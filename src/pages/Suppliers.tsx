import { useEffect, useState } from 'react'
import { Plus, Pencil, Truck } from 'lucide-react'
import type { Supplier, Product, Purchase } from '@shared/types'
import { money, shortDate } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { toastSuccess, toastError } from '../stores/toast'

interface Form { id: number | null; name: string; contact_person: string; phone: string; address: string; notes: string }

export function Suppliers(): React.JSX.Element {
  const [rows, setRows] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Form | null>(null)
  const [detail, setDetail] = useState<{ s: Supplier; products: Product[]; purchases: Purchase[] } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setRows(await window.api.suppliers.list())
    } catch (e) {
      toastError('Failed to load suppliers', String((e as Error)?.message || e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const save = async (f: Form) => {
    try {
      if (f.id) {
        await window.api.suppliers.update(f.id, { name: f.name, contact_person: f.contact_person || null, phone: f.phone || null, address: f.address || null, notes: f.notes || null })
        toastSuccess('Supplier updated')
      } else {
        await window.api.suppliers.create({ name: f.name, contact_person: f.contact_person || null, phone: f.phone || null, address: f.address || null, notes: f.notes || null })
        toastSuccess('Supplier added')
      }
      setEditing(null)
      void load()
    } catch (e) { toastError('Save failed', String((e as Error)?.message || e)) }
  }

  const openDetail = async (s: Supplier) => {
    const [products, purchases] = await Promise.all([window.api.suppliers.products(s.id), window.api.suppliers.purchases(s.id)])
    setDetail({ s, products, purchases })
  }

  return (
    <div className="px-4 pt-3 pb-8 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Suppliers</h1>
          <p className="text-xs text-slate-400">{rows.length} vendor partners</p>
        </div>
        <button onClick={() => setEditing({ id: null, name: '', contact_person: '', phone: '', address: '', notes: '' })} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl">
          <Plus className="h-4 w-4" /> New Supplier
        </button>
      </div>

      {loading ? (
        <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No suppliers" message="Add suppliers to record purchases and track vendor history." icon={<Truck className="h-7 w-7" />} />
      ) : (
        <div className="space-y-2.5">
          {rows.map((s) => (
            <div key={s.id} className="card p-3.5 flex items-start gap-3 hover:border-ink-600 transition-colors">
              <div className="h-10 w-10 rounded-xl bg-ink-800 border border-ink-line flex items-center justify-center text-brand-400 shrink-0 mt-0.5">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <button onClick={() => void openDetail(s)} className="text-left w-full">
                  <p className="font-bold text-white text-base leading-tight hover:text-brand-300 transition-colors">{s.name}</p>
                  {s.contact_person && <p className="text-xs text-slate-400 mt-0.5">Contact: {s.contact_person}</p>}
                  {s.phone && (
                    <p className="text-xs text-brand-400 font-medium mt-0.5">
                      📞 {s.phone}
                    </p>
                  )}
                  {s.address && <p className="text-xs text-slate-500 truncate mt-0.5">{s.address}</p>}
                </button>
              </div>
              <button
                onClick={() => setEditing({ id: s.id, name: s.name, contact_person: s.contact_person ?? '', phone: s.phone ?? '', address: s.address ?? '', notes: s.notes ?? '' })}
                className="btn-ghost-2 p-2 rounded-lg text-slate-400 hover:text-white shrink-0"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && <SupplierModal form={editing} onSave={save} onClose={() => setEditing(null)} />}
      {detail && <SupplierDetail data={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function SupplierModal({ form, onSave, onClose }: { form: Form; onSave: (f: Form) => void; onClose: () => void }): React.JSX.Element {
  const [f, setF] = useState<Form>(form)
  const set = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }))
  return (
    <Modal open onClose={onClose} title={form.id ? 'Edit Supplier' : 'New Supplier'} maxWidth="max-w-md" footer={
      <>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => onSave(f)} className="btn-primary">Save</button>
      </>
    }>
      <form onSubmit={(e) => { e.preventDefault(); onSave(f) }} className="space-y-3">
        <div><label className="label">Name *</label><input required value={f.name} onChange={(e) => set({ name: e.target.value })} className="input w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Contact Person</label><input value={f.contact_person} onChange={(e) => set({ contact_person: e.target.value })} className="input w-full" /></div>
          <div><label className="label">Phone</label><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="input w-full" /></div>
        </div>
        <div><label className="label">Address</label><input value={f.address} onChange={(e) => set({ address: e.target.value })} className="input w-full" /></div>
        <div><label className="label">Notes</label><input value={f.notes} onChange={(e) => set({ notes: e.target.value })} className="input w-full" /></div>
      </form>
    </Modal>
  )
}

function SupplierDetail({ data, onClose }: { data: { s: Supplier; products: Product[]; purchases: Purchase[] }; onClose: () => void }): React.JSX.Element {
  const { s, products, purchases } = data
  return (
    <Modal open onClose={onClose} title={s.name} maxWidth="max-w-lg">
      <div className="mb-4 rounded-lg border border-ink-line bg-ink-950 p-3 text-sm text-slate-300">
        {s.contact_person && <p><span className="text-slate-500">Contact:</span> {s.contact_person}</p>}
        {s.phone && <p><span className="text-slate-500">Phone:</span> {s.phone}</p>}
        {s.address && <p><span className="text-slate-500">Address:</span> {s.address}</p>}
      </div>
      <h3 className="mb-2 text-sm font-bold uppercase text-slate-300">Purchases ({purchases.length})</h3>
      <div className="mb-4 max-h-40 space-y-1 overflow-y-auto">
        {purchases.length === 0 && <p className="text-sm text-slate-500">No purchases yet.</p>}
        {purchases.map((p) => (
          <div key={p.id} className="flex justify-between rounded-lg border border-ink-line px-3 py-1.5 text-sm">
            <span className="text-slate-400">{p.purchase_no} · {shortDate(p.purchase_date)}</span>
            <span className="font-bold text-slate-200">{money(p.total_c)}</span>
          </div>
        ))}
      </div>
      <h3 className="mb-2 text-sm font-bold uppercase text-slate-300">Products ({(products || []).length})</h3>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {(products || []).map((p) => (
          <div key={p.id} className="flex justify-between rounded-lg border border-ink-line px-3 py-1.5 text-sm">
            <span className="text-slate-200">{p.name}</span>
            <span className="text-slate-400">{p.stock} {p.base_unit}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}