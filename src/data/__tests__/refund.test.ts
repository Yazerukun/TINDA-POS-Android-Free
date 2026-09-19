import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { refundSale } from '../sales'
import { setSessionUser } from '../util'

async function seed(qtyBase: number) {
  await db.categories.add({ id: 1, name: 'Canned Goods', created_at: '2026-01-01' } as never)
  await db.products.add({
    id: 1,
    name: '555 Sardines',
    sku: 'SKU-0012',
    category_id: 1,
    base_unit: 'can',
    default_price_c: 3200,
    units: [
      { id: 10, name: 'can', conversion_to_base: 1, barcode: null, selling_price_c: 3200, is_default: true }
    ],
    stock: 0
  } as never)
  await db.sales.add({
    id: 100,
    transaction_no: '20260919-0001',
    user_id: 1,
    status: 'COMPLETED',
    created_at: '2026-09-19T19:20:00.000Z',
    subtotal_c: qtyBase * 3200,
    discount_c: 0,
    total_c: qtyBase * 3200,
    items: [
      { id: 500, sale_id: 100, product_id: 1, product_name: '555 Sardines', qty: qtyBase, qty_base: qtyBase, unit_name: 'can', unit_price_c: 3200, cost_base_c: 2400, subtotal_c: qtyBase * 3200, refunded_qty_base: 0 }
    ],
    payments: [{ id: 700, sale_id: 100, method: 'CASH', amount_c: qtyBase * 3200, created_at: '2026-09-19T19:20:00.000Z' }],
    shift_id: undefined
  } as never)
  await db.users.add({ id: 1, username: 'manager', full_name: 'Manager', roles: ['ADMIN'], is_active: true, created_at: '2026-01-01' } as never)
  await setSessionUser(1)
}

beforeEach(async () => {
  await db.transaction('rw', db.categories, db.products, db.sales, db.refunds, db.movements, db.audit, db.users, db.meta, async () => {
    await Promise.all([
      db.categories.clear(),
      db.products.clear(),
      db.sales.clear(),
      db.refunds.clear(),
      db.movements.clear(),
      db.audit.clear(),
      db.users.clear(),
      db.meta.clear()
    ])
  })
})

describe('refundSale', () => {
  it('multi-unit line: refund amount = unit_price x qty (regression: must be 160 for 5x32, not 32)', async () => {
    await seed(5)
    const refund = await refundSale({
      sale_id: 100,
      reason: 'customer cancel',
      items: [{ sale_item_id: 500, product_id: 1, qty_base: 5, unit_name: 'can' }]
    })
    expect(refund.total_c).toBe(16000) // 5 cans × ₱32
    expect(refund.items[0].qty_base).toBe(5)
    expect(refund.items[0].amount_c).toBe(16000)
    const sale = await db.sales.get(100)
    expect(sale.items[0].refunded_qty_base).toBe(5)
    expect(sale.status).toBe('REFUNDED')
  })

  it('single-unit line still refunds correctly (qty_base = 1)', async () => {
    await seed(1)
    const refund = await refundSale({
      sale_id: 100,
      reason: 'customer cancel',
      items: [{ sale_item_id: 500, product_id: 1, qty_base: 1, unit_name: 'can' }]
    })
    expect(refund.total_c).toBe(3200)
  })
})