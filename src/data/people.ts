// Customers, the utang (credit) ledger, and store expenses.

import type { CreditEntryType, CreditLedgerEntry, Customer, Expense, ExpenseCategory } from '@shared/types'
import { db } from './db'
import { audit, cents, currentSessionUser, insertRow, localDateKey, matches, nowIso, num, requireSessionUser, text } from './util'

export interface CustomerInputRow {
  full_name: string
  nickname?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  credit_limit_c: number
}

export async function listCustomers(opts: { search?: string; status?: string; limit?: number; offset?: number } = {}): Promise<{ rows: Customer[]; total: number }> {
  const all = await db.customers.toArray()
  const filtered = all
    .filter((customer) => (opts.status === 'INACTIVE' ? !customer.is_active : customer.is_active || opts.status === 'ALL'))
    .filter((customer) => matches(customer.full_name, opts.search ?? '') || matches(customer.nickname, opts.search ?? '') || matches(customer.phone, opts.search ?? ''))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
  const offset = opts.offset ?? 0
  return { rows: filtered.slice(offset, offset + (opts.limit ?? 500)), total: filtered.length }
}

export async function getCustomer(id: number): Promise<Customer> {
  const customer = await db.customers.get(id)
  if (!customer) throw new Error('Customer not found.')
  return customer
}

export async function createCustomer(input: CustomerInputRow): Promise<Customer> {
  const fullName = text(input.full_name)
  if (!fullName) throw new Error('Customer name is required.')
  const now = nowIso()
  const row = await insertRow(db.customers, {
    full_name: fullName,
    nickname: input.nickname ? text(input.nickname) : null,
    phone: input.phone ? text(input.phone) : null,
    address: input.address ? text(input.address) : null,
    notes: input.notes ? text(input.notes) : null,
    credit_limit_c: cents(input.credit_limit_c),
    balance_c: 0,
    is_active: true,
    created_at: now,
    updated_at: now
  })
  await audit({ action: 'CUSTOMER_CREATE', entity_type: 'customer', entity_id: row.id, new_value: fullName })
  return row
}

export async function updateCustomer(id: number, input: Partial<CustomerInputRow> & { is_active?: boolean }): Promise<Customer> {
  const customer = await db.customers.get(id)
  if (!customer) throw new Error('Customer not found.')
  const patch: Partial<Customer> = { updated_at: nowIso() }
  if (input.full_name !== undefined) patch.full_name = text(input.full_name)
  if (input.nickname !== undefined) patch.nickname = input.nickname
  if (input.phone !== undefined) patch.phone = input.phone
  if (input.address !== undefined) patch.address = input.address
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.credit_limit_c !== undefined) patch.credit_limit_c = cents(input.credit_limit_c)
  if (input.is_active !== undefined) patch.is_active = input.is_active
  await db.customers.update(id, patch)
  return { ...customer, ...patch } as Customer
}

export async function customerLedger(id: number, opts: { limit?: number } = {}): Promise<CreditLedgerEntry[]> {
  const rows = await db.credit.where('customer_id').equals(id).toArray()
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, opts.limit ?? 200)
}

/** Single write path for every balance change, so the ledger always balances. */
export async function applyCreditEntry(input: {
  customer_id: number
  entry_type: CreditEntryType
  amount_c: number
  reference_type?: string | null
  reference_id?: number | null
  notes?: string | null
  user_id?: number
}): Promise<CreditLedgerEntry> {
  const customer = await db.customers.get(input.customer_id)
  if (!customer) throw new Error('Customer not found.')
  const before = num(customer.balance_c)
  const delta =
    input.entry_type === 'CREDIT_SALE' || input.entry_type === 'ADJUSTMENT' ? input.amount_c : -Math.abs(input.amount_c)
  const after = before + delta
  const entry = await insertRow(db.credit, {
    customer_id: input.customer_id,
    entry_type: input.entry_type,
    amount_c: input.amount_c,
    balance_before_c: before,
    balance_after_c: after,
    reference_type: input.reference_type ?? null,
    reference_id: input.reference_id ?? null,
    notes: input.notes ?? null,
    user_id: input.user_id ?? 0,
    created_at: nowIso()
  })
  await db.customers.update(customer.id, { balance_c: after, updated_at: nowIso() })
  return entry
}

export async function payCredit(input: { customer_id: number; amount_c: number; method?: string; notes?: string }): Promise<CreditLedgerEntry> {
  const session = await requireSessionUser()
  const amount = cents(input.amount_c)
  if (amount <= 0) throw new Error('Payment amount must be greater than zero.')
  const entry = await applyCreditEntry({
    customer_id: input.customer_id,
    entry_type: 'PAYMENT',
    amount_c: amount,
    reference_type: input.method ?? 'CASH',
    notes: input.notes ?? null,
    user_id: session.id
  })
  await audit({ action: 'UTANG_PAYMENT', entity_type: 'customer', entity_id: input.customer_id, new_value: `${amount}` })
  return entry
}

export async function adjustCredit(input: { customer_id: number; amount_c: number; notes: string; reason: string }): Promise<CreditLedgerEntry> {
  const session = await requireSessionUser()
  const amount = cents(input.amount_c)
  if (amount === 0) throw new Error('Adjustment amount cannot be zero.')
  const entry = await applyCreditEntry({
    customer_id: input.customer_id,
    entry_type: 'ADJUSTMENT',
    amount_c: amount,
    reference_type: input.reason,
    notes: input.notes,
    user_id: session.id
  })
  await audit({ action: 'UTANG_ADJUSTMENT', entity_type: 'customer', entity_id: input.customer_id, reason: input.reason, new_value: `${amount}` })
  return entry
}

