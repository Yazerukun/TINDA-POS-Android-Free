import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  Banknote,
  Wallet,
  Receipt,
  ShoppingCart,
  AlertTriangle,
  PlusCircle,
  BookOpen,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Smartphone,
  Flame,
  CreditCard
} from 'lucide-react'
import { SectionCard, StatusBadge, EmptyState } from '../components/ui/EmptyState'
import type { Product, Sale, ReportSummary } from '@shared/types'
import { money, moneyShort, shortDateTime, todayKey } from '@shared/format'
import { useNav } from '../stores/nav'
import { PriceGuideModal } from '../components/PriceGuideModal'

export function Dashboard(): React.JSX.Element | null {
  const { setPage } = useNav()
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [recent, setRecent] = useState<Sale[]>([])
  const [alertProducts, setAlertProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [utang, setUtang] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [priceGuideOpen, setPriceGuideOpen] = useState(false)

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
          window.api.transactions.list({ from: `${today} 00:00:00`, to: `${today} 23:59:59`, limit: 200 })
        ])
        if (!alive || request !== generation) return
        setError(null)
        setSummary(sales.summary)
        setRecent(tx.rows)
        setAllProducts(prods.rows)
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

  const safeAlerts = Array.isArray(alertProducts) ? alertProducts : []
  const out = safeAlerts.filter((p) => p.stock <= 0)
  const low = safeAlerts.filter((p) => p.stock > 0)
  const safeRecent = Array.isArray(recent) ? recent : []
  const todaySales = safeRecent.filter((s) => s && s.status !== 'VOIDED')

  const paymentBreakdown = useMemo(() => {
    let cash = 0
    let gcash = 0
    let maya = 0
    let utang = 0
    for (const s of todaySales) {
      for (const p of s.payments) {
        if (p.method === 'CASH') cash += p.amount_c
        else if (p.method === 'GCASH') gcash += p.amount_c
        else if (p.method === 'MAYA') maya += p.amount_c
        else if (p.method === 'UTANG') utang += p.amount_c
      }
    }
    const total = cash + gcash + maya + utang
    return {
      cash,
      gcash,
      maya,
      utang,
      total,
      cashPct: total > 0 ? (cash / total) * 100 : 0,
      gcashPct: total > 0 ? (gcash / total) * 100 : 0,
      mayaPct: total > 0 ? (maya / total) * 100 : 0,
      utangPct: total > 0 ? (utang / total) * 100 : 0
    }
  }, [todaySales])

  const topMovers = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue_c: number }>()
    for (const s of todaySales) {
      for (const item of s.items) {
        const key = item.product_name || 'Item'
        const ex = map.get(key)
        if (ex) {
          ex.qty += item.qty
          ex.revenue_c += item.subtotal_c
        } else {
          map.set(key, { name: key, qty: item.qty, revenue_c: item.subtotal_c })
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
  }, [todaySales])

  if (error) {
    return (
      <div className="px-4 pt-3 pb-6">
        <div className="card p-6 text-center">
          <p className="text-sm text-danger-400">Failed to load dashboard: {error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-3 text-xs">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="px-4 pt-3 pb-6 space-y-4">
        <div className="card h-36 animate-pulse" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-20 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const netSales = summary.sales_total_c - summary.refunds_c

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      {/* 1. HERO SALES CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-950/40 via-ink-900 to-ink-950 p-4 shadow-card">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Today's Net Sales</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-bold text-brand-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500"></span>
            </span>
            Live
          </span>
        </div>

        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-3xl font-black tracking-tight text-white tabular-nums">
            {money(netSales)}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-ink-line/60 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md bg-ink-800/80 px-2 py-1 text-slate-300">
            <TrendingUp className="h-3 w-3 text-brand-400" />
            <span className="font-semibold text-white">{moneyShort(summary.profit_c)}</span> profit
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-ink-800/80 px-2 py-1 text-slate-300">
            <ShoppingCart className="h-3 w-3 text-slate-400" />
            <span className="font-semibold text-white">{summary.transactions}</span> sales ({summary.items_sold} items)
          </span>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${summary.refunds_c > 0 ? 'bg-danger-500/10 text-danger-400' : 'bg-ink-800/80 text-slate-400'}`}>
            Refunds: {money(summary.refunds_c)}
          </span>
        </div>
      </div>

      {/* 2. FAST ACTION TILES (4-GRID) */}
      <div>
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Quick Actions</p>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setPage('pos')}
            className="card flex flex-col items-center justify-center p-2.5 text-center transition active:scale-95 hover:border-brand-500/50 bg-ink-900/90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400 shadow-sm shadow-brand-500/10">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-white">New Sale</span>
            <span className="text-[10px] text-slate-500">POS</span>
          </button>

          <button
            onClick={() => setPage('inventory')}
            className="card flex flex-col items-center justify-center p-2.5 text-center transition active:scale-95 hover:border-brand-500/50 bg-ink-900/90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <PlusCircle className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-white">Product</span>
            <span className="text-[10px] text-slate-500">Inventory</span>
          </button>

          <button
            onClick={() => setPriceGuideOpen(true)}
            className="card relative flex flex-col items-center justify-center p-2.5 text-center transition active:scale-95 hover:border-emerald-500/50 bg-emerald-500/5 border-emerald-500/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-emerald-300">Prices</span>
            <span className="text-[10px] text-emerald-400/80 font-semibold">🟢 BANTAY</span>
          </button>

          <button
            onClick={() => setPage('utang')}
            className="card flex flex-col items-center justify-center p-2.5 text-center transition active:scale-95 hover:border-brand-500/50 bg-ink-900/90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-white">Utang</span>
            <span className="text-[10px] text-slate-500">Collect</span>
          </button>
        </div>
      </div>

      {/* 3. FINANCIAL SNAPSHOT TILES (3 COLUMNS) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setPage('reports')}
          className="card p-2.5 text-left transition active:scale-95 hover:bg-ink-800"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Profit</span>
            <Banknote className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <p className="mt-1 text-sm font-black text-white tabular-nums truncate">{moneyShort(summary.profit_c)}</p>
          <p className="text-[10px] text-slate-500">today</p>
        </button>

        <button
          onClick={() => setPage('utang')}
          className="card p-2.5 text-left transition active:scale-95 hover:bg-ink-800"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Utang</span>
            <Wallet className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <p className={`mt-1 text-sm font-black tabular-nums truncate ${utang > 0 ? 'text-amber-400' : 'text-slate-300'}`}>{moneyShort(utang)}</p>
          <p className="text-[10px] text-slate-500">receivable</p>
        </button>

        <button
          onClick={() => setPage('expenses')}
          className="card p-2.5 text-left transition active:scale-95 hover:bg-ink-800"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expenses</span>
            <Receipt className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="mt-1 text-sm font-black text-white tabular-nums truncate">{moneyShort(summary.expenses_c)}</p>
          <p className="text-[10px] text-slate-500">today</p>
        </button>
      </div>

      {/* 4. PAYMENT METHOD SPLIT */}
      <div className="card p-3 space-y-2.5 bg-ink-900/80">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment Breakdown</span>
          <span className="text-xs font-bold text-white tabular-nums">Collected: {money(paymentBreakdown.total)}</span>
        </div>

        {paymentBreakdown.total > 0 ? (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-950">
              {paymentBreakdown.cash > 0 && (
                <div
                  style={{ width: `${paymentBreakdown.cashPct}%` }}
                  className="bg-emerald-500 transition-all"
                  title={`Cash: ${money(paymentBreakdown.cash)} (${paymentBreakdown.cashPct.toFixed(0)}%)`}
                />
              )}
              {paymentBreakdown.gcash > 0 && (
                <div
                  style={{ width: `${paymentBreakdown.gcashPct}%` }}
                  className="bg-blue-500 transition-all"
                  title={`GCash: ${money(paymentBreakdown.gcash)} (${paymentBreakdown.gcashPct.toFixed(0)}%)`}
                />
              )}
              {paymentBreakdown.maya > 0 && (
                <div
                  style={{ width: `${paymentBreakdown.mayaPct}%` }}
                  className="bg-teal-400 transition-all"
                  title={`Maya: ${money(paymentBreakdown.maya)} (${paymentBreakdown.mayaPct.toFixed(0)}%)`}
                />
              )}
              {paymentBreakdown.utang > 0 && (
                <div
                  style={{ width: `${paymentBreakdown.utangPct}%` }}
                  className="bg-amber-500 transition-all"
                  title={`Utang: ${money(paymentBreakdown.utang)} (${paymentBreakdown.utangPct.toFixed(0)}%)`}
                />
              )}
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-4 gap-1.5 pt-1 text-xs">
              <div className="rounded-lg bg-ink-950/60 p-2 border border-ink-line/40">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold uppercase">Cash</span>
                </div>
                <p className="mt-1 font-black text-white tabular-nums">{money(paymentBreakdown.cash)}</p>
                <p className="text-[10px] text-slate-500">{paymentBreakdown.cashPct.toFixed(0)}%</p>
              </div>

              <div className="rounded-lg bg-ink-950/60 p-2 border border-ink-line/40">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-[10px] font-bold uppercase">GCash</span>
                </div>
                <p className="mt-1 font-black text-white tabular-nums">{money(paymentBreakdown.gcash)}</p>
                <p className="text-[10px] text-slate-500">{paymentBreakdown.gcashPct.toFixed(0)}%</p>
              </div>

              <div className="rounded-lg bg-ink-950/60 p-2 border border-ink-line/40">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-teal-400" />
                  <span className="text-[10px] font-bold uppercase">Maya</span>
                </div>
                <p className="mt-1 font-black text-white tabular-nums">{money(paymentBreakdown.maya)}</p>
                <p className="text-[10px] text-slate-500">{paymentBreakdown.mayaPct.toFixed(0)}%</p>
              </div>

              <div className="rounded-lg bg-ink-950/60 p-2 border border-ink-line/40">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] font-bold uppercase">Utang</span>
                </div>
                <p className="mt-1 font-black text-amber-400 tabular-nums">{money(paymentBreakdown.utang)}</p>
                <p className="text-[10px] text-slate-500">{paymentBreakdown.utangPct.toFixed(0)}%</p>
              </div>
            </div>
          </>
        ) : (
          <p className="py-2 text-center text-xs text-slate-500">No payment records yet today.</p>
        )}
      </div>

      {/* 5. TOP 5 FAST-MOVING ITEMS TODAY */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-amber-400" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fast Movers Today</p>
          </div>
          <span className="text-[10px] text-slate-500">Top 5 by units sold</span>
        </div>

        {topMovers.length > 0 ? (
          <div className="space-y-1.5">
            {topMovers.map((m, idx) => (
              <div
                key={m.name}
                className="card p-2.5 flex items-center justify-between gap-3 bg-ink-900/80 border border-ink-line/60 hover:bg-ink-850 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                      idx === 0
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        : idx === 1
                        ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                        : idx === 2
                        ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40'
                        : 'bg-ink-950 text-slate-500 border border-ink-line'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{m.name}</p>
                    <p className="text-[10px] text-slate-400">{m.qty} sold</p>
                  </div>
                </div>
                <span className="text-xs font-black tabular-nums text-brand-400 shrink-0">{money(m.revenue_c)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-3 text-center text-xs text-slate-500 bg-ink-900/50">
            Fast-moving products will appear here as items are sold today.
          </div>
        )}
      </div>

      {/* 6. INVENTORY STOCK WATCHLIST */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Stock Alerts</p>
          <button
            onClick={() => setPage('inventory')}
            className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300"
          >
            <span>View All ({Array.isArray(allProducts) ? allProducts.length : 0})</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {safeAlerts.length === 0 ? (
          <div className="card p-3 flex items-center justify-between bg-ink-900/60">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-xs font-medium text-slate-300">All inventory levels are healthy</p>
            </div>
            <span className="text-[10px] text-slate-500">{Array.isArray(allProducts) ? allProducts.length : 0} items active</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {safeAlerts.slice(0, 4).map((p) => (
              <div
                key={p.id}
                onClick={() => setPage('inventory')}
                className="card p-2.5 flex items-center justify-between gap-2 hover:bg-ink-800 transition active:scale-98 cursor-pointer"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${p.stock <= 0 ? 'text-red-400' : 'text-amber-400'}`} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{p.name}</p>
                    <p className="text-[10px] text-slate-400">
                      Threshold: {p.low_stock_threshold} {p.base_unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold tabular-nums ${p.stock <= 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {p.stock} {p.base_unit}
                  </span>
                  <StatusBadge status={p.stock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. RECENT SALES FEED */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recent Transactions</p>
          <button
            onClick={() => setPage('transactions')}
            className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300"
          >
            <span>History</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {safeRecent.length === 0 ? (
          <EmptyState
            title="No transactions yet today"
            message="Sales made in the POS will appear here."
            icon={<ShoppingCart className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-1.5">
            {safeRecent.slice(0, 5).map((s) => (
              <div
                key={s.id}
                onClick={() => setPage('transactions')}
                className="card p-2.5 flex items-center justify-between gap-3 hover:bg-ink-800 transition active:scale-98 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-200">{s.transaction_no}</p>
                  <p className="text-[10px] text-slate-500">
                    {s.cashier_name} · {shortDateTime(s.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black tabular-nums text-white">{moneyShort(s.total_c)}</span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PRICE GUIDE MODAL */}
      {priceGuideOpen && (
        <PriceGuideModal
          open={priceGuideOpen}
          onClose={() => setPriceGuideOpen(false)}
          products={allProducts}
        />
      )}
    </div>
  )
}
