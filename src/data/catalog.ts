// Categories, products (with their selling units), suppliers and CSV import.

import type {
  Category,
  Product,
  ProductInput,
  ProductStatus,
  ProductUnit,
  Purchase,
  StockBatch,
  StockStatus,
  Supplier
} from '@shared/types'
import { db } from './db'
import { audit, cents, currentSessionUser, emitInventoryChanged, insertRow, localDateKey, matches, nowIso, num, text } from './util'
import { getSettings } from './system'

export function stockStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return 'OUT_OF_STOCK'
  if (threshold > 0 && stock <= threshold) return 'LOW_STOCK'
  return 'IN_STOCK'
}

export function parseCsv(textContent: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let quoted = false
  const source = textContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''))
}

function parseMoneyToCents(value: string): number {
  return Math.round(num(value) * 100)
}

function defaultUnit(name: string, priceC: number, barcode: string | null): ProductUnit {
  return { id: 0, product_id: 0, name: name || 'pc', conversion_to_base: 1, barcode, selling_price_c: priceC, is_default: true }
}

export function normalizeUnits(name: string, priceC: number, barcode: string | null, input: ProductInput['units']): ProductUnit[] {
  const cleaned = (input ?? [])
    .filter((unit) => text(unit?.name) !== '')
    .map((unit, index) => ({
      id: index + 1,
      product_id: 0,
      name: text(unit.name),
      conversion_to_base: num(unit.conversion_to_base, 1) > 0 ? num(unit.conversion_to_base, 1) : 1,
      barcode: unit.barcode ? text(unit.barcode) : null,
      selling_price_c: cents(unit.selling_price_c),
      is_default: Boolean(unit.is_default)
    }))
  if (!cleaned.length) return [{ ...defaultUnit(name, priceC, barcode), id: 1 }]
  if (!cleaned.some((unit) => unit.is_default)) cleaned[0]!.is_default = true
  return cleaned
}

/** Reads a product back with its category name, unit list, stock status and sellable stock. */
export async function hydrateProduct(product: Product, batches?: StockBatch[]): Promise<Product> {
  const category = product.category_id ? await db.categories.get(product.category_id) : null
  const stock = num(product.stock)
  const isExpired = Boolean(product.expiration_date && product.expiration_date < localDateKey())
  const sellable = isExpired ? 0 : stock
  const expMode = product.expiration_date ? 'ITEM' : (product.expiration_mode ?? (product.has_expiration ? 'ITEM' : 'NONE'))
  return {
    ...product,
    stock,
    category_name: category?.name ?? null,
    units: normalizeUnits(product.name, num(product.default_price_c), product.barcode, product.units),
    stock_status: stockStatus(stock, num(product.low_stock_threshold)),
    sellable_stock: sellable,
    expiration_mode: expMode,
    batches: undefined
  }
}

export async function listCategories(): Promise<Category[]> {
  const rows = await db.categories.toArray()
  // Ensure all rows have parent_id (old rows pre-v4 won't have it)
  return rows
    .map((c) => ({ ...c, parent_id: c.parent_id ?? null }))
    .sort((a, b) => {
      // Sort: parents first (parent_id=null), then children under their parent
      const aParent = a.parent_id ?? 0
      const bParent = b.parent_id ?? 0
      if (aParent !== bParent) return aParent - bParent
      return a.name.localeCompare(b.name)
    })
}

export async function createCategory(name: string, parentId?: number | null): Promise<Category> {
  const clean = text(name)
  if (!clean) throw new Error('Category name is required.')
  const existing = await db.categories.where('name').equals(clean).first()
  if (existing) return { ...existing, parent_id: existing.parent_id ?? null }
  const row = await insertRow(db.categories, { name: clean, parent_id: parentId ?? null, created_at: nowIso() })
  await audit({ action: 'CATEGORY_CREATE', entity_type: 'category', entity_id: row.id, new_value: clean })
  return { ...row, parent_id: row.parent_id ?? null }
}

