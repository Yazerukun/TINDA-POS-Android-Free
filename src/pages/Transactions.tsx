import { useEffect, useState } from 'react'
import { Search, Eye, RotateCcw, Ban, ListOrdered, ReceiptText, Printer, Share2 } from 'lucide-react'
import type { Sale } from '@shared/types'
import { money, shortDateTime } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState, StatusBadge } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { ReceiptPaper } from '../components/ReceiptPaper'
import { toastSuccess, toastError } from '../stores/toast'

export function Transactions(): React.JSX.Element {
  const [rows, setRows] = useState<Sale[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<Sale | null>(null)
  const [refund, setRefund] = useState<Sale | null>(null)
  const [voider, setVoider] = useState<Sale | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await window.api.transactions.list({
        search: q || undefined,
        status: status || undefined,
        from: from ? `${from} 00:00:00` : undefined,
        to: to ? `${to} 23:59:59` : undefined,
        limit: 200
      })
      setRows(res.rows)
    } catch (e) {
      toastError('Failed to load transactions', String((e as Error)?.message || e))
    } finally {
      setLoading(false)
    }
  }
  // Mount-only load; load() reads current filters and is re-invoked on demand after changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [])

  const total = rows.filter((s) => s.status !== 'VOIDED').reduce((s, x) => s + x.total_c, 0)

  return (
    <div className="px-4 pt-3 pb-8 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Transactions</h1>
          <p className="text-xs text-slate-400">{rows.length} shown · net <span className="font-bold text-brand-400">{money(total)}</span></p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void load()}
              placeholder="Receipt #, product…"
              className="input w-full pl-9 text-sm py-2"
            />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setTimeout(() => void load(), 0) }} className="input text-xs py-2 w-32 shrink-0">
            <option value="">All status</option>
            <option value="COMPLETED">Completed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PARTIALLY_REFUNDED">Partially</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setTimeout(() => void load(), 0) }} className="input w-full text-xs py-1.5" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setTimeout(() => void load(), 0) }} className="input w-full text-xs py-1.5" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No transactions" message="Sales will appear here." icon={<ListOrdered className="h-7 w-7" />} />
      ) : (
        <div className="space-y-2.5">
          {rows.map(s => (
            <div key={s.id} className="card p-3.5 hover:border-ink-600 transition-colors">
              <div className="flex justify-between items-start mb-1.5">
                <div>
                  <span className="font-bold text-brand-400 text-sm">{s.transaction_no}</span>
                  <p className="text-xs text-slate-400">{shortDateTime(s.created_at)}</p>
                </div>
                <p className="font-bold tabular-nums text-white text-base">{money(s.total_c)}</p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-ink-line/60">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs text-slate-400 truncate mb-1">{s.cashier_name} {s.customer_name ? `· ${s.customer_name}` : ''}</p>
                  <div><StatusBadge status={s.status} /></div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setView(s)} className="btn-ghost-2 p-2 rounded-lg text-slate-300 hover:text-white" title="View"><Eye className="h-4 w-4" /></button>
                  {(s.status === 'COMPLETED' || s.status === 'PARTIALLY_REFUNDED') && (
                    <button onClick={() => setRefund(s)} className="btn-ghost-2 p-2 rounded-lg text-amber-400 hover:text-amber-300" title="Refund"><RotateCcw className="h-4 w-4" /></button>
                  )}
                  {s.status === 'COMPLETED' && (
                    <button onClick={() => setVoider(s)} className="btn-ghost-2 p-2 rounded-lg text-danger-400 hover:text-danger-300" title="Void"><Ban className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view && <ViewSale sale={view} onClose={() => setView(null)} />}
      {refund && <RefundModal sale={refund} onClose={() => setRefund(null)} onDone={() => { setRefund(null); void load() }} />}
      {voider && <VoidModal sale={voider} onClose={() => setVoider(null)} onDone={() => { setVoider(null); void load() }} />}
    </div>
  )
}

function ViewSale({ sale, onClose }: { sale: Sale; onClose: () => void }): React.JSX.Element {
  const [receiptLines, setReceiptLines] = useState<string[] | null>(null)
  const print = async () => {
    try {
      const result = await window.api.printer.printReceipt(sale.id)
      if (result.ok) toastSuccess('Receipt printed successfully')
      else toastError('Receipt printing failed', result.message)
    } catch (e) { toastError('Receipt printing failed', String((e as Error)?.message || e)) }
  }
  const openReceiptPreview = async () => {
    try {
      // Reconstruct the EXISTING transaction only — no checkout, no stock change.
      const lines = await window.api.pos.reprint(sale.id)
      setReceiptLines(lines)
    } catch (e) { toastError('Could not generate receipt', String((e as Error)?.message || e)) }
  }
  return (
    <>
      <Modal open onClose={onClose} title={sale.transaction_no} maxWidth="max-w-md" footer={
        <><button onClick={() => void openReceiptPreview()} className="btn-ghost flex items-center gap-2"><ReceiptText className="h-4 w-4" /> View Receipt</button><button onClick={() => void print()} className="btn-primary flex items-center gap-2"><Printer className="h-4 w-4" /> Print Receipt</button></>
      }>
      <div className="mb-3 flex justify-between text-sm text-slate-400">
        <span>{shortDateTime(sale.created_at)}</span><span>{sale.cashier_name}</span>
      </div>
      {sale.customer_name && <p className="mb-2 text-sm text-slate-400">Customer: <span className="text-slate-200">{sale.customer_name}</span></p>}
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {sale.items.map((i) => (
          <div key={i.id} className="flex justify-between rounded-lg border border-ink-line px-3 py-1.5 text-sm">
            <span className="text-slate-300">{i.product_name} <span className="text-slate-500">×{i.qty} {i.unit_name}</span>{i.refunded_qty_base > 0 && <span className="ml-1 text-amber-400">(ref {i.refunded_qty_base})</span>}</span>
            <span className="font-bold text-slate-200">{money(i.subtotal_c)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 border-t border-ink-line pt-2 text-sm">
        <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{money(sale.subtotal_c)}</span></div>
        {sale.discount_c > 0 && <div className="flex justify-between text-slate-400"><span>Discount</span><span>-{money(sale.discount_c)}</span></div>}
        <div className="flex justify-between font-bold text-white"><span>Total</span><span>{money(sale.total_c)}</span></div>
        <div className="space-y-0.5 pt-1">
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-xs text-slate-500"><span>{p.method}</span><span>{money(p.amount_c)}</span></div>
          ))}
        </div>
      </div>
      </Modal>
      {receiptLines && (
        <Modal open onClose={() => setReceiptLines(null)} title={`Receipt — ${sale.transaction_no}`} maxWidth="max-w-lg" footer={
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <button onClick={() => void window.api.printer.shareReceipt?.(receiptLines, `Receipt ${sale.transaction_no}`)} className="btn-ghost flex items-center gap-1.5"><Share2 className="h-4 w-4" /> Share</button>
            <button onClick={() => void print()} className="btn-primary flex items-center gap-1.5"><Printer className="h-4 w-4" /> Print Receipt</button>
            <button onClick={() => setReceiptLines(null)} className="btn-ghost">Close</button>
          </div>
        }>
          <ReceiptPaper lines={receiptLines} />
        </Modal>
      )}
    </>
  )
}

function RefundModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }): React.JSX.Element {
  const [qty, setQty] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refundableItems = sale.items.filter((i) => i.qty_base - i.refunded_qty_base > 0)

  const setItemQty = (itemId: number, value: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(maxQty, Math.round(value) || 0))
    setQty((prev) => ({ ...prev, [itemId]: clamped }))
  }

  const totalRefund = refundableItems.reduce((sum, i) => {
    const q = qty[i.id] ?? 0
    return sum + (q > 0 ? Math.round((i.subtotal_c / (i.qty_base || 1)) * q) : 0)
  }, 0)

  const submit = async () => {
    if (totalRefund <= 0) { toastError('Select items to refund', 'Set quantity to at least 1 for one item.'); return }
    if (!reason.trim()) { toastError('Reason required', 'Enter a refund reason.'); return }
    setSubmitting(true)
    try {
      const items = refundableItems
        .map((i) => ({ sale_item_id: i.id, product_id: i.product_id as number, qty_base: qty[i.id] ?? 0, unit_name: i.unit_name }))
        .filter((i) => i.qty_base > 0)
      await window.api.transactions.refund({ sale_id: sale.id, reason, items })
      toastSuccess('Refund processed')
      onDone()
    } catch (e) {
      toastError('Refund failed', String((e as Error)?.message || e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Refund — ${sale.transaction_no}`} maxWidth="max-w-md" footer={
      <button onClick={() => void submit()} disabled={submitting || totalRefund <= 0} className="btn-primary">
        {totalRefund > 0 ? `Refund ${money(totalRefund)}` : 'Select items'}
      </button>
    }>
      <div className="space-y-3">
        {refundableItems.map((i) => {
          const maxQty = i.qty_base - i.refunded_qty_base
          const currentQty = qty[i.id] ?? 0
          const itemRefund = currentQty > 0 ? Math.round((i.subtotal_c / (i.qty_base || 1)) * currentQty) : 0
          return (
            <div key={i.id} className="rounded-lg border border-ink-line p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 leading-tight">{i.product_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {money(Math.round(i.subtotal_c / (i.qty_base || 1)))} / {i.unit_name} · Remaining: <span className="text-slate-300 font-semibold">{maxQty}</span>
                  </p>
                </div>
                {itemRefund > 0 && (
                  <span className="text-xs font-bold text-brand-400 shrink-0">−{money(itemRefund)}</span>
                )}
              </div>
              {/* Qty stepper: [−] [input] [+] */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setItemQty(i.id, currentQty - 1, maxQty)}
                  disabled={currentQty <= 0}
                  className="btn-ghost-2 h-9 w-9 rounded-lg text-lg font-bold disabled:opacity-30"
                >−</button>
                <input
                  type="number"
                  min={0}
                  max={maxQty}
                  value={currentQty === 0 ? '' : currentQty}
                  placeholder="0"
                  onChange={(e) => setItemQty(i.id, parseInt(e.target.value || '0', 10), maxQty)}
                  className="h-9 w-16 rounded-lg border border-ink-line bg-ink-950 text-center text-sm font-bold text-white"
                />
                <button
                  type="button"
                  onClick={() => setItemQty(i.id, currentQty + 1, maxQty)}
                  disabled={currentQty >= maxQty}
                  className="btn-ghost-2 h-9 w-9 rounded-lg text-lg font-bold disabled:opacity-30"
                >+</button>
                <span className="text-xs text-slate-500">of {maxQty} {i.unit_name}</span>
                {currentQty === maxQty && (
                  <span className="ml-auto text-[10px] text-amber-400 font-semibold">Full</span>
                )}
              </div>
            </div>
          )
        })}
        <div>
          <label className="label">Reason *</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="input w-full" placeholder="e.g. Damaged, customer changed mind" />
        </div>
      </div>
    </Modal>
  )
}

function VoidModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }): React.JSX.Element {
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const disabled = confirmText.trim().toLowerCase() !== 'void' || !reason.trim()

  const submit = async () => {
    setSubmitting(true)
    try {
      await window.api.transactions.void({ sale_id: sale.id, reason })
      toastSuccess('Sale voided')
      onDone()
    } catch (e) {
      toastError('Void failed', String((e as Error)?.message || e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Void — ${sale.transaction_no}`} maxWidth="max-w-sm" footer={
      <button onClick={() => void submit()} disabled={disabled || submitting} className="btn-danger">Void Sale</button>
    }>
      <p className="mb-3 text-sm text-danger-400">This will void the entire sale of {money(sale.total_c)} and restore stock. This cannot be undone.</p>
      <div className="space-y-3">
        <div><label className="label">Reason *</label><input value={reason} onChange={(e) => setReason(e.target.value)} className="input w-full" /></div>
        <div><label className="label">Type VOID to confirm</label><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="input w-full" /></div>
      </div>
    </Modal>
  )
}
