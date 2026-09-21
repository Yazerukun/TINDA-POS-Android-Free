// Inventory: receiving (restock), withdrawals, movement history, batches and
// expiration tracking. All quantities are integer base units.

import type {
  ExpirationEntry,
  InventoryMovement,
  InventoryMovementType,
  Product,
  StockReceivingRecord,
  StockReceivingSource,
  WithdrawalReason
} from '@shared/types'
import { db } from './db'
import { applyStockChange, hydrateProduct } from './catalog'
import { audit, emitInventoryChanged, insertRow, localDateKey, nowIso, num, requireSessionUser, text } from './util'

function conversionFor(product: Product, unitName: string): number {
  const target = text(unitName).toLowerCase()
  const unit = product.units?.find((entry) => entry.name.toLowerCase() === target)
  if (unit && num(unit.conversion_to_base, 1) > 0) return num(unit.conversion_to_base, 1)
  if (target === text(product.base_unit).toLowerCase()) return 1
  return 1
}

const WITHDRAWAL_TYPES: Record<WithdrawalReason, InventoryMovementType> = {
  TAKEN: 'WITHDRAWAL',
  DAMAGED: 'DAMAGE',
  EXPIRED: 'EXPIRATION',
  FORWARD: 'ADJUSTMENT'
}

export async function listMovements(opts: {
  product_id?: number
  movement_type?: InventoryMovementType | ''
  limit?: number
  offset?: number
  from?: string
  to?: string
} = {}): Promise<{ rows: InventoryMovement[]; total: number }> {
  const all = await db.movements.toArray()
  const filtered = all
    .filter((movement) => (opts.product_id ? movement.product_id === opts.product_id : true))
    .filter((movement) => (opts.movement_type ? movement.movement_type === opts.movement_type : true))
    .filter((movement) => (opts.from ? movement.created_at >= opts.from : true))
    .filter((movement) => (opts.to ? movement.created_at <= opts.to : true))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const offset = opts.offset ?? 0
  return { rows: filtered.slice(offset, offset + (opts.limit ?? 200)), total: filtered.length }
}

export async function listReceiving(opts: {
  search?: string
  from?: string
  to?: string
  supplier_id?: number
  source?: StockReceivingSource | ''
  limit?: number
  offset?: number
} = {}): Promise<{ rows: StockReceivingRecord[]; total: number; total_cost_c: number }> {
  const all = await db.receiving.toArray()
  const filtered = all
    .filter((record) => (opts.supplier_id ? record.supplier_id === opts.supplier_id : true))
    .filter((record) => (opts.source ? record.source === opts.source : true))
    .filter((record) => (opts.search ? record.product_name.toLowerCase().includes(opts.search.toLowerCase()) : true))
    .filter((record) => (opts.from ? record.created_at >= opts.from : true))
    .filter((record) => (opts.to ? record.created_at <= opts.to : true))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const offset = opts.offset ?? 0
  return {
    rows: filtered.slice(offset, offset + (opts.limit ?? 200)),
    total: filtered.length,
    total_cost_c: filtered.reduce((sum, record) => sum + num(record.total_cost_c), 0)
  }
}

async function recordReceiving(input: {
  product: Product
  previousStock: number
  newStock: number
  quantityReceived: number
  receivedUnit: string
  baseQuantity: number
  unitCostC: number | null
  supplierId: number | null
  reference: string | null
  notes: string | null
  source: StockReceivingSource
  userName: string
}): Promise<void> {
  const supplier = input.supplierId ? await db.suppliers.get(input.supplierId) : null
  const totalCost = input.unitCostC !== null ? input.unitCostC * input.quantityReceived : null
  await insertRow(db.receiving, {
    product_id: input.product.id,
    product_name: input.product.name,
    quantity_received: input.quantityReceived,
    received_unit: input.receivedUnit,
    base_quantity: input.baseQuantity,
    base_unit: input.product.base_unit,
    previous_stock: input.previousStock,
    new_stock: input.newStock,
    supplier_id: input.supplierId,
    supplier_name: supplier?.name ?? null,
    unit_cost_c: input.unitCostC,
    total_cost_c: totalCost,
    reference: input.reference,
    notes: input.notes,
    received_by: input.userName,
    source: input.source,
    created_at: nowIso()
  })
}