export async function removeCategory(id: number): Promise<void> {
  const category = await db.categories.get(id)
  if (!category) return
  const affected = await db.products.where('category_id').equals(id).toArray()
  for (const product of affected) await db.products.update(product.id, { category_id: null })
  await db.categories.delete(id)
  await audit({ action: 'CATEGORY_DELETE', entity_type: 'category', entity_id: id, old_value: category.name })
}

async function nextSku(): Promise<string> {
  const count = await db.products.count()
  let candidate = `SKU-${String(count + 1).padStart(4, '0')}`
  let guard = 0
  while (await db.products.where('sku').equals(candidate).first()) {
    guard++
    candidate = `SKU-${String(count + 1 + guard).padStart(4, '0')}`
  }
  return candidate
}

export async function searchProducts(
  query: string,
  opts: { category_id?: number | null; status?: string; limit?: number; offset?: number } = {}
): Promise<{ rows: Product[]; total: number }> {
  const all = await db.products.toArray()
  const batches = await db.batches.toArray()
  const cleanQ = (query ?? '').trim()
  const unpaddedQ = cleanQ.replace(/^0+/, '')
  const filtered = all
    .filter((product) => (opts.status ? product.status === (opts.status as ProductStatus) : product.status !== 'ARCHIVED'))
    .filter((product) => (opts.category_id ? product.category_id === opts.category_id : true))
    .filter((product) => {
      if (!cleanQ) return true
      if (matches(product.name, cleanQ) || matches(product.sku, cleanQ) || matches(product.barcode, cleanQ)) return true
      if (product.units?.some((u) => matches(u.barcode, cleanQ) || matches(u.name, cleanQ))) return true
      if (unpaddedQ) {
        const prodBarcode = (product.barcode ?? '').replace(/^0+/, '')
        if (prodBarcode && prodBarcode.toLowerCase() === unpaddedQ.toLowerCase()) return true
        if (product.units?.some((u) => (u.barcode ?? '').replace(/^0+/, '').toLowerCase() === unpaddedQ.toLowerCase())) return true
      }
      return false
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const total = filtered.length
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 200
  const slice = filtered.slice(offset, offset + limit)
  const rows = await Promise.all(
    slice.map((product) => hydrateProduct(product, batches.filter((batch) => batch.product_id === product.id)))
  )
  return { rows, total }
}

export async function getProduct(id: number): Promise<Product> {
  const product = await db.products.get(id)
  if (!product) throw new Error('Product not found.')
  return hydrateProduct(product)
}

export async function countProducts(status?: string): Promise<number> {
  if (!status) return db.products.count()
  return (await db.products.toArray()).filter((product) => product.status === status).length
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const settings = await getSettings()
  const name = text(input.name)
  if (!name) throw new Error('Product name is required.')
  const sku = text(input.sku) || (await nextSku())
  const duplicate = await db.products.where('sku').equals(sku).first()
  if (duplicate) throw new Error(`SKU ${sku} already exists.`)
  const now = nowIso()
  const row: Omit<Product, 'id'> = {
    category_id: input.category_id ?? null,
    category_name: null,
    name,
    sku,
    barcode: input.barcode ? text(input.barcode) : null,
    description: input.description ?? null,
    base_unit: text(input.base_unit) || 'pc',
    purchase_cost_c: cents(input.purchase_cost_c),
    default_price_c: cents(input.default_price_c),
    stock: Math.trunc(num(input.initial_stock_base ?? 0)),
    low_stock_threshold: num(input.low_stock_threshold ?? settings.default_low_stock, settings.default_low_stock),
    supplier_id: input.supplier_id ?? null,
    has_expiration: Boolean(input.expiration_date),
    expiration_mode: input.expiration_date ? 'ITEM' : 'NONE',
    expiration_date: input.expiration_date ?? null,
    image_path: null,
    status: 'ACTIVE',
    notes: input.notes ?? null,
    units: [],
    stock_status: 'IN_STOCK',
    created_at: now,
    updated_at: now
  }
  row.units = normalizeUnits(row.name, row.default_price_c, row.barcode, input.units).map((unit) => ({ ...unit, product_id: 0 }))
  if (row.barcode && row.units.length > 0 && !row.units[0].barcode) {
    row.units[0].barcode = row.barcode
  }
  const created = await insertRow(db.products, row)
  const id = created.id
  const units = created.units.map((unit) => ({ ...unit, product_id: id }))
  await db.products.update(id, { units })
  const initial = Math.trunc(num(input.initial_stock_base ?? 0))
  if (initial > 0) {
    const session = await currentSessionUser()
    const movement = {
      product_id: id,
      quantity_before: 0,
      quantity_change: initial,
      quantity_after: initial,
      unit: row.base_unit,
      movement_type: 'INITIAL_STOCK' as const,
      reason: 'Opening stock',
      reference: null,
      user_id: session?.id ?? 0,
      created_at: now
    }
    await insertRow(db.movements, movement)

    if (row.expiration_mode === 'BATCH') {
      await insertRow(db.batches, {
        product_id: id,
        batch_number: 'BATCH-INITIAL',
        label: 'Opening stock',
        quantity: initial,
        expiration_date: input.expiration_date ?? null,
        created_at: now
      })
    }
  }
  emitInventoryChanged('RESTOCK', [id])
  await audit({ action: 'PRODUCT_CREATE', entity_type: 'product', entity_id: id, new_value: name })
  return getProduct(id)
}

export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  const product = await db.products.get(id)
  if (!product) throw new Error('Product not found.')
  const patch: Partial<Product> = { updated_at: nowIso() }
  if (input.name !== undefined) patch.name = text(input.name)
  if (input.sku !== undefined && text(input.sku)) patch.sku = text(input.sku)
  if (input.barcode !== undefined) patch.barcode = input.barcode ? text(input.barcode) : null
  if (input.description !== undefined) patch.description = input.description
  if (input.category_id !== undefined) patch.category_id = input.category_id
  if (input.base_unit !== undefined && text(input.base_unit)) patch.base_unit = text(input.base_unit)
  if (input.purchase_cost_c !== undefined) patch.purchase_cost_c = cents(input.purchase_cost_c)
  if (input.default_price_c !== undefined) patch.default_price_c = cents(input.default_price_c)
  if (input.low_stock_threshold !== undefined) patch.low_stock_threshold = num(input.low_stock_threshold)
  if (input.supplier_id !== undefined) patch.supplier_id = input.supplier_id
  if (input.expiration_date !== undefined) {
    patch.expiration_date = input.expiration_date || null
    patch.has_expiration = Boolean(input.expiration_date)
    patch.expiration_mode = input.expiration_date ? 'ITEM' : 'NONE'
  } else if (input.has_expiration !== undefined) {
    patch.has_expiration = Boolean(input.has_expiration)
    if (input.expiration_mode !== undefined) patch.expiration_mode = input.expiration_mode
  }
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.units !== undefined) {
    patch.units = normalizeUnits(text(patch.name ?? product.name), cents(patch.default_price_c ?? product.default_price_c), patch.barcode ?? product.barcode, input.units).map((unit) => ({ ...unit, product_id: id }))
    const activeBarcode = patch.barcode ?? product.barcode
    if (activeBarcode && patch.units.length > 0 && !patch.units[0].barcode) {
      patch.units[0].barcode = activeBarcode
    }
  }
  await db.products.update(id, patch)
  await audit({ action: 'PRODUCT_UPDATE', entity_type: 'product', entity_id: id, new_value: patch.name ?? product.name })
  return getProduct(id)
}

