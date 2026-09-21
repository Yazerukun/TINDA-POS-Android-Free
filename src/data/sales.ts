// Sales: held carts, checkout (stock, payments, utang), receipt lines, refunds,
// voids and transaction history. Money is integer centavos; stock is base units.

import type { HeldSale, HeldSaleItem, Payment, Product, Refund, Sale, SaleItem } from '@shared/types'
import type { CheckoutPayload, PrintResult, RefundPayload, VoidPayload } from '@shared/ipc'
import { db } from './db'
import { deductBatches, restoreStock } from './stock'
import { applyCreditEntry } from './people'
import { getSettings } from './system'
import { audit, cents, currentSessionUser, dayEndIso, dayStartIso, emitInventoryChanged, insertRow, localDateKey, money, matches, nextSequence, nowIso, num, plainMoney, requireSessionUser, text } from './util'
import { autoPrintAfterCheckout, printSaleReceipt } from './printerService'

const NO_PRINTER: PrintResult = {
  ok: false,
  code: 'NO_PRINTER',
  message: 'No receipt printer is configured.'
}

export async function transactionNo(): Promise<string> {
  const sequence = await nextSequence(`sale_seq_${localDateKey()}`)
  return `${localDateKey().replace(/-/g, '')}-${String(sequence).padStart(4, '0')}`
}

/** Plain receipt lines consumed by shared/receiptHtml.ts (and the preview). */
export async function buildReceiptLines(sale: Sale): Promise<string[]> {
  const settings = await getSettings()
  const lines: string[] = []
  lines.push(settings.store_name || 'TINDA POS')
  if (settings.receipt_header) lines.push(settings.receipt_header)
  if (settings.receipt_show_app_name) lines.push(settings.receipt_title || 'TINDA POS')
  if (settings.address) lines.push(settings.address)
  if (settings.phone) lines.push(settings.phone)
  if (settings.tin) lines.push(`TIN: ${settings.tin}`)
  if (settings.receipt_gcash_no) lines.push(`GCash: ${settings.receipt_gcash_no}`)
  if (settings.receipt_maya_no) lines.push(`Maya: ${settings.receipt_maya_no}`)
  lines.push('--------------------------------')
  lines.push(`No: ${sale.transaction_no}`)
  lines.push(`Date: ${new Date(sale.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`)
  lines.push(`Cashier: ${sale.cashier_name}`)
  if (sale.customer_name) lines.push(`Customer: ${sale.customer_name}`)
  lines.push('--------------------------------')
  for (const item of sale.items) {
    // Name row + "qty x unit price   amount" detail row (see shared/receiptHtml.ts).
    lines.push(item.product_name)
    lines.push(`${item.qty} x ${plainMoney(item.unit_price_c)} ${plainMoney(item.subtotal_c)}`)
  }
  lines.push('--------------------------------')
  lines.push(`Subtotal ${money(sale.subtotal_c)}`)
  if (sale.discount_c > 0) lines.push(`Discount ${money(sale.discount_c)}`)
  lines.push(`TOTAL ${money(sale.total_c)}`)
  for (const payment of sale.payments) {
    const label = payment.method === 'CASH' ? 'Cash' : payment.method === 'GCASH' ? 'GCash' : payment.method === 'MAYA' ? 'Maya' : 'Utang'
    lines.push(`${label} ${money(payment.amount_c)}`)
  }
  const nonCash = sale.payments.filter((payment) => payment.method !== 'CASH').reduce((sum, payment) => sum + num(payment.amount_c), 0)
  const cashTendered = sale.payments.filter((payment) => payment.method === 'CASH').reduce((sum, payment) => sum + num(payment.amount_c), 0)
  const cashApplied = Math.max(0, sale.total_c - nonCash)
  const sukli = Math.max(0, cashTendered - cashApplied)
  if (sukli > 0) lines.push(`SUKLI ${money(sukli)}`)
  lines.push('--------------------------------')
  if (settings.receipt_footer) lines.push(settings.receipt_footer)
  lines.push(`Items: ${sale.items.reduce((sum, item) => sum + num(item.qty), 0)}`)
  return lines
}