export async function restock(input: {
  product_id: number
  quantity: number
  unit_name: string
  supplier_id?: number | null
  cost_c: number
  reference?: string | null
  notes?: string | null
  expiration_date?: string | null
  batch_label?: string | null
}): Promise<InventoryMovement> {
  const session = await requireSessionUser()
  const product = await db.products.get(input.product_id)
  if (!product) throw new Error('Product not found.')
  const quantity = num(input.quantity)
  if (quantity <= 0) throw new Error('Quantity must be greater than zero.')
  const unitName = text(input.unit_name) || product.base_unit
  const conversion = conversionFor(await hydrateProduct(product), unitName)
  const baseQuantity = Math.round(quantity * conversion)
  const costC = num(input.cost_c)
  const previousStock = num(product.stock)

  const movement = await applyStockChange({
    product,
    delta: baseQuantity,
    unit: unitName,
    movement_type: 'PURCHASE',
    reason: input.reference ? `Restock ${input.reference}` : 'Restock',
    reference: input.reference ?? null,
    user_id: session.id
  })

  if (costC > 0) {
    await db.products.update(product.id, { purchase_cost_c: Math.round(costC / conversion), updated_at: nowIso() })
  }

  if (input.expiration_date) {
    await db.products.update(product.id, {
      expiration_date: input.expiration_date,
      has_expiration: true,
      expiration_mode: 'ITEM'
    })
  }
  const refreshed = await db.products.get(product.id)
  await recordReceiving({
    product: refreshed ?? product,
    previousStock,
    newStock: num(refreshed?.stock ?? previousStock + baseQuantity),
    quantityReceived: quantity,
    receivedUnit: unitName,
    baseQuantity,
    unitCostC: costC > 0 ? Math.round(costC) : null,
    supplierId: input.supplier_id ?? product.supplier_id ?? null,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    source: 'RESTOCK',
    userName: session.full_name
  })
  emitInventoryChanged('RESTOCK', [product.id])
  await audit({ action: 'INVENTORY_RESTOCK', entity_type: 'product', entity_id: product.id, new_value: `+${baseQuantity} ${product.base_unit}` })
  return movement
}

export async function withdraw(input: {
  product_id: number
  quantity: number
  unit_name: string
  reason: WithdrawalReason
  notes?: string | null
  batch_id?: number | null
}): Promise<InventoryMovement> {
  const session = await requireSessionUser()
  const product = await db.products.get(input.product_id)
  if (!product) throw new Error('Product not found.')
  const quantity = num(input.quantity)
  if (quantity <= 0) throw new Error('Quantity must be greater than zero.')
  const unitName = text(input.unit_name) || product.base_unit
  const conversion = conversionFor(await hydrateProduct(product), unitName)
  const baseQuantity = Math.round(quantity * conversion)
  const movement = await applyStockChange({
    product,
    delta: -baseQuantity,
    unit: unitName,
    movement_type: WITHDRAWAL_TYPES[input.reason] ?? 'WITHDRAWAL',
    reason: input.reason,
    reference: input.notes ?? null,
    user_id: session.id
  })
  if (input.batch_id) {
    const batch = await db.batches.get(input.batch_id)
    if (batch) await db.batches.update(batch.id, { quantity: Math.max(0, num(batch.quantity) - baseQuantity) })
  }
  emitInventoryChanged('ADJUSTMENT', [product.id])
  await audit({ action: 'INVENTORY_WITHDRAW', entity_type: 'product', entity_id: product.id, reason: input.reason, new_value: `-${baseQuantity} ${product.base_unit}` })
  return movement
}

