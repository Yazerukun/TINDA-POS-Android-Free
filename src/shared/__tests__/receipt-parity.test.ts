import { describe, expect, it } from 'vitest'
import { receiptBodyHtml, receiptCss } from '../receiptHtml'

describe('receipt layout parity (shared module, mirrors Windows)', () => {
  it('formats negative and denomination subtotals like the shared reference', () => {
    const html = receiptBodyHtml(['CASH COUNT REPORT', '---', 'NET SALES 450.00', 'Expected Cash 1,200.00', 'Actual Cash 1,180.00', 'Difference -20.00', '  ₱500 2 x 500.00 = 1,000.00'], '58mm', 'PHP')
    expect(html).toContain('-₱20.00')
    expect(html).toContain('tp-denomline')
    expect(html).toContain('₱1,000.00')
    expect(html).toContain('tp-heading')
  })

  it('keeps the same sheet width/typography rules for 58mm and 80mm', () => {
    expect(receiptCss('58mm')).toContain('width: 48mm')
    expect(receiptCss('80mm')).toContain('width: 72mm')
    expect(receiptCss('58mm')).not.toBe(receiptCss('80mm'))
  })
})