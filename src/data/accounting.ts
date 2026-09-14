// Shifts, cash movements, cash counts, X/Z readings and the report queries.

import type {
  CashCountRecord,
  CashMovement,
  Customer,
  ExportResult,
  Product,
  ReadReport,
  ReportSummary,
  Sale,
  SalesReportRow,
  Shift,
  ZRead
} from '@shared/types'
import { CASH_COUNT_DENOMINATION_CENTS, actualCashCent, cashCountStatusText } from '@shared/cashCount'
import { db } from './db'
import { hydrateProduct } from './catalog'
import { utangReport } from './people'
import { NO_PRINTER } from './sales'
import { audit, cents, dayEndIso, dayStartIso, insertRow, localDateKey, money, nowIso, num, requireSessionUser, text } from './util'

async function openShiftRow(): Promise<Shift | undefined> {
  return db.shifts.where('status').equals('OPENED').first()
}

export async function currentShift(): Promise<Shift | null> {
  return (await openShiftRow()) ?? null
}

export async function openShift(startingCashC: number): Promise<Shift> {
  const session = await requireSessionUser()
  const existing = await openShiftRow()
  if (existing) return existing
  const total = await db.shifts.count()
  const row: Omit<Shift, 'id'> = {
    user_id: session.id,
    shift_no: total + 1,
    cashier_name: session.full_name,
    opened_at: nowIso(),
    closed_at: null,
    starting_cash_c: cents(startingCashC),
    cash_sales_c: 0,
    gcash_c: 0,
    maya_c: 0,
    utang_sold_c: 0,
    refund_cash_c: 0,
    cash_expenses_c: 0,
    cash_in_c: 0,
    cash_out_c: 0,
    expected_cash_c: 0,
    actual_cash_c: null,
    difference_c: null,
    closing_note: null,
    status: 'OPENED',
    movement_count: 0
  }
  const created = await insertRow(db.shifts, row)
  await audit({ action: 'SHIFT_OPEN', entity_type: 'shift', entity_id: created.id, new_value: `${created.starting_cash_c}` })
  return created
}

/** Authoritative read of a shift: used by X-read, Z-read and cash counts. */
export async function buildReadReport(shift: Shift, type: 'X' | 'Z'): Promise<ReadReport> {
  const sales = (await db.sales.toArray()).filter((sale) => sale.shift_id === shift.id)
  const active = sales.filter((sale) => sale.status !== 'VOIDED')
  const voided = sales.filter((sale) => sale.status === 'VOIDED')
  const refunds = (await db.refunds.toArray()).filter((refund) => sales.some((sale) => sale.id === refund.sale_id))
  const expenses = (await db.expenses.toArray()).filter((expense) => expense.created_at >= shift.opened_at && (!shift.closed_at || expense.created_at <= shift.closed_at))
  const movements = await db.cashMovements.where('shift_id').equals(shift.id).toArray()

  const gross = active.reduce((sum, sale) => sum + num(sale.subtotal_c), 0)
  const discount = active.reduce((sum, sale) => sum + num(sale.discount_c), 0)
  const refundsC = refunds.reduce((sum, refund) => sum + num(refund.total_c), 0)
  const voidsC = voided.reduce((sum, sale) => sum + num(sale.total_c), 0)

  const nonCashOf = (sale: Sale, method: string): number =>
    sale.payments.filter((payment) => payment.method === method).reduce((sum, payment) => sum + num(payment.amount_c), 0)
  const gcash = active.reduce((sum, sale) => sum + nonCashOf(sale, 'GCASH'), 0)
  const maya = active.reduce((sum, sale) => sum + nonCashOf(sale, 'MAYA'), 0)
  const utang = active.reduce((sum, sale) => sum + nonCashOf(sale, 'UTANG'), 0)
  const cashApplied = active.reduce((sum, sale) => sum + Math.max(0, num(sale.total_c) - nonCashOf(sale, 'GCASH') - nonCashOf(sale, 'MAYA') - nonCashOf(sale, 'UTANG')), 0)

  const cashRefunds = refunds
    .filter((refund) => {
      const sale = sales.find((entry) => entry.id === refund.sale_id)
      if (!sale) return false
      const paidCash = sale.payments.some((payment) => payment.method === 'CASH')
      const paidUtang = sale.payments.some((payment) => payment.method === 'UTANG')
      return paidCash && !paidUtang
    })
    .reduce((sum, refund) => sum + num(refund.total_c), 0)

  const cashIn = movements.filter((movement) => movement.type === 'CASH_IN').reduce((sum, movement) => sum + num(movement.amount_c), 0)
  const cashOut = movements.filter((movement) => movement.type === 'CASH_OUT').reduce((sum, movement) => sum + num(movement.amount_c), 0)
  const expenseTotal = expenses.reduce((sum, expense) => sum + num(expense.amount_c), 0)

  const expected = num(shift.starting_cash_c) + cashApplied + cashIn - cashOut - expenseTotal - cashRefunds

  return {
    shift_id: shift.id,
    shift_no: shift.shift_no,
    report_type: type,
    report_at: nowIso(),
    cashier_id: shift.user_id,
    cashier_name: shift.cashier_name,
    opened_at: shift.opened_at,
    closed_at: shift.status === 'CLOSED' ? shift.closed_at : null,
    starting_cash_c: num(shift.starting_cash_c),
    gross_sales_c: gross,
    discount_c: discount,
    refunds_c: refundsC,
    cash_refunds_c: cashRefunds,
    voids_c: voidsC,
    net_sales_c: gross - discount - refundsC - voidsC,
    cash_c: cashApplied,
    gcash_c: gcash,
    maya_c: maya,
    utang_c: utang,
    expenses_c: expenseTotal,
    cash_in_c: cashIn,
    cash_out_c: cashOut,
    expected_cash_c: expected,
    transaction_count: active.length,
    void_count: voided.length,
    split_count: active.filter((sale) => sale.payments.length > 1).length
  }
}

