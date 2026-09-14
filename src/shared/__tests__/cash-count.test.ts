import { describe, expect, it } from 'vitest'
import type { CashCountRecord } from '@shared/types'
import {
  actualCashCent,
  CASH_COUNT_DENOMINATION_CENTS,
  cashCountLines,
  cashCountStatusText,
  formatCashCountMoney
} from '../cashCount'
import { receiptHtml } from '../receiptHtml'

// Expected ₱5,000, physically ₱4,980 → SHORT, difference -20.00.
// quantities for: 1000,500,200,100,50,20 bills ; 20,10,5,1,0.25 coins
const record: CashCountRecord = {
  id: 42,
  shift_id: 7,
  user_id: 1,
  cashier_name: 'Ana',
  business_date: '2026-09-10',
  starting_cash_c: 200000,
  expected_cash_c: 500000,
  actual_cash_c: 498000,
  difference_c: -2000,
  status: 'SHORT',
  denominations: [4, 1, 2, 0, 1, 1, 0, 1, 0, 0, 0],
  notes: 'short by 20',
  created_at: '2026-09-10 17:25:00'
}

// Reads a right-aligned amount value that follows "Label ..." on a report line.
function fieldValue(lines: string[], label: string): string | undefined {
  const line = lines.find((l) => l.trim().startsWith(label))
  return line?.replace(new RegExp(`^\\s*${label}\\s+`), '').trim()
}

describe('v1.0.7 cash count printing (user feedback #2)', () => {
  it('1. prints a saved Cash Count report with header', () => {
    const lines = cashCountLines({ ...record, store_name: 'JUAN STORE' })
    expect(lines).toContain('TINDA POS')
    expect(lines).toContain('CASH COUNT REPORT')
    expect(lines).toContain('Store: JUAN STORE')
  })

  it('2. expected cash is printed from the saved record', () => {
    expect(fieldValue(cashCountLines(record), 'Expected Cash')).toBe('5,000.00')
  })

  it('3. actual cash is printed from the saved record', () => {
    expect(fieldValue(cashCountLines(record), 'Actual Cash')).toBe('4,980.00')
  })

  it('4. difference is printed from the saved record (sign + amount)', () => {
    expect(fieldValue(cashCountLines(record), 'Difference')).toBe('-20.00')
  })

  it('5. BALANCED prints correctly', () => {
    const balanced: CashCountRecord = { ...record, difference_c: 0, actual_cash_c: record.expected_cash_c, status: 'BALANCED' }
    const lines = cashCountLines(balanced)
    expect(fieldValue(lines, 'Difference')).toBe('0.00')
    expect(lines.some((l) => l.includes('BALANCED'))).toBe(true)
  })

  it('6. OVER prints correctly', () => {
    const over: CashCountRecord = { ...record, difference_c: 500, actual_cash_c: record.expected_cash_c + 500, status: 'OVER' }
    const lines = cashCountLines(over)
    expect(fieldValue(lines, 'Difference')).toBe('5.00')
    expect(lines.some((l) => l.includes('OVER'))).toBe(true)
  })

  it('7. SHORT prints correctly', () => {
    expect(cashCountLines(record).some((l) => l.includes('SHORT'))).toBe(true)
  })

  it('8. denomination quantities are printed exactly as saved', () => {
    const text = cashCountLines(record).join('\n')
    const lines = text.split('\n')
    const thous = lines.find((l) => l.startsWith('  ₱1000'))!
    expect(thous).toContain('4 x')
    const fiveHundred = lines.find((l) => l.startsWith('  ₱500'))!
    expect(fiveHundred).toContain('1 x')
    const quarter = lines.find((l) => l.startsWith('  ₱0.25'))!
    expect(quarter).toContain('0 x')
  })

  it('9. denomination subtotals are printed as quantity × value', () => {
    const text = cashCountLines(record).join('\n')
    const lines = text.split('\n')
    const thous = lines.find((l) => l.startsWith('  ₱1000'))!
    expect(thous).toContain('4 x')
    expect(thous).toContain('4,000.00')
    const twentyBill = lines.find((l) => /^ {2}₱20 {2}/.test(l) && l.includes('1 x'))!
    expect(twentyBill).toContain('20.00')
    const twentyCoin = lines.find((l) => /^ {2}₱20 {2}/.test(l) && l.includes('0 x'))!
    expect(twentyCoin).toContain('0.00')
    const quarter = lines.find((l) => l.startsWith('  ₱0.25'))!
    expect(quarter).toContain('0 x')
    expect(quarter).toContain('0.00')
  })

  it('10. cashier / shift / date / prepared-by are printed from the record', () => {
    const text = cashCountLines(record).join('\n')
    expect(text).toContain('Date: 2026-09-10')
    expect(text).toContain('Business Date: 2026-09-10')
    expect(text).toContain('Shift: 7')
    expect(text).toContain('Cashier: Ana')
    expect(text).toContain('Prepared By: Ana')
    expect(text).toContain('Notes: short by 20')
  })

  it('11. history reprint reproduces the identical saved figures', () => {
    const first = cashCountLines(record)
    const second = cashCountLines(record)
    expect(second).toEqual(first)
  })

  it('12. an old record is never recalculated from current values', () => {
    const lines = cashCountLines({ ...record, store_name: 'JUAN STORE' })
    expect(fieldValue(lines, 'Expected Cash')).toBe('5,000.00')
    expect(fieldValue(lines, 'Actual Cash')).toBe('4,980.00')
    expect(fieldValue(lines, 'Difference')).toBe('-20.00')
    expect(lines.some((l) => l.includes('SHORT'))).toBe(true)
  })

  it('13. building print lines does not alter the saved record', () => {
    const snapshot = JSON.stringify(record)
    cashCountLines(record)
    expect(JSON.stringify(record)).toBe(snapshot)
  })

  it('14. 58mm rendering path renders the exact same lines card-width HTML', () => {
    const html = receiptHtml(cashCountLines(record), '58mm', 'PHP')
    expect(html).toContain('width: 48mm')
    expect(html).toContain('CASH COUNT REPORT')
    expect(html).toContain('Status         SHORT')
  })

  it('15. 80mm rendering path renders the wider 72mm sheet', () => {
    const html = receiptHtml(cashCountLines(record), '80mm', 'PHP')
    expect(html).toContain('width: 72mm')
    expect(html).toContain('Expected Cash')
    expect(html).toContain('5,000.00')
  })
})

describe('v1.0.7 cash count shared helpers', () => {
  it('actual cash computes from quantities and denomination cents', () => {
    expect(actualCashCent(record.denominations, CASH_COUNT_DENOMINATION_CENTS)).toBe(498000)
    expect(actualCashCent([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0)
    expect(() => actualCashCent([-1, ...Array(10).fill(0)])).toThrow()
    expect(() => actualCashCent(Array(10).fill(0))).toThrow()
  })

  it('status helper maps difference to BALANCED / OVER / SHORT', () => {
    expect(cashCountStatusText(0)).toBe('BALANCED')
    expect(cashCountStatusText(1)).toBe('OVER')
    expect(cashCountStatusText(-1)).toBe('SHORT')
  })

  it('formats cash count money with commas and sign', () => {
    expect(formatCashCountMoney(500000)).toBe('5,000.00')
    expect(formatCashCountMoney(498000)).toBe('4,980.00')
    expect(formatCashCountMoney(-2000)).toBe('-20.00')
    expect(formatCashCountMoney(2000)).toBe('20.00')
    expect(formatCashCountMoney(1000)).toBe('10.00')
    expect(formatCashCountMoney(25)).toBe('0.25')
  })
})