export async function revokeCredit(input: { customer_id: number; amount_c: number; notes: string; reason: string }): Promise<CreditLedgerEntry> {
  const session = await requireSessionUser()
  const entry = await applyCreditEntry({
    customer_id: input.customer_id,
    entry_type: 'REVERSAL',
    amount_c: cents(input.amount_c),
    reference_type: input.reason,
    notes: input.notes,
    user_id: session.id
  })
  await audit({ action: 'UTANG_REVERSAL', entity_type: 'customer', entity_id: input.customer_id, reason: input.reason })
  return entry
}

/** Records that a cashier may exceed the customer's credit limit. */
export async function approveOverlimit(input: { customer_id: number; amount_c: number; notes: string; approved_by: string; reason: string }): Promise<{ balance_c: number }> {
  const customer = await getCustomer(input.customer_id)
  await audit({
    action: 'UTANG_OVERLIMIT_APPROVED',
    entity_type: 'customer',
    entity_id: input.customer_id,
    user_name: input.approved_by,
    reason: input.reason,
    new_value: `${cents(input.amount_c)}`
  })
  return { balance_c: num(customer.balance_c) }
}

const DEFAULT_EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Supplies', 'Salary', 'Transport', 'Others']

async function ensureExpenseCategories(): Promise<void> {
  const count = await db.expenseCategories.count()
  if (count > 0) return
  for (const name of DEFAULT_EXPENSE_CATEGORIES) {
    const existing = await db.expenseCategories.where('name').equals(name).first()
    if (!existing) await insertRow(db.expenseCategories, { name, is_system: true, created_at: nowIso() })
  }
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  await ensureExpenseCategories()
  const rows = await db.expenseCategories.toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export async function createExpenseCategory(name: string): Promise<ExpenseCategory> {
  const clean = text(name)
  if (!clean) throw new Error('Category name is required.')
  const existing = await db.expenseCategories.where('name').equals(clean).first()
  if (existing) return existing
  return insertRow(db.expenseCategories, { name: clean, is_system: false, created_at: nowIso() })
}

export async function listExpenses(opts: { from?: string; to?: string; category_id?: number; limit?: number; offset?: number } = {}): Promise<{ rows: Expense[]; total: number }> {
  const all = await db.expenses.toArray()
  const filtered = all
    .filter((expense) => (opts.category_id ? expense.category_id === opts.category_id : true))
    .filter((expense) => (opts.from ? expense.expense_date >= opts.from : true))
    .filter((expense) => (opts.to ? expense.expense_date <= opts.to : true))
    .sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1))
  const offset = opts.offset ?? 0
  return { rows: filtered.slice(offset, offset + (opts.limit ?? 200)), total: filtered.length }
}

export async function createExpense(input: {
  category_id: number
  amount_c: number
  expense_date: string
  description?: string | null
  reference?: string | null
  notes?: string | null
}): Promise<Expense> {
  const session = await requireSessionUser()
  const amount = cents(input.amount_c)
  if (amount <= 0) throw new Error('Expense amount must be greater than zero.')
  const category = await db.expenseCategories.get(input.category_id)
  if (!category) throw new Error('Expense category not found.')
  const row = await insertRow(db.expenses, {
    category_id: input.category_id,
    category_name: category.name,
    amount_c: amount,
    expense_date: input.expense_date || localDateKey(),
    description: input.description ?? null,
    reference: input.reference ?? null,
    user_id: session.id,
    user_name: session.full_name,
    notes: input.notes ?? null,
    created_at: nowIso()
  })
  await audit({ action: 'EXPENSE_CREATE', entity_type: 'expense', entity_id: row.id, new_value: `${category.name} ${amount}` })
  return row
}

export async function updateExpense(id: number, input: Partial<{ category_id: number; amount_c: number; expense_date: string; description: string | null; reference: string | null; notes: string | null }>): Promise<Expense> {
  const row = await db.expenses.get(id)
  if (!row) throw new Error('Expense not found.')
  const patch: Partial<Expense> = {}
  if (input.category_id !== undefined) {
    const category = await db.expenseCategories.get(input.category_id)
    if (!category) throw new Error('Expense category not found.')
    patch.category_id = input.category_id
    patch.category_name = category.name
  }
  if (input.amount_c !== undefined) patch.amount_c = cents(input.amount_c)
  if (input.expense_date !== undefined) patch.expense_date = input.expense_date
  if (input.description !== undefined) patch.description = input.description
  if (input.reference !== undefined) patch.reference = input.reference
  if (input.notes !== undefined) patch.notes = input.notes
  await db.expenses.update(id, patch)
  return { ...row, ...patch } as Expense
}

export async function removeExpense(id: number): Promise<void> {
  const row = await db.expenses.get(id)
  if (!row) return
  await db.expenses.delete(id)
  await audit({ action: 'EXPENSE_DELETE', entity_type: 'expense', entity_id: id, old_value: `${row.category_name} ${row.amount_c}` })
}

/** Outstanding utang per customer plus payments collected (for the report). */
export async function utangReport(): Promise<{ rows: Customer[]; total_outstanding_c: number; payments_c: number }> {
  const customers = await db.customers.toArray()
  const ledger = await db.credit.toArray()
  const rows = customers
    .filter((customer) => num(customer.balance_c) > 0)
    .sort((a, b) => num(b.balance_c) - num(a.balance_c))
  return {
    rows,
    total_outstanding_c: rows.reduce((sum, customer) => sum + num(customer.balance_c), 0),
    payments_c: ledger.filter((entry) => entry.entry_type === 'PAYMENT').reduce((sum, entry) => sum + num(entry.amount_c), 0)
  }
}

export async function sessionUserName(): Promise<string> {
  const session = await currentSessionUser()
  return session?.full_name ?? 'Unknown'
}
