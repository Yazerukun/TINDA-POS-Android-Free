import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { exportUniversalBackup, importUniversalBackup } from '../tindaBackupAndroid'
import { buildBackupFile } from '../../shared/tindaBackup/format'
import { parseBackupFile } from '../../shared/tindaBackup/format'
import { validateBackupFile, verifyChecksum, unsupportedFieldsReport } from '../../shared/tindaBackup/validate'

async function seed() {
  await db.categories.add({ id: 1, name: 'Drinks', created_at: '2026-01-01' } as never)
  await db.products.add({
    id: 1,
    name: 'Coke',
    sku: 'CM-1',
    category_id: 1,
    base_unit: 'bottle',
    default_price_c: 2000,
    units: [
      { id: 10, name: 'bottle', conversion_to_base: 1, barcode: null, selling_price_c: 2000, is_default: true },
      { id: 11, name: 'case', conversion_to_base: 24, barcode: '480000000024', selling_price_c: 48000, is_default: false }
    ]
  } as never)
  await db.sales.add({
    id: 100,
    transaction_no: '000001',
    user_id: 1,
    status: 'COMPLETED',
    created_at: '2026-01-01',
    subtotal_c: 2000,
    total_c: 2000,
    items: [{ id: 500, product_id: 1, product_name: 'Coke', qty: 1, subtotal_c: 2000, sale_id: 100 }],
    payments: [{ id: 700, sale_id: 100, method: 'CASH', amount_c: 2000, created_at: '2026-01-01' }]
  } as never)
}

beforeEach(async () => {
  await db.transaction('rw', db.categories, db.products, db.sales, db.movements, db.audit, async () => {
    await Promise.all([db.categories.clear(), db.products.clear(), db.sales.clear(), db.movements.clear(), db.audit.clear()])
  })
})

