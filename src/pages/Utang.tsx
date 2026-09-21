import { useEffect, useMemo, useState } from 'react'
import { Search, Wallet, HandCoins, Scale, Check, Plus, Users, Loader2, Share2 } from 'lucide-react'
import type { Customer, CreditLedgerEntry } from '@shared/types'
import { money, shortDateTime } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { toastSuccess, toastError } from '../stores/toast'
import { useSettings } from '../stores/settings'
import { shareCustomerStatement } from '../utils/shareStatement'

export function Utang(): React.JSX.Element {
  const { settings } = useSettings()
  const [rows, setRows] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [action, setAction] = useState<null | { type: 'PAY' | 'ADJUST' | 'OVERLIMIT'; customer: Customer }>(null)
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<'ALL' | 'WITH_BALANCE' | 'ZERO_BALANCE'>('ALL')

  const load = async () => {
    setLoading(true)
    try {
      const res = await window.api.customers.list({ status: 'ACTIVE', limit: 1000 })
      setRows(res.rows)
    } catch (e) {
      toastError('Failed to load credit', String((e as Error)?.message || e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const withBalanceCount = useMemo(() => rows.filter((c) => c.balance_c > 0).length, [rows])
  const zeroBalanceCount = useMemo(() => rows.filter((c) => c.balance_c <= 0).length, [rows])

  const filtered = useMemo(() => {
    let list = rows
    if (filterTab === 'WITH_BALANCE') list = list.filter((c) => c.balance_c > 0)
    else if (filterTab === 'ZERO_BALANCE') list = list.filter((c) => c.balance_c <= 0)
    if (q) list = list.filter((c) => (c.full_name + ' ' + (c.nickname || '')).toLowerCase().includes(q.toLowerCase()))
    return list
  }, [rows, q, filterTab])

  const totalOutstanding = rows.reduce((s, c) => s + c.balance_c, 0)

  const openLedger = async (c: Customer) => {
    setSelected(c)
    const l = await window.api.customers.ledger(c.id, { limit: 50 })
    setLedger(l)
  }

  const actionDone = async () => {
    const customerId = action?.customer.id
    setAction(null)
    await load()
    if (customerId && selected?.id === customerId) {
      const [customer, entries] = await Promise.all([
        window.api.customers.get(customerId),
        window.api.customers.ledger(customerId, { limit: 50 })
      ])
      setSelected(customer)
      setLedger(entries)
    }
  }

  return (
    <div className="px-4 pt-3 pb-6">
      <PageHeader
        title="Store Credit"
        subtitle={`Customers with credit · total outstanding ${money(totalOutstanding)}`}
        actions={
          <button
            onClick={() => setCreateCustomerOpen(true)}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl active:scale-95 transition"
          >
            <Plus className="h-4 w-4" /> New Customer
          </button>
        }
      />

      {/* Filter Tabs & Search */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-ink-900 border border-ink-line text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={`flex-1 py-1.5 rounded-lg text-center transition ${filterTab === 'ALL' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('WITH_BALANCE')}
            className={`flex-1 py-1.5 rounded-lg text-center transition ${filterTab === 'WITH_BALANCE' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
          >
            With Balance ({withBalanceCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('ZERO_BALANCE')}
            className={`flex-1 py-1.5 rounded-lg text-center transition ${filterTab === 'ZERO_BALANCE' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
          >
            Zero Balance ({zeroBalanceCount})
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer by name or nickname…"
            className="input h-11 w-full pl-10 rounded-xl"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filterTab === 'WITH_BALANCE' ? 'No customers with outstanding balance' : 'No customers found'}
          message={filterTab === 'WITH_BALANCE' ? 'All customer accounts are settled with zero balance.' : 'Add a customer to begin extending store credit.'}
          icon={<Wallet className="h-7 w-7" />}
          action={
            <button onClick={() => setCreateCustomerOpen(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add New Customer
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <div key={c.id} className="card p-3.5 space-y-3 bg-ink-900/90 hover:bg-ink-850 transition shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button onClick={() => void openLedger(c)} className="font-bold text-white text-base text-left hover:text-brand-400 truncate block">
                    {c.full_name}
                  </button>
                  {c.nickname && <p className="text-xs text-slate-400">"{c.nickname}"</p>}
                  {c.phone && <p className="text-[11px] text-slate-500">{c.phone}</p>}
                </div>
                <div className="shrink-0">
                  {c.balance_c > c.credit_limit_c ? (
                    <span className="inline-flex items-center rounded-md bg-danger-500/15 px-2 py-0.5 text-[10px] font-bold text-danger-400 border border-danger-500/30">
                      OVER LIMIT
                    </span>
                  ) : c.balance_c > 0 ? (
                    <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                      HAS BALANCE
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      ZERO BALANCE
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-950/70 p-2.5 border border-ink-line/50">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Balance</p>
                  <p className={`text-lg font-black tabular-nums ${c.balance_c > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {money(c.balance_c)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Credit Limit</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-300">
                    {money(c.credit_limit_c)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={() => setAction({ type: 'PAY', customer: c })}
                  className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold"
                  title="Record payment"
                >
                  <HandCoins className="h-3.5 w-3.5" />
                  <span>Record Payment</span>
                </button>
                <button
                  onClick={() => setAction({ type: 'ADJUST', customer: c })}
                  className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold"
                  title="Adjust balance"
                >
                  <Scale className="h-3.5 w-3.5" />
                  <span>Adjust</span>
                </button>
                {c.balance_c > 0 && (
                  <button
                    onClick={() => void shareCustomerStatement(c, settings?.store_name)}
                    className="btn-ghost-2 px-2.5 py-2 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 flex items-center gap-1"
                    title="Share payment reminder"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Remind</span>
                  </button>
                )}
                <button
                  onClick={() => void openLedger(c)}
                  className="btn-ghost-2 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
                  title="View ledger history"
                >
                  History
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <LedgerModal customer={selected} entries={ledger} storeName={settings?.store_name} onClose={() => setSelected(null)} onPay={() => setAction({ type: 'PAY', customer: selected })} />
      )}
      {action && <CreditActionModal action={action} onClose={() => setAction(null)} onDone={() => void actionDone()} />}
      {createCustomerOpen && (
        <CreateCustomerModal
          onClose={() => setCreateCustomerOpen(false)}
          onCreated={() => {
            setCreateCustomerOpen(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

function CreateCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }): React.JSX.Element {
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [creditLimit, setCreditLimit] = useState('1000')
  const [submitting, setSubmitting] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = fullName.trim()
    if (!trimmed) {
      toastError('Name required', 'Customer name is required.')
      return
    }
    setSubmitting(true)
    try {
      const limitC = Math.round((parseFloat(creditLimit) || 1000) * 100)
      await window.api.customers.create({
        full_name: trimmed,
        nickname: nickname.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        credit_limit_c: limitC
      })
      toastSuccess('Customer created', trimmed)
      onCreated()
    } catch (err) {
      toastError('Failed to create customer', String((err as Error)?.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New Customer"
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            type="button"
            onClick={(e) => void handleSave(e)}
            disabled={submitting || !fullName.trim()}
            className="btn-primary flex items-center gap-1.5"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Customer
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
        <div>
          <label className="label">Full Name *</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Mang Ben / Aling Maria"
            className="input w-full"
            autoFocus
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Nickname</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Ben"
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0917..."
              className="input w-full"
            />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Purok / Street"
            className="input w-full"
          />
        </div>
        <div>
          <label className="label">Credit Limit (₱)</label>
          <input
            type="number"
            min={0}
            step="100"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            className="input w-full"
          />
          <p className="text-[10px] text-slate-500 mt-1">Default ₱1,000. Store credit may exceed limit if approved.</p>
        </div>
      </form>
    </Modal>
  )
}

function LedgerModal({ customer, entries, storeName, onClose, onPay }: { customer: Customer; entries: CreditLedgerEntry[]; storeName?: string; onClose: () => void; onPay: () => void }): React.JSX.Element {
  return (
    <Modal open onClose={onClose} title={customer.full_name} maxWidth="max-w-lg" footer={
      <div className="flex items-center justify-between w-full">
        {customer.balance_c > 0 ? (
          <button
            type="button"
            onClick={() => void shareCustomerStatement(customer, storeName)}
            className="btn-secondary flex items-center gap-1.5 text-xs text-amber-400 border-amber-500/30"
          >
            <Share2 className="h-4 w-4" /> Share Reminder
          </button>
        ) : <div />}
        <button onClick={onPay} className="btn-primary flex items-center gap-2 text-xs"><HandCoins className="h-4 w-4" /> Collect Payment</button>
      </div>
    }>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="card p-2 text-center"><p className="text-[10px] uppercase text-slate-500">Balance</p><p className="text-sm font-black text-amber-400">{money(customer.balance_c)}</p></div>
        <div className="card p-2 text-center"><p className="text-[10px] uppercase text-slate-500">Limit</p><p className="text-sm font-black text-slate-200">{money(customer.credit_limit_c)}</p></div>
        <div className="card p-2 text-center"><p className="text-[10px] uppercase text-slate-500">Available</p><p className="text-sm font-black text-emerald-400">{money(Math.max(0, customer.credit_limit_c - customer.balance_c))}</p></div>
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {entries.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No ledger activity.</p>}
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2 text-sm">
            <div>
              <p className="font-medium capitalize text-slate-200">{e.entry_type.replace(/_/g, ' ').toLowerCase()}</p>
              <p className="text-xs text-slate-500">{shortDateTime(e.created_at)}</p>
            </div>
            <span className={`font-bold ${e.amount_c >= 0 ? 'text-danger-400' : 'text-emerald-400'}`}>{e.amount_c >= 0 ? '+' : ''}{money(e.amount_c)}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function CreditActionModal({ action, onClose, onDone }: { action: { type: 'PAY' | 'ADJUST' | 'OVERLIMIT'; customer: Customer }; onClose: () => void; onDone: () => void }): React.JSX.Element {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const amountC = Math.round((parseFloat(amount) || 0) * 100)

  const submit = async () => {
    if (action.type === 'ADJUST' ? amountC === 0 : amountC <= 0) { toastError('Enter a valid amount'); return }
    setSubmitting(true)
    try {
      if (action.type === 'PAY') {
        await window.api.customers.pay({ customer_id: action.customer.id, amount_c: amountC, method: 'CASH', notes })
        toastSuccess('Payment recorded', `${money(amountC)} from ${action.customer.full_name}`)
      } else if (action.type === 'ADJUST') {
        await window.api.customers.adjust({ customer_id: action.customer.id, amount_c: amountC, notes, reason })
        toastSuccess('Balance adjusted')
      } else {
        await window.api.customers.approveOverlimit({ customer_id: action.customer.id, amount_c: amountC, notes, approved_by: 'admin', reason })
        toastSuccess('Overlimit approved')
      }
      onDone()
    } catch (e) {
      toastError('Operation failed', String((e as Error)?.message || e))
    } finally {
      setSubmitting(false)
    }
  }

  const isPay = action.type === 'PAY'
  return (
    <Modal open onClose={onClose} title={`${isPay ? 'Record Payment' : action.type === 'ADJUST' ? 'Adjust Balance' : 'Approve Overlimit'} — ${action.customer.full_name}`} maxWidth="max-w-md" footer={
      <>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => void submit()} disabled={submitting || (isPay ? amountC <= 0 : false)} className="btn-primary flex items-center gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          <Check className="h-4 w-4" /> Confirm
        </button>
      </>
    }>
      <div className="mb-3 rounded-xl border border-ink-line bg-ink-950 p-3 text-center">
        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Current Credit Balance</p>
        <p className="text-2xl font-black text-amber-400 tabular-nums mt-0.5">{money(action.customer.balance_c)}</p>
      </div>

      <div className="space-y-3">
        {isPay && action.customer.balance_c > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Quick Amounts:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAmount((action.customer.balance_c / 100).toFixed(2))}
                className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/25 active:scale-95 transition"
              >
                Full ({money(action.customer.balance_c)})
              </button>
              {[50, 100, 200, 500, 1000].map((preset) => (
                preset * 100 <= action.customer.balance_c ? (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className="rounded-lg border border-ink-line bg-ink-850 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-ink-800 active:scale-95 transition"
                  >
                    ₱{preset}
                  </button>
                ) : null
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label">Amount (₱) {isPay ? '' : action.type === 'ADJUST' ? '(positive = add debt, negative = deduct)' : ''}</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input w-full text-lg font-bold"
            autoFocus
          />
        </div>

        {isPay && amountC > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-ink-950 p-2.5 text-xs border border-ink-line">
            <span className="text-slate-400">Remaining Balance:</span>
            <span className="font-black text-white tabular-nums text-sm">
              {money(Math.max(0, action.customer.balance_c - amountC))}
            </span>
          </div>
        )}

        {action.type === 'ADJUST' && (
          <div>
            <label className="label">Reason *</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="input w-full" placeholder="e.g. Discount / Adjustment" />
          </div>
        )}

        <div>
          <label className="label">Notes (Optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" placeholder="e.g. Partial payment reference" />
        </div>
      </div>
    </Modal>
  )
}
