import { describe, expect, it } from 'vitest'
import { availableBase, cartHasStockConflict, hasStockConflict, maxQuantity, reservedBase } from './cartStock'

describe('v1.0.5 realtime cart availability', () => {
  it('adds, decreases, removes and clears only temporary availability', () => {
    expect(availableBase(10)).toBe(10)
    expect(availableBase(10, { qty: 1, conversion_to_base: 1 })).toBe(9)
    expect(availableBase(10, { qty: 3, conversion_to_base: 1 })).toBe(7)
    expect(availableBase(10, { qty: 2, conversion_to_base: 1 })).toBe(8)
    expect(availableBase(10)).toBe(10)
  })

  it('enforces zero/max stock and recalculates external inventory changes', () => {
    expect(maxQuantity(0, 1)).toBe(0)
    expect(maxQuantity(3, 1)).toBe(3)
    expect(availableBase(15, { qty: 2, conversion_to_base: 1 })).toBe(13)
  })

  it('detects held/resumed stock conflicts and blocks checkout inputs until corrected', () => {
    const conflict = { product_id: 1, qty: 2, conversion_to_base: 1, stock_base: 1 }
    expect(hasStockConflict(conflict)).toBe(true)
    expect(cartHasStockConflict([conflict])).toBe(true)
    expect(cartHasStockConflict([{ ...conflict, qty: 1 }])).toBe(false)
  })

  it('reserves and caps multi-unit quantities in base units', () => {
    const box = { product_id: 1, qty: 1, conversion_to_base: 24, stock_base: 48 }
    expect(reservedBase(box)).toBe(24)
    expect(availableBase(48, box)).toBe(24)
    expect(maxQuantity(48, 24)).toBe(2)
    expect(availableBase(48, { qty: 2, conversion_to_base: 24 })).toBe(0)
  })
})