export async function checkout(payload: CheckoutPayload): Promise<{ sale: Sale; receipt: string[]; print: PrintResult }> {
  const session = await requireSessionUser()
  const settings = await getSettings()
  if (!payload.items?.length) throw new Error('The cart is empty.')

  const subtotal = payload.items.reduce((sum, item) => sum + cents(item.subtotal_c), 0)
  const discount = Math.max(0, cents(payload.discount_c))
  const total = Math.max(0, subtotal - discount)

  const payments = (payload.payments ?? []).map((payment) => ({ ...payment, amount_c: cents(payment.amount_c) }))
  const tendered = payments.reduce((sum, payment) => sum + payment.amount_c, 0)
  if (tendered < total) throw new Error(`Payment is short by ${money(total - tendered)}.`)

  const needsCustomer = payments.some((payment) => payment.method === 'UTANG')
  const customerId = payload.customer_id ?? null
  if (needsCustomer && !customerId) throw new Error('Select a customer for this utang.')
  const customer = customerId ? await db.customers.get(customerId) : null
  if (needsCustomer && !customer) throw new Error('Customer not found.')

  // Stock guard before any write, so a failed sale never half-applies.
  const products = new Map<number, Product>()
  for (const item of payload.items) {
    if (item.product_id === null) continue
    const product = await db.products.get(item.product_id)
    if (!product) throw new Error(`${item.name} is no longer available.`)
    products.set(product.id, product)
    const available = num(product.stock)
    if (!settings.allow_negative_inventory && num(item.qty_base) > available) {
      throw new Error(`Not enough stock for ${product.name}. Available: ${available} ${product.base_unit}.`)
    }
  }

  const now = nowIso()
  const shift = await db.shifts.where('status').equals('OPENED').first()
  const sale = await insertRow(db.sales, {
    transaction_no: await transactionNo(),
    user_id: session.id,
    cashier_name: session.full_name,
    customer_id: customerId,
    customer_name: customer?.full_name ?? null,
    subtotal_c: subtotal,
    discount_c: discount,
    total_c: total,
    status: 'COMPLETED',
    shift_id: shift?.id ?? null,
    notes: payload.notes ?? null,
    created_at: now,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    items: [],
    payments: []
  })
  const saleId = sale.id

  const items: SaleItem[] = payload.items.map((item, index) => ({
    id: index + 1,
    sale_id: saleId,
    product_id: item.product_id,
    product_name: item.name,
    unit_name: item.unit_name,
    qty: num(item.qty),
    qty_base: Math.round(num(item.qty_base)),
    unit_price_c: cents(item.unit_price_c),
    subtotal_c: cents(item.subtotal_c),
    cost_base_c: cents(item.cost_base_c),
    refunded_qty_base: 0
  }))
  const paymentRows: Payment[] = payments.map((payment, index) => ({
    id: index + 1,
    sale_id: saleId,
    method: payment.method,
    amount_c: payment.amount_c,
    reference: payment.reference ?? null,
    created_at: now
  }))
  await db.sales.update(saleId, { transaction_no: sale.transaction_no, items, payments: paymentRows })

  // Stock: deduct, record a movement, and burn batches first-in-first-out.
  const touched: number[] = []
  for (const item of items) {
    if (item.product_id === null) continue
    const product = products.get(item.product_id)
    if (!product) continue
    const before = num(product.stock)
    const after = before - item.qty_base
    await db.products.update(product.id, { stock: after, updated_at: nowIso() })
    await insertRow(db.movements, {
      product_id: product.id,
      quantity_before: before,
      quantity_change: -item.qty_base,
      quantity_after: after,
      unit: item.unit_name,
      movement_type: 'SALE',
      reason: sale.transaction_no,
      reference: sale.transaction_no,
      user_id: session.id,
      created_at: now
    })
    await deductBatches(product, item.qty_base)
    touched.push(product.id)
  }

  // Utang: one ledger entry per credit payment.
  let utangTotal = 0
  for (const payment of paymentRows) {
    if (payment.method !== 'UTANG' || !customerId) continue
    utangTotal += payment.amount_c
    await applyCreditEntry({
      customer_id: customerId,
      entry_type: 'CREDIT_SALE',
      amount_c: payment.amount_c,
      reference_type: 'SALE',
      reference_id: saleId,
      notes: sale.transaction_no,
      user_id: session.id
    })
  }

  // Shift counters keep the sale portion of each payment (change is not revenue).
  if (shift) {
    const cashApplied = Math.max(0, total - paymentRows.filter((payment) => payment.method !== 'CASH').reduce((sum, payment) => sum + payment.amount_c, 0))
    const gcash = paymentRows.filter((payment) => payment.method === 'GCASH').reduce((sum, payment) => sum + payment.amount_c, 0)
    const maya = paymentRows.filter((payment) => payment.method === 'MAYA').reduce((sum, payment) => sum + payment.amount_c, 0)
    const applied = Math.min(cashApplied, total - gcash - maya - utangTotal)
    await db.shifts.update(shift.id, {
      cash_sales_c: num(shift.cash_sales_c) + Math.max(0, applied),
      gcash_c: num(shift.gcash_c) + gcash,
      maya_c: num(shift.maya_c) + maya,
      utang_sold_c: num(shift.utang_sold_c) + utangTotal
    })
  }

  if (touched.length) emitInventoryChanged('SALE', touched)
  const finished = (await db.sales.get(saleId))!
  const receipt = await buildReceiptLines(finished)
  await audit({ action: 'SALE_CHECKOUT', entity_type: 'sale', entity_id: saleId, new_value: `${finished.transaction_no} ${total}` })
  const print = await autoPrintAfterCheckout(settings, finished, receipt)
  return { sale: finished, receipt, print }
}

