import { db } from './db'
import type {
  PriceComparisonStatus,
  PriceReference,
  PriceReferenceInput,
  PriceSourceType,
  PriceSyncResult
} from '../shared/types'
import { SEED_PRICE_REFERENCES } from './seedPriceReferences'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  sanitized?: PriceReferenceInput
}

export function validatePriceReferenceInput(input: PriceReferenceInput): ValidationResult {
  const errors: string[] = []
  const productName = input.product_name?.trim() || ''
  const sourceName = input.source_name?.trim() || ''

  if (!productName) {
    errors.push('Product name is required.')
  }
  if (!sourceName) {
    errors.push('Source name is required.')
  }

  const checkPrice = (val: number | null | undefined, name: string): number | null => {
    if (val === undefined || val === null) return null
    if (typeof val !== 'number' || isNaN(val) || !Number.isInteger(val) || val < 0) {
      errors.push(`${name} must be a non-negative integer centavos.`)
      return null
    }
    return val
  }

  const marketPriceC = checkPrice(input.market_price_c, 'Market price')
  const minPriceC = checkPrice(input.min_price_c, 'Minimum price')
  const maxPriceC = checkPrice(input.max_price_c, 'Maximum price')

  if (minPriceC !== null && maxPriceC !== null && minPriceC > maxPriceC) {
    errors.push('Minimum price cannot exceed maximum price.')
  }

  const validSourceTypes: PriceSourceType[] = ['official', 'market', 'reference', 'test']
  const sourceType =
    input.source_type && validSourceTypes.includes(input.source_type)
      ? input.source_type
      : 'market'

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      product_id: input.product_id ?? null,
      barcode: input.barcode?.trim() || null,
      product_name: productName,
      brand: input.brand?.trim() || null,
      variant: input.variant?.trim() || null,
      unit: input.unit?.trim() || null,
      image_path: input.image_path?.trim() || null,
      image_url: input.image_url?.trim() || null,
      market_price_c: marketPriceC,
      min_price_c: minPriceC,
      max_price_c: maxPriceC,
      currency: input.currency?.trim() || 'PHP',
      source_name: sourceName,
      source_type: sourceType,
      source_url: input.source_url?.trim() || null,
      location: input.location?.trim() || 'Philippines',
      effective_date: input.effective_date?.trim() || null
    }
  }
}

export async function ensureSeedData(): Promise<void> {
  try {
    const count = await db.priceReferences.count()
    if (count === 0) {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
      const rows: Omit<PriceReference, 'id'>[] = SEED_PRICE_REFERENCES.map((s) => ({
        product_id: s.product_id ?? null,
        barcode: s.barcode?.trim() || null,
        product_name: s.product_name.trim(),
        brand: s.brand?.trim() || null,
        variant: s.variant?.trim() || null,
        unit: s.unit?.trim() || null,
        image_path: s.image_path?.trim() || null,
        image_url: s.image_url?.trim() || null,
        market_price_c: s.market_price_c ?? null,
        min_price_c: s.min_price_c ?? null,
        max_price_c: s.max_price_c ?? null,
        currency: s.currency || 'PHP',
        source_name: s.source_name || 'DTI SRP & Market Price Guide',
        source_type: s.source_type || 'market',
        source_url: s.source_url?.trim() || null,
        location: s.location || 'Philippines',
        effective_date: s.effective_date || null,
        retrieved_at: now,
        last_synced_at: now,
        created_at: now,
        updated_at: now
      }))
      await db.priceReferences.bulkAdd(rows as any)
    }
  } catch (e) {
    // Non-blocking
    console.warn('[priceReferences] ensureSeedData error:', e)
  }
}

export async function getPriceReference(id: number): Promise<PriceReference | undefined> {
  return db.priceReferences.get(id)
}

export async function getPriceReferenceByProductId(
  productId: number
): Promise<PriceReference | undefined> {
  const matches = await db.priceReferences
    .where('product_id')
    .equals(productId)
    .toArray()
  if (matches.length === 0) return undefined
  return matches.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0]
}

export async function getPriceReferenceByBarcode(
  barcode: string
): Promise<PriceReference | undefined> {
  if (!barcode || !barcode.trim()) return undefined
  const matches = await db.priceReferences
    .where('barcode')
    .equals(barcode.trim())
    .toArray()
  if (matches.length === 0) return undefined
  return matches.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0]
}

