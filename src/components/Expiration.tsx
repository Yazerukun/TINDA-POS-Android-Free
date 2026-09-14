import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Pencil, RefreshCw } from 'lucide-react'
import type { ExpirationEntry, Product } from '@shared/types'
import { expirationStatus } from '@shared/expiration'
import { Modal } from './ui/Modal'
import { toastError, toastSuccess } from '../stores/toast'

const labels = { EXPIRED: 'Expired', SOON: 'Expiring within 7 days', NEAR: 'Expiring within 30 days', UNKNOWN: 'Date review required', OK: 'Not near expiry' }
const colors = { EXPIRED: 'text-red-400', SOON: 'text-orange-400', NEAR: 'text-yellow-400', UNKNOWN: 'text-amber-300', OK: 'text-slate-400' }

export function ExpiryLabel({ date }: { date: string | null }): React.JSX.Element {
  const status = expirationStatus(date)
  return <span className={`text-xs ${colors[status]}`}>{labels[status]}{date ? `: ${date}` : ''}</span>
}

export function ProductExpiry({ product }: { product: Product }): React.JSX.Element | null {
  if (!product.expiration_mode || product.expiration_mode === 'NONE') return null
  const batches = product.batches ?? []
  const nearest = batches.find((b) => b.expiration_date)
  const undated = batches.filter((b) => !b.expiration_date).reduce((n, b) => n + b.quantity, 0)
  return <div className="mt-2 space-y-1 break-words">
    {product.expiration_mode === 'ITEM' ? <ExpiryLabel date={product.expiration_date ?? null} /> : <>
      {nearest && <p><ExpiryLabel date={nearest.expiration_date} /> <span className="text-xs text-slate-400">({nearest.quantity} {product.base_unit})</span></p>}
      {undated > 0 && <p className="text-xs text-amber-300">Date review: {undated} {product.base_unit}</p>}
    </>}
    {product.stock > (product.sellable_stock ?? product.stock) && <p className="text-xs text-red-400">Blocked stock: {product.stock - (product.sellable_stock ?? product.stock)} {product.base_unit}</p>}
  </div>
}

export function ExpirationList({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [rows, setRows] = useState<ExpirationEntry[]>([])
  const [filter, setFilter] = useState('ALERTS')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ExpirationEntry | null>(null)
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { setRows(await window.api.inventory.expiration()); setError('') }
    catch (e) { setError(String((e as Error).message || e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void load()
    const unsubscribe = window.api.inventory.onChanged(() => { void load() })
    const timer = window.setInterval(() => { void load() }, 15000)
    return () => { unsubscribe(); window.clearInterval(timer) }
  }, [load])
  const save = async () => {
    if (!editing?.batch_id) return
    setBusy(true)
    try { await window.api.inventory.batchDate(editing.batch_id, date); setEditing(null); await load(); toastSuccess('Batch expiration saved') }
    catch (e) { toastError('Save failed', String((e as Error).message || e)) }
    finally { setBusy(false) }
  }
  const visible = rows.filter((r) => r.product_name.toLowerCase().includes(search.toLowerCase()) && (filter === 'ALL' || (filter === 'ALERTS' ? expirationStatus(r.expiration_date) !== 'OK' : expirationStatus(r.expiration_date) === filter)))
  return <Modal open onClose={onClose} title="Expiration Dates" maxWidth="max-w-4xl" footer={<button onClick={onClose} className="btn-ghost">Close</button>}>
    <div className="flex flex-wrap gap-2 mb-4">
      <input className="input min-w-0 flex-1" aria-label="Search expiration items" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select className="input max-w-full" aria-label="Expiration filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="ALERTS">All alerts</option><option value="ALL">All tracked stock</option>
        {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <button className="btn-ghost" title="Refresh expiration dates" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></button>
    </div>
    {error ? <p role="alert" className="text-red-400">{error}</p> : loading ? <p>Loading expiration dates...</p> : <div className="divide-y divide-ink-line">
      {visible.map((r) => <div key={`${r.product_id}-${r.batch_id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex-1 break-words"><p className="font-semibold text-white">{r.product_name}</p><p className="text-xs text-slate-400">{r.batch_id ? `Batch #${r.batch_id}: ` : ''}{r.label}</p><ExpiryLabel date={r.expiration_date} /></div>
        <span className="text-sm">{r.quantity} {r.base_unit}</span>
        {r.batch_id && <button className="btn-ghost" title="Correct batch expiration" onClick={() => { setEditing(r); setDate(r.expiration_date ?? '') }}><Pencil className="h-4 w-4" /></button>}
      </div>)}
      {!visible.length && <p className="py-8 text-center text-slate-400">No stock matches this filter.</p>}
    </div>}
    {editing && <div className="mt-4 border-t border-ink-line pt-4">
      <p className="mb-2 text-sm">{editing.product_name} / {editing.label}</p>
      <label className="label" htmlFor="batch-date">Expiration date</label>
      <input id="batch-date" className="input w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="mt-3 flex gap-2"><button className="btn-primary" disabled={busy || !date} onClick={() => void save()}>Save Date</button><button className="btn-ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>
    </div>}
  </Modal>
}

export function ExpirationAlerts({ remind = false }: { remind?: boolean }): React.JSX.Element | null {
  const [rows, setRows] = useState<ExpirationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [reminder, setReminder] = useState(false)
  useEffect(() => {
    let alive = true
    let first = true
    let sequence = 0
    const load = async () => {
      const request = ++sequence
      try {
        const data = await window.api.inventory.expiration()
        if (!alive || request !== sequence) return
        const alerts = data.filter((r) => expirationStatus(r.expiration_date) !== 'OK')
        setRows(alerts); setError(false); setLoading(false)
        if (first && remind && alerts.length) setReminder(true)
        first = false
      } catch { if (alive && request === sequence) { setError(true); setLoading(false) } }
    }
    void load()
    const refresh = () => { void load() }
    const unsubscribe = window.api.inventory.onChanged(refresh)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 15000)
    return () => { alive = false; unsubscribe(); window.removeEventListener('focus', refresh); window.clearInterval(timer) }
  }, [remind])
  const expired = rows.filter((r) => expirationStatus(r.expiration_date) === 'EXPIRED').length
  const unknown = rows.filter((r) => expirationStatus(r.expiration_date) === 'UNKNOWN').length
  return <>
    <div className="flex flex-wrap items-center gap-3 border-b border-ink-line px-6 py-2 text-sm">
      <AlertTriangle className={`h-4 w-4 shrink-0 ${expired ? 'text-red-400' : 'text-amber-400'}`} />
      <span className="flex-1">{loading ? 'Checking expiration dates...' : error ? 'Expiration alerts unavailable' : `${expired} expired / ${rows.length - expired - unknown} expiring soon / ${unknown} need date review`}</span>
      <button onClick={() => setOpen(true)} className="btn-ghost flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Expiration Dates</button>
    </div>
    {reminder && <Modal open onClose={() => setReminder(false)} title="Paalala sa Expiration" footer={<><button className="btn-ghost" onClick={() => setReminder(false)}>Mamaya</button><button className="btn-primary" onClick={() => { setReminder(false); setOpen(true) }}>Tingnan ang Items</button></>}>
      <p>May {expired} item/batch na expired, {rows.length - expired - unknown} na malapit nang ma-expire, at {unknown} na kailangang lagyan ng expiration date.</p>
    </Modal>}
    {open && <ExpirationList onClose={() => setOpen(false)} />}
  </>
}
