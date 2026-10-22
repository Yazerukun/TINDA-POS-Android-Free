import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import {
  getSqlJs,
  isSqliteBinary,
  parseSqliteDatabase,
  inspectDatabaseFile,
  executeDesktopMigration
} from '../desktopMigrationService'

async function createMockSqliteDb(): Promise<Uint8Array> {
  const SQL = await getSqlJs()
  const sqlite = new SQL.Database()

  // 1. Settings
  sqlite.run(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO settings VALUES ('store_name', 'TINDA Desktop Express');
    INSERT INTO settings VALUES ('receipt_header', 'Welcome to TINDA POS');
  `)

  // 2. Categories
  sqlite.run(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, created_at TEXT);
    INSERT INTO categories VALUES (1, 'Beverages', '2026-01-01');
    INSERT INTO categories VALUES (2, 'Canned Goods', '2026-01-01');
  `)

  // 3. Products & Product Units
  sqlite.run(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      barcode TEXT,
      category_id INTEGER,
      base_unit TEXT,
      purchase_cost_c INTEGER,
      default_price_c INTEGER,
      stock INTEGER,
      low_stock_threshold INTEGER,
      is_active INTEGER,
      created_at TEXT
    );
    INSERT INTO products VALUES (1, 'San Miguel Pale Pilsen', 'SMP-330', '480000000001', 1, 'bottle', 4000, 5500, 24, 6, 1, '2026-01-01');
    INSERT INTO products VALUES (2, 'Century Tuna Flakes', 'CTF-155', '480000000002', 2, 'can', 2800, 3800, 50, 10, 1, '2026-01-01');

    CREATE TABLE product_units (
      id INTEGER PRIMARY KEY,
      product_id INTEGER,
      name TEXT,
      conversion_to_base INTEGER,
      barcode TEXT,
      selling_price_c INTEGER,
      is_default INTEGER
    );
    INSERT INTO product_units VALUES (101, 1, 'bottle', 1, '480000000001', 5500, 1);
    INSERT INTO product_units VALUES (102, 1, 'case', 24, '480000000024', 125000, 0);
    INSERT INTO product_units VALUES (201, 2, 'can', 1, '480000000002', 3800, 1);
  `)

  // 4. Customers
  sqlite.run(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL,
      nickname TEXT,
      phone TEXT,
      address TEXT,
      credit_limit_c INTEGER,
      balance_c INTEGER,
      is_active INTEGER,
      created_at TEXT
    );
    INSERT INTO customers VALUES (1, 'Maria Santos', 'Ate Maria', '09171234567', 'Brgy San Jose', 500000, 150000, 1, '2026-01-01');
  `)

  // 5. Sales
  sqlite.run(`
    CREATE TABLE sales (
      id INTEGER PRIMARY KEY,
      transaction_no TEXT UNIQUE,
      user_id INTEGER,
      subtotal_c INTEGER,
      total_c INTEGER,
      created_at TEXT
    );
    INSERT INTO sales VALUES (1, 'TXN-DESK-001', 1, 5500, 5500, '2026-01-01');

    CREATE TABLE sale_items (
      id INTEGER PRIMARY KEY,
      sale_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      qty REAL,
      unit_price_c INTEGER,
      subtotal_c INTEGER
    );
    INSERT INTO sale_items VALUES (1, 1, 1, 'San Miguel Pale Pilsen', 1, 5500, 5500);

    CREATE TABLE payments (
      id INTEGER PRIMARY KEY,
      sale_id INTEGER,
      method TEXT,
      amount_c INTEGER,
      created_at TEXT
    );
    INSERT INTO payments VALUES (1, 1, 'CASH', 5500, '2026-01-01');
  `)

  const binary = sqlite.export()
  sqlite.close()
  return binary
}

beforeEach(async () => {
  await db.transaction('rw', db.categories, db.products, db.customers, db.sales, db.backups, db.audit, async () => {
    await Promise.all([
      db.categories.clear(),
      db.products.clear(),
      db.customers.clear(),
      db.sales.clear(),
      db.backups.clear(),
      db.audit.clear()
    ])
  })
})