export async function matchForProduct(product: {
  id: number
  name: string
  barcode?: string | null
}): Promise<PriceReference | null> {
  await ensureSeedData()

  // 1. Direct product link
  const linked = await getPriceReferenceByProductId(product.id)
  if (linked) return linked

  // 2. Exact barcode match
  if (product.barcode?.trim()) {
    const byBarcode = await getPriceReferenceByBarcode(product.barcode.trim())
    if (byBarcode) return byBarcode
  }

  // 3. Normalized name match
  const targetName = product.name.trim().toLowerCase()
  const all = await db.priceReferences.toArray()
  const exactNameMatch = all.find(
    (r) => r.product_name.trim().toLowerCase() === targetName
  )
  if (exactNameMatch) return exactNameMatch

  // 4. Substring containment match
  const substringMatch = all.find(
    (r) =>
      targetName.includes(r.product_name.trim().toLowerCase()) ||
      r.product_name.trim().toLowerCase().includes(targetName)
  )
  return substringMatch || null
}

export async function linkPriceReference(
  referenceId: number,
  productId: number
): Promise<PriceReference> {
  const existing = await db.priceReferences.get(referenceId)
  if (!existing) throw new Error(`Price reference #${referenceId} not found.`)
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  await db.priceReferences.update(referenceId, {
    product_id: productId,
    updated_at: now
  })
  return (await db.priceReferences.get(referenceId))!
}

export async function unlinkPriceReference(referenceId: number): Promise<PriceReference> {
  const existing = await db.priceReferences.get(referenceId)
  if (!existing) throw new Error(`Price reference #${referenceId} not found.`)
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  await db.priceReferences.update(referenceId, {
    product_id: null,
    updated_at: now
  })
  return (await db.priceReferences.get(referenceId))!
}

export function comparePrice(
  retailPriceC: number,
  reference: PriceReference | null | undefined
): PriceComparisonStatus {
  if (!reference) return 'NO_REFERENCE'

  const hasRange = reference.min_price_c !== null && reference.max_price_c !== null
  if (hasRange) {
    if (retailPriceC < reference.min_price_c!) return 'BELOW_RANGE'
    if (retailPriceC > reference.max_price_c!) return 'ABOVE_RANGE'
    return 'WITHIN_RANGE'
  }

  if (reference.market_price_c !== null) {
    if (retailPriceC < reference.market_price_c) return 'BELOW_RANGE'
    if (retailPriceC > reference.market_price_c) return 'ABOVE_RANGE'
    return 'WITHIN_RANGE'
  }

  return 'NO_REFERENCE'
}

export interface SearchPriceReferencesOptions {
  query?: string
  sourceType?: PriceSourceType
  linkedOnly?: boolean
  unlinkedOnly?: boolean
  limit?: number
  offset?: number
}

export async function searchPriceReferences(
  options: SearchPriceReferencesOptions = {}
): Promise<{ rows: PriceReference[]; references: PriceReference[]; total: number }> {
  await ensureSeedData()

  let list = await db.priceReferences.toArray()

  if (options.sourceType) {
    list = list.filter((r) => r.source_type === options.sourceType)
  }

  if (options.linkedOnly) {
    list = list.filter((r) => r.product_id !== null && r.product_id !== undefined)
  } else if (options.unlinkedOnly) {
    list = list.filter((r) => r.product_id === null || r.product_id === undefined)
  }

  if (options.query?.trim()) {
    const q = options.query.trim().toLowerCase()
    list = list.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        (r.brand && r.brand.toLowerCase().includes(q)) ||
        (r.barcode && r.barcode.toLowerCase().includes(q))
    )
  }

  // Sort by updated_at DESC, id DESC
  list.sort((a, b) => {
    const timeA = a.updated_at || a.created_at || ''
    const timeB = b.updated_at || b.created_at || ''
    const cmp = timeB.localeCompare(timeA)
    return cmp !== 0 ? cmp : b.id - a.id
  })

  const total = list.length
  const offset = options.offset ?? 0
  const limit = options.limit ?? 50
  const rows = list.slice(offset, offset + limit)

  return { rows, references: rows, total }
}

export interface PriceReferenceStatus {
  total: number
  last_synced_at: string | null
  is_stale: boolean
  sources: { source_name: string; count: number }[]
}

