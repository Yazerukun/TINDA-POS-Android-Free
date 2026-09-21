import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Users } from 'lucide-react'
import type { Customer } from '@shared/types'
import { money } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { toastSuccess, toastError } from '../stores/toast'

interface Form { id: number | null; full_name: string; nickname: string; phone: string; address: string; credit_limit_c: number }

export function Customers(): React.JSX.Element {
  const [rows, setRows] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Form | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await window.api.customers.list({ status: 'ACTIVE', limit: 1000 })
      setRows(res.rows)
    } catch (e) {
      toastError('Failed to load customers', String((e as Error)?.message || e))
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

  const save = async (f: Form) => {
    try {
      if (f.id) {
        await window.api.customers.update(f.id, { full_name: f.full_name, nickname: f.nickname || null, phone: f.phone || null, address: f.address || null, credit_limit_c: f.credit_limit_c })
        toastSuccess('Customer updated')
      } else {
        await window.api.customers.create({ full_name: f.full_name, nickname: f.nickname || null, phone: f.phone || null, address: f.address || null, credit_limit_c: f.credit_limit_c })
        toastSuccess('Customer added')
      }
      setEditing(null)
      void load()
    } catch (e) { toastError('Save failed', String((e as Error)?.message || e)) }
  }

  return (
    <div className="px-4 pt-3 pb-8 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Customers</h1>
          <p className="text-xs text-slate-400">{rows.length} active customers</p>
        </div>
        <button onClick={() => setEditing({ id: null, full_name: '', nickname: '', phone: '', address: '', credit_limit_c: 100000 })} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl">
          <Plus className="h-4 w-4" /> New Customer
        </button>
      </div>

      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" className="input w-full pl-9 text-sm py-2" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No customers" message="Add customers to extend store credit." icon={<Users className="h-7 w-7" />} action={<button onClick={() => setEditing({ id: null, full_name: '', nickname: '', phone: '', address: '', credit_limit_c: 100000 })} className="btn-primary">New Customer</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="card p-4 flex flex-col justify-between hover:bg-ink-800 transition">
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-white truncate text-base">{c.full_name}</p>
                  {c.nickname && <p className="text-sm text-slate-400 truncate">"{c.nickname}"</p>}
                  {c.phone && <p className="text-xs text-slate-500 truncate mt-0.5">{c.phone}</p>}
                </div>
                <button onClick={() => setEditing({ id: c.id, full_name: c.full_name, nickname: c.nickname ?? '', phone: c.phone ?? '', address: c.address ?? '', credit_limit_c: c.credit_limit_c })} className="btn-ghost-2 shrink-0 h-10 w-10 p-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-white" title="Edit"><Pencil className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Balance</p>
                  <p className={`text-xl font-black tabular-nums leading-none mt-1 ${c.balance_c > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{money(c.balance_c)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Limit</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-300 mt-1">{money(c.credit_limit_c)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <CustomerModal form={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CustomerModal({ form, onSave, onClose }: { form: Form; onSave: (f: Form) => void; onClose: () => void }): React.JSX.Element {
  const [f, setF] = useState<Form>(form)
  const set = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }))
  return (
    <Modal open onClose={onClose} title={form.id ? 'Edit Customer' : 'New Customer'} maxWidth="max-w-md" footer={
      <>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => onSave(f)} className="btn-primary">Save</button>
      </>
    }>
      <form onSubmit={(e) => { e.preventDefault(); onSave(f) }} className="space-y-3">
        <div><label className="label">Full Name *</label><input required value={f.full_name} onChange={(e) => set({ full_name: e.target.value })} className="input w-full" /></div>
        <div><label className="label">Nickname</label><input value={f.nickname} onChange={(e) => set({ nickname: e.target.value })} className="input w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Phone</label><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="input w-full" /></div>
          <div><label className="label">Credit Limit (₱)</label><input type="number" min={0} value={f.credit_limit_c / 100} onChange={(e) => set({ credit_limit_c: Math.round(parseFloat(e.target.value || '0') * 100) })} className="input w-full" /></div>
        </div>
        <div><label className="label">Address</label><input value={f.address} onChange={(e) => set({ address: e.target.value })} className="input w-full" /></div>
      </form>
    </Modal>
  )
}