describe('desktopMigrationService', () => {
  it('detects SQLite signature accurately', async () => {
    const sqliteBytes = await createMockSqliteDb()
    expect(isSqliteBinary(sqliteBytes)).toBe(true)

    const randomBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    expect(isSqliteBinary(randomBytes)).toBe(false)
  })

  it('parses raw SQLite database into canonical tables and settings', async () => {
    const sqliteBytes = await createMockSqliteDb()
    const parsed = await parseSqliteDatabase(sqliteBytes)

    expect(parsed.settings).toMatchObject({
      store_name: 'TINDA Desktop Express',
      receipt_header: 'Welcome to TINDA POS'
    })

    const tableNames = parsed.tables.map((t) => t.name)
    expect(tableNames).toContain('categories')
    expect(tableNames).toContain('products')
    expect(tableNames).toContain('product_units')
    expect(tableNames).toContain('customers')
    expect(tableNames).toContain('sales')

    const products = parsed.tables.find((t) => t.name === 'products')
    expect(products?.rows).toHaveLength(2)
    expect(products?.rows[0]).toMatchObject({ name: 'San Miguel Pale Pilsen', sku: 'SMP-330' })
  })

  it('inspects SQLite file and returns complete metadata preview', async () => {
    const sqliteBytes = await createMockSqliteDb()
    const inspection = await inspectDatabaseFile({
      name: 'tindapos.db',
      size: sqliteBytes.length,
      arrayBuffer: async () => sqliteBytes.buffer.slice(sqliteBytes.byteOffset, sqliteBytes.byteOffset + sqliteBytes.byteLength)
    })

    expect(inspection.type).toBe('SQLITE')
    expect(inspection.fileName).toBe('tindapos.db')
    expect(inspection.storeName).toBe('TINDA Desktop Express')
    expect(inspection.productCount).toBe(2)
    expect(inspection.categoryCount).toBe(2)
    expect(inspection.customerCount).toBe(1)
    expect(inspection.saleCount).toBe(1)
    expect(inspection.isValid).toBe(true)
  })

  it('executes RESTORE_REPLACE migration, clears stale rows, and attaches units/items', async () => {
    // Seed existing stale row
    await db.products.add({ id: 999, name: 'Old Stale Mobile Product', sku: 'STALE' } as any)

    const sqliteBytes = await createMockSqliteDb()
    const inspection = await inspectDatabaseFile({
      name: 'tindapos.db',
      size: sqliteBytes.length,
      arrayBuffer: async () => sqliteBytes.buffer.slice(sqliteBytes.byteOffset, sqliteBytes.byteOffset + sqliteBytes.byteLength)
    })

    const summary = await executeDesktopMigration(inspection, 'RESTORE_REPLACE')

    expect(summary.mode).toBe('RESTORE_REPLACE')
    expect(summary.safetyBackupFilename).toContain('safety-pre-migration')

    // Stale row should be gone
    const products = await db.products.toArray()
    expect(products.some((p) => p.id === 999)).toBe(false)
    expect(products).toHaveLength(2)

    const sanMig = products.find((p) => p.sku === 'SMP-330')
    expect(sanMig).toBeDefined()
    expect(sanMig?.units).toHaveLength(2)
    expect(sanMig?.units[0].is_default).toBe(true)

    // Verify customers
    const customers = await db.customers.toArray()
    expect(customers).toHaveLength(1)
    expect(customers[0].full_name).toBe('Maria Santos')
    expect(customers[0].balance_c).toBe(150000)

    // Verify safety backup was saved in db.backups
    const backups = await db.backups.toArray()
    expect(backups.length).toBeGreaterThan(0)
  })

  it('executes SMART_MERGE migration without deleting existing mobile data', async () => {
    // Seed existing mobile product
    await db.products.add({
      id: 50,
      name: 'Mobile Native Product',
      sku: 'MOB-01',
      barcode: '999999999999',
      default_price_c: 1000,
      stock: 5,
      units: []
    } as any)

    // Also seed a product that matches desktop by barcode to verify price/stock merge
    await db.products.add({
      id: 51,
      name: 'San Miguel Pale Pilsen',
      sku: 'SMP-330',
      barcode: '480000000001',
      default_price_c: 5000,
      purchase_cost_c: 3500,
      stock: 10,
      units: []
    } as any)

    const sqliteBytes = await createMockSqliteDb()
    const inspection = await inspectDatabaseFile({
      name: 'tindapos.db',
      size: sqliteBytes.length,
      arrayBuffer: async () => sqliteBytes.buffer.slice(sqliteBytes.byteOffset, sqliteBytes.byteOffset + sqliteBytes.byteLength)
    })

    const summary = await executeDesktopMigration(inspection, 'SMART_MERGE')

    expect(summary.mode).toBe('SMART_MERGE')

    // Existing mobile product must STILL exist!
    const mobProd = await db.products.get(50)
    expect(mobProd).toBeDefined()
    expect(mobProd?.name).toBe('Mobile Native Product')

    // Matched product had stock added (10 existing + 24 from desktop = 34) and price updated
    const matched = await db.products.get(51)
    expect(matched?.stock).toBe(34)
    expect(matched?.default_price_c).toBe(5500)
    expect(matched?.units).toHaveLength(2)

    // Unmatched product was added
    const tuna = (await db.products.toArray()).find((p) => p.sku === 'CTF-155')
    expect(tuna).toBeDefined()
    expect(tuna?.name).toBe('Century Tuna Flakes')

    expect(summary.counts.products.added).toBe(1)
    expect(summary.counts.products.updated).toBe(1)
  })
})
