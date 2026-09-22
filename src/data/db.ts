// Persistent local store for the Android build.
//
// Everything the store needs survives a restart lives here: settings, users,
// products with their units, stock movements, sales with their items and
// payments, utang (credit) ledgers, shifts, cash counts, Z-reads and backups.
// IndexedDB is backed by the app's own data directory, so a WebView reload or
// an app relaunch keeps the data — unlike the previous in-memory stub.

import Dexie, { type Table } from 'dexie'
import type {
  AuditLog,
  CashCountRecord,
  CashMovement,
  Category,
  CreditLedgerEntry,
  Customer,
  Expense,
  ExpenseCategory,
  HeldSale,
  InventoryMovement,
  PriceReference,
  Product,
  Refund,
  Sale,
  Shift,
  StockBatch,
  StockReceivingRecord,
  Supplier,
  User,
  ZRead
} from '@shared/types'

export interface MetaRow {
  key: string
  value: string
}

export interface SessionRow {
  id: number
  user_id: number
  created_at: string
}

/** Users gain the credential hash columns the renderer must never see. */
export interface UserRow extends User {
  password_hash: string
  pin_hash: string
}

export interface HeldSaleRow extends HeldSale {
  payload: string
}

export interface BackupRow {
  filename: string
  created_at: string
  size: number
  reason: string | null
  payload: string
}

class TindaDatabase extends Dexie {
  meta!: Table<MetaRow, string>
  sessions!: Table<SessionRow, number>
  users!: Table<UserRow, number>
  categories!: Table<Category, number>
  suppliers!: Table<Supplier, number>
  products!: Table<Product, number>
  batches!: Table<StockBatch, number>
  movements!: Table<InventoryMovement, number>
  receiving!: Table<StockReceivingRecord, number>
  customers!: Table<Customer, number>
  credit!: Table<CreditLedgerEntry, number>
  expenseCategories!: Table<ExpenseCategory, number>
  expenses!: Table<Expense, number>
  sales!: Table<Sale, number>
  held!: Table<HeldSaleRow, number>
  refunds!: Table<Refund, number>
  shifts!: Table<Shift, number>
  cashMovements!: Table<CashMovement, number>
  cashCounts!: Table<CashCountRecord, number>
  zReads!: Table<ZRead, number>
  audit!: Table<AuditLog, number>
  backups!: Table<BackupRow, string>
  priceReferences!: Table<PriceReference, number>

  constructor() {
    super('tinda-pos-free')
    this.version(1).stores({
      meta: 'key',
      sessions: 'id',
      users: '++id, &username',
      categories: '++id, &name',
      suppliers: '++id, name, status',
      products: '++id, name, sku, barcode, category_id, status, updated_at',
      batches: '++id, product_id, expiration_date',
      movements: '++id, product_id, movement_type, created_at',
      receiving: '++id, product_id, created_at',
      customers: '++id, full_name, is_active',
      credit: '++id, customer_id, created_at',
      expenseCategories: '++id, &name',
      expenses: '++id, category_id, expense_date',
      sales: '++id, transaction_no, created_at, status, shift_id',
      held: '++id, token',
      refunds: '++id, sale_id, created_at',
      shifts: '++id, status, opened_at',
      cashMovements: '++id, shift_id, created_at',
      cashCounts: '++id, shift_id, business_date',
      zReads: '++id, shift_id',
      audit: '++id, created_at',
      backups: 'filename'
    })
    // v2 adds the supplier index products are queried by (Supplier detail page).
    // IndexedDB indexes a key path, so an existing store cannot gain one without
    // a schema version bump — Dexie rebuilds/products the index on upgrade.
    this.version(2).stores({
      products: '++id, name, sku, barcode, category_id, status, updated_at, supplier_id'
    })
    // v3 adds the price references table for TINDA BANTAY market prices catalog.
    this.version(3).stores({
      priceReferences: '++id, product_id, barcode, product_name, brand, category, source_name, last_synced_at'
    })
    // v4 adds parent_id to categories for main→sub hierarchy.
    // Existing categories automatically get parent_id=null (top-level) — zero data loss.
    this.version(4).stores({
      categories: '++id, &name, parent_id'
    })
  }
}

export const db = new TindaDatabase()

/** Tables wiped by "reset database" / restore. Order matters for readability only. */
export const DATA_TABLES = [
  'categories',
  'suppliers',
  'products',
  'batches',
  'movements',
  'receiving',
  'customers',
  'credit',
  'expenseCategories',
  'expenses',
  'sales',
  'held',
  'refunds',
  'shifts',
  'cashMovements',
  'cashCounts',
  'zReads',
  'audit',
  'sessions',
  'users'
] as const

export type DataTableName = (typeof DATA_TABLES)[number]
