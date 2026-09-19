import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { resetDatabase, createBackup, setupComplete } from '../system'

beforeEach(async () => {
  await db.transaction('rw', db.categories, db.products, db.sales, db.backups, db.audit, async () => {
    await Promise.all([db.categories.clear(), db.products.clear(), db.sales.clear(), db.backups.clear(), db.audit.clear()])
  })
})

describe('resetDatabase (reset-fix)', () => {
  it('requires typing RESET exactly (UI contract) and wipes data', async () => {
    await db.products.add({ id: 1, name: 'Coke', base_unit: 'bottle', default_price_c: 900, units: [], active: true } as never)

    await expect(resetDatabase('DELETE')).rejects.toThrow()
    await expect(db.products.count()).resolves.toBe(1)

    await resetDatabase('RESET')
    await expect(db.products.count()).resolves.toBe(0)
    await expect(setupComplete()).resolves.toEqual({ complete: false })
  })

  it('preserves the safety backup and previously saved backups', async () => {
    await db.products.add({ id: 1, name: 'Coke', base_unit: 'bottle', default_price_c: 900, units: [], active: true } as never)
    const prior = await createBackup('previous store')

    await resetDatabase('RESET')

    const backups = await db.backups.toArray()
    const reasons = backups.map((b) => b.reason)
    expect(reasons).toContain('previous store')
    expect(reasons).toContain('before reset')
    expect(backups.some((b) => b.filename === prior.filename)).toBe(true)
  })
})