import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react'
import type { Expense, ExpenseCategory } from '@shared/types'
import { money, shortDate } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { toastSuccess, toastError } from '../stores/toast'

interface Form { id: number | null; category_id: number; amount_c: number; expense_date: string; description: string }

export function Expenses(): React.JSX.Element {
  const [rows, setRows] = useState<Expense[]>([])
  const [cats, setCats] = useState<ExpenseCategory[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Form | null>(null)
  const [newCat, setNewCat] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [e, c] = await Promise.all([
        window.api.expenses.list({ from: from || undefined, to: to || undefined, limit: 500 }),
        window.api.expenses.categories()
      ])
      setRows(e.rows)
      setCats(c)
    } catch (err) {
      toastError('Failed to load expenses', String((err as Error)?.message || err))
    } finally {
      setLoading(false)
    }
  }
  // Mount-only load; load() reads current from/to and is re-invoked on demand after changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [])

  const total = rows.reduce((s, e) => s + e.amount_c, 0)

  const save = async (f: Form) => {
    try {
      if (f.id) {
        await window.api.expenses.update(f.id, { category_id: f.category_id, amount_c: f.amount_c, expense_date: f.expense_date, description: f.description || null })
        toastSuccess('Expense updated')
      } else {
        await window.api.expenses.create({ category_id: f.category_id, amount_c: f.amount_c, expense_date: f.expense_date, description: f.description || null })
        toastSuccess('Expense added')
      }
      setEditing(null)
      void load()
    } catch (err) { toastError('Save failed', String((err as Error)?.message || err)) }
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this expense?')) return
    try {
      await window.api.expenses.remove(id)
      toastSuccess('Expense deleted')
      void load()
    } catch (err) { toastError('Delete failed', String((err as Error)?.message || err)) }
  }

  const addCategory = async () => {
    if (!newCat.trim()) return
    try {
      await window.api.expenses.createCategory(newCat.trim())
      setNewCat('')
      toastSuccess('Category added')
      void load()
    } catch (err) { toastError('Failed to add category', String((err as Error)?.message || err)) }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Expenses"
        subtitle={`${rows.length} records · total ${money(total)}`}
        actions={<button onClick={() => setEditing(blankForm(cats))} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> New Expense</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setTimeout(() => void load(), 0) }} className="input w-44" />
        <span className="text-slate-500">to</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setTimeout(() => void load(), 0) }} className="input w-44" />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add expense category…" className="input w-56" />
        <button onClick={() => void addCategory()} className="btn-ghost">Add</button>
        <span className="ml-2 text-xs text-slate-500">{cats.length} categories</span>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-12 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No expenses" message="Expenses you record will appear here." icon={<Receipt className="h-7 w-7" />} />
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th><th className="w-16"></th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-slate-400">{shortDate(e.expense_date)}</td>
                  <td><span className="badge bg-ink-700 text-slate-300">{e.category_name}</span></td>
                  <td className="text-slate-300">{e.description ?? '—'}</td>
                  <td className="text-right font-bold text-danger-400">{money(e.amount_c)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing({ id: e.id, category_id: e.category_id, amount_c: e.amount_c, expense_date: e.expense_date, description: e.description ?? '' })} className="btn-ghost-2 rounded-lg p-2"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => void remove(e.id)} className="btn-ghost-2 rounded-lg p-2 text-danger-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ExpenseModal form={editing} cats={cats} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  )
}

function blankForm(cats: ExpenseCategory[]): Form {
  return { id: null, category_id: cats[0]?.id ?? 0, amount_c: 0, expense_date: new Date().toISOString().slice(0, 10), description: '' }
}

function ExpenseModal({ form, cats, onSave, onClose }: { form: Form; cats: ExpenseCategory[]; onSave: (f: Form) => void; onClose: () => void }): React.JSX.Element {
  const [f, setF] = useState<Form>(form)
  const set = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }))
  return (
    <Modal open onClose={onClose} title={form.id ? 'Edit Expense' : 'New Expense'} maxWidth="max-w-sm" footer={
      <>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => onSave(f)} className="btn-primary">Save</button>
      </>
    }>
      <form onSubmit={(e) => { e.preventDefault(); onSave(f) }} className="space-y-3">
        <div>
          <label className="label">Category</label>
          <select value={f.category_id} onChange={(e) => set({ category_id: Number(e.target.value) })} className="input w-full">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Amount (₱) *</label><input type="number" min={0} required value={f.amount_c / 100} onChange={(e) => set({ amount_c: Math.round(parseFloat(e.target.value || '0') * 100) })} className="input w-full" /></div>
        <div><label className="label">Date *</label><input type="date" required value={f.expense_date} onChange={(e) => set({ expense_date: e.target.value })} className="input w-full" /></div>
        <div><label className="label">Description</label><input value={f.description} onChange={(e) => set({ description: e.target.value })} className="input w-full" /></div>
      </form>
    </Modal>
  )
}