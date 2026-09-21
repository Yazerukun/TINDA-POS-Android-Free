// Auth (setup, login, persistent session), users, store settings, backups,
// printer (not supported yet on Android) and app info.

import type { BackupInfo, RoleName, SessionUser, StoreSettings, User } from '@shared/types'
import type { CompleteSetupPayload, DataLocationStatus, LoginResult, PrintResult } from '@shared/ipc'
import { DATA_TABLES, db, type BackupRow, type DataTableName, type UserRow } from './db'
import {
  META_SETTINGS,
  META_SETUP_DONE,
  audit,
  cents,
  currentSessionUser,
  hashSecret,
  insertRow,
  num,
  nowIso,
  randomSalt,
  readMeta,
  requireSessionUser,
  setSessionUser,
  text,
  writeMeta
} from './util'
import { createCategory, createProduct, createSupplier, stockStatus } from './catalog'
import { createCustomer } from './people'
import { NO_PRINTER } from './sales'
import { listPrinters, testPrint as runTestPrint } from './printerService'
import { exportUniversalBackup, importUniversalBackup } from './tindaBackupAndroid'

export const APP_VERSION = '1.0.33'

const ROLE_NAMES: RoleName[] = ['ADMIN', 'MANAGER', 'CASHIER']

export function defaultSettings(): StoreSettings {
  return {
    store_name: 'TINDA POS',
    owner_name: '',
    address: '',
    phone: '',
    tin: '',
    currency: 'PHP',
    receipt_header: '',
    receipt_title: 'TINDA POS',
    receipt_show_app_name: true,
    receipt_footer: 'Thank you for your purchase!',
    logo_path: null,
    default_low_stock: 5,
    default_tax_c: 0,
    allow_negative_inventory: true,
    backup_location: 'device storage',
    auto_backup_enabled: false,
    auto_backup_daily: false,
    auto_backup_on_exit: false,
    receipt_printer: '',
    auto_print_after_sale: false,
    receipt_paper_width: '80mm',
    receipt_copies: 1,
    theme: 'dark',
    data_dir: 'device storage (IndexedDB)'
  }
}

export async function getSettings(): Promise<StoreSettings> {
  const raw = await readMeta(META_SETTINGS)
  if (!raw) return defaultSettings()
  try {
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<StoreSettings>) }
  } catch {
    return defaultSettings()
  }
}

export async function updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await getSettings()
  const next = { ...current, ...patch }
  await writeMeta(META_SETTINGS, JSON.stringify(next))
  return next
}

async function saveSettings(next: StoreSettings): Promise<StoreSettings> {
  await writeMeta(META_SETTINGS, JSON.stringify(next))
  return next
}

export async function setupComplete(): Promise<{ complete: boolean }> {
  return { complete: (await readMeta(META_SETUP_DONE)) === '1' }
}

function sessionUserOf(user: UserRow): SessionUser {
  return { id: user.id, username: user.username, full_name: user.full_name, roles: user.roles }
}

async function createUserRow(input: { username: string; password: string; pin: string; full_name: string; roles: RoleName[]; is_active?: boolean }): Promise<UserRow> {
  const username = text(input.username)
  if (!username) throw new Error('Username is required.')
  if (text(input.password).length < 4) throw new Error('Password must be at least 4 characters.')
  if (!/^\d{4}$/.test(text(input.pin))) throw new Error('Quick PIN must be exactly 4 digits.')
  const existing = await db.users.where('username').equals(username).first()
  if (existing) throw new Error(`Username ${username} is already taken.`)
  const salt = randomSalt()
  const row: Omit<UserRow, 'id'> = {
    username,
    full_name: text(input.full_name) || username,
    pin: '',
    roles: input.roles,
    is_active: input.is_active ?? true,
    created_at: nowIso(),
    password_hash: await hashSecret(input.password, salt),
    pin_hash: await hashSecret(text(input.pin), salt)
  }
  const created = await insertRow(db.users, row)
  await writeMeta(`salt_user_${created.id}`, salt)
  return created
}