export async function archiveProduct(id: number, status: ProductStatus = 'ARCHIVED'): Promise<Product> {
  const product = await db.products.get(id)
  if (!product) throw new Error('Product not found.')
  await db.products.update(id, { status, updated_at: nowIso() })
  await audit({ action: status === 'ARCHIVED' ? 'PRODUCT_ARCHIVE' : 'PRODUCT_RESTORE', entity_type: 'product', entity_id: id, old_value: product.status, new_value: status })
  return getProduct(id)
}

/** Applies a stock delta, records the movement and refreshes the product row. */
export async function applyStockChange(input: {
  product: Product
  delta: number
  unit: string
  movement_type: import('@shared/types').InventoryMovementType
  reason?: string | null
  reference?: string | null
  user_id?: number
  allow_negative?: boolean
}): Promise<import('@shared/types').InventoryMovement> {
  const before = num(input.product.stock)
  const after = before + input.delta
  if (after < 0 && !input.allow_negative) {
    throw new Error(`Not enough stock for ${input.product.name}. Available: ${before} ${input.product.base_unit}.`)
  }
  await db.products.update(input.product.id, { stock: after, updated_at: nowIso() })
  return insertRow(db.movements, {
    product_id: input.product.id,
    quantity_before: before,
    quantity_change: input.delta,
    quantity_after: after,
    unit: input.unit,
    movement_type: input.movement_type,
    reason: input.reason ?? null,
    reference: input.reference ?? null,
    user_id: input.user_id ?? 0,
    created_at: nowIso()
  })
}

