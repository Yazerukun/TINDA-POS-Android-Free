import { db, DATA_TABLES } from './db'
import type { DataTableName } from './db'
import { buildBackupFile } from '../shared/tindaBackup/format'
import type { TindaBackupData, TindaBackupFile, TindaBackupTable } from '../shared/tindaBackup/types'
import { unsupportedFieldsReport, validateBackupFile, verifyChecksum } from '../shared/tindaBackup/validate'
import { APP_VERSION, defaultSettings, getSettings, updateSettings } from './system'

/** Dexie collection name -> canonical table name. */
const DEXIE_TO_CANONICAL: Record<string, string> = {
  categories: 'categories',
  suppliers: 'suppliers',
  products: 'products',
  batches: 'stock_batches',
  movements: 'inventory_movements',
  receiving: 'purchases',
  customers: 'customers',
  credit: 'credit_ledger',
  expenseCategories: 'expense_categories',
  expenses: 'expenses',
  sales: 'sales',
  held: 'held_sales',
  refunds: 'refunds',
  shifts: 'shifts',
  cashMovements: 'cash_movements',
  cashCounts: 'cash_counts',
  zReads: 'z_reads',
  audit: 'audit_logs',
  users: 'users'
}

/** Collections not carried by the universal backup (ephemeral / no Windows equivalent). */
const SKIPPED: Record<string, string> = {
  sessions: 'Active sessions are ephemeral and never backed up.',
  held: 'Held carts are ephemeral and not portable across platforms.',
  backups: 'Backup history is app-local.',
  receiving: 'Raw receiving events; stock-in is carried via inventory_movements.'
}

const CANONICAL_TO_DEXIE = Object.fromEntries(Object.entries(DEXIE_TO_CANONICAL).map(([k, v]) => [v, k]))
const EXCLUDED_CANONICAL = new Set(['held_sales', 'purchases', 'purchase_items', 'batch_movements', 'user_roles'])

async function toArray(table: DataTableName): Promise<Record<string, unknown>[]> {
  return (db.table(table) as { toArray: () => Promise<Record<string, unknown>[]> }).toArray()
}

function splitEmbedded(rows: Record<string, unknown>[], key: string): { outer: Record<string, unknown>[]; children: Record<string, unknown>[][]; defaults: Record<string, unknown> } {
  const outer: Record<string, unknown>[] = []
  const children: Record<string, unknown>[][] = []
  for (const row of rows) {
    const embedded = (row[key] as Record<string, unknown>[] | undefined) ?? []
    delete row[key]
    outer.push(row)
    children.push(embedded)
  }
  const defaultChild = Object.fromEntries(
    Object.entries(rows[0]?.[key] ?? {}).filter(([, v]) => typeof v !== 'object')
  )
  void defaultChild
  return { outer, children, defaults: {} }
}

async function snapshotCanonical(): Promise<TindaBackupData> {
  const settings = await getSettings()
  const tables: TindaBackupTable[] = []
  const push = (name: string, rows: Record<string, unknown>[]) => rows.length > 0 && tables.push({ name, rows })

  const rows = await toArray('products')
  const units: Record<string, unknown>[] = []
  const products = rows.map((p) => {
    const embedded = (p.units as Record<string, unknown>[] | undefined) ?? []
    delete p.units
    for (const u of embedded) units.push({ ...u, product_id: p.id })
    return p
  })
  push('products', products)
  push('product_units', units)

  const sales = await toArray('sales')
  const saleItems: Record<string, unknown>[] = []
  const payments: Record<string, unknown>[] = []
  for (const s of sales) {
    for (const it of (s.items as Record<string, unknown>[] | undefined) ?? []) saleItems.push({ ...it, sale_id: s.id })
    for (const p of (s.payments as Record<string, unknown>[] | undefined) ?? []) payments.push({ ...p, sale_id: s.id })
    delete s.items
    delete s.payments
  }
  push('sales', sales)
  push('sale_items', saleItems)
  push('payments', payments)

  const refunds = await toArray('refunds')
  const refundItems: Record<string, unknown>[] = []
  for (const r of refunds) {
    for (const it of (r.items as Record<string, unknown>[] | undefined) ?? []) refundItems.push({ ...it, refund_id: r.id })
    delete r.items
  }
  push('refunds', refunds)
  push('refund_items', refundItems)

  for (const dexie of DATA_TABLES) {
    const canonical = DEXIE_TO_CANONICAL[dexie]
    if (!canonical || SKIPPED[dexie] || canonical === 'products' || canonical === 'sales' || canonical === 'refunds') continue
    push(canonical, await toArray(dexie))
  }
  return { settings: settings as unknown as Record<string, unknown>, tables }
}

