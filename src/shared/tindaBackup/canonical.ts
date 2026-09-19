export const FORMAT_ID = 'tinda-pos-backup'
export const FORMAT_VERSION = 1
export const SCHEMA_VERSION = 1
export const BACKUP_EXTENSION = 'tinda-backup'

/**
 * Parent-before-child order: FK inserts must create referenced rows first.
 * DELETE runs in reverse (children first) to satisfy foreign_keys=ON.
 */
export const CANONICAL_TABLES = [
  'roles',
  'users',
  'user_roles',
  'categories',
  'suppliers',
  'products',
  'product_units',
  'stock_batches',
  'purchases',
  'purchase_items',
  'inventory_movements',
  'batch_movements',
  'customers',
  'credit_ledger',
  'expense_categories',
  'expenses',
  'sales',
  'sale_items',
  'payments',
  'held_sales',
  'held_sale_items',
  'refunds',
  'refund_items',
  'shifts',
  'cash_movements',
  'cash_counts',
  'z_reads',
  'audit_logs',
  'settings'
] as const

export type CanonicalTableName = (typeof CANONICAL_TABLES)[number]

/** Tables the Windows SQLite schema stores 1:1 under the same name. */
export const WINDOWS_TABLES = new Set<string>(CANONICAL_TABLES)

/** Android Dexie collection names that map to canonical tables. */
export const ANDROID_TABLES = new Set<string>([
  'categories', 'suppliers', 'products', 'batches', 'movements', 'receiving',
  'customers', 'credit', 'expenseCategories', 'expenses', 'sales', 'held',
  'refunds', 'shifts', 'cashMovements', 'cashCounts', 'zReads', 'audit', 'users'
])