export async function listSuppliers(opts: { status?: string; search?: string } = {}): Promise<Supplier[]> {
  const rows = await db.suppliers.toArray()
  return rows
    .filter((supplier) => (opts.status ? supplier.status === opts.status : true))
    .filter((supplier) => matches(supplier.name, opts.search ?? '') || matches(supplier.contact_person, opts.search ?? ''))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createSupplier(input: Partial<Supplier>): Promise<Supplier> {
  const name = text(input.name)
  if (!name) throw new Error('Supplier name is required.')
  const now = nowIso()
  const row = await insertRow(db.suppliers, {
    name,
    contact_person: input.contact_person ? text(input.contact_person) : null,
    phone: input.phone ? text(input.phone) : null,
    address: input.address ? text(input.address) : null,
    notes: input.notes ? text(input.notes) : null,
    status: input.status ?? 'ACTIVE',
    created_at: now,
    updated_at: now
  })
  await audit({ action: 'SUPPLIER_CREATE', entity_type: 'supplier', entity_id: row.id, new_value: name })
  return row
}

export async function updateSupplier(id: number, input: Partial<Supplier>): Promise<Supplier> {
  const row = await db.suppliers.get(id)
  if (!row) throw new Error('Supplier not found.')
  const patch: Partial<Supplier> = { updated_at: nowIso() }
  if (input.name !== undefined) patch.name = text(input.name)
  if (input.contact_person !== undefined) patch.contact_person = input.contact_person
  if (input.phone !== undefined) patch.phone = input.phone
  if (input.address !== undefined) patch.address = input.address
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.status !== undefined) patch.status = input.status
  await db.suppliers.update(id, patch)
  return { ...row, ...patch } as Supplier
}

export async function supplierProducts(id: number): Promise<Product[]> {
  const rows = await db.products.where('supplier_id').equals(id).toArray()
  return Promise.all(rows.map((product) => hydrateProduct(product)))
}

/** Supplier purchase history is not recorded yet in the Android build. */
export async function supplierPurchases(): Promise<Purchase[]> {
  return []
}

export const CSV_HEADERS = ['name', 'sku', 'barcode', 'category', 'base_unit', 'purchase_cost', 'default_price', 'initial_stock', 'low_stock_threshold']

export async function csvTemplate(): Promise<string> {
  const example = ['Coke Sakto 200ml', 'SKU-1001', '4801234567890', 'Drinks', 'pc', '14.50', '20.00', '48', '6']
  return `${CSV_HEADERS.join(',')}\n${example.join(',')}\n`
}

interface CsvPreviewRow extends Record<string, unknown> {
  row_number: number
  product_name: string
  valid: boolean
  duplicate: boolean
  reasons: string[]
}

