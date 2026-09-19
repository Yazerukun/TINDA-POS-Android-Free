import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { salesReport } from '../accounting'

async function seedSale(discount_c: number) {
  await db.products.add({
    id: 1,
    name: 'Coke',
    sku: 'CM-1',
    category_id: 1,
    base_unit: 'bottle',
    default_price_c: 900,
    units: [
      { id: 10, name: 'bottle', conversion_to_base: 1, barcode: null, selling_price_c: 900, is_default: true }
    ]
  } as never)
  await db.sales.add({
    id: 100,
    transaction_no: '000001',
    user_id: 1,
    status: 'COMPLETED',
    created_at: '2026-01-15',
    subtotal_c: 1800,
    discount_c,
    total_c: 1800 - discount_c,
    items: [
      { id: 500, sale_id: 100, product_id: 1, product_name: 'Coke', qty: 2, qty_base: 2, unit_name: 'bottle', unit_price_c: 900, cost_base_c: 600, subtotal_c: 1800 }
    ],
    payments: [{ id: 700, sale_id: 100, method: 'CASH', amount_c: 1800 - discount_c, created_at: '2026-01-15' }]
  } as never)
}

beforeEach(async () => {
  await db.transaction('rw', db.categories, db.products, db.sales, db.refunds, db.movements, db.audit, async () => {
    await Promise.all([db.categories.clear(), db.products.clear(), db.sales.clear(), db.refunds.clear(), db.movements.clear(), db.audit.clear()])
  })
})

describe('refund-aware profit (accounting)', () => {
  it('partial refund: profit = (sales - refunds) - (cost - refundedCost); discount netted, no double deduction', async () => {
    await seedSale(300)
    await db.refunds.add({
      id: 1,
      sale_id: 100,
      transaction_no: 'R-0001',
      user_id: 1,
      reason: 'return 1 bottle',
      status: 'COMPLETED',
      created_at: '2026-01-15',
      subtotal_c: 900,
      total_c: 900,
      items: [{ id: 900, refund_id: 1, sale_item_id: 500, product_id: 1, product_name: 'Coke', qty: 1, qty_base: 1, unit_name: 'bottle', amount_c: 900 }]
    } as never)

    const { summary } = await salesReport({ from: '2026-01-15', to: '2026-01-15' })
    expect(summary.sales_total_c).toBe(1500)
    expect(summary.refunds_c).toBe(900)
    expect(summary.cost_c).toBe(1200)
    expect(summary.profit_c).toBe(0) // (1500-900) - (1200-600)
  })

  it('full refund: profit is zero, not negative', async () => {
    await seedSale(0)
    await db.refunds.add({
      id: 1,
      sale_id: 100,
      transaction_no: 'R-0001',
      user_id: 1,
      reason: 'full return',
      status: 'COMPLETED',
      created_at: '2026-01-15',
      subtotal_c: 1800,
      total_c: 1800,
      items: [{ id: 900, refund_id: 1, sale_item_id: 500, product_id: 1, product_name: 'Coke', qty: 2, qty_base: 2, unit_name: 'bottle', amount_c: 1800 }]
    } as never)

    const { summary } = await salesReport({ from: '2026-01-15', to: '2026-01-15' })
    expect(summary.profit_c).toBe(0)
  })

  it('discount is netted in profit (chart uses net sale total, not gross item subtotals)', async () => {
    await seedSale(300)
    const { chart } = await salesReport({ from: '2026-01-15', to: '2026-01-15' })
    expect(chart[0].profit_c).toBe(300) // 1500 gross total - 1200 cost, NOT 1800-1200
  })
})