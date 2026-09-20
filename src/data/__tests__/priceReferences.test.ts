import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '../db'
import {
  ensureSeedData,
  searchPriceReferences,
  getPriceReference,
  getPriceReferenceByBarcode,
  getPriceReferenceByProductId,
  matchForProduct,
  linkPriceReference,
  unlinkPriceReference,
  comparePrice,
  getPriceReferenceStatus,
  syncPriceReferences
} from '../priceReferences'
import { SEED_PRICE_REFERENCES } from '../seedPriceReferences'

describe('Android Price References (TINDA BANTAY)', () => {
  beforeEach(async () => {
    await db.priceReferences.clear()
    await db.products.clear()
  })

  it('has all 172 pre-bundled items in SEED_PRICE_REFERENCES', () => {
    expect(SEED_PRICE_REFERENCES.length).toBe(172)
    // Check some well-known Filipino essentials
    const pancitCanton = SEED_PRICE_REFERENCES.find((p) =>
      p.product_name.includes('Lucky Me Pancit Canton')
    )
    expect(pancitCanton).toBeDefined()
    expect(pancitCanton?.market_price_c).toBe(1050) // ₱10.50
  })

  it('ensureSeedData populates 172 items on an empty store', async () => {
    expect(await db.priceReferences.count()).toBe(0)
    await ensureSeedData()
    expect(await db.priceReferences.count()).toBe(172)

    // Running again does not duplicate
    await ensureSeedData()
    expect(await db.priceReferences.count()).toBe(172)
  })

  it('searchPriceReferences filters by query, source type, and link status', async () => {
    await ensureSeedData()

    // Query search
    const luckyMe = await searchPriceReferences({ query: 'Lucky Me' })
    expect(luckyMe.total).toBeGreaterThan(0)
    expect(luckyMe.rows.every((r) => r.product_name.includes('Lucky Me') || r.brand?.includes('Lucky Me'))).toBe(true)

    // Barcode search
    const byBarcode = await searchPriceReferences({ query: '4800016644810' })
    expect(byBarcode.total).toBe(1)
    expect(byBarcode.rows[0].barcode).toBe('4800016644810')

    // Link status filter
    const unlinked = await searchPriceReferences({ unlinkedOnly: true })
    expect(unlinked.total).toBe(172)

    const linked = await searchPriceReferences({ linkedOnly: true })
    expect(linked.total).toBe(0)
  })

  it('matchForProduct matches by barcode and normalized name', async () => {
    await ensureSeedData()

    // 1. By exact barcode
    const match1 = await matchForProduct({
      id: 101,
      name: 'Pancit Canton',
      barcode: '4800016644810'
    })
    expect(match1).not.toBeNull()
    expect(match1?.barcode).toBe('4800016644810')

    // 2. By exact name (case-insensitive)
    const match2 = await matchForProduct({
      id: 102,
      name: 'lucky me pancit canton original 60g'
    })
    expect(match2).not.toBeNull()
    expect(match2?.product_name).toBe('Lucky Me Pancit Canton Original 60g')

    // 3. Unmatched
    const match3 = await matchForProduct({
      id: 103,
      name: 'Nonexistent Commodity 9999XYZ'
    })
    expect(match3).toBeNull()
  })

  it('linkPriceReference and unlinkPriceReference update association', async () => {
    await ensureSeedData()
    const first = (await db.priceReferences.toArray())[0]

    const linked = await linkPriceReference(first.id, 42)
    expect(linked.product_id).toBe(42)

    const byProduct = await getPriceReferenceByProductId(42)
    expect(byProduct?.id).toBe(first.id)

    const unlinked = await unlinkPriceReference(first.id)
    expect(unlinked.product_id).toBeNull()
    expect(await getPriceReferenceByProductId(42)).toBeUndefined()
  })

  it('comparePrice accurately categorizes retail prices', () => {
    const ref = {
      id: 1,
      product_id: null,
      barcode: '123',
      product_name: 'Test Item',
      brand: null,
      variant: null,
      unit: 'pc',
      image_path: null,
      image_url: null,
      market_price_c: 1000, // ₱10.00
      min_price_c: 900,     // ₱9.00
      max_price_c: 1200,    // ₱12.00
      currency: 'PHP',
      source_name: 'DTI',
      source_type: 'official' as const,
      source_url: null,
      location: null,
      effective_date: null,
      retrieved_at: '',
      last_synced_at: '',
      created_at: '',
      updated_at: ''
    }

    expect(comparePrice(1000, null)).toBe('NO_REFERENCE')
    expect(comparePrice(850, ref)).toBe('BELOW_RANGE')
    expect(comparePrice(900, ref)).toBe('WITHIN_RANGE')
    expect(comparePrice(1100, ref)).toBe('WITHIN_RANGE')
    expect(comparePrice(1200, ref)).toBe('WITHIN_RANGE')
    expect(comparePrice(1250, ref)).toBe('ABOVE_RANGE')
  })

  it('getPriceReferenceStatus reports correct total and freshness', async () => {
    await ensureSeedData()
    const status = await getPriceReferenceStatus()
    expect(status.total).toBe(172)
    expect(status.sources.length).toBeGreaterThan(0)
    expect(status.last_synced_at).toBeDefined()
  })
})
