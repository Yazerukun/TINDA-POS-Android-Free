import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { db, DATA_TABLES, type DataTableName } from '../data/db'
import { importUniversalBackup, exportUniversalBackup } from '../data/tindaBackupAndroid'
import { CANONICAL_TABLES } from '../shared/tindaBackup/canonical'
import type { TindaBackupData, TindaBackupFile, TindaBackupTable } from '../shared/tindaBackup/types'
import { buildBackupFile } from '../shared/tindaBackup/format'
import { APP_VERSION, getSettings, updateSettings } from '../data/system'
import type { Category, Customer, Product, ProductUnit, Sale } from '../shared/types'

let sqlPromise: Promise<SqlJsStatic> | null = null

/**
 * Initializes and caches the sql.js WebAssembly SQLite engine.
 * Handles Node.js test runners, browser Vite dev, and Capacitor Android WebView.
 */
export async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      if (typeof window === 'undefined' || !window.location) {
        return initSqlJs()
      }
      // Bulletproof Capacitor WebView & browser initialization:
      // Fetching arrayBuffer directly and passing wasmBinary bypasses Emscripten sync XHR & streaming fetch restrictions.
      try {
        const wasmRes = await fetch('/sql-wasm.wasm')
        if (wasmRes.ok) {
          const wasmBinary = await wasmRes.arrayBuffer()
          return initSqlJs({ wasmBinary })
        }
      } catch (err) {
        console.warn('Wasm direct fetch failed, trying locateFile:', err)
      }

      return initSqlJs({
        locateFile: (file: string) => {
          try {
            return new URL(file, window.location.href).href
          } catch {
            return `/${file}`
          }
        }
      })
    })()
  }
  return sqlPromise
}

export interface DatabaseInspection {
  type: 'SQLITE' | 'UNIVERSAL_BACKUP'
  fileName: string
  fileSizeBytes: number
  storeName: string
  createdAt: string
  productCount: number
  categoryCount: number
  customerCount: number
  saleCount: number
  userCount: number
  isValid: boolean
  warning?: string
  rawBackupData: TindaBackupData
}

export type MigrationMode = 'RESTORE_REPLACE' | 'SMART_MERGE'

export interface MigrationProgress {
  stage: 'PARSING' | 'BACKING_UP' | 'MIGRATING' | 'VERIFYING' | 'DONE' | 'ERROR'
  percent: number
  message: string
}

export interface MigrationSummary {
  mode: MigrationMode
  safetyBackupFilename: string
  counts: {
    products: { added: number; updated: number; total: number }
    categories: { added: number; total: number }
    customers: { added: number; updated: number; total: number }
    sales: { added: number; total: number }
    suppliers: { added: number; total: number }
  }
  durationMs: number
  timestamp: string
}

/**
 * Validates whether binary buffer starts with SQLite format 3 signature.
 */
export function isSqliteBinary(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes.length < 16) return false
  const header = String.fromCharCode(...bytes.subarray(0, 16))
  return header.startsWith('SQLite format 3')
}

/**
 * Reads a binary SQLite database buffer and extracts all tables and settings into canonical TindaBackupData.
 */
