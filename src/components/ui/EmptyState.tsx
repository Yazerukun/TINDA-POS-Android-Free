import { Package } from 'lucide-react'

interface EmptyStateProps {
  title: string
  message: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function EmptyState({ title, message, action, icon }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-line bg-ink-900/40 px-6 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800 text-slate-500">
        {icon ?? <Package className="h-7 w-7" />}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SectionCard({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={`card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const map: Record<string, string> = {
    IN_STOCK: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    LOW_STOCK: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    OUT_OF_STOCK: 'bg-red-500/10 text-red-400 border-red-500/30',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    REFUNDED: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    PARTIALLY_REFUNDED: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    VOIDED: 'bg-red-500/10 text-red-400 border-red-500/30',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    ARCHIVED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    OPENED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    CLOSED: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  }
  return <span className={`badge border ${map[status] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>{status.replace(/_/g, ' ')}</span>
}