import { useEffect, useState } from 'react'
import { Search, Eye, RotateCcw, Ban, ListOrdered, ReceiptText, Printer } from 'lucide-react'
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
    <div className="p-6">
      <PageHeader title="Transactions" subtitle={`${rows.length} shown · net ${money(total)}`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            placeholder="Receipt #, product…"
            className="input w-full pl-9"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setTimeout(() => void load(), 0) }} className="input w-40">
          <option value="">All status</option>
          <option value="COMPLETED">Completed</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIALLY_REFUNDED">Partially refunded</option>
          <option value="VOIDED">Voided</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-40" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-40" />
        <button onClick={() => void load()} className="btn-primary">Apply</button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-12 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No transactions" message="Sales will appear here." icon={<ListOrdered className="h-7 w-7" />} />
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead><tr><th>Receipt</th><th>Date</th><th>Cashier</th><th>Customer</th><th className="text-right">Total</th><th>Status</th><th className="w-36">Actions</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-brand-400">{s.transaction_no}</td>
                  <td className="whitespace-nowrap text-slate-400">{shortDateTime(s.created_at)}</td>
                  <td className="text-slate-300">{s.cashier_name}</td>
                  <td className="text-slate-400">{s.customer_name ?? ''}</td>
                  <td className="text-right font-bold text-white">{money(s.total_c)}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setView(s)} className="btn-ghost-2 rounded-lg p-2" title="View"><Eye className="h-4 w-4" /></button>
                      {(s.status === 'COMPLETED' || s.status === 'PARTIALLY_REFUNDED') && (
                        <button onClick={() => setRefund(s)} className="btn-ghost-2 rounded-lg p-2" title="Refund"><RotateCcw className="h-4 w-4" /></button>
                      )}
                      {s.status === 'COMPLETED' && (
                        <button onClick={() => setVoider(s)} className="btn-ghost-2 rounded-lg p-2 text-danger-400" title="Void"><Ban className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <button onClick={() => setReceiptLines(null)} className="btn-primary">Close</button>
        }>
          <ReceiptPaper lines={receiptLines} />
        </Modal>
      )}
    </>
  )
}

function RefundModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }): React.JSX.Element {
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const items = sale.items.filter((i) => i.qty_base - i.refunded_qty_base > 0)
  const totalRefund = Object.entries(selected).reduce((s, [id, qty]) => {
    const item = sale.items.find((i) => i.id === Number(id))
    return s + (item ? (item.subtotal_c / item.qty_base) * qty : 0)
  }, 0)

  const submit = async () => {
    if (totalRefund <= 0) { toastError('Select items to refund'); return }
    if (!reason.trim()) { toastError('Enter a refund reason'); return }
    setSubmitting(true)
    try {
      const refundItems = items
        .map((i) => ({ sale_item_id: i.id, product_id: i.product_id as number, qty_base: selected[i.id] ?? 0, unit_name: i.unit_name }))
        .filter((i) => i.qty_base > 0)
      await window.api.transactions.refund({
        sale_id: sale.id,
        reason,
        items: refundItems
      })
      toastSuccess('Refund processed')
      onDone()
    } catch (e) {
      toastError('Refund failed', String((e as Error)?.message || e))
    } finally {
      setSubmitting(false)
    }
  }

  const toggle = (itemId: number, qtyBase: number, maxQty: number) => {
    setSelected((prev) => ({ ...prev, [itemId]: prev[itemId] ? 0 : Math.max(1, Math.min(maxQty, qtyBase)) }))
  }

  return (
    <Modal open onClose={onClose} title={`Refund — ${sale.transaction_no}`} maxWidth="max-w-md" footer={
      <button onClick={() => void submit()} disabled={submitting} className="btn-primary">Refund {money(totalRefund)}</button>
    }>
      <div className="space-y-2">
        {items.map((i) => {
          const maxQty = i.qty_base - i.refunded_qty_base
          return (
            <div key={i.id} className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2">
              <div>
                <p className="text-sm text-slate-200">{i.product_name}</p>
                <p className="text-xs text-slate-500">{money(i.subtotal_c / i.qty_base)} × {i.qty} {i.unit_name}</p>
              </div>
              <button
                onClick={() => toggle(i.id, i.qty_base, maxQty)}
                className={`btn-ghost rounded-lg px-3 py-1 text-xs ${selected[i.id] ? '!border-brand-500 !text-brand-400' : ''}`}
              >
                {selected[i.id] ? `Refund ${selected[i.id]}` : 'Refund'}
              </button>
            </div>
          )
        })}
        <div><label className="label">Reason *</label><input value={reason} onChange={(e) => setReason(e.target.value)} className="input w-full" /></div>
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
