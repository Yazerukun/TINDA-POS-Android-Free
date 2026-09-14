import { describe, expect, it } from 'vitest'
import type { Product } from '@shared/types'
import {
  createProductInput,
  editProductForm,
  firstUnitError,
  newProductForm,
  unitInputFrom,
  updateProductInput
} from './productForm'

const baseProduct: Product = {
  id: 1,
  category_id: 2,
  category_name: 'Drinks',
  name: 'Coke Mismo',
  sku: 'CM-1',
  barcode: '480000000001',
  description: 'Coke Mismo 500ml',
  base_unit: 'bottle',
  purchase_cost_c: 1500,
  default_price_c: 2000,
  stock: 10,
  low_stock_threshold: 5,
  supplier_id: 3,
  has_expiration: false,
  image_path: null,
  status: 'ACTIVE',
  notes: 'suki order',
  units: [
    { id: 11, product_id: 1, name: 'bottle', conversion_to_base: 1, barcode: null, selling_price_c: 2000, is_default: true },
    { id: 12, product_id: 1, name: 'case', conversion_to_base: 24, barcode: '480000000024', selling_price_c: 48000, is_default: false }
  ],
  stock_status: 'IN_STOCK',
  created_at: '2026-09-01 10:00:00',
  updated_at: '2026-09-01 10:00:00'
}

function editWith(form: ReturnType<typeof editProductForm>, patch: Partial<ReturnType<typeof editProductForm>>) {
  return { ...form, ...patch }
}

describe('v1.0.7 inventory edit preserves selling units (user feedback #1)', () => {
  it('1. edit pre-fills the form with real product values including its valid unit', () => {
    const form = editProductForm(baseProduct)
    expect(form.name).toBe('Coke Mismo')
    expect(form.default_price_c).toBe(2000)
    expect(form.units.map((u) => u.name)).toEqual(['bottle', 'case'])
    expect(form.units[0]?.conversion_to_base).toBe(1)
    expect(form.description).toBe('Coke Mismo 500ml')
    expect(form.supplier_id).toBe(3)
    expect(form.notes).toBe('suki order')
  })

  it('2. editing only the product name preserves every unit', () => {
    const form = editProductForm(baseProduct)
    const payload = updateProductInput(editWith(form, { name: 'Coke Mismo XL' }))
    expect(payload.name).toBe('Coke Mismo XL')
    expect(payload.units?.map((u) => u.name)).toEqual(['bottle', 'case'])
  })

  it('3. editing only the selling price preserves every unit', () => {
    const form = editProductForm(baseProduct)
    const payload = updateProductInput(editWith(form, { default_price_c: 2200 }))
    expect(payload.default_price_c).toBe(2200)
    expect(payload.units?.map((u) => u.name)).toEqual(['bottle', 'case'])
    expect(payload.units?.every((u) => !!(u.name && u.name.trim()))).toBe(true)
  })

  it('4. editing barcode preserves every unit', () => {
    const form = editProductForm(baseProduct)
    const payload = updateProductInput(editWith(form, { barcode: '480000000099' }))
    expect(payload.barcode).toBe('480000000099')
    expect(payload.units?.map((u) => u.name)).toEqual(['bottle', 'case'])
  })

  it('5. editing category preserves every unit', () => {
    const form = editProductForm(baseProduct)
    const payload = updateProductInput(editWith(form, { category_id: 7 }))
    expect(payload.category_id).toBe(7)
    expect(payload.units?.map((u) => u.name)).toEqual(['bottle', 'case'])
  })

  it('6. editing low stock threshold preserves every unit', () => {
    const form = editProductForm(baseProduct)
    const payload = updateProductInput(editWith(form, { low_stock_threshold: 12 }))
    expect(payload.low_stock_threshold).toBe(12)
    expect(payload.units?.map((u) => u.name)).toEqual(['bottle', 'case'])
  })

  it('7. multi-unit / Tingi units are preserved exactly', () => {
    const form = editProductForm(baseProduct)
    const payload = updateProductInput(form)
    expect(payload.units).toEqual([
      { name: 'bottle', conversion_to_base: 1, barcode: null, selling_price_c: 2000, is_default: true },
      { name: 'case', conversion_to_base: 24, barcode: '480000000024', selling_price_c: 48000, is_default: false }
    ])
  })

  it('8. no blank unit object is generated when editing', () => {
    const form = editProductForm(baseProduct)
    const payload = updateProductInput(form)
    expect(payload.units?.some((u) => u.name === '')).toBe(false)
    expect(payload.units?.some((u) => !u.name || !u.name.trim())).toBe(false)
    expect(payload.units).toBeDefined()
    expect(payload.units!.length).toBeGreaterThan(0)
  })

  it('9. an existing valid unit never triggers "Unit name required"', () => {
    const form = editProductForm(baseProduct)
    expect(firstUnitError(form.units)).toBeNull()
    const productWithOneUnit = { ...baseProduct, units: [baseProduct.units[0]!] }
    expect(firstUnitError(editProductForm(productWithOneUnit).units)).toBeNull()
  })

  it('10. a genuinely blank required unit still validates with a friendly message', () => {
    const form = editProductForm(baseProduct)
    const bad = updateProductInput(editWith(form, { units: [{ ...form.units[0]!, name: '  ' }] }))
    expect(firstUnitError(bad.units ?? [])).toBe('Please enter a name for the selling unit.')
  })
})

describe('v1.0.7 product form helpers', () => {
  it('maps a stored unit into the editable input shape', () => {
    expect(unitInputFrom(baseProduct.units[1]!)).toEqual({ name: 'case', conversion_to_base: 24, barcode: '480000000024', selling_price_c: 48000, is_default: false })
  })

  it('new form starts empty with no units and a default base unit', () => {
    const f = newProductForm()
    expect(f.id).toBeNull()
    expect(f.base_unit).toBe('pc')
    expect(f.units).toEqual([])
    expect(createProductInput(f).units).toEqual([{ name: 'pc', conversion_to_base: 1, barcode: null, selling_price_c: 0, is_default: true }])
  })

  it('create keeps v1.0.6 default payload for a filled form', () => {
    const f = editProductForm(baseProduct)
    const input = createProductInput(f)
    expect(input.units).toEqual(f.units)
    expect(input.initial_stock_base).toBe(0)
    expect(input.has_expiration).toBe(false)
  })
})