export async function exportUniversalBackup(): Promise<string> {
  const file = await buildBackupFile(
    await snapshotCanonical(),
    { platform: 'android', appVersion: APP_VERSION, schemaVersion: 1 }
  )
  return JSON.stringify(file)
}

function groupBy<T>(rows: T[], key: (r: T) => unknown): Map<unknown, T[]> {
  const map = new Map<unknown, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = map.get(k)
    if (list) list.push(r)
    else map.set(k, [r])
  }
  return map
}

function attachEmbedded<T>(outer: T[], children: Record<string, unknown>[], parentKey: string, childKey: string): T[] {
  const grouped = groupBy(children, (c) => c[parentKey])
  return outer.map((row) => ({
    ...row,
    [childKey]: grouped.get((row as Record<string, unknown>).id) ?? []
  }))
}

function safeSettings(input: Record<string, unknown>): Record<string, unknown> {
  const defaults = defaultSettings()
  const out: Record<string, unknown> = {}
  for (const [key, fallback] of Object.entries(defaults)) {
    if (!(key in input)) { out[key] = fallback; continue }
    const value = input[key]
    if (typeof fallback === 'boolean') out[key] = value === true || value === 'true' || value === '1'
    else if (typeof fallback === 'number') out[key] = Number(value)
    else if (fallback === null) out[key] = value
    else out[key] = String(value ?? '')
  }
  return out
}

export async function importUniversalBackup(text: string): Promise<{
  counts: Record<string, number>
  unsupported: ReturnType<typeof unsupportedFieldsReport>
  restarted: boolean
}> {
  const file = JSON.parse(text) as TindaBackupFile
  const validated = validateBackupFile(file)
  if (!validated.ok) {
    throw new Error(`Invalid backup: ${validated.issues.map((i) => i.message).join('; ')}`)
  }
  if (!(await verifyChecksum(file))) {
    throw new Error('Backup checksum mismatch: file is corrupted or was tampered with.')
  }
  const unsupported = unsupportedFieldsReport(file, 'android')
  const byName = new Map(file.data.tables.map((t) => [t.name, t.rows]))

  const counts = Object.fromEntries(file.data.tables.map((t) => [t.name, t.rows.length])) as Record<string, number>

  for (const dexie of DATA_TABLES) {
    await (db.table(dexie) as { clear: () => Promise<void> }).clear()
  }
  void EXCLUDED_CANONICAL

  const targets: { table: DataTableName; rows: Record<string, unknown>[] }[] = []
  const target = (canonical: string, rows: Record<string, unknown>[]) => {
    const dexie = CANONICAL_TO_DEXIE[canonical]
    if (dexie && rows.length > 0) targets.push({ table: dexie as DataTableName, rows })
  }

  target(
    'products',
    attachEmbedded(byName.get('products') ?? [], byName.get('product_units') ?? [], 'product_id', 'units')
  )
  target(
    'sales',
    attachEmbedded(
      attachEmbedded(byName.get('sales') ?? [], byName.get('sale_items') ?? [], 'sale_id', 'items'),
      byName.get('payments') ?? [],
      'sale_id',
      'payments'
    )
  )
  target('refunds', attachEmbedded(byName.get('refunds') ?? [], byName.get('refund_items') ?? [], 'refund_id', 'items'))

  const direct: [string, string][] = [
    ['categories', 'categories'],
    ['suppliers', 'suppliers'],
    ['customers', 'customers'],
    ['expenses', 'expenses'],
    ['shifts', 'shifts'],
    ['stock_batches', 'batches'],
    ['inventory_movements', 'movements'],
    ['credit_ledger', 'credit'],
    ['expense_categories', 'expenseCategories'],
    ['cash_movements', 'cashMovements'],
    ['cash_counts', 'cashCounts'],
    ['z_reads', 'zReads'],
    ['audit_logs', 'audit'],
    ['users', 'users']
  ]
  for (const [canonical, dexie] of direct) {
    const rows = byName.get(canonical)
    if (rows && rows.length > 0) targets.push({ table: dexie as DataTableName, rows })
  }

  for (const t of targets) {
    await (db.table(t.table) as { bulkPut: (rows: Record<string, unknown>[]) => Promise<unknown> }).bulkPut(t.rows)
  }
  if (file.data.settings) {
    await updateSettings(safeSettings(file.data.settings))
  }
  await (db.audit as unknown as { add: (row: Record<string, unknown>) => Promise<unknown> }).add({
    action: 'UNIVERSAL_IMPORT',
    entity_type: 'backup',
    new_value: JSON.stringify(counts),
    created_at: new Date().toISOString()
  })
  return { counts, unsupported, restarted: false }
}