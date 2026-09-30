import { useEffect, useState } from 'react'
import {
  TrendingUp,
  Banknote,
  Wallet,
  Receipt,
  ShoppingCart,
  AlertTriangle,
  PlusCircle,
  Sparkles,
  ChevronRight,
  ArrowDownLeft
} from 'lucide-react'
import { SectionCard, StatusBadge, EmptyState } from '../components/ui/EmptyState'
import type { Product, Sale, ReportSummary } from '@shared/types'
import { money, moneyShort, shortDateTime, todayKey } from '@shared/format'
import { useNav } from '../stores/nav'
import { PriceGuideModal } from '../components/PriceGuideModal'
import { PettyCashModal } from '../components/PettyCashModal'

export function Dashboard(): React.JSX.Element | null {
  const { setPage } = useNav()
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [recent, setRecent] = useState<Sale[]>([])
  const [alertProducts, setAlertProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [utang, setUtang] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [priceGuideOpen, setPriceGuideOpen] = useState(false)
  const [pettyCashOpen, setPettyCashOpen] = useState(false)

  const loadData = async () => {
    try {
      const today = todayKey()
      const [sales, prods, u, tx] = await Promise.all([
        window.api.reports.sales({ from: today, to: today }),
        window.api.products.search('', { status: 'ACTIVE', limit: 1000 }),
        window.api.reports.utang(),
        window.api.transactions.list({ from: `${today} 00:00:00`, to: `${today} 23:59:59`, limit: 8 })
      ])
      setError(null)
      setSummary(sales.summary)
      setRecent(tx.rows)
      setAllProducts(prods.rows)
      const alerts = prods.rows.filter((p) => p.stock <= p.low_stock_threshold).slice(0, 10)
      setAlertProducts(alerts)
      setUtang(u.total_outstanding_c)
    } catch (e) {
      setError(String((e as Error)?.message || e))
    }
  }

  useEffect(() => {
    let alive = true
    const refresh = () => { if (alive) void loadData() }
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
      <div className="px-4 pt-3 pb-6">
        <div className="card p-6 text-center bg-white border border-slate-200">
          <p className="text-sm font-semibold text-rose-600">Failed to load dashboard: {error}</p>
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
        <div className="card h-36 animate-pulse bg-white border border-slate-200" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-white border border-slate-200" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-white border border-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  const netSales = summary.sales_total_c - summary.refunds_c

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      {/* 1. HERO SALES CARD (Clean Rich Emerald with White Text) */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-600/30 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 p-5 shadow-sm text-white">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Today's Net Sales</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
            </span>
            Live Store
          </span>
        </div>

        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-3xl sm:text-4xl font-black tracking-tight text-white tabular-nums">
            {money(netSales)}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-3 border-t border-white/20 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/15 px-2.5 py-1 text-emerald-100">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
            <span className="font-bold text-white">{moneyShort(summary.profit_c)}</span> profit
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/15 px-2.5 py-1 text-emerald-100">
            <ShoppingCart className="h-3.5 w-3.5 text-emerald-300" />
            <span className="font-bold text-white">{summary.transactions}</span> sales ({summary.items_sold} pcs)
          </span>
          <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${summary.refunds_c > 0 ? 'bg-rose-500/25 text-rose-100 font-semibold' : 'bg-black/15 text-emerald-100'}`}>
            Refunds: {money(summary.refunds_c)}
          </span>
        </div>
      </div>

      {/* 2. FAST ACTION TILES (5-GRID) */}
      <div>
        <p className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Quick Actions</p>
        <div className="grid grid-cols-5 gap-2">
          <button
            onClick={() => setPage('pos')}
            className="card flex flex-col items-center justify-center p-2 text-center transition active:scale-95 hover:border-brand-500/50 bg-white border border-slate-200 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shadow-xs border border-emerald-100">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-slate-900">New Sale</span>
            <span className="text-[10px] text-slate-400">POS</span>
          </button>

          <button
            onClick={() => setPettyCashOpen(true)}
            className="card flex flex-col items-center justify-center p-2 text-center transition active:scale-95 hover:border-purple-500/50 bg-white border border-slate-200 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 shadow-xs border border-purple-100">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-slate-900">Petty Cash</span>
            <span className="text-[10px] text-slate-400">In/Out</span>
          </button>

          <button
            onClick={() => setPage('inventory')}
            className="card flex flex-col items-center justify-center p-2 text-center transition active:scale-95 hover:border-blue-500/50 bg-white border border-slate-200 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 shadow-xs border border-blue-100">
              <PlusCircle className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-slate-900">Product</span>
            <span className="text-[10px] text-slate-400">Inventory</span>
          </button>

          <button
            onClick={() => setPriceGuideOpen(true)}
            className="card relative flex flex-col items-center justify-center p-2 text-center transition active:scale-95 hover:border-emerald-500/50 bg-emerald-50/50 border border-emerald-200 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-emerald-800">Prices</span>
            <span className="text-[10px] text-emerald-600 font-semibold">BANTAY</span>
          </button>

          <button
            onClick={() => setPage('utang')}
            className="card flex flex-col items-center justify-center p-2 text-center transition active:scale-95 hover:border-amber-500/50 bg-white border border-slate-200 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 shadow-xs border border-amber-100">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-xs font-bold text-slate-900">Utang</span>
            <span className="text-[10px] text-slate-400">Collect</span>
          </button>
        </div>
      </div>

      {/* 3. FINANCIAL SNAPSHOT TILES (3 COLUMNS) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setPage('reports')}
          className="card p-3 text-left transition active:scale-95 hover:bg-slate-50 bg-white border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Profit</span>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-base font-black text-slate-900 tabular-nums truncate">{moneyShort(summary.profit_c)}</p>
          <p className="text-[10px] text-slate-400">today</p>
        </button>

        <button
          onClick={() => setPage('utang')}
          className="card p-3 text-left transition active:scale-95 hover:bg-slate-50 bg-white border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Utang</span>
            <Wallet className="h-4 w-4 text-amber-600" />
          </div>
          <p className={`mt-1 text-base font-black tabular-nums truncate ${utang > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{moneyShort(utang)}</p>
          <p className="text-[10px] text-slate-400">receivable</p>
        </button>

        <button
          onClick={() => setPage('expenses')}
          className="card p-3 text-left transition active:scale-95 hover:bg-slate-50 bg-white border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expenses</span>
            <Receipt className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-1 text-base font-black text-slate-900 tabular-nums truncate">{moneyShort(summary.expenses_c)}</p>
          <p className="text-[10px] text-slate-400">today</p>
        </button>
      </div>

      {/* 4. INVENTORY STOCK WATCHLIST */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Stock Alerts</p>
          <button
            onClick={() => setPage('inventory')}
            className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
          >
            <span>View All ({allProducts.length})</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {alertProducts.length === 0 ? (
          <div className="card p-3.5 flex items-center justify-between bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold text-slate-700">All inventory levels are healthy</p>
            </div>
            <span className="text-[11px] text-slate-400">{allProducts.length} items active</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {alertProducts.slice(0, 4).map((p) => (
              <div
                key={p.id}
                onClick={() => setPage('inventory')}
                className="card p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition active:scale-98 cursor-pointer bg-white border border-slate-200 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${p.stock <= 0 ? 'text-rose-600' : 'text-amber-600'}`} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{p.name}</p>
                    <p className="text-[10px] text-slate-500">
                      Threshold: {p.low_stock_threshold} {p.base_unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-black tabular-nums ${p.stock <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {p.stock} {p.base_unit}
                  </span>
                  <StatusBadge status={p.stock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. RECENT SALES FEED */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recent Transactions</p>
          <button
            onClick={() => setPage('transactions')}
            className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
          >
            <span>History</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="No transactions yet today"
            message="Sales made in the POS will appear here."
            icon={<ShoppingCart className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-1.5">
            {recent.slice(0, 5).map((s) => (
              <div
                key={s.id}
                onClick={() => setPage('transactions')}
                className="card p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition active:scale-98 cursor-pointer bg-white border border-slate-200 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">{s.transaction_no}</p>
                  <p className="text-[10px] text-slate-500">
                    {s.cashier_name} · {shortDateTime(s.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black tabular-nums text-slate-900">{moneyShort(s.total_c)}</span>
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

      {/* PETTY CASH MODAL */}
      {pettyCashOpen && (
        <PettyCashModal
          open={pettyCashOpen}
          onClose={() => setPettyCashOpen(false)}
          onDone={() => void loadData()}
        />
      )}
    </div>
  )
}
