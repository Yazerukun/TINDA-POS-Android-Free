import { useEffect, useMemo, useState } from 'react'
import { Search, Wallet, HandCoins, Scale, Check, ChevronDown, ChevronUp, Package, Printer, Share2 } from 'lucide-react'
import type { Customer, CreditLedgerEntry, Sale } from '@shared/types'
import { money, shortDateTime } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, StatusBadge } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { toastSuccess, toastError } from '../stores/toast'

export function Utang(): React.JSX.Element {
  const [rows, setRows] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [action, setAction] = useState<null | { type: 'PAY' | 'ADJUST' | 'OVERLIMIT'; customer: Customer }>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await window.api.customers.list({ status: 'ACTIVE', limit: 1000 })
      setRows(res.rows)
    } catch (e) {
      toastError('Failed to load utang', String((e as Error)?.message || e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    let list = rows
    if (q) list = list.filter((c) => (c.full_name + ' ' + (c.nickname || '')).toLowerCase().includes(q.toLowerCase()))
    return list
  }, [rows, q])

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
      <PageHeader title="Utang" subtitle={`Customers with credit · total outstanding ${money(totalOutstanding)}`} />

      <div className="mb-3 relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer by name or nickname…" className="input h-11 w-full pl-10 rounded-xl" />
      </div>

      {loading ? (
        <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No customers with utang" message="Sell on credit to a customer to see their balance here." icon={<Wallet className="h-7 w-7" />} />
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
                  {c.balance_c > c.credit_limit_c ? <StatusBadge status="VOIDED" /> : <StatusBadge status="ACTIVE" />}
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
                  title="Collect payment"
                >
                  <HandCoins className="h-3.5 w-3.5" />
                  <span>Pay</span>
                </button>
                <button
                  onClick={() => setAction({ type: 'ADJUST', customer: c })}
                  className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold"
                  title="Adjust balance"
                >
                  <Scale className="h-3.5 w-3.5" />
                  <span>Adjust</span>
                </button>
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
        <LedgerModal customer={selected} entries={ledger} onClose={() => setSelected(null)} onPay={() => setAction({ type: 'PAY', customer: selected })} />
      )}
      {action && <CreditActionModal action={action} onClose={() => setAction(null)} onDone={() => void actionDone()} />}
    </div>
  )
}

