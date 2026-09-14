import type { ReadReport } from './types'

function localTime(value: string): string {
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function readReportLines(r: ReadReport, reportNo?: string, closing?: { actual_cash_c: number; finalized_at: string }, storeName = 'TINDA POS'): string[] {
  const m = (n:number) => (n/100).toFixed(2)
  return [storeName || 'TINDA POS', `${r.report_type}-READ`,
    r.report_type === 'Z' ? 'FINAL SHIFT REPORT' : 'CURRENT SHIFT - NOT FINAL',
    '--------------------------------',
    ...(reportNo ? [`Report: ${reportNo}`] : []),
    `Date: ${localTime(r.report_at)}`, `Cashier: ${r.cashier_name}`, `Shift: ${r.shift_no ?? r.shift_id}`,
    `Opened: ${localTime(r.opened_at)}`, ...(closing ? [`Closed: ${localTime(closing.finalized_at)}`] : []),
    '--------------------------------', 'SALES SUMMARY',
    `Gross Sales    ${m(r.gross_sales_c)}`, `Discounts      ${m(r.discount_c)}`,
    `Refunds        ${m(r.refunds_c)}`, `Voids          ${m(r.voids_c)}`, `NET SALES      ${m(r.net_sales_c)}`,
    '--------------------------------', 'PAYMENT BREAKDOWN',
    `Cash           ${m(r.cash_c)}`, `GCash          ${m(r.gcash_c)}`, `Maya           ${m(r.maya_c)}`, `Utang          ${m(r.utang_c)}`,
    '--------------------------------', 'CASH RECONCILIATION',
    `Starting Cash  ${m(r.starting_cash_c)}`, `Cash In        ${m(r.cash_in_c)}`, `Cash Out       ${m(r.cash_out_c)}`,
    ...(r.cash_refunds_c === undefined ? [] : [`Cash Refunds   ${m(r.cash_refunds_c)}`]),
    `Expenses       ${m(r.expenses_c)}`, `Expected Cash  ${m(r.expected_cash_c)}`,
    ...(closing ? [`Actual Cash    ${m(closing.actual_cash_c)}`, `Difference     ${m(closing.actual_cash_c - r.expected_cash_c)}`,
      `Status: ${closing.actual_cash_c === r.expected_cash_c ? 'BALANCED' : closing.actual_cash_c > r.expected_cash_c ? 'OVER' : 'SHORT'}`] : []),
    '--------------------------------', `Transactions   ${r.transaction_count}`]
}
