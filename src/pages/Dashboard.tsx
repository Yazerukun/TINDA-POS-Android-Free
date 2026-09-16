import { useEffect, useState } from 'react'
import { TrendingUp, Banknote, Wallet, Receipt, ShoppingCart, AlertTriangle } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { SectionCard, StatusBadge, EmptyState } from '../components/ui/EmptyState'
import type { Product, Sale, ReportSummary } from '@shared/types'
import { money, moneyShort, shortDateTime, todayKey } from '@shared/format'

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }): React.JSX.Element {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-700 text-brand-400">{icon}</div>
      </div>
    </div>
  )
}

export function Dashboard(): React.JSX.Element | null {
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [recent, setRecent] = useState<Sale[]>([])
  const [alertProducts, setAlertProducts] = useState<Product[]>([])
  const [utang, setUtang] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let generation = 0
    const load = async () => {
      const request = ++generation
      try {
        const today = todayKey()
        const [sales, prods, u, tx] = await Promise.all([
          window.api.reports.sales({ from: today, to: today }),
          window.api.products.search('', { status: 'ACTIVE', limit: 1000 }),
          window.api.reports.utang(),
          window.api.transactions.list({ from: `${today} 00:00:00`, to: `${today} 23:59:59`, limit: 8 })
        ])
        if (!alive || request !== generation) return
        setError(null)
        setSummary(sales.summary)
        setRecent(tx.rows)
        const alerts = prods.rows.filter((p) => p.stock <= p.low_stock_threshold).slice(0, 10)
        setAlertProducts(alerts)
        setUtang(u.total_outstanding_c)
      } catch (e) {
        if (alive && request === generation) setError(String((e as Error)?.message || e))
      }
    }
    const refresh = () => { void load() }
    refresh()
    const unsubscribe = window.api.inventory.onChanged(refresh)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 15000)
    return () => {
      alive = false
      unsubscribe()
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [])

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Dashboard" subtitle="Sales Overview" />
        <div className="card p-6 text-center">
          <p className="text-sm text-danger-400">Failed to load dashboard: {error}</p>
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="p-6">
        <PageHeader title="Dashboard" subtitle="Sales Overview" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const out = alertProducts.filter((p) => p.stock <= 0)
  const low = alertProducts.filter((p) => p.stock > 0)

  return (
    <div className="p-6">
      <PageHeader title="Dashboard" subtitle="Sales Overview" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Today's Net Sales" value={money(summary.sales_total_c - summary.refunds_c)} sub={`${summary.transactions} transactions · Refunds: ${money(summary.refunds_c)}`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Estimated Profit" value={money(summary.profit_c)} sub={`${summary.items_sold} items sold`} icon={<Banknote className="h-5 w-5" />} />
        <StatCard label="Outstanding Utang" value={money(utang)} sub="customer credit" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Expenses" value={money(summary.expenses_c)} sub="this period" icon={<Receipt className="h-5 w-5" />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="LOW / OUT OF STOCK" action={<span className="text-xs text-slate-500">{out.length} out · {low.length} low</span>}>
          {alertProducts.length === 0 ? (
            <p className="text-sm text-slate-400">All products in stock.</p>
          ) : (
            <div className="space-y-2">
              {alertProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${p.stock <= 0 ? 'text-red-400' : 'text-amber-400'}`} />
                    <span className="truncate text-sm text-slate-200">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{p.stock} {p.base_unit}</span>
                    <StatusBadge status={p.stock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="RECENT TRANSACTIONS" action={<span className="text-xs text-slate-500">{recent.length} shown</span>}>
          {recent.length === 0 ? (
            <EmptyState title="No transactions yet" message="Sales you make today will appear here." icon={<ShoppingCart className="h-7 w-7" />} />
          ) : (
            <div className="space-y-2">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-line px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">{s.transaction_no}</p>
                    <p className="text-xs text-slate-500">{s.cashier_name} · {shortDateTime(s.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{moneyShort(s.total_c)}</span>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