const DEMO_PRODUCTS: { name: string; category: string; cost: number; price: number; stock: number; unit: string }[] = [
  { name: 'Coke Sakto 200ml', category: 'Drinks', cost: 1450, price: 2000, stock: 48, unit: 'pc' },
  { name: 'Royal Sakto 200ml', category: 'Drinks', cost: 1450, price: 2000, stock: 36, unit: 'pc' },
  { name: 'C2 Green Tea 230ml', category: 'Drinks', cost: 2200, price: 3000, stock: 24, unit: 'pc' },
  { name: 'Bottled Water 500ml', category: 'Drinks', cost: 1000, price: 1500, stock: 60, unit: 'pc' },
  { name: 'Bear Brand 33g', category: 'Drinks', cost: 1600, price: 2200, stock: 30, unit: 'sachet' },
  { name: 'Piattos 40g', category: 'Snacks', cost: 1400, price: 2000, stock: 40, unit: 'pc' },
  { name: 'Chippy 27g', category: 'Snacks', cost: 900, price: 1400, stock: 45, unit: 'pc' },
  { name: 'Skyflakes 25g', category: 'Snacks', cost: 700, price: 1000, stock: 50, unit: 'pc' },
  { name: 'Rebisco Sandwich', category: 'Snacks', cost: 800, price: 1200, stock: 40, unit: 'pc' },
  { name: 'Century Tuna 155g', category: 'Canned Goods', cost: 3400, price: 4500, stock: 18, unit: 'can' },
  { name: 'Argentina Corned Beef 150g', category: 'Canned Goods', cost: 3600, price: 4800, stock: 15, unit: 'can' },
  { name: '555 Sardines 155g', category: 'Canned Goods', cost: 2400, price: 3200, stock: 20, unit: 'can' },
  { name: 'Lucky Me Pancit Canton', category: 'Noodles', cost: 1200, price: 1700, stock: 60, unit: 'pack' },
  { name: 'Lucky Me Beef Mami', category: 'Noodles', cost: 900, price: 1300, stock: 55, unit: 'pack' },
  { name: 'Payless Xtra Big', category: 'Noodles', cost: 1100, price: 1600, stock: 40, unit: 'pack' },
  { name: 'Tide Bar 380g', category: 'Household', cost: 3000, price: 3900, stock: 12, unit: 'pc' },
  { name: 'Joy Dishwashing 45g', category: 'Household', cost: 700, price: 1100, stock: 25, unit: 'sachet' },
  { name: 'Safeguard Soap 60g', category: 'Household', cost: 2200, price: 2900, stock: 20, unit: 'pc' }
]

async function loadDemoData(): Promise<void> {
  const categories = await db.categories.count()
  if (categories > 0) return
  const supplier = await createSupplier({ name: 'Cebu Wholesale Trading', contact_person: 'Ate Lorna', phone: '09171234567' })
  for (const entry of DEMO_PRODUCTS) {
    const category = await createCategory(entry.category)
    await createProduct({
      category_id: category.id,
      name: entry.name,
      sku: '',
      barcode: null,
      description: null,
      base_unit: entry.unit,
      purchase_cost_c: entry.cost,
      default_price_c: entry.price,
      low_stock_threshold: 6,
      supplier_id: supplier.id,
      has_expiration: false,
      expiration_mode: 'NONE',
      notes: null,
      units: [{ name: entry.unit, conversion_to_base: 1, barcode: null, selling_price_c: entry.price, is_default: true }],
      initial_stock_base: entry.stock
    })
  }
  await createCustomer({ full_name: 'Mang Ben', nickname: 'Ben', phone: '09181234567', address: 'Purok 2', notes: null, credit_limit_c: 50000 })
  await createCustomer({ full_name: 'Aling Rosa', nickname: 'Rosa', phone: '09191234567', address: 'Purok 5', notes: null, credit_limit_c: 30000 })
}