export async function previewCsv(content: string): Promise<{
  rows: CsvPreviewRow[]
  total: number
  valid: number
  invalid: number
  duplicates: number
}> {
  const table = parseCsv(content)
  if (!table.length) throw new Error('The CSV file is empty.')
  const header = table[0]!.map((cell) => cell.trim().toLowerCase())
  const index = (name: string): number => header.indexOf(name)
  if (index('name') < 0) throw new Error('The CSV must have a "name" column. Download the template to start.')
  const existing = await db.products.toArray()
  const rows: CsvPreviewRow[] = []
  table.slice(1).forEach((cells, offset) => {
    const value = (name: string): string => (index(name) >= 0 ? text(cells[index(name)]) : '')
    const name = value('name')
    const sku = value('sku')
    const barcode = value('barcode')
    const reasons: string[] = []
    if (!name) reasons.push('Missing product name')
    const duplicate =
      Boolean(sku) && existing.some((product) => product.sku.toLowerCase() === sku.toLowerCase())
    if (num(value('default_price')) <= 0) reasons.push('Selling price must be greater than zero')
    if (value('initial_stock') && !Number.isInteger(num(value('initial_stock')))) reasons.push('Initial stock must be a whole number')
    rows.push({
      row_number: offset + 2,
      product_name: name,
      sku,
      barcode,
      category: value('category'),
      base_unit: value('base_unit') || 'pc',
      purchase_cost: value('purchase_cost'),
      default_price: value('default_price'),
      initial_stock: value('initial_stock') || '0',
      valid: reasons.length === 0,
      duplicate,
      reasons
    })
  })
  const valid = rows.filter((row) => row.valid).length
  return {
    rows,
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    duplicates: rows.filter((row) => row.duplicate).length
  }
}

export async function importCsv(content: string, strategy: 'SKIP' | 'UPDATE'): Promise<{ created: number; updated: number; skipped: number; product_ids: number[] }> {
  const preview = await previewCsv(content)
  if (preview.invalid > 0) throw new Error('Fix the invalid rows before importing.')
  let created = 0
  let updated = 0
  let skipped = 0
  const productIds: number[] = []
  for (const row of preview.rows) {
    const name = text(row.product_name)
    const sku = text(row.sku)
    const existing = sku ? await db.products.where('sku').equals(sku).first() : undefined
    const categoryName = text(row.category as string)
    let categoryId: number | null = null
    if (categoryName) {
      const category = (await db.categories.where('name').equals(categoryName).first()) ?? (await createCategory(categoryName))
      categoryId = category.id
    }
    const priceC = parseMoneyToCents(String(row.default_price ?? '0'))
    const costC = parseMoneyToCents(String(row.purchase_cost ?? '0'))
    const stock = Math.trunc(num(row.initial_stock))
    if (existing) {
      if (strategy === 'SKIP') {
        skipped++
        continue
      }
      await updateProduct(existing.id, {
        name,
        category_id: categoryId,
        base_unit: text(row.base_unit as string) || existing.base_unit,
        purchase_cost_c: costC,
        default_price_c: priceC
      })
      updated++
      productIds.push(existing.id)
      continue
    }
    const product = await createProduct({
      category_id: categoryId,
      name,
      sku,
      barcode: text(row.barcode as string) || null,
      description: null,
      base_unit: text(row.base_unit as string) || 'pc',
      purchase_cost_c: costC,
      default_price_c: priceC,
      supplier_id: null,
      has_expiration: false,
      expiration_mode: 'NONE',
      notes: null,
      units: [{ name: text(row.base_unit as string) || 'pc', conversion_to_base: 1, barcode: null, selling_price_c: priceC, is_default: true }],
      initial_stock_base: stock
    })
    created++
    productIds.push(product.id)
  }
  emitInventoryChanged('CSV_IMPORT', productIds)
  await audit({ action: 'PRODUCT_CSV_IMPORT', entity_type: 'product', new_value: `${created} created / ${updated} updated / ${skipped} skipped` })
  return { created, updated, skipped, product_ids: productIds }
}
