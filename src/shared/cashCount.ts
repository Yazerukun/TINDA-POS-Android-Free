// Shared Cash Count helpers.
//
// Single source of truth for the denomination list so that the amount saved by
// the main process (repositories/cashCounts.ts) always matches the printed and
// previewed report. Printing must never recompute the accounting figures: it
// only formats the authoritative saved record (see cashCounts repository).

import type { CashCountRecord } from './types'

export interface CashCountDenomination {
  label: string
  cents: number
  kind: 'BILL' | 'COIN'
}

export const CASH_COUNT_DENOMINATIONS: CashCountDenomination[] = [
  { label: '₱1000', cents: 100000, kind: 'BILL' },
  { label: '₱500', cents: 50000, kind: 'BILL' },
  { label: '₱200', cents: 20000, kind: 'BILL' },
  { label: '₱100', cents: 10000, kind: 'BILL' },
  { label: '₱50', cents: 5000, kind: 'BILL' },
  { label: '₱20', cents: 2000, kind: 'BILL' },
  { label: '₱20', cents: 2000, kind: 'COIN' },
  { label: '₱10', cents: 1000, kind: 'COIN' },
  { label: '₱5', cents: 500, kind: 'COIN' },
  { label: '₱1', cents: 100, kind: 'COIN' },
  { label: '₱0.25', cents: 25, kind: 'COIN' }
]

export const CASH_COUNT_DENOMINATION_CENTS = CASH_COUNT_DENOMINATIONS.map((d) => d.cents)

export function actualCashCent(quantities: number[], denominations = CASH_COUNT_DENOMINATION_CENTS): number {
  if (quantities.length !== denominations.length) throw new Error('Invalid denomination list.')
  return quantities.reduce((sum, q, i) => {
    if (!Number.isInteger(q) || q < 0) throw new Error('Quantities must be non-negative whole numbers.')
    return sum + q * (denominations[i] ?? 0)
  }, 0)
}

export function cashCountStatusText(differenceC: number): CashCountRecord['status'] {
  if (differenceC === 0) return 'BALANCED'
  return differenceC > 0 ? 'OVER' : 'SHORT'
}

// 5000 -> "50.00", -2000 -> "-20.00", 123450 -> "1,234.50"
export function formatCashCountMoney(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const whole = Math.trunc(Math.abs(cents) / 100)
  const frac = String(Math.abs(cents) % 100).padStart(2, '0')
  return `${sign}${whole.toLocaleString('en-US')}.${frac}`
}

export type CashCountReport = CashCountRecord & { store_name?: string | null }

// Builds the plain receipt lines for a saved Cash Count. Every figure comes
// from the stored record: reprinting from history must reproduce the exact
// same expected/actual/difference/status/denominations with no recalculation.
export function cashCountLines(r: CashCountReport): string[] {
  const quantityAt = (index: number): number => Number(r.denominations[index] ?? 0) || 0
  const subtotal = (index: number): number => quantityAt(index) * (CASH_COUNT_DENOMINATIONS[index]?.cents ?? 0)
  const money = (n: number): string => formatCashCountMoney(n)
  const countLine = (index: number): string => {
    const d = CASH_COUNT_DENOMINATIONS[index]!
    return `  ${d.label.padEnd(6)}${quantityAt(index)} x ${money(d.cents).padStart(7)} = ${money(subtotal(index)).padStart(10)}`
  }

  const lines: string[] = [
    'TINDA POS',
    'CASH COUNT REPORT',
    '--------------------------------'
  ]
  if (r.store_name) lines.push(`Store: ${r.store_name}`)
  lines.push(`Date: ${r.business_date}`)
  lines.push(`Time: ${r.created_at.includes(' ') ? r.created_at.split(' ').slice(1).join(' ') : r.created_at}`)
  lines.push(`Business Date: ${r.business_date}`)
  lines.push(`Shift: ${r.shift_id}`)
  lines.push(`Cashier: ${r.cashier_name}`)
  lines.push(`Prepared By: ${r.cashier_name}`)
  lines.push('--------------------------------')
  lines.push('DENOMINATION BREAKDOWN')
  lines.push('BILLS:')
  CASH_COUNT_DENOMINATIONS.forEach((d, i) => {
    if (d.kind === 'BILL') lines.push(countLine(i))
  })
  lines.push('COINS:')
  CASH_COUNT_DENOMINATIONS.forEach((d, i) => {
    if (d.kind === 'COIN') lines.push(countLine(i))
  })
  lines.push('--------------------------------')
  lines.push(`Expected Cash  ${money(r.expected_cash_c).padStart(10)}`)
  lines.push(`Actual Cash    ${money(r.actual_cash_c).padStart(10)}`)
  lines.push(`Difference     ${money(r.difference_c).padStart(10)}`)
  lines.push(`Status         ${r.status}`)
  if (r.notes) lines.push(`Notes: ${r.notes}`)
  lines.push('--------------------------------')
  lines.push('TINDA POS')
  return lines
}