export async function completeSetup(payload: CompleteSetupPayload): Promise<LoginResult> {
  const storeName = text(payload?.store?.store_name)
  if (!storeName) throw new Error('Store name is required.')
  const username = text(payload?.admin?.username) || 'admin'

  const settings = await getSettings()
  const next: StoreSettings = {
    ...settings,
    store_name: storeName,
    owner_name: text(payload?.store?.owner_name),
    address: text(payload?.store?.address),
    phone: text(payload?.store?.phone),
    receipt_header: text(payload?.receipt?.header),
    receipt_footer: text(payload?.receipt?.footer) || settings.receipt_footer
  }
  await saveSettings(next)

  const existing = await db.users.where('username').equals(username).first()
  const user =
    existing ??
    (await createUserRow({
      username,
      password: text(payload?.admin?.password),
      pin: text(payload?.admin?.pin),
      full_name: text(payload?.admin?.full_name) || 'Manager',
      roles: ['ADMIN']
    }))
  await setSessionUser(user.id)
  if (payload?.load_demo) await loadDemoData()
  await writeMeta(META_SETUP_DONE, '1')
  await audit({ action: 'STORE_SETUP', entity_type: 'store', new_value: storeName })
  return { user: sessionUserOf(user), firstRun: false, shiftOpen: false }
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const setup = await setupComplete()
  if (!setup.complete) throw new Error('This store is not set up yet.')
  const user = await db.users.where('username').equals(text(username)).first()
  if (!user) throw new Error('Unknown username or wrong password.')
  const row = await db.users.get(user.id)
  if (!row) throw new Error('Unknown username or wrong password.')
  const stored = await readSaltFor(user.id)
  const hash = await hashSecret(password, stored)
  if (hash !== row.password_hash) throw new Error('Unknown username or wrong password.')
  if (!row.is_active) throw new Error('This account is inactive.')
  await setSessionUser(row.id)
  const shift = await db.shifts.where('status').equals('OPENED').first()
  return { user: sessionUserOf(row), firstRun: false, shiftOpen: Boolean(shift) }
}

/** Per-user salt, created with the account (see createUserRow). */
async function readSaltFor(userId: number): Promise<string> {
  const key = `salt_user_${userId}`
  const existing = await readMeta(key)
  if (existing) return existing
  const salt = randomSalt()
  await writeMeta(key, salt)
  return salt
}

export async function loginPin(pin: string): Promise<LoginResult> {
  const clean = text(pin)
  const users = await db.users.toArray()
  for (const user of users) {
    const salt = await readSaltFor(user.id)
    const hash = await hashSecret(clean, salt)
    if (hash === user.pin_hash && user.is_active) {
      await setSessionUser(user.id)
      const shift = await db.shifts.where('status').equals('OPENED').first()
      return { user: sessionUserOf(user), firstRun: false, shiftOpen: Boolean(shift) }
    }
  }
  throw new Error('Invalid Quick PIN.')
}

export async function authStatus(): Promise<SessionUser | null> {
  return currentSessionUser()
}

export async function logout(): Promise<void> {
  await setSessionUser(null)
}

export async function adminResetPin(userId: number, newPin: string): Promise<void> {
  const session = await requireSessionUser()
  if (!session.roles.includes('ADMIN')) throw new Error('Only an admin can reset a PIN.')
  if (!/^\d{4}$/.test(text(newPin))) throw new Error('Quick PIN must be exactly 4 digits.')
  const salt = await readSaltFor(userId)
  await db.users.update(userId, { pin_hash: await hashSecret(text(newPin), salt) })
  await audit({ action: 'USER_PIN_RESET', entity_type: 'user', entity_id: userId })
}

export async function changePassword(current: string, next: string): Promise<void> {
  const session = await requireSessionUser()
  const user = await db.users.get(session.id)
  if (!user) throw new Error('User not found.')
  const salt = await readSaltFor(user.id)
  if ((await hashSecret(current, salt)) !== user.password_hash) throw new Error('Current password is incorrect.')
  if (text(next).length < 4) throw new Error('New password must be at least 4 characters.')
  await db.users.update(user.id, { password_hash: await hashSecret(text(next), salt) })
}

export async function changePin(pin: string): Promise<void> {
  const session = await requireSessionUser()
  if (!/^\d{4}$/.test(text(pin))) throw new Error('Quick PIN must be exactly 4 digits.')
  const salt = await readSaltFor(session.id)
  await db.users.update(session.id, { pin_hash: await hashSecret(text(pin), salt) })
}