export async function closeShift(input: { actual_cash_c: number; closing_note?: string }): Promise<Shift> {
  const shift = await openShiftRow()
  if (!shift) throw new Error('There is no open shift to close.')
  const report = await buildReadReport(shift, 'Z')
  const actual = cents(input.actual_cash_c)
  const closed = await db.shifts.update(shift.id, {
    status: 'CLOSED',
    closed_at: nowIso(),
    expected_cash_c: report.expected_cash_c,
    actual_cash_c: actual,
    difference_c: actual - report.expected_cash_c,
    closing_note: input.closing_note ?? null,
    cash_sales_c: report.cash_c,
    gcash_c: report.gcash_c,
    maya_c: report.maya_c,
    utang_sold_c: report.utang_c,
    refund_cash_c: report.cash_refunds_c ?? 0,
    cash_expenses_c: report.expenses_c,
    cash_in_c: report.cash_in_c,
    cash_out_c: report.cash_out_c,
    movement_count: (await db.cashMovements.where('shift_id').equals(shift.id).toArray()).length
  })
  void closed
  await audit({ action: 'SHIFT_CLOSE', entity_type: 'shift', entity_id: shift.id, new_value: `${actual}` })
  return (await db.shifts.get(shift.id))!
}

export async function cashMovement(input: { type: 'CASH_IN' | 'CASH_OUT'; amount_c: number; reason?: string }): Promise<CashMovement> {
  const session = await requireSessionUser()
  const shift = await openShiftRow()
  if (!shift) throw new Error('Open a shift before recording cash movements.')
  const amount = cents(input.amount_c)
  if (amount <= 0) throw new Error('Amount must be greater than zero.')
  const row: Omit<CashMovement, 'id'> = {
    shift_id: shift.id,
    type: input.type,
    amount_c: amount,
    reason: input.reason ?? null,
    user_id: session.id,
    created_at: nowIso()
  }
  const created = await insertRow(db.cashMovements, row)
  await db.shifts.update(shift.id, {
    cash_in_c: input.type === 'CASH_IN' ? num(shift.cash_in_c) + amount : num(shift.cash_in_c),
    cash_out_c: input.type === 'CASH_OUT' ? num(shift.cash_out_c) + amount : num(shift.cash_out_c),
    movement_count: num(shift.movement_count) + 1
  })
  return created
}

export async function listShifts(opts: { from?: string; to?: string; cashier_id?: number; status?: string; limit?: number; offset?: number } = {}): Promise<{ rows: Shift[]; total: number }> {
  const all = await db.shifts.toArray()
  const filtered = all
    .filter((shift) => (opts.status ? shift.status === opts.status : true))
    .filter((shift) => (opts.cashier_id ? shift.user_id === opts.cashier_id : true))
    .filter((shift) => (opts.from ? shift.opened_at >= dayStartIso(opts.from) : true))
    .filter((shift) => (opts.to ? shift.opened_at <= dayEndIso(opts.to) : true))
    .sort((a, b) => (a.opened_at < b.opened_at ? 1 : -1))
  const offset = opts.offset ?? 0
  return { rows: filtered.slice(offset, offset + (opts.limit ?? 100)), total: filtered.length }
}