describe('tinda-backup android adapter', () => {
  it('export products split units, sales split items/payments; validates', async () => {
    await seed()
    const text = await exportUniversalBackup()
    const file = parseBackupFile(text)
    expect(validateBackupFile(file).ok).toBe(true)
    expect(await verifyChecksum(file)).toBe(true)
    expect(file.manifest.source.platform).toBe('android')
    const prods = file.data.tables.find((t) => t.name === 'products')
    const units = file.data.tables.find((t) => t.name === 'product_units')
    const sales = file.data.tables.find((t) => t.name === 'sales')
    const items = file.data.tables.find((t) => t.name === 'sale_items')
    const payments = file.data.tables.find((t) => t.name === 'payments')
    expect(prods?.rows[0]).not.toHaveProperty('units')
    expect(units?.rows).toHaveLength(2)
    expect(units?.rows[0]).toMatchObject({ id: 10, product_id: 1, selling_price_c: 2000 })
    expect(sales?.rows[0]).not.toHaveProperty('items')
    expect(sales?.rows[0]).not.toHaveProperty('payments')
    expect(items?.rows).toHaveLength(1)
    expect(payments?.rows).toHaveLength(1)
  })

  it('import restores units/items/payments and clears stale rows', async () => {
    await seed()
    const text = await exportUniversalBackup()
    await db.products.add({ id: 999, name: 'Stale', sku: 'ST' } as never)
    const { counts } = await importUniversalBackup(text)

    const products = await db.products.toArray()
    const restored = products.find((p) => p.id === 1)
    expect(restored?.units).toHaveLength(2)
    expect(restored?.units[0]).toMatchObject({ id: 10, name: 'bottle', is_default: true })
    expect(counts.products).toBe(1)

    const sales = await db.sales.toArray()
    expect(sales[0]?.items).toHaveLength(1)
    expect(sales[0]?.items[0]).toMatchObject({ id: 500, sale_id: 100 })
    expect(sales[0]?.payments).toHaveLength(1)
    expect(products.some((p) => p.id === 999)).toBe(false)
  })

  it('accepts a Windows-authored backup and reports unsupported tables', async () => {
    const file = await buildBackupFile(
      {
        settings: { store_name: 'PC Store' },
        tables: [
          { name: 'categories', rows: [{ id: 7, name: 'Snacks' }] },
          { name: 'sales', rows: [{ id: 2, transaction_no: 'S2', total_c: 100, created_at: '2026-01-01' }] },
          { name: 'purchases', rows: [{ id: 1, supplier_id: 1, total_c: 50, created_at: '2026-01-01' }] }
        ]
      },
      { platform: 'windows', appVersion: '1.0.18', schemaVersion: 1 }
    )
    const opened = JSON.parse(JSON.stringify(file))
    opened.checksum = file.checksum
    const { counts, unsupported } = await importUniversalBackup(JSON.stringify(opened))
    expect(counts.categories).toBe(1)
    expect(counts.purchases).toBe(1)
    expect(unsupported.unsupportedTables.some((u) => u.name === 'purchases')).toBe(true)

    const cats = await db.categories.toArray()
    expect(cats[0]).toMatchObject({ id: 7, name: 'Snacks' })
    const settings = await import('../../data/system').then((s) => s.getSettings())
    expect(settings.store_name).toBe('PC Store')
  })

  it('rejects tampered files', async () => {
    await seed()
    const text = await exportUniversalBackup()
    const file = JSON.parse(text) as { data: { tables: { name: string; rows: { name: string }[] }[] } }
    file.data.tables.find((t) => t.name === 'categories')!.rows[0]!.name = 'Hacked'
    await expect(importUniversalBackup(JSON.stringify(file))).rejects.toThrow(/checksum mismatch/i)
  })

  it('handles cross-platform user_roles and z_reads snapshots from Windows SQLite', async () => {
    const file = await buildBackupFile(
      {
        settings: { store_name: 'Windows Store' },
        tables: [
          { name: 'users', rows: [{ id: 1, username: 'admin', full_name: 'Admin User', is_active: 1 }] },
          { name: 'user_roles', rows: [{ user_id: 1, role_name: 'admin' }, { user_id: 1, role_name: 'cashier' }] },
          {
            name: 'z_reads',
            rows: [
              {
                id: 1,
                z_counter: 1,
                created_at: '2026-01-01T12:00:00Z',
                snapshot: JSON.stringify({ gross_c: 10000, net_c: 10000, tax_c: 0 })
              }
            ]
          }
        ]
      },
      { platform: 'windows', appVersion: '1.0.18', schemaVersion: 1 }
    )

    await importUniversalBackup(JSON.stringify(file))

    const users = await db.users.toArray()
    expect(users).toHaveLength(1)
    expect(users[0].username).toBe('admin')
    expect(users[0].roles).toEqual(['admin', 'cashier'])
    expect(users[0].is_active).toBe(true)

    const zreads = await db.zReads.toArray()
    expect(zreads).toHaveLength(1)
    expect(typeof zreads[0].snapshot).toBe('object')
    expect((zreads[0].snapshot as { gross_c: number }).gross_c).toBe(10000)
  })

  it('restores legacy Android JSON backups seamlessly', async () => {
    const legacyBackup = {
      schema: 1,
      timestamp: '2026-01-01T00:00:00Z',
      settings: { store_name: 'Legacy Sari-Sari Store' },
      tables: [
        {
          table: 'categories',
          rows: [{ id: 99, name: 'Sari-Sari Items' }]
        },
        {
          table: 'products',
          rows: [
            {
              id: 88,
              name: 'Candy',
              sku: 'CND-1',
              category_id: 99,
              base_unit: 'pc',
              default_price_c: 100,
              units: [{ id: 1, name: 'pc', conversion_to_base: 1, selling_price_c: 100, is_default: true }]
            }
          ]
        }
      ]
    }

    const { counts } = await importUniversalBackup(JSON.stringify(legacyBackup))
    expect(counts.categories).toBe(1)
    expect(counts.products).toBe(1)

    const restoredCats = await db.categories.toArray()
    expect(restoredCats.some((c) => c.name === 'Sari-Sari Items')).toBe(true)
  })
})