export async function listUsers(): Promise<User[]> {
  const rows = await db.users.toArray()
  return rows.map((row) => ({ id: row.id, username: row.username, full_name: row.full_name, pin: '', roles: row.roles, is_active: row.is_active, created_at: row.created_at }))
}

export async function roles(): Promise<string[]> {
  return [...ROLE_NAMES]
}

export async function createUser(input: { username: string; password: string; pin: string; full_name: string; roles: string[]; is_active?: boolean }): Promise<User> {
  const session = await requireSessionUser()
  if (!session.roles.includes('ADMIN')) throw new Error('Only an admin can add users.')
  const row = await createUserRow({
    username: input.username,
    password: input.password,
    pin: input.pin,
    full_name: input.full_name,
    roles: (input.roles?.length ? input.roles : ['CASHIER']) as RoleName[],
    is_active: input.is_active
  })
  await audit({ action: 'USER_CREATE', entity_type: 'user', entity_id: row.id, new_value: row.username })
  return { id: row.id, username: row.username, full_name: row.full_name, pin: '', roles: row.roles, is_active: row.is_active, created_at: row.created_at }
}

export async function updateUser(id: number, input: Partial<{ username: string; password: string; pin: string; full_name: string; roles: string[]; is_active: boolean }>): Promise<User> {
  const session = await requireSessionUser()
  if (!session.roles.includes('ADMIN') && session.id !== id) throw new Error('Only an admin can edit other users.')
  const user = await db.users.get(id)
  if (!user) throw new Error('User not found.')
  const patch: Partial<UserRow> = {}
  if (input.username !== undefined && text(input.username)) patch.username = text(input.username)
  if (input.full_name !== undefined) patch.full_name = text(input.full_name)
  if (input.roles !== undefined) patch.roles = input.roles as RoleName[]
  if (input.is_active !== undefined) patch.is_active = input.is_active
  if (input.password) patch.password_hash = await hashSecret(input.password, await readSaltFor(id))
  if (input.pin) patch.pin_hash = await hashSecret(text(input.pin), await readSaltFor(id))
  await db.users.update(id, patch)
  const updated = (await db.users.get(id))!
  return { id: updated.id, username: updated.username, full_name: updated.full_name, pin: '', roles: updated.roles, is_active: updated.is_active, created_at: updated.created_at }
}

// ---------------------------------------------------------------- backups

function serializeTable(table: DataTableName): Promise<{ table: DataTableName; rows: unknown[] }> {
  return (db.table(table) as { toArray: () => Promise<unknown[]> })
    .toArray()
    .then((rows) => ({ table, rows }))
}

async function snapshot(): Promise<string> {
  const tables = await Promise.all(DATA_TABLES.map((table) => serializeTable(table)))
  return JSON.stringify({ schema: 1, created_at: nowIso(), settings: await getSettings(), tables })
}

export async function createBackup(reason?: string): Promise<BackupInfo> {
  const payload = await exportUniversalBackup()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `tinda-pos-backup-${stamp}.tinda-backup`
  const row: BackupRow = {
    filename,
    created_at: nowIso(),
    size: payload.length,
    reason: reason ?? null,
    payload
  }
  await db.backups.put(row)
  try {
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  } catch {
    /* the copy inside the app storage is still available */
  }
  await audit({ action: 'BACKUP_CREATE', entity_type: 'backup', new_value: filename })
  return { filename, path: `device storage/${filename}`, size: payload.length, created_at: row.created_at }
}

export async function listBackups(): Promise<BackupInfo[]> {
  const rows = await db.backups.toArray()
  return rows
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((row) => ({ filename: row.filename, path: `device storage/${row.filename}`, size: row.size, created_at: row.created_at }))
}

export async function getBackupPayload(filename: string): Promise<string | null> {
  const row = await db.backups.get(filename)
  return row?.payload ?? null
}

async function wipeData(): Promise<void> {
  for (const table of DATA_TABLES) {
    await (db.table(table) as { clear: () => Promise<void> }).clear()
  }
}