export async function shiftSummary(id: number): Promise<Shift> {
  const shift = await db.shifts.get(id)
  if (!shift) throw new Error('Shift not found.')
  return shift
}

export async function cashCountExpected(): Promise<ReadReport> {
  const shift = await openShiftRow()
  if (!shift) {
    return {
      shift_id: 0,
      shift_no: null,
      report_type: 'X',
      report_at: nowIso(),
      cashier_id: 0,
      cashier_name: '—',
      opened_at: nowIso(),
      closed_at: null,
      starting_cash_c: 0,
      gross_sales_c: 0,
      discount_c: 0,
      refunds_c: 0,
      cash_refunds_c: 0,
      voids_c: 0,
      net_sales_c: 0,
      cash_c: 0,
      gcash_c: 0,
      maya_c: 0,
      utang_c: 0,
      expenses_c: 0,
      cash_in_c: 0,
      cash_out_c: 0,
      expected_cash_c: 0,
      transaction_count: 0,
      void_count: 0,
      split_count: 0
    }
  }
  return buildReadReport(shift, 'X')
}

export async function saveCashCount(input: { shift_id?: number; quantities: number[]; notes?: string | null }): Promise<CashCountRecord> {
  const session = await requireSessionUser()
  const shift = input.shift_id ? await db.shifts.get(input.shift_id) : await openShiftRow()
  const expected = shift ? (await buildReadReport(shift, 'X')).expected_cash_c : 0
  const actual = actualCashCent(input.quantities, CASH_COUNT_DENOMINATION_CENTS)
  const difference = actual - expected
  const row: Omit<CashCountRecord, 'id'> = {
    shift_id: shift?.id ?? 0,
    user_id: session.id,
    cashier_name: session.full_name,
    business_date: localDateKey(),
    starting_cash_c: num(shift?.starting_cash_c),
    expected_cash_c: expected,
    actual_cash_c: actual,
    difference_c: difference,
    status: cashCountStatusText(difference),
    denominations: input.quantities.map((quantity) => Math.trunc(num(quantity))),
    notes: input.notes ?? null,
    created_at: nowIso()
  }
  const created = await insertRow(db.cashCounts, row)
  await audit({ action: 'CASH_COUNT_SAVE', entity_type: 'cash_count', entity_id: created.id, new_value: `${expected}/${actual}` })
  return created
}

