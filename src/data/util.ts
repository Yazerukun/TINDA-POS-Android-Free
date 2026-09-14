// Shared helpers for the Android data layer: dates, money, ids, audit trail,
// inventory-change events and the persisted login session.

import type { Table } from 'dexie'
import { toDateKey } from '@shared/format'
import type { InventoryChangedEvent, RoleName, SessionUser } from '@shared/types'
import { db } from './db'

/**
 * Inserts a row and returns it with the generated id.
 *
 * IndexedDB only auto-generates a key when the key path is absent, so the id
 * must never be pre-set to 0 on an insert (that would insert key 0 every time).
 */
export async function insertRow<T extends { id: number }>(table: Table<T, number>, row: Omit<T, 'id'>): Promise<T> {
  const id = Number(await table.add(row as T))
  return { ...(row as T), id }
}

export const META_SETTINGS = 'settings'
export const META_SETUP_DONE = 'setup_complete'
export const META_SESSION = 'session_user_id'

export const nowIso = (): string => new Date().toISOString()

/** Local business date as YYYY-MM-DD (never UTC — a store day is local). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dayStartIso(value: string): string {
  return new Date(`${toDateKey(value)}T00:00:00`).toISOString()
}

export function dayEndIso(value: string): string {
  return new Date(`${toDateKey(value)}T23:59:59.999`).toISOString()
}

export function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Money is always integer centavos. */
export function cents(value: unknown, fallback = 0): number {
  return Math.round(num(value, fallback))
}

export function money(centsValue: number): string {
  const sign = centsValue < 0 ? '-' : ''
  const whole = Math.trunc(Math.abs(centsValue) / 100)
  const fraction = String(Math.abs(centsValue) % 100).padStart(2, '0')
  return `${sign}${whole.toLocaleString('en-US')}.${fraction}`
}

/** Plain number for receipt detail lines (no thousands separators). */
export function plainMoney(centsValue: number): string {
  return (centsValue / 100).toFixed(2)
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function text(value: unknown): string {
  return String(value ?? '').trim()
}

export function matches(value: string | null | undefined, query: string): boolean {
  if (!query) return true
  return String(value ?? '').toLowerCase().includes(query.toLowerCase())
}

/** Per-day counters for transaction numbers (`meta` table). */
export async function nextSequence(key: string): Promise<number> {
  const row = await db.meta.get(key)
  const next = Number(row?.value ?? 0) + 1
  await db.meta.put({ key, value: String(next) })
  return next
}

export async function readMeta(key: string): Promise<string | null> {
  return (await db.meta.get(key))?.value ?? null
}

export async function writeMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}

export async function deleteMeta(key: string): Promise<void> {
  await db.meta.delete(key)
}

export interface AuditInput {
  action: string
  entity_type?: string | null
  entity_id?: number | null
  old_value?: string | null
  new_value?: string | null
  reason?: string | null
  user_id?: number | null
  user_name?: string | null
}

export async function audit(input: AuditInput): Promise<void> {
  const session = await currentSessionUser()
  const row = {
    action: input.action,
    user_id: input.user_id ?? session?.id ?? null,
    user_name: input.user_name ?? session?.full_name ?? null,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    old_value: input.old_value ?? null,
    new_value: input.new_value ?? null,
    reason: input.reason ?? null,
    created_at: nowIso()
  }
  await insertRow(db.audit, row)
  // Keep the trail bounded on a phone.
  const total = await db.audit.count()
  if (total > 5000) {
    const oldest = await db.audit.orderBy('created_at').limit(total - 5000).toArray()
    await db.audit.bulkDelete(oldest.map((entry) => entry.id))
  }
}

const inventoryListeners = new Set<(event: InventoryChangedEvent) => void>()

export function emitInventoryChanged(reason: InventoryChangedEvent['reason'], productIds: number[]): void {
  if (!productIds.length) return
  const event: InventoryChangedEvent = { reason, product_ids: productIds }
  for (const listener of inventoryListeners) {
    try {
      listener(event)
    } catch {
      /* a broken listener must not break a sale */
    }
  }
}

export function onInventoryChanged(callback: (event: InventoryChangedEvent) => void): () => void {
  inventoryListeners.add(callback)
  return () => inventoryListeners.delete(callback)
}

/** The logged-in user, persisted in `meta` so a restart stays signed in. */
export async function currentSessionUser(): Promise<SessionUser | null> {
  const raw = await readMeta(META_SESSION)
  const id = Number(raw)
  if (!Number.isFinite(id) || id <= 0) return null
  const user = await db.users.get(id)
  if (!user || !user.is_active) return null
  return { id: user.id, username: user.username, full_name: user.full_name, roles: user.roles }
}

export async function setSessionUser(userId: number | null): Promise<void> {
  if (userId === null) {
    await deleteMeta(META_SESSION)
    await db.sessions.clear()
    return
  }
  await writeMeta(META_SESSION, String(userId))
  await db.sessions.clear()
  await db.sessions.add({ id: 1, user_id: userId, created_at: nowIso() })
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await currentSessionUser()
  if (!user) throw new Error('No user is signed in. Please sign in again.')
  return user
}

export function isAdmin(user: SessionUser | null): boolean {
  return Boolean(user?.roles?.includes('ADMIN' as RoleName))
}

/** SHA-256 hash of salt + secret. WebCrypto is available in the Android WebView. */
export async function hashSecret(secret: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