function LedgerEntryRow({ entry }: { entry: CreditLedgerEntry }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(false)

  const isCreditSale = (entry.entry_type === 'CREDIT_SALE' || entry.reference_type === 'SALE') && !!entry.reference_id

  const toggleExpand = async () => {
    if (!isCreditSale) return
    if (!expanded && !sale && entry.reference_id) {
      setLoading(true)
      try {
        const s = await window.api.transactions.get(entry.reference_id)
        setSale(s)
      } catch (err) {
        console.error('Failed to load sale details:', err)
      } finally {
        setLoading(false)
      }
    }
    setExpanded(!expanded)
  }

  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!entry.reference_id) return
    try {
      const res = await window.api.printer.printReceipt(entry.reference_id)
      if (res.ok) toastSuccess('Receipt sent to printer')
      else toastError('Print notice', res.message || 'Printer not connected')
    } catch (err) {
      toastError('Print failed', String(err))
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!entry.reference_id) return
    try {
      const res = await window.api.printer.shareReceipt(entry.reference_id)
      if (!res.ok && res.message) toastError('Share notice', res.message)
    } catch (err) {
      toastError('Share failed', String(err))
    }
  }

  return (
    <div className="rounded-xl border border-ink-line/80 bg-ink-950/60 overflow-hidden transition-all">
      <div
        onClick={() => isCreditSale && void toggleExpand()}
        className={`flex items-center justify-between px-3 py-2.5 text-sm ${isCreditSale ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
      >
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold capitalize text-slate-200">
              {entry.entry_type.replace(/_/g, ' ').toLowerCase()}
            </span>
            {entry.notes && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-ink-850 text-slate-400 border border-ink-line">
                {entry.notes}
              </span>
            )}
            {isCreditSale && (
              <span className="text-[10px] font-mono text-brand-400 flex items-center gap-0.5">
                <Package className="h-3 w-3" />
                {expanded ? 'Hide items' : 'View items'}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{shortDateTime(entry.created_at)}</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`font-bold tabular-nums ${entry.amount_c >= 0 ? 'text-danger-400' : 'text-emerald-400'}`}>
            {entry.amount_c >= 0 ? '+' : ''}{money(entry.amount_c)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-ink-line/60 bg-ink-900/80 p-3 space-y-2 text-xs animate-fade-in">
          {loading ? (
            <p className="text-slate-400 text-center py-2">Loading items...</p>
          ) : sale && sale.items.length > 0 ? (
            <>
              <div className="flex items-center justify-between pb-1.5 border-b border-ink-line/40 text-[10px] font-mono uppercase text-slate-400">
                <span>Items Taken ({sale.items.length})</span>
                <span>Subtotal</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-slate-300">
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{item.product_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {item.qty} {item.unit_name || 'pc'} × {money(item.unit_price_c)}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-200 tabular-nums shrink-0">
                      {money(item.subtotal_c)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-ink-line/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrint}
                    className="btn-ghost-2 px-2 py-1 text-[11px] flex items-center gap-1 text-slate-300 hover:text-white"
                    title="Print receipt slip"
                  >
                    <Printer className="h-3.5 w-3.5 text-brand-400" />
                    <span>Print Slip</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="btn-ghost-2 px-2 py-1 text-[11px] flex items-center gap-1 text-slate-300 hover:text-white"
                    title="Share slip"
                  >
                    <Share2 className="h-3.5 w-3.5 text-amber-400" />
                    <span>Share</span>
                  </button>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-500 mr-1.5 font-mono">Total Utang:</span>
                  <span className="font-bold text-amber-400 tabular-nums">{money(sale.total_c)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-center py-2">No item details found for this record.</p>
          )}
        </div>
      )}
    </div>
  )
}

function LedgerModal({ customer, entries, onClose, onPay }: { customer: Customer; entries: CreditLedgerEntry[]; onClose: () => void; onPay: () => void }): React.JSX.Element {
  return (
    <Modal open onClose={onClose} title={customer.full_name} maxWidth="max-w-lg" footer={
      <button onClick={onPay} className="btn-primary flex items-center gap-2"><HandCoins className="h-4 w-4" /> Collect Payment</button>
    }>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="card p-2 text-center"><p className="text-[10px] uppercase text-slate-500">Balance</p><p className="text-sm font-black text-amber-400">{money(customer.balance_c)}</p></div>
        <div className="card p-2 text-center"><p className="text-[10px] uppercase text-slate-500">Limit</p><p className="text-sm font-black text-slate-200">{money(customer.credit_limit_c)}</p></div>
        <div className="card p-2 text-center"><p className="text-[10px] uppercase text-slate-500">Available</p><p className="text-sm font-black text-emerald-400">{money(Math.max(0, customer.credit_limit_c - customer.balance_c))}</p></div>
      </div>
      <div className="max-h-80 space-y-1.5 overflow-y-auto">
        {entries.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No ledger activity.</p>}
        {entries.map((e) => (
          <LedgerEntryRow key={e.id} entry={e} />
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
        toastSuccess('Payment recorded')
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
    <Modal open onClose={onClose} title={`${isPay ? 'Collect Payment' : action.type === 'ADJUST' ? 'Adjust Balance' : 'Approve Overlimit'} — ${action.customer.full_name}`} maxWidth="max-w-md" footer={
      <>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => void submit()} disabled={submitting} className="btn-primary flex items-center gap-2"><Check className="h-4 w-4" /> Confirm</button>
      </>
    }>
      <div className="mb-3 rounded-lg border border-ink-line bg-ink-950 p-3 text-center">
        <p className="text-xs text-slate-500">Current Balance</p>
        <p className="text-xl font-black text-amber-400">{money(action.customer.balance_c)}</p>
      </div>
      <div className="space-y-3">
        <div><label className="label">Amount (₱) {isPay ? '' : action.type === 'ADJUST' ? '(positive = add debt, negative = deduct)' : ''}</label><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input w-full" autoFocus /></div>
        {action.type === 'ADJUST' && <div><label className="label">Reason *</label><input value={reason} onChange={(e) => setReason(e.target.value)} className="input w-full" /></div>}
        <div><label className="label">Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full" /></div>
      </div>
    </Modal>
  )
}