async function heldItems(payload: CheckoutPayload): Promise<HeldSaleItem[]> {
  return payload.items.map((item) => ({
    product_id: item.product_id,
    name: item.name,
    unit_name: item.unit_name,
    qty: num(item.qty),
    qty_base: Math.round(num(item.qty_base)),
    unit_price_c: cents(item.unit_price_c),
    subtotal_c: cents(item.subtotal_c),
    cost_base_c: cents(item.cost_base_c)
  }))
}

export async function holdSale(payload: CheckoutPayload): Promise<HeldSale> {
  const session = await requireSessionUser()
  const items = await heldItems(payload)
  const subtotal = items.reduce((sum, item) => sum + item.subtotal_c, 0)
  const discount = Math.max(0, cents(payload.discount_c))
  const token = `HOLD-${String(await nextSequence(`hold_seq_${localDateKey()}`)).padStart(4, '0')}`
  const row: Omit<HeldSale, 'id'> = {
    token,
    items,
    subtotal_c: subtotal,
    discount_c: discount,
    total_c: Math.max(0, subtotal - discount),
    user_id: session.id,
    created_at: nowIso()
  }
  const stored = await insertRow(db.held, { ...row, payload: JSON.stringify(payload) })
  return { ...row, id: stored.id }
}

export async function heldSales(): Promise<HeldSale[]> {
  const rows = await db.held.toArray()
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map(({ payload: _payload, ...rest }) => rest)
}

export async function resumeHeld(id: number): Promise<HeldSale> {
  const row = await db.held.get(id)
  if (!row) throw new Error('Held sale not found.')
  const { payload: _payload, ...rest } = row
  return rest
}

export async function deleteHeld(id: number): Promise<void> {
  await db.held.delete(id)
}

export async function reprint(saleId: number): Promise<string[]> {
  const sale = await db.sales.get(saleId)
  if (!sale) throw new Error('Sale not found.')
  return buildReceiptLines(sale)
}

