import { CANONICAL_TABLES, FORMAT_ID, FORMAT_VERSION, SCHEMA_VERSION, WINDOWS_TABLES } from './canonical'
import { computeChecksum } from './format'
import type { BackupSourcePlatform, TindaBackupFile, UnsupportedFieldReport, ValidationIssue, ValidationResult } from './types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateBackupFile(file: TindaBackupFile): ValidationResult {
  const issues: ValidationIssue[] = []
  const fail = (code: string, message: string, extra?: Partial<ValidationIssue>) =>
    issues.push({ code, message, ...extra })

  if (!isPlainObject(file)) { fail('invalid', 'Backup file is not an object.'); return { ok: false, issues } }
  if (!isPlainObject(file.manifest)) { fail('invalid', 'Missing manifest.'); return { ok: false, issues } }
  if (file.manifest.format !== FORMAT_ID) fail('bad-format', `Unsupported format "${file.manifest.format}".`)
  if (file.manifest.formatVersion !== FORMAT_VERSION)
    fail('bad-version', `Unsupported format version ${file.manifest.formatVersion}; this build supports ${FORMAT_VERSION}.`)
  if (file.manifest.source.platform !== 'windows' && file.manifest.source.platform !== 'android')
    fail('bad-source', `Unsupported source platform "${file.manifest.source.platform}".`)
  if (typeof file.manifest.createdAt !== 'string' || Number.isNaN(Date.parse(file.manifest.createdAt)))
    fail('bad-date', 'Invalid createdAt date.')
  if (file.manifest.source.schemaVersion > SCHEMA_VERSION)
    fail('future-schema', `Backup uses schema ${file.manifest.source.schemaVersion}, newer than supported ${SCHEMA_VERSION}.`)

  if (!isPlainObject(file.data)) { fail('invalid', 'Missing data.'); return { ok: false, issues } }
  if (!Array.isArray(file.data.tables)) { fail('invalid', 'data.tables must be an array.'); return { ok: false, issues } }
  if (file.data.settings !== null && !isPlainObject(file.data.settings))
    fail('invalid', 'data.settings must be an object or null.')

  const seen = new Set<string>()
  for (const table of file.data.tables) {
    if (!isPlainObject(table)) { fail('bad-table', 'Table entry must be an object.'); continue }
    if (!CANONICAL_TABLES.includes(table.name as never)) {
      fail('unknown-table', `Unknown table "${table.name}".`, { table: table.name })
      continue
    }
    if (seen.has(table.name)) fail('duplicate-table', `Duplicate table "${table.name}".`, { table: table.name })
    seen.add(table.name)
    if (!Array.isArray(table.rows)) { fail('bad-rows', `"${table.name}".rows must be an array.`, { table: table.name }); continue }
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i]
      if (!isPlainObject(row)) {
        fail('bad-row', `Row ${i} of "${table.name}" is not an object.`, { table: table.name, row: i })
        continue
      }
      if ('id' in row && typeof row.id !== 'number') {
        fail('bad-id', `Row ${i} of "${table.name}": id must be a number.`, { table: table.name, row: i })
      }
      if ('created_at' in row && typeof row.created_at === 'string' && Number.isNaN(Date.parse(row.created_at))) {
        fail('bad-date', `Row ${i} of "${table.name}": invalid created_at.`, { table: table.name, row: i })
      }
    }
  }

  if (typeof file.checksum !== 'string' || file.checksum.length === 0) {
    fail('bad-checksum', 'Missing checksum.')
  }
  return { ok: issues.length === 0, issues }
}

export async function verifyChecksum(file: TindaBackupFile): Promise<boolean> {
  return file.checksum === (await computeChecksum(file.data))
}

const ANDROID_CANONICAL_MAP: Record<string, string> = {
  categories: 'categories',
  suppliers: 'suppliers',
  products: 'products',
  batches: 'stock_batches',
  movements: 'inventory_movements',
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

export function supportedCanonicalTables(platform: BackupSourcePlatform): Set<string> {
  if (platform === 'windows') return new Set(WINDOWS_TABLES)
  return new Set(Object.values(ANDROID_CANONICAL_MAP))
}

export function unsupportedFieldsReport(file: TindaBackupFile, targetPlatform: BackupSourcePlatform): UnsupportedFieldReport {
  const supported = supportedCanonicalTables(targetPlatform)
  const unsupported = file.data.tables
    .filter((t) => !supported.has(t.name))
    .map((t) => ({ name: t.name, reason: `Not represented on ${targetPlatform}.` }))
  return {
    unsupportedTables: unsupported,
    summary:
      unsupported.length === 0
        ? `All ${file.data.tables.length} tables are supported on ${targetPlatform}.`
        : `${unsupported.length} of ${file.data.tables.length} tables cannot be restored on ${targetPlatform}: ${unsupported
            .map((u) => u.name)
            .join(', ')}.`
  }
}