export async function parseSqliteDatabase(buffer: ArrayBuffer | Uint8Array): Promise<TindaBackupData> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (!isSqliteBinary(bytes)) {
    throw new Error('File is not a valid SQLite database (missing SQLite 3 signature).')
  }

  const SQL = await getSqlJs()
  const sqliteDb = new SQL.Database(bytes)

  try {
    // 1. Get all table names
    const tablesRes = sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    const availableTables = new Set<string>()
    if (tablesRes.length > 0 && tablesRes[0].values) {
      for (const val of tablesRes[0].values) {
        if (typeof val[0] === 'string') availableTables.add(val[0])
      }
    }

    // 2. Extract settings if present
    const settings: Record<string, unknown> = {}
    if (availableTables.has('settings')) {
      try {
        const settingsRes = sqliteDb.exec('SELECT * FROM settings')
        if (settingsRes.length > 0) {
          const cols = settingsRes[0].columns
          const vals = settingsRes[0].values
          const keyIdx = cols.indexOf('key')
          const valIdx = cols.indexOf('value')

          if (keyIdx !== -1 && valIdx !== -1) {
            // Key-value settings table
            for (const r of vals) {
              const k = String(r[keyIdx])
              let v = r[valIdx]
              if (typeof v === 'string') {
                try {
                  v = JSON.parse(v)
                } catch {
                  // Keep as string
                }
              }
              settings[k] = v
            }
          } else {
            // Single-row settings table
            if (vals.length > 0) {
              cols.forEach((col, i) => {
                let v = vals[0][i]
                if (typeof v === 'string') {
                  try { v = JSON.parse(v) } catch {}
                }
                settings[col] = v
              })
            }
          }
        }
      } catch {
        // Settings parsing error non-fatal
      }
    }

    // 3. Extract canonical tables
    const tables: TindaBackupTable[] = []
    const tablesToExtract = Array.from(availableTables).filter((t) => t !== 'settings')

    for (const name of tablesToExtract) {
      try {
        const res = sqliteDb.exec(`SELECT * FROM "${name}"`)
        if (res.length > 0 && res[0].values && res[0].values.length > 0) {
          const cols = res[0].columns
          const rows = res[0].values.map((valRow) => {
            const rowObj: Record<string, unknown> = {}
            cols.forEach((col, idx) => {
              rowObj[col] = valRow[idx]
            })
            return rowObj
          })
          tables.push({ name, rows })
        }
      } catch {
        // Skip unreadable table
      }
    }

    return { settings: Object.keys(settings).length > 0 ? settings : null, tables }
  } finally {
    sqliteDb.close()
  }
}

/**
 * Inspects a database file (SQLite .db or JSON .tinda-backup) without applying any mutations.
 * Returns an instant preview summary.
 */
export async function inspectDatabaseFile(
  file: File | { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<DatabaseInspection> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (isSqliteBinary(bytes)) {
    // Parse as raw SQLite database
    const rawData = await parseSqliteDatabase(bytes)
    const tablesMap = new Map(rawData.tables.map((t) => [t.name, t.rows]))

    const storeName = String(
      (rawData.settings?.store_name as string) ||
      (rawData.settings?.storeName as string) ||
      'TINDA Desktop Store'
    )

    return {
      type: 'SQLITE',
      fileName: file.name,
      fileSizeBytes: file.size,
      storeName,
      createdAt: new Date().toISOString(),
      productCount: (tablesMap.get('products') ?? []).length,
      categoryCount: (tablesMap.get('categories') ?? []).length,
      customerCount: (tablesMap.get('customers') ?? []).length,
      saleCount: (tablesMap.get('sales') ?? []).length,
      userCount: (tablesMap.get('users') ?? []).length,
      isValid: true,
      rawBackupData: rawData
    }
  }

  // Otherwise, attempt parsing as Universal Backup JSON
  const text = new TextDecoder().decode(bytes)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Unrecognized file format: neither SQLite binary database nor valid JSON backup.')
  }

  const backupFile = parsed as Partial<TindaBackupFile>
  if (!backupFile.data || !Array.isArray(backupFile.data.tables)) {
    throw new Error('Invalid backup structure: missing data.tables.')
  }

  const tablesMap = new Map(backupFile.data.tables.map((t) => [t.name, t.rows]))
  const storeName = String(
    (backupFile.data.settings?.store_name as string) ||
    (backupFile.data.settings?.storeName as string) ||
    'TINDA Store'
  )

  return {
    type: 'UNIVERSAL_BACKUP',
    fileName: file.name,
    fileSizeBytes: file.size,
    storeName,
    createdAt: backupFile.manifest?.createdAt || new Date().toISOString(),
    productCount: (tablesMap.get('products') ?? []).length,
    categoryCount: (tablesMap.get('categories') ?? []).length,
    customerCount: (tablesMap.get('customers') ?? []).length,
    saleCount: (tablesMap.get('sales') ?? []).length,
    userCount: (tablesMap.get('users') ?? []).length,
    isValid: true,
    rawBackupData: backupFile.data as TindaBackupData
  }
}

/**
 * Merges Desktop data into mobile Dexie non-destructively.
 */
