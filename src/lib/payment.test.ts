import { describe, expect, it } from 'vitest'
import { cashInputFromCents } from './payment'

describe('cash checkout input', () => {
  it('converts centavo totals to peso input values without multiplying cash by 100', () => {
    expect(cashInputFromCents(5000)).toBe('50')
    expect(cashInputFromCents(12345)).toBe('123.45')
  })
})