export async function listCashCounts(opts: { business_date?: string; user_id?: number; status?: string } = {}): Promise<CashCountRecord[]> {
  const all = await db.cashCounts.toArray()
  return all
    .filter((record) => (opts.business_date ? record.business_date === opts.business_date : true))
    .filter((record) => (opts.user_id ? record.user_id === opts.user_id : true))
    .filter((record) => (opts.status ? record.status === opts.status : true))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

export async function xRead(): Promise<ReadReport> {
  const shift = await openShiftRow()
  if (!shift) return cashCountExpected()
  return buildReadReport(shift, 'X')
}

export async function finalizeZ(input: { actual_cash_c: number; note?: string }): Promise<ZRead> {
  const session = await requireSessionUser()
  const shift = await openShiftRow()
  if (!shift) throw new Error('There is no open shift to finalize.')
  const snapshot = await buildReadReport(shift, 'Z')
  const sequence = (await db.zReads.count()) + 1
  const row: Omit<ZRead, 'id'> = {
    shift_id: shift.id,
    report_no: `Z-${localDateKey().replace(/-/g, '')}-${String(sequence).padStart(3, '0')}`,
    snapshot,
    finalized_by: session.id,
    finalized_by_name: session.full_name,
    finalized_at: nowIso()
  }
  const created = await insertRow(db.zReads, row)
  await closeShift({ actual_cash_c: input.actual_cash_c, closing_note: input.note })
  await audit({ action: 'Z_READ_FINALIZE', entity_type: 'shift', entity_id: shift.id, new_value: created.report_no })
  return created
}

export async function zHistory(): Promise<ZRead[]> {
  const all = await db.zReads.toArray()
  return all.sort((a, b) => (a.finalized_at < b.finalized_at ? 1 : -1))
}

function saleProfit(sale: Sale): number {
  return sale.items.reduce((sum, item) => sum + num(item.subtotal_c) - item.qty_base * num(item.cost_base_c), 0)
}

function groupKey(iso: string, groupBy: 'DAILY' | 'WEEKLY' | 'MONTHLY'): string {
  const date = new Date(iso)
  if (groupBy === 'MONTHLY') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  if (groupBy === 'WEEKLY') {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    return localDateKey(start)
  }
  return localDateKey(date)
}

export async function salesReport(opts: { from: string; to: string; groupBy?: 'DAILY' | 'WEEKLY' | 'MONTHLY' }): Promise<{
  rows: SalesReportRow[]
  summary: ReportSummary
  chart: { label: string; total_c: number; profit_c: number }[]
}> {
  const from = dayStartIso(opts.from || localDateKey())
  const to = dayEndIso(opts.to || localDateKey())
  const groupBy = opts.groupBy ?? 'DAILY'
  const sales = (await db.sales.toArray())
    .filter((sale) => sale.created_at >= from && sale.created_at <= to)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const active = sales.filter((sale) => sale.status !== 'VOIDED')
  const refunds = (await db.refunds.toArray()).filter((refund) => refund.created_at >= from && refund.created_at <= to)
  const expenses = (await db.expenses.toArray()).filter((expense) => expense.expense_date >= (opts.from || localDateKey()) && expense.expense_date <= (opts.to || localDateKey()))

  const rows: SalesReportRow[] = sales.map((sale) => ({
    sale_id: sale.id,
    transaction_no: sale.transaction_no,
    created_at: sale.created_at,
    cashier: sale.cashier_name,
    customer: sale.customer_name,
    items: sale.items.reduce((sum, item) => sum + num(item.qty), 0),
    subtotal_c: num(sale.subtotal_c),
    discount_c: num(sale.discount_c),
    total_c: num(sale.total_c),
    method: sale.payments.map((payment) => payment.method).join(' + '),
    status: sale.status
  }))

  const summary: ReportSummary = {
    sales_total_c: active.reduce((sum, sale) => sum + num(sale.total_c), 0),
    profit_c: active.reduce((sum, sale) => sum + saleProfit(sale), 0),
    items_sold: active.reduce((sum, sale) => sum + sale.items.reduce((count, item) => count + num(item.qty), 0), 0),
    transactions: active.length,
    cost_c: active.reduce((sum, sale) => sum + sale.items.reduce((total, item) => total + item.qty_base * num(item.cost_base_c), 0), 0),
    discount_c: active.reduce((sum, sale) => sum + num(sale.discount_c), 0),
    refunds_c: refunds.reduce((sum, refund) => sum + num(refund.total_c), 0),
    expenses_c: expenses.reduce((sum, expense) => sum + num(expense.amount_c), 0)
  }

  const buckets = new Map<string, { label: string; total_c: number; profit_c: number }>()
  for (const sale of active) {
    const key = groupKey(sale.created_at, groupBy)
    const current = buckets.get(key) ?? { label: key, total_c: 0, profit_c: 0 }
    current.total_c += num(sale.total_c)
    current.profit_c += saleProfit(sale)
    buckets.set(key, current)
  }
  const chart = [...buckets.values()].sort((a, b) => (a.label < b.label ? -1 : 1))
  return { rows, summary, chart }
}

export async function inventoryReport(): Promise<{
  rows: (Product & { inventory_value_c: number; total_cost_c: number })[]
  summary: { total_units: number; inventory_value_c: number; low_stock: number; out_of_stock: number }
}> {
  const products = await db.products.toArray()
  const hydrated = await Promise.all(products.map((product) => hydrateProduct(product)))
  const rows = hydrated
    .map((product) => ({
      ...product,
      inventory_value_c: num(product.stock) * num(product.purchase_cost_c),
      total_cost_c: num(product.stock) * num(product.purchase_cost_c)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    rows,
    summary: {
      total_units: rows.reduce((sum, product) => sum + num(product.stock), 0),
      inventory_value_c: rows.reduce((sum, product) => sum + product.inventory_value_c, 0),
      low_stock: rows.filter((product) => product.stock_status === 'LOW_STOCK').length,
      out_of_stock: rows.filter((product) => product.stock_status === 'OUT_OF_STOCK').length
    }
  }
}

export async function cashierReport(opts: { from?: string; to?: string; cashier_id?: number } = {}): Promise<{ rows: Sale[]; summary: ReportSummary }> {
  const from = dayStartIso(opts.from || '2000-01-01')
  const to = dayEndIso(opts.to || localDateKey())
  const rows = (await db.sales.toArray())
    .filter((sale) => sale.created_at >= from && sale.created_at <= to)
    .filter((sale) => (opts.cashier_id ? sale.user_id === opts.cashier_id : true))
  const active = rows.filter((sale) => sale.status !== 'VOIDED')
  const refunds = (await db.refunds.toArray()).filter((refund) => refund.created_at >= from && refund.created_at <= to)
  return {
    rows,
    summary: {
      sales_total_c: active.reduce((sum, sale) => sum + num(sale.total_c), 0),
      profit_c: active.reduce((sum, sale) => sum + saleProfit(sale), 0),
      items_sold: active.reduce((sum, sale) => sum + sale.items.reduce((count, item) => count + num(item.qty), 0), 0),
      transactions: active.length,
      cost_c: active.reduce((sum, sale) => sum + sale.items.reduce((total, item) => total + item.qty_base * num(item.cost_base_c), 0), 0),
      discount_c: active.reduce((sum, sale) => sum + num(sale.discount_c), 0),
      refunds_c: refunds.reduce((sum, refund) => sum + num(refund.total_c), 0),
      expenses_c: 0
    }
  }
}

export async function shiftsReport(opts: { from?: string; to?: string } = {}): Promise<{ rows: Shift[]; summary: ReportSummary }> {
  const { rows } = await listShifts({ from: opts.from, to: opts.to, limit: 500 })
  const summary: ReportSummary = {
    sales_total_c: rows.reduce((sum, shift) => sum + num(shift.cash_sales_c) + num(shift.gcash_c) + num(shift.maya_c) + num(shift.utang_sold_c), 0),
    profit_c: 0,
    items_sold: 0,
    transactions: rows.length,
    cost_c: 0,
    discount_c: 0,
    refunds_c: rows.reduce((sum, shift) => sum + num(shift.refund_cash_c), 0),
    expenses_c: rows.reduce((sum, shift) => sum + num(shift.cash_expenses_c), 0)
  }
  return { rows, summary }
}

function csvCell(value: unknown): string {
  const raw = String(value ?? '')
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

function triggerDownload(filename: string, content: string): void {
  try {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  } catch {
    /* the export is still reported through the returned row count */
  }
}

export async function exportCsv(kind: 'SALES' | 'INVENTORY' | 'EXPENSES' | 'UTANG' | 'TRANSACTIONS', opts: { from?: string; to?: string } = {}): Promise<ExportResult> {
  const from = opts.from ?? '2000-01-01'
  const to = opts.to ?? localDateKey()
  let header: string[] = []
  const lines: string[][] = []
  if (kind === 'INVENTORY') {
    const report = await inventoryReport()
    header = ['Name', 'SKU', 'Category', 'Base unit', 'Stock', 'Cost', 'Price', 'Stock value']
    for (const row of report.rows) {
      lines.push([row.name, row.sku, row.category_name ?? '', row.base_unit, String(row.stock), money(row.purchase_cost_c), money(row.default_price_c), money(row.inventory_value_c)])
    }
  } else if (kind === 'EXPENSES') {
    const expenses = (await db.expenses.toArray()).filter((expense) => expense.expense_date >= from && expense.expense_date <= to)
    header = ['Date', 'Category', 'Amount', 'Description', 'Reference', 'Recorded by']
    for (const expense of expenses) lines.push([expense.expense_date, expense.category_name, money(expense.amount_c), expense.description ?? '', expense.reference ?? '', expense.user_name])
  } else if (kind === 'UTANG') {
    const report = await utangReport()
    header = ['Customer', 'Phone', 'Balance', 'Credit limit']
    for (const customer of report.rows as Customer[]) lines.push([customer.full_name, customer.phone ?? '', money(customer.balance_c), money(customer.credit_limit_c)])
  } else {
    const { rows } = await salesReport({ from, to })
    header = ['Date', 'Transaction', 'Cashier', 'Customer', 'Items', 'Subtotal', 'Discount', 'Total', 'Method', 'Status']
    for (const row of rows) {
      lines.push([row.created_at, row.transaction_no, row.cashier, row.customer ?? '', String(row.items), money(row.subtotal_c), money(row.discount_c), money(row.total_c), row.method, row.status])
    }
  }
  const content = [header, ...lines].map((row) => row.map(csvCell).join(',')).join('\n')
  const filename = `tinda-pos-${kind.toLowerCase()}-${localDateKey()}.csv`
  triggerDownload(filename, content)
  return { path: filename, rows: lines.length }
}

export const PRINT_UNAVAILABLE = NO_PRINTER
export { text }