export async function restoreBackup(filename: string): Promise<void> {
  const row = await db.backups.get(filename)
  if (!row) throw new Error('Backup not found.')
  await createBackup('before restore')
  if (row.payload.includes('"format":"tinda-pos-backup"') || row.payload.includes('"tinda-pos-backup"')) {
    await importUniversalBackup(row.payload)
  } else {
    const parsed = JSON.parse(row.payload) as { settings?: StoreSettings; tables?: { table: DataTableName; rows: unknown[] }[] }
    await wipeData()
    for (const entry of parsed.tables ?? []) {
      const table = db.table(entry.table) as { bulkPut: (rows: unknown[]) => Promise<unknown> }
      if (Array.isArray(entry.rows) && entry.rows.length) await table.bulkPut(entry.rows)
    }
    if (parsed.settings) await saveSettings({ ...defaultSettings(), ...parsed.settings })
    await writeMeta(META_SETUP_DONE, '1')
  }
  await audit({ action: 'BACKUP_RESTORE', entity_type: 'backup', new_value: filename })
}

export async function resetDatabase(confirmation: string): Promise<void> {
  if (confirmation !== 'RESET') throw new Error('Type RESET exactly to confirm.')
  await createBackup('before reset')
  await wipeData()
  await saveSettings(defaultSettings())
  await setSessionUser(null)
  await writeMeta(META_SETUP_DONE, '0')
}

export async function startNewStore(confirmation: string): Promise<void> {
  if (text(confirmation).toUpperCase() !== 'NEW STORE') throw new Error('Type NEW STORE to confirm.')
  await createBackup('before new store')
  const settings = await getSettings()
  await wipeData()
  await saveSettings({ ...defaultSettings(), store_name: settings.store_name, receipt_header: settings.receipt_header, receipt_footer: settings.receipt_footer })
  await setSessionUser(null)
  await writeMeta(META_SETUP_DONE, '0')
}

export async function backupDir(): Promise<string> {
  return 'device storage'
}

export async function backupLocationStatus(): Promise<DataLocationStatus> {
  return {
    mode: 'SHARED',
    label: 'Shared AppData',
    root: 'device storage (IndexedDB)',
    databaseFile: 'tinda-pos-free',
    backupDir: 'device storage',
    portableAvailable: false,
    sharedRoot: 'device storage (IndexedDB)',
    portableRoot: null,
    sharedHasData: true,
    portableHasData: false
  }
}

export async function selectSyncFolder(): Promise<string | null> {
  return null
}

export async function openFolder(): Promise<void> {
  // Android has no file-explorer folder to open; backups are listed in the app.
}

export async function usePortableData(): Promise<void> {
  throw new Error('Portable Data folders are a Windows feature. On Android everything stays in the app storage.')
}

export async function useSharedAppData(): Promise<void> {
  // Only one storage location exists on Android.
}

// ---------------------------------------------------------------- printer / app

export async function printerList(): Promise<{ name: string; displayName: string; isDefault: boolean }[]> {
  return listPrinters()
}

export async function printerSave(input: { name: string; autoPrint: boolean; paperWidth: '58mm' | '80mm'; copies: number }): Promise<StoreSettings> {
  return updateSettings({
    receipt_printer: input.name,
    auto_print_after_sale: input.autoPrint,
    receipt_paper_width: input.paperWidth,
    receipt_copies: num(input.copies, 1)
  })
}

export async function testPrint(): Promise<PrintResult> {
  return runTestPrint()
}

export function printerUnavailable(): PrintResult {
  return NO_PRINTER
}

export async function appInfo(): Promise<{ name: string; version: string; offline: boolean; platform: string; isElectron: boolean }> {
  return { name: 'TINDA POS', version: APP_VERSION, offline: true, platform: 'android', isElectron: false }
}

export async function auditList(opts: { limit?: number; offset?: number; action?: string } = {}): Promise<{ rows: import('@shared/types').AuditLog[]; total: number }> {
  const all = await db.audit.toArray()
  const filtered = all
    .filter((entry) => (opts.action ? entry.action === opts.action : true))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const offset = opts.offset ?? 0
  return { rows: filtered.slice(offset, offset + (opts.limit ?? 200)), total: filtered.length }
}

export function stockStatusText(stock: number, threshold: number): string {
  const status = stockStatus(stock, threshold)
  return status === 'OUT_OF_STOCK' ? 'Out of stock' : status === 'LOW_STOCK' ? 'Low stock' : 'In stock'
}