export async function listTransactions(opts: {
  from?: string
  to?: string
  status?: string
  method?: string
  cashier_id?: number
  search?: string
  limit?: number
  offset?: number
} = {}): Promise<{ rows: Sale[]; total: number }> {
  const all = await db.sales.toArray()
  const filtered = all
    .filter((sale) => (opts.from ? sale.created_at >= dayStartIso(opts.from) : true))
    .filter((sale) => (opts.to ? sale.created_at <= dayEndIso(opts.to) : true))
    .filter((sale) => (opts.status ? sale.status === opts.status : true))
    .filter((sale) => (opts.method ? sale.payments.some((payment) => payment.method === opts.method) : true))
    .filter((sale) => (opts.cashier_id ? sale.user_id === opts.cashier_id : true))
    .filter((sale) => matches(sale.transaction_no, opts.search ?? '') || matches(sale.customer_name, opts.search ?? ''))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const offset = opts.offset ?? 0
  return { rows: filtered.slice(offset, offset + (opts.limit ?? 100)), total: filtered.length }
}

export async function getTransaction(id: number): Promise<Sale> {
  const sale = await db.sales.get(id)
  if (!sale) throw new Error('Sale not found.')
  return sale
}

export async function refundSale(payload: RefundPayload): Promise<Refund> {
  const session = await requireSessionUser()
  const sale = await db.sales.get(payload.sale_id)
  if (!sale) throw new Error('Sale not found.')
  if (sale.status === 'VOIDED') throw new Error('A voided sale cannot be refunded.')
  if (!payload.items?.length) throw new Error('Select at least one item to refund.')

  const items: Refund['items'] = []
  let refundTotal = 0
  const updatedSaleItems = sale.items.map((item) => ({ ...item }))
  const touched: number[] = []

  payload.items.forEach((requested, index) => {
    const target = updatedSaleItems.find((item) => item.id === requested.sale_item_id)
    if (!target) throw new Error('Sale line not found.')
    const remaining = num(target.qty_base) - num(target.refunded_qty_base)
    const qtyBase = Math.round(num(requested.qty_base))
    if (qtyBase <= 0) throw new Error('Refund quantity must be greater than zero.')
    if (qtyBase > remaining) throw new Error(`${target.product_name}: only ${remaining} can still be refunded.`)
    const amount = Math.round((num(target.subtotal_c) * qtyBase) / (num(target.qty_base) || 1))
    target.refunded_qty_base = num(target.refunded_qty_base) + qtyBase
    refundTotal += amount
    const unitRatio = num(target.qty_base) > 0 ? num(target.qty) / num(target.qty_base) : 1
    items.push({
      id: index + 1,
      refund_id: 0,
      sale_item_id: target.id,
      product_id: requested.product_id,
      qty: Math.round(qtyBase * unitRatio * 100) / 100,
      qty_base: qtyBase,
      unit_name: requested.unit_name || target.unit_name,
      amount_c: amount
    })
  })

  const refundNo = `R-${localDateKey().replace(/-/g, '')}-${String(await nextSequence(`refund_seq_${localDateKey()}`)).padStart(4, '0')}`
  const refundId = (await insertRow(db.refunds, {
    refund_no: refundNo,
    sale_id: sale.id,
    transaction_no: sale.transaction_no,
    user_id: session.id,
    user_name: session.full_name,
    reason: payload.reason,
    total_c: refundTotal,
    created_at: nowIso(),
    items: items.map((item) => ({ ...item, refund_id: 0 }))
  })).id
  await db.refunds.update(refundId, { items: items.map((item) => ({ ...item, refund_id: refundId })) })

  for (const item of items) {
    const product = await db.products.get(item.product_id)
    if (!product) continue
    await restoreStock(product, item.qty_base)
    await insertRow(db.movements, {
      product_id: product.id,
      quantity_before: num(product.stock),
      quantity_change: item.qty_base,
      quantity_after: num(product.stock) + item.qty_base,
      unit: item.unit_name,
      movement_type: 'REFUND',
      reason: refundNo,
      reference: sale.transaction_no,
      user_id: session.id,
      created_at: nowIso()
    })
    touched.push(product.id)
  }

  const fullyRefunded = updatedSaleItems.every((item) => num(item.refunded_qty_base) >= num(item.qty_base))
  await db.sales.update(sale.id, {
    items: updatedSaleItems,
    status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
  })

  const utangPaid = sale.payments.filter((payment) => payment.method === 'UTANG').reduce((sum, payment) => sum + num(payment.amount_c), 0)
  if (utangPaid > 0 && sale.customer_id) {
    await applyCreditEntry({
      customer_id: sale.customer_id,
      entry_type: 'REFUND',
      amount_c: refundTotal,
      reference_type: 'REFUND',
      reference_id: refundId,
      notes: refundNo,
      user_id: session.id
    })
  }
  const cashPaid = sale.payments.some((payment) => payment.method === 'CASH') && utangPaid === 0
  if (cashPaid && sale.shift_id) {
    const shift = await db.shifts.get(sale.shift_id)
    if (shift) await db.shifts.update(shift.id, { refund_cash_c: num(shift.refund_cash_c) + refundTotal })
  }
  if (touched.length) emitInventoryChanged('REFUND', touched)
  await audit({ action: 'SALE_REFUND', entity_type: 'sale', entity_id: sale.id, reason: payload.reason, new_value: `${refundNo} ${refundTotal}` })

  const stored = await db.refunds.get(refundId)
  return stored!
}