export async function adjust(input: { product_id: number; qty_base: number; reason: string }): Promise<InventoryMovement> {
  const session = await requireSessionUser()
  const product = await db.products.get(input.product_id)
  if (!product) throw new Error('Product not found.')
  const movement = await applyStockChange({
    product,
    delta: Math.trunc(num(input.qty_base)),
    unit: product.base_unit,
    movement_type: 'ADJUSTMENT',
    reason: input.reason,
    user_id: session.id
  })
  emitInventoryChanged('ADJUSTMENT', [product.id])
  return movement
}

export async function countStock(input: { product_id: number; actual_base: number; notes?: string }): Promise<InventoryMovement> {
  const session = await requireSessionUser()
  const product = await db.products.get(input.product_id)
  if (!product) throw new Error('Product not found.')
  const delta = Math.trunc(num(input.actual_base)) - num(product.stock)
  const movement = await applyStockChange({
    product,
    delta,
    unit: product.base_unit,
    movement_type: 'ADJUSTMENT',
    reason: input.notes ? `Stock count: ${input.notes}` : 'Stock count',
    user_id: session.id
  })
  emitInventoryChanged('ADJUSTMENT', [product.id])
  return movement
}

export async function receive(input: { product_id: number; qty_base: number; unit_name: string; cost_c: number; reason?: string }): Promise<InventoryMovement> {
  return restock({
    product_id: input.product_id,
    quantity: num(input.qty_base),
    unit_name: input.unit_name,
    cost_c: num(input.cost_c),
    reference: input.reason ?? null
  })
}

export async function movement(
  type: InventoryMovementType,
  input: { product_id: number; qty_base: number; reason?: string; notes?: string }
): Promise<InventoryMovement> {
  const session = await requireSessionUser()
  const product = await db.products.get(input.product_id)
  if (!product) throw new Error('Product not found.')
  const delta = Math.trunc(num(input.qty_base))
  const result = await applyStockChange({
    product,
    delta: type === 'SALE' ? -Math.abs(delta) : delta,
    unit: product.base_unit,
    movement_type: type,
    reason: input.reason ?? null,
    reference: input.notes ?? null,
    user_id: session.id
  })
  emitInventoryChanged('ADJUSTMENT', [product.id])
  return result
}

export async function setBatchDate(id: number, date: string): Promise<void> {
  const batch = await db.batches.get(id)
  if (!batch) throw new Error('Batch not found.')
  await db.batches.update(id, { expiration_date: date || null })
  await audit({ action: 'BATCH_DATE', entity_type: 'batch', entity_id: id, new_value: date })
}

/** Expiring/expired stock, earliest first — used by the alerts strip. */
export async function expirationEntries(): Promise<ExpirationEntry[]> {
  const products = await db.products.toArray()
  const entries: ExpirationEntry[] = []
  for (const product of products) {
    if (product.status === 'ARCHIVED') continue
    if (product.expiration_date) {
      entries.push({
        product_id: product.id,
        product_name: product.name,
        base_unit: product.base_unit,
        batch_id: null,
        label: 'Product Expiry',
        expiration_date: product.expiration_date,
        quantity: num(product.stock)
      })
    }
  }
  return entries.sort((a, b) => (a.expiration_date ?? '9999') < (b.expiration_date ?? '9999') ? -1 : 1)
}

/** FEFO deduction: oldest expiration first, then the product's own stock. */
export async function deductBatches(product: Product, baseQuantity: number): Promise<void> {
  if (!product.has_expiration) return
  const batches = (await db.batches.where('product_id').equals(product.id).toArray())
    .filter((batch) => num(batch.quantity) > 0)
    .sort((a, b) => (a.expiration_date ?? '9999') < (b.expiration_date ?? '9999') ? -1 : 1)
  let remaining = baseQuantity
  for (const batch of batches) {
    if (remaining <= 0) break
    const take = Math.min(num(batch.quantity), remaining)
    await db.batches.update(batch.id, { quantity: num(batch.quantity) - take })
    remaining -= take
  }
}

/** Restores stock from a refund/void (batches are not re-created). */
export async function restoreStock(product: Product, baseQuantity: number): Promise<void> {
  const current = await db.products.get(product.id)
  if (!current) return
  await db.products.update(product.id, { stock: num(current.stock) + baseQuantity, updated_at: nowIso() })
}
