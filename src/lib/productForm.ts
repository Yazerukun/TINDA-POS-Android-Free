// Pure helpers for the Inventory product form.
//
// Kept dependency-free so the edit/create payload rules can be unit-tested
// without React. The v1.0.7 regression this protects: editing a product must
// never wipe its existing selling units or replace them with a blank unit,
// otherwise the backend rejects the save with "Unit name is required".

import type { Product, ProductInput } from '@shared/types'

export interface ProductUnitInput {
  name: string
  conversion_to_base: number
  barcode: string | null
  selling_price_c: number
  is_default: boolean
}

export interface ProductFormData {
  id: number | null
  name: string
  sku: string
  barcode: string
  category_id: number | null
  base_unit: string
  purchase_cost_c: number
  default_price_c: number
  low_stock_threshold: number
  initial_stock_base: number
  description: string | null
  supplier_id: number | null
  notes: string | null
  units: ProductUnitInput[]
  expiration_mode?: ProductInput['expiration_mode']
  expiration_date?: string | null
  current_stock?: number
}

export function unitInputFrom(unit: Product['units'][number]): ProductUnitInput {
  return {
    name: unit.name,
    conversion_to_base: unit.conversion_to_base,
    barcode: unit.barcode,
    selling_price_c: unit.selling_price_c,
    is_default: unit.is_default
  }
}

// A fresh "New Product" form. Replaces the old per-page BLANK_UNIT so the
// create payload is also built from the form instead of a hard-coded blank.
// low_stock_threshold comes from the store's Default Low Stock Alert setting
// so the form reflects what the backend will actually save (v1.0.8 bug fix).
export function newProductForm(defaultLowStock = 5): ProductFormData {
  return {
    id: null,
    name: '',
    sku: '',
    barcode: '',
    category_id: null,
    base_unit: 'pc',
    purchase_cost_c: 0,
    default_price_c: 0,
    low_stock_threshold: defaultLowStock,
    initial_stock_base: 0,
    description: null,
    supplier_id: null,
    notes: null,
    units: [],
    expiration_mode: 'NONE', expiration_date: null
  }
}

// Pre-fills the edit form with the REAL saved product values, including its
// existing selling units. Without this the edit flow replaced valid units with
// a blank unit and Save failed with "Unit name is required".
export function editProductForm(product: Product): ProductFormData {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode ?? '',
    category_id: product.category_id,
    base_unit: product.base_unit,
    purchase_cost_c: product.purchase_cost_c,
    default_price_c: product.default_price_c,
    low_stock_threshold: product.low_stock_threshold,
    initial_stock_base: 0,
    description: product.description,
    supplier_id: product.supplier_id,
    notes: product.notes,
    expiration_mode: product.expiration_mode,
    expiration_date: product.expiration_date,
    current_stock: product.stock,
    units: (product.units && product.units.length > 0 ? product.units : []).map(unitInputFrom)
  }
}

// Friendly validation target, not the generic backend message.
export function blankUnitMessage(): string {
  return 'Please enter a name for the selling unit.'
}

// Returns a friendly message for the first genuinely invalid unit, or null
// when every unit has a real name. This is a UI hint only; the backend
// validateProductInput still enforces the full unit rules on save.
export function firstUnitError(units: ProductUnitInput[]): string | null {
  const withoutName = units.find((u) => !u.name || !u.name.trim())
  if (withoutName) return blankUnitMessage()
  return null
}

// Builds the update payload. Units come from the form ONLY — a valid existing
// unit is preserved exactly, and editing unrelated fields never injects a
// blank unit. Description / supplier / notes round-trip so they are not lost.
// has_expiration is intentionally NOT sent: the backend merges undefined
// fields from the stored product, so editing never flips that flag.
export function updateProductInput(form: ProductFormData): Partial<ProductInput> {
  return {
    name: form.name,
    sku: form.sku,
    barcode: form.barcode || null,
    category_id: form.category_id,
    base_unit: form.base_unit,
    purchase_cost_c: form.purchase_cost_c,
    default_price_c: form.default_price_c,
    low_stock_threshold: form.low_stock_threshold,
    description: form.description,
    supplier_id: form.supplier_id,
    notes: form.notes,
    ...(form.expiration_mode !== undefined ? { expiration_mode: form.expiration_mode, expiration_date: form.expiration_date || null } : {}),
    units: form.units
  }
}

// Create payload: unchanged behavior from v1.0.6 (a single selling unit named
// after the base unit when no units were configured in the form).
export function createProductInput(form: ProductFormData): ProductInput {
  const units = form.units.length > 0
    ? form.units
    : [{ name: form.base_unit, conversion_to_base: 1, barcode: null, selling_price_c: 0, is_default: true }]
  return {
    name: form.name,
    sku: form.sku,
    barcode: form.barcode || null,
    category_id: form.category_id,
    base_unit: form.base_unit,
    purchase_cost_c: form.purchase_cost_c,
    default_price_c: form.default_price_c,
    low_stock_threshold: form.low_stock_threshold,
    initial_stock_base: form.initial_stock_base,
    description: form.description,
    supplier_id: form.supplier_id,
    has_expiration: false,
    expiration_mode: form.expiration_mode ?? 'NONE',
    expiration_date: form.expiration_date || null,
    notes: form.notes,
    units
  }
}