export async function voidSale(payload: VoidPayload): Promise<Sale> {
  const session = await requireSessionUser()
  const sale = await db.sales.get(payload.sale_id)
  if (!sale) throw new Error('Sale not found.')
  if (sale.status === 'VOIDED') return sale

  const touched: number[] = []
  for (const item of sale.items) {
    if (item.product_id === null) continue
    const outstanding = num(item.qty_base) - num(item.refunded_qty_base)
    if (outstanding <= 0) continue
    const product = await db.products.get(item.product_id)
    if (!product) continue
    await restoreStock(product, outstanding)
    await insertRow(db.movements, {
      product_id: product.id,
      quantity_before: num(product.stock),
      quantity_change: outstanding,
      quantity_after: num(product.stock) + outstanding,
      unit: item.unit_name,
      movement_type: 'RETURN',
      reason: `Void ${sale.transaction_no}`,
      reference: sale.transaction_no,
      user_id: session.id,
      created_at: nowIso()
    })
    touched.push(product.id)
  }

  const utangPaid = sale.payments.filter((payment) => payment.method === 'UTANG').reduce((sum, payment) => sum + num(payment.amount_c), 0)
  if (utangPaid > 0 && sale.customer_id) {
    await applyCreditEntry({
      customer_id: sale.customer_id,
      entry_type: 'REVERSAL',
      amount_c: utangPaid,
      reference_type: 'VOID',
      reference_id: sale.id,
      notes: payload.reason,
      user_id: session.id
    })
  }

  if (sale.shift_id) {
    const shift = await db.shifts.get(sale.shift_id)
    if (shift) {
      const cashPaid = sale.payments.filter((payment) => payment.method === 'CASH').reduce((sum, payment) => sum + num(payment.amount_c), 0)
      const gcash = sale.payments.filter((payment) => payment.method === 'GCASH').reduce((sum, payment) => sum + num(payment.amount_c), 0)
      const maya = sale.payments.filter((payment) => payment.method === 'MAYA').reduce((sum, payment) => sum + num(payment.amount_c), 0)
      await db.shifts.update(shift.id, {
        cash_sales_c: Math.max(0, num(shift.cash_sales_c) - Math.min(cashPaid, sale.total_c)),
        gcash_c: Math.max(0, num(shift.gcash_c) - gcash),
        maya_c: Math.max(0, num(shift.maya_c) - maya),
        utang_sold_c: Math.max(0, num(shift.utang_sold_c) - utangPaid)
      })
    }
  }

  await db.sales.update(sale.id, {
    status: 'VOIDED',
    voided_at: nowIso(),
    voided_by: session.id,
    void_reason: payload.reason
  })
  if (touched.length) emitInventoryChanged('VOID', touched)
  await audit({ action: 'SALE_VOID', entity_type: 'sale', entity_id: sale.id, reason: payload.reason })
  const updated = await db.sales.get(sale.id)
  return updated!
}

export async function recentSales(limit = 5): Promise<Sale[]> {
  const all = await db.sales.toArray()
  return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit)
}

export async function currentCashier(): Promise<string | null> {
  const session = await currentSessionUser()
  return session?.full_name ?? null
}

export { NO_PRINTER, printSaleReceipt }