export async function getPriceReferenceStatus(): Promise<PriceReferenceStatus> {
  await ensureSeedData()
  const list = await db.priceReferences.toArray()
  const total = list.length

  let lastSynced: string | null = null
  const sourceCountMap = new Map<string, number>()

  for (const r of list) {
    if (r.last_synced_at) {
      if (!lastSynced || r.last_synced_at > lastSynced) {
        lastSynced = r.last_synced_at
      }
    }
    const sName = r.source_name || 'Unknown'
    sourceCountMap.set(sName, (sourceCountMap.get(sName) || 0) + 1)
  }

  let isStale = true
  if (lastSynced) {
    const syncTime = new Date(lastSynced).getTime()
    // Stale if older than 30 days
    isStale = Date.now() - syncTime > 30 * 24 * 60 * 60 * 1000
  }

  const sources = Array.from(sourceCountMap.entries())
    .map(([source_name, count]) => ({ source_name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    total,
    last_synced_at: lastSynced,
    is_stale: isStale,
    sources
  }
}

export const DEFAULT_REMOTE_PRICE_FEED_URL =
  'https://raw.githubusercontent.com/Yazerukun/TINDA-POS/master/data/price-catalog.json'

export interface SyncPriceReferencesOptions {
  force?: boolean
  remoteUrl?: string
  catalogData?: PriceReferenceInput[]
}

export async function syncPriceReferences(
  options: SyncPriceReferencesOptions = {}
): Promise<PriceSyncResult> {
  await ensureSeedData()

  let catalogToSync: PriceReferenceInput[] | null = options.catalogData ?? null

  if (!catalogToSync) {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    if (!isOnline) {
      const status = await getPriceReferenceStatus()
      return {
        success: false,
        synced_count: 0,
        rejected_count: 0,
        errors: ['No internet connection.'],
        last_synced_at: status.last_synced_at || 'Never',
        message: 'Offline — Showing Last Saved Data',
        is_offline: true
      }
    }

    const urlToFetch = options.remoteUrl || DEFAULT_REMOTE_PRICE_FEED_URL
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(urlToFetch, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          catalogToSync = data
        }
      }
    } catch {
      // Fallback to bundled seed data
    }

    if (!catalogToSync || catalogToSync.length === 0) {
      catalogToSync = SEED_PRICE_REFERENCES
    }
  }

  let syncedCount = 0
  let rejectedCount = 0
  const errors: string[] = []
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  for (const item of catalogToSync) {
    const validation = validatePriceReferenceInput(item)
    if (!validation.valid || !validation.sanitized) {
      rejectedCount++
      errors.push(`Item "${item.product_name || 'unknown'}": ${validation.errors.join('; ')}`)
      continue
    }

    const s = validation.sanitized
    try {
      // Look up existing by barcode or product_name
      let existing: PriceReference | undefined
      if (s.barcode) {
        existing = await db.priceReferences.where('barcode').equals(s.barcode).first()
      }
      if (!existing) {
        const allByName = await db.priceReferences
          .where('product_name')
          .equalsIgnoreCase(s.product_name)
          .toArray()
        existing = allByName[0]
      }

      if (existing) {
        await db.priceReferences.update(existing.id, {
          market_price_c: s.market_price_c,
          min_price_c: s.min_price_c,
          max_price_c: s.max_price_c,
          currency: s.currency,
          source_name: s.source_name,
          source_type: s.source_type,
          source_url: s.source_url,
          location: s.location,
          effective_date: s.effective_date,
          image_url: s.image_url || existing.image_url,
          last_synced_at: now,
          updated_at: now
        })
      } else {
        await db.priceReferences.add({
          product_id: s.product_id ?? null,
          barcode: s.barcode,
          product_name: s.product_name,
          brand: s.brand,
          variant: s.variant,
          unit: s.unit,
          image_path: s.image_path,
          image_url: s.image_url,
          market_price_c: s.market_price_c,
          min_price_c: s.min_price_c,
          max_price_c: s.max_price_c,
          currency: s.currency || 'PHP',
          source_name: s.source_name,
          source_type: s.source_type || 'market',
          source_url: s.source_url,
          location: s.location || 'Philippines',
          effective_date: s.effective_date,
          retrieved_at: now,
          last_synced_at: now,
          created_at: now,
          updated_at: now
        } as PriceReference)
      }
      syncedCount++
    } catch (err: unknown) {
      rejectedCount++
      errors.push(
        `Item "${item.product_name}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return {
    success: true,
    synced_count: syncedCount,
    rejected_count: rejectedCount,
    errors,
    last_synced_at: now,
    message: `Successfully synchronized ${syncedCount} price reference(s)${
      rejectedCount > 0 ? ` (${rejectedCount} rejected)` : ''
    }.`,
    is_offline: false
  }
}
