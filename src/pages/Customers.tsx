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
    <div className="p-6">
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} active customers`}
        actions={<button onClick={() => setEditing({ id: null, full_name: '', nickname: '', phone: '', address: '', credit_limit_c: 100000 })} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> New Customer</button>}
      />
      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" className="input w-full pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-14 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No customers" message="Add customers to sell on utang (credit)." icon={<Users className="h-7 w-7" />} action={<button onClick={() => setEditing({ id: null, full_name: '', nickname: '', phone: '', address: '', credit_limit_c: 100000 })} className="btn-primary">New Customer</button>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead><tr><th>Name</th><th>Phone</th><th>Limit</th><th>Balance</th><th className="w-16"></th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <p className="font-medium text-slate-200">{c.full_name}</p>
                    {c.nickname && <p className="text-xs text-slate-500">{c.nickname}</p>}
                  </td>
                  <td className="text-slate-400">{c.phone ?? '—'}</td>
                  <td className="text-slate-300">{money(c.credit_limit_c)}</td>
                  <td><span className={`font-bold ${c.balance_c > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{money(c.balance_c)}</span></td>
                  <td>
                    <button onClick={() => setEditing({ id: c.id, full_name: c.full_name, nickname: c.nickname ?? '', phone: c.phone ?? '', address: c.address ?? '', credit_limit_c: c.credit_limit_c })} className="btn-ghost-2 rounded-lg p-2" title="Edit"><Pencil className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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