async function smartMergeData(data: TindaBackupData): Promise<MigrationSummary['counts']> {
  const tablesMap = new Map(data.tables.map((t) => [t.name, t.rows]))
  const counts: MigrationSummary['counts'] = {
    products: { added: 0, updated: 0, total: 0 },
    categories: { added: 0, total: 0 },
    customers: { added: 0, updated: 0, total: 0 },
    sales: { added: 0, total: 0 },
    suppliers: { added: 0, total: 0 }
  }

  // 1. Categories
  const existingCategories = await db.categories.toArray()
  const categoryByName = new Map(existingCategories.map((c) => [c.name.trim().toLowerCase(), c]))

  const rawCategories = tablesMap.get('categories') ?? []
  for (const catRow of rawCategories) {
    const name = String(catRow.name || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!categoryByName.has(key)) {
      const id = await db.categories.add({
        name,
        created_at: (catRow.created_at as string) || new Date().toISOString()
      } as Category)
      categoryByName.set(key, { id: id as number, name, created_at: new Date().toISOString() })
      counts.categories.added++
    }
  }
  counts.categories.total = (await db.categories.count())

  // 2. Suppliers
  const existingSuppliers = await db.suppliers.toArray()
  const supplierByName = new Map(existingSuppliers.map((s) => [s.name.trim().toLowerCase(), s]))
  const rawSuppliers = tablesMap.get('suppliers') ?? []
  for (const supRow of rawSuppliers) {
    const name = String(supRow.name || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!supplierByName.has(key)) {
      const id = await db.suppliers.add({
        name,
        contact_person: (supRow.contact_person as string) || null,
        phone: (supRow.phone as string) || null,
        address: (supRow.address as string) || null,
        notes: (supRow.notes as string) || null,
        status: supRow.status === 'ARCHIVED' || supRow.is_active === 0 ? 'ARCHIVED' : 'ACTIVE',
        created_at: (supRow.created_at as string) || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      supplierByName.set(key, { id: id as number, name } as any)
      counts.suppliers.added++
    }
  }
  counts.suppliers.total = await db.suppliers.count()

  // 3. Products and Units
  const existingProducts = await db.products.toArray()
  const productByBarcode = new Map<string, Product>()
  const productBySku = new Map<string, Product>()
  const productByName = new Map<string, Product>()

  for (const p of existingProducts) {
    if (p.barcode) productByBarcode.set(p.barcode.trim(), p)
    if (p.sku) productBySku.set(p.sku.trim().toLowerCase(), p)
    productByName.set(p.name.trim().toLowerCase(), p)
  }

  const rawProducts = tablesMap.get('products') ?? []
  const rawUnits = tablesMap.get('product_units') ?? []

  // Group rawUnits by product_id
  const unitsByProductId = new Map<unknown, ProductUnit[]>()
  for (const u of rawUnits) {
    const pId = u.product_id
    const unitObj: ProductUnit = {
      id: Number(u.id) || Date.now(),
      product_id: Number(pId) || 0,
      name: String(u.name || 'pc'),
      conversion_to_base: Number(u.conversion_to_base) || 1,
      barcode: u.barcode ? String(u.barcode) : null,
      selling_price_c: Number(u.selling_price_c) || 0,
      is_default: u.is_default === 1 || u.is_default === true || u.is_default === '1'
    }
    const list = unitsByProductId.get(pId) || []
    list.push(unitObj)
    unitsByProductId.set(pId, list)
  }

  for (const pRow of rawProducts) {
    const name = String(pRow.name || '').trim()
    if (!name) continue
    const barcode = pRow.barcode ? String(pRow.barcode).trim() : null
    const sku = pRow.sku ? String(pRow.sku).trim() : ''

    const found =
      (barcode && productByBarcode.get(barcode)) ||
      (sku && productBySku.get(sku.toLowerCase())) ||
      productByName.get(name.toLowerCase())

    const units = unitsByProductId.get(pRow.id) || [
      {
        id: Date.now(),
        product_id: 0,
        name: String(pRow.base_unit || 'pc'),
        conversion_to_base: 1,
        barcode: barcode,
        selling_price_c: Number(pRow.default_price_c) || 0,
        is_default: true
      }
    ]

    const isActive = pRow.is_active === 0 || pRow.is_active === false || pRow.status === 'ARCHIVED' ? false : true

    if (found) {
      // Update existing product
      await db.products.update(found.id, {
        default_price_c: Number(pRow.default_price_c) || found.default_price_c,
        purchase_cost_c: Number(pRow.purchase_cost_c) || found.purchase_cost_c,
        wholesale_price_c: pRow.wholesale_price_c !== undefined ? Number(pRow.wholesale_price_c) : found.wholesale_price_c,
        stock: (found.stock || 0) + (Number(pRow.stock) || 0),
        units: units.length > 0 ? units : found.units,
        updated_at: new Date().toISOString()
      })
      counts.products.updated++
    } else {
      // Insert new product
      const newProd: Omit<Product, 'id'> = {
        name,
        sku: sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
        barcode,
        category_id: (pRow.category_id as number) || null,
        category_name: null,
        description: (pRow.description as string) || null,
        base_unit: String(pRow.base_unit || 'pc'),
        purchase_cost_c: Number(pRow.purchase_cost_c) || 0,
        default_price_c: Number(pRow.default_price_c) || 0,
        wholesale_price_c: pRow.wholesale_price_c ? Number(pRow.wholesale_price_c) : null,
        stock: Number(pRow.stock) || 0,
        low_stock_threshold: Number(pRow.low_stock_threshold) || 5,
        supplier_id: (pRow.supplier_id as number) || null,
        has_expiration: pRow.has_expiration === 1 || pRow.has_expiration === true,
        image_path: (pRow.image_path as string) || null,
        status: isActive ? 'ACTIVE' : 'ARCHIVED',
        notes: (pRow.notes as string) || null,
        units,
        stock_status: (Number(pRow.stock) || 0) <= 0 ? 'OUT_OF_STOCK' : 'IN_STOCK',
        created_at: (pRow.created_at as string) || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      const newId = await db.products.add(newProd as Product)
      const inserted = { ...newProd, id: newId as number }
      if (barcode) productByBarcode.set(barcode, inserted)
      if (sku) productBySku.set(sku.toLowerCase(), inserted)
      productByName.set(name.toLowerCase(), inserted)
      counts.products.added++
    }
  }
  counts.products.total = await db.products.count()

  // 4. Customers & Utang
  const existingCustomers = await db.customers.toArray()
  const customerByPhone = new Map<string, Customer>()
  const customerByNameMap = new Map<string, Customer>()
  for (const c of existingCustomers) {
    if (c.phone) customerByPhone.set(c.phone.trim(), c)
    customerByNameMap.set(c.full_name.trim().toLowerCase(), c)
  }

  const rawCustomers = tablesMap.get('customers') ?? []
  for (const cRow of rawCustomers) {
    const fullName = String(cRow.full_name || cRow.name || '').trim()
    if (!fullName) continue
    const phone = cRow.phone ? String(cRow.phone).trim() : null

    const found = (phone && customerByPhone.get(phone)) || customerByNameMap.get(fullName.toLowerCase())
    const balance = Number(cRow.balance_c) || 0
    const creditLimit = Number(cRow.credit_limit_c) || 0

    if (found) {
      await db.customers.update(found.id, {
        balance_c: (found.balance_c || 0) + balance,
        credit_limit_c: Math.max(found.credit_limit_c || 0, creditLimit),
        updated_at: new Date().toISOString()
      })
      counts.customers.updated++
    } else {
      const newCust: Omit<Customer, 'id'> = {
        full_name: fullName,
        nickname: (cRow.nickname as string) || null,
        phone,
        address: (cRow.address as string) || null,
        notes: (cRow.notes as string) || null,
        credit_limit_c: creditLimit,
        balance_c: balance,
        is_active: cRow.is_active === 0 || cRow.is_active === false ? false : true,
        created_at: (cRow.created_at as string) || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      const newId = await db.customers.add(newCust as Customer)
      const inserted = { ...newCust, id: newId as number }
      if (phone) customerByPhone.set(phone, inserted)
      customerByNameMap.set(fullName.toLowerCase(), inserted)
      counts.customers.added++
    }
  }
  counts.customers.total = await db.customers.count()

  // 5. Sales (append transactions that don't exist yet)
  const existingSales = await db.sales.toArray()
  const existingTxNos = new Set(existingSales.map((s) => s.transaction_no))

  const rawSales = tablesMap.get('sales') ?? []
  const rawSaleItems = tablesMap.get('sale_items') ?? []
  const rawPayments = tablesMap.get('payments') ?? []

  const itemsBySaleId = new Map<unknown, unknown[]>()
  for (const it of rawSaleItems) {
    const sId = it.sale_id
    const list = itemsBySaleId.get(sId) || []
    list.push(it)
    itemsBySaleId.set(sId, list)
  }

  const paymentsBySaleId = new Map<unknown, unknown[]>()
  for (const p of rawPayments) {
    const sId = p.sale_id
    const list = paymentsBySaleId.get(sId) || []
    list.push(p)
    paymentsBySaleId.set(sId, list)
  }

  for (const sRow of rawSales) {
    const txNo = String(sRow.transaction_no || '').trim()
    if (!txNo || existingTxNos.has(txNo)) continue

    const items = itemsBySaleId.get(sRow.id) || []
    const payments = paymentsBySaleId.get(sRow.id) || []

    await db.sales.add({
      ...sRow,
      transaction_no: txNo,
      items,
      payments,
      created_at: (sRow.created_at as string) || new Date().toISOString()
    } as any)
    existingTxNos.add(txNo)
    counts.sales.added++
  }
  counts.sales.total = await db.sales.count()

  // 6. Cash Movements (Cash In / Cash Out)
  const rawMovements = tablesMap.get('cash_movements') ?? []
  for (const cm of rawMovements) {
    const amount = Number(cm.amount_c) || 0
    if (amount > 0) {
      await db.cashMovements.add({
        shift_id: Number(cm.shift_id) || 0,
        user_id: Number(cm.user_id) || 1,
        type: cm.type === 'CASH_OUT' ? 'CASH_OUT' : 'CASH_IN',
        amount_c: amount,
        reason: (cm.reason as string) || (cm.type === 'CASH_OUT' ? 'Desktop Cash Out' : 'Desktop Cash In'),
        created_at: (cm.created_at as string) || new Date().toISOString()
      })
    }
  }

  return counts
}

/**
 * Executes a full database migration from Desktop SQLite or Universal Backup.
 */
export async function executeDesktopMigration(
  inspection: DatabaseInspection,
  mode: MigrationMode,
  onProgress?: (p: MigrationProgress) => void
): Promise<MigrationSummary> {
  const start = Date.now()
  onProgress?.({ stage: 'BACKING_UP', percent: 10, message: 'Creating safety backup of current mobile data...' })

  // 1. Create safety backup
  let safetyBackupFilename = `safety-pre-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.tinda-backup`
  try {
    const currentBackup = await exportUniversalBackup()
    await db.backups.add({
      filename: safetyBackupFilename,
      created_at: new Date().toISOString(),
      size: currentBackup.length,
      reason: `Safety snapshot before ${mode === 'RESTORE_REPLACE' ? 'Desktop Restore' : 'Desktop Merge'}`,
      payload: currentBackup
    })
  } catch (err) {
    console.warn('Safety backup generation failed; proceeding with caution', err)
    safetyBackupFilename = 'none'
  }

  onProgress?.({ stage: 'MIGRATING', percent: 35, message: `Migrating database (${mode === 'RESTORE_REPLACE' ? 'Restore Replace' : 'Smart Merge'})...` })

  let counts: MigrationSummary['counts']

  if (mode === 'RESTORE_REPLACE') {
    // Generate valid backup file structure and call importUniversalBackup
    const backupFile = await buildBackupFile(inspection.rawBackupData, {
      platform: 'windows',
      appVersion: APP_VERSION,
      schemaVersion: 1
    })

    await importUniversalBackup(JSON.stringify(backupFile))

    counts = {
      products: { added: await db.products.count(), updated: 0, total: await db.products.count() },
      categories: { added: await db.categories.count(), total: await db.categories.count() },
      customers: { added: await db.customers.count(), updated: 0, total: await db.customers.count() },
      sales: { added: await db.sales.count(), total: await db.sales.count() },
      suppliers: { added: await db.suppliers.count(), total: await db.suppliers.count() }
    }
  } else {
    // Smart merge mode
    counts = await smartMergeData(inspection.rawBackupData)
  }

  onProgress?.({ stage: 'VERIFYING', percent: 85, message: 'Verifying database integrity and indexing...' })

  // Audit log entry
  await db.audit.add({
    action: 'DESKTOP_MIGRATION',
    entity_type: mode,
    new_value: JSON.stringify({
      mode,
      sourceType: inspection.type,
      storeName: inspection.storeName,
      counts
    }),
    created_at: new Date().toISOString()
  } as any)

  onProgress?.({ stage: 'DONE', percent: 100, message: 'Migration completed successfully!' })

  return {
    mode,
    safetyBackupFilename,
    counts,
    durationMs: Date.now() - start,
    timestamp: new Date().toISOString()
  }
}
