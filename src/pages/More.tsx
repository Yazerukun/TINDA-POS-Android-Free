import { useState, useEffect } from 'react'
import { ChevronRight, Store, Sparkles, CalendarClock, LogOut, Coffee, Copy, Check } from 'lucide-react'
import { NAV } from '../components/layout/Sidebar'
import { useNav, type PageKey } from '../stores/nav'
import { useAuth } from '../stores/auth'
import { useSettings } from '../stores/settings'
import { hasPermission } from '@shared/roles'
import type { Product } from '@shared/types'
import { PriceGuideModal } from '../components/PriceGuideModal'
import { ExpirationList } from '../components/Expiration'
import { toastSuccess, toastError } from '../stores/toast'
import tindaIcon from '../assets/tinda-icon.png'

function MayaMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 76 32" className="h-5 w-12" role="img" aria-label="Maya">
      <g fill="#00a86b">
        <path d="M5 8h7l5 7 5-7h7L17 24Z" />
        <path d="M17 8h6l-6 8-6-8Z" opacity=".55" />
      </g>
      <text x="30" y="22" fill="#111827" fontFamily="Arial, sans-serif" fontSize="17" fontWeight="800" letterSpacing="-1">
        maya
      </text>
    </svg>
  )
}

const SUBTITLES: Partial<Record<PageKey, string>> = {
  customers: 'Customer credit, contacts & balances',
  utang: 'Track and settle customer store credit',
  expenses: 'Record store expenses',
  suppliers: 'Manage suppliers & purchases',
  transactions: 'View sales and receipt history',
  backup: 'Back up, restore & sync your data',
  settings: 'Store, users & data options',
  printer: 'Receipt printer configuration',
  update: 'Software update & about'
}

const GROUPS: { title: string; keys: PageKey[] }[] = [
  { title: 'Store Operations', keys: ['customers', 'utang', 'expenses', 'suppliers', 'transactions'] },
  { title: 'System & Data', keys: ['backup', 'settings', 'printer', 'update'] }
]

export function More(): React.JSX.Element {
  const { setPage } = useNav()
  const { user, logout } = useAuth()
  const { settings } = useSettings()
  const [priceGuideOpen, setPriceGuideOpen] = useState(false)
  const [expirationOpen, setExpirationOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [copiedMaya, setCopiedMaya] = useState(false)

  const copyMaya = async () => {
    try {
      await navigator.clipboard.writeText('09912255156')
      setCopiedMaya(true)
      toastSuccess('Maya number copied!', '0991 225 5156')
      setTimeout(() => setCopiedMaya(false), 2500)
    } catch {
      toastError('Could not copy Maya number')
    }
  }

  useEffect(() => {
    window.api.products.search('', { limit: 1000 }).then((res) => setProducts(res.rows)).catch(() => {})
  }, [])

  const can = (k: PageKey) => {
    const item = NAV.find((n) => n.key === k)
    return item && user ? hasPermission(user.roles, item.permission) : false
  }

  return (
    <div className="px-4 pt-3 pb-24 space-y-4">
      {/* 1. STORE PROFILE HEADER CARD */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-ink-line/80 bg-ink-900/90 p-4 shadow-card">
        <img
          src={tindaIcon}
          alt="TINDA POS"
          className="h-12 w-12 shrink-0 rounded-2xl object-contain drop-shadow-[0_0_12px_rgba(52,211,153,0.4)] active:scale-95 transition"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-white tracking-tight">
            {settings?.store_name ?? 'TINDA POS'}
          </h1>
          <p className="truncate text-xs text-slate-400">
            {settings?.address ? settings.address : 'Offline POS for Sari-Sari Stores'}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-brand-400">
              v1.0.30 Stable
            </span>
            <span className="text-[10px] text-slate-500">
              {user?.full_name ? `Logged in: ${user.full_name}` : 'Local Account'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. TINDA BANTAY HERO BANNER */}
      <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-ink-900 to-ink-950 shadow-card">
        <button
          onClick={() => setPriceGuideOpen(true)}
          className="flex w-full items-center gap-3.5 p-4 text-left transition active:scale-[0.99] hover:bg-emerald-500/5"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/10">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-emerald-300">TINDA BANTAY · Price Guide</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                </span>
                LIVE
              </span>
            </div>
            <p className="truncate text-xs text-slate-400 mt-0.5">
              172-item market price reference · DTI Price Guide synced
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
        </button>
      </div>

      {/* 3. GROUPED OPERATION & SYSTEM CARDS */}
      {GROUPS.map((group) => {
        const keys = group.keys.filter(can)
        if (keys.length === 0) return null
        return (
          <div key={group.title} className="space-y-1.5">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group.title}</p>
            <div className="overflow-hidden rounded-2xl border border-ink-line/80 bg-ink-900/90 divide-y divide-ink-line/60 shadow-card">
              {keys.map((k) => {
                const item = NAV.find((n) => n.key === k)!
                return (
                  <button
                    key={k}
                    onClick={() => setPage(k)}
                    className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition active:bg-ink-800 hover:bg-ink-800/60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-slate-300">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">{item.label}</span>
                      {SUBTITLES[k] && <span className="block truncate text-xs text-slate-400 mt-0.5">{SUBTITLES[k]}</span>}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                  </button>
                )
              })}
              {group.title === 'Store Operations' && (
                <button
                  onClick={() => setExpirationOpen(true)}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition active:bg-ink-800 hover:bg-ink-800/60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-amber-400">
                    <CalendarClock className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">Expiration Dates</span>
                    <span className="block truncate text-xs text-slate-400 mt-0.5">Track shelf life, batches & expiring products</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* 4. BUY ME A COFFEE / MAYA DONATION CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-950 p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 via-amber-900/30 to-ink-950 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
            {/* Animated rising steam wisps */}
            <div className="pointer-events-none absolute -top-2 flex items-end gap-1">
              <span className="h-2 w-0.5 rounded-full bg-amber-400/80 animate-steam-1" />
              <span className="h-3 w-0.5 rounded-full bg-amber-300 animate-steam-2" />
              <span className="h-2 w-0.5 rounded-full bg-amber-400/80 animate-steam-3" />
            </div>
            <Coffee className="h-6 w-6 animate-coffee-catchy" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white">Buy me a coffee</h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                For More Updates
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Support development & continuous updates
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
          TINDA POS is 100% free and offline-ready. If it helps your store thrive, you can support future development and upcoming updates by buying the developer a coffee!
        </p>

        {/* Maya Payment Box */}
        <div className="mt-3.5 overflow-hidden rounded-xl border border-emerald-500/40 bg-ink-950 shadow-inner">
          <div className="flex items-center justify-between border-b border-ink-line/60 bg-ink-900/60 px-3.5 py-1.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-11 items-center justify-center rounded bg-white px-1 shadow-sm">
                <MayaMark />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Maya Wallet
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Tap to copy number</span>
          </div>

          <button
            type="button"
            onClick={() => void copyMaya()}
            className="flex w-full items-center justify-between px-3.5 py-3 transition hover:bg-ink-800/40 active:bg-ink-800"
          >
            <div className="text-left">
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Account Number
              </span>
              <span className="block font-mono text-lg font-black tracking-wider text-white">
                0991 225 5156
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30 active:scale-95 shadow-sm">
              {copiedMaya ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy</span>
                </>
              )}
            </div>
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-slate-500">
          Voluntary donation · Dev Francis (0991 225 5156) · Thank you for your support!
        </p>
      </div>

      {/* 5. DEVELOPER & APP CREDITS */}
      <div className="relative overflow-hidden rounded-2xl border border-ink-line/60 bg-gradient-to-b from-ink-900/50 to-ink-950/70 p-5 text-center flex flex-col items-center space-y-2">
        {/* Modern Circular Animated App Crest */}
        <div className="relative flex items-center justify-center py-1">
          {/* Subtle spinning dashed orbit ring */}
          <div className="absolute h-20 w-20 rounded-full border border-dashed border-emerald-400/30 animate-orbit-ring" />
          
          {/* Breathing ambient neon glow aura */}
          <div className="absolute h-16 w-16 rounded-full bg-emerald-500/20 blur-lg animate-pulse" />

          {/* Circular Badge with neon border & pulse */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/70 bg-gradient-to-tr from-ink-950 via-ink-900 to-emerald-950/80 p-2 shadow-[0_0_20px_rgba(52,211,153,0.35)] animate-circle-glow">
            <img
              src={tindaIcon}
              alt="TINDA POS"
              className="h-full w-full rounded-full object-contain drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-black tracking-wide text-white">TINDA POS Free for Android</p>
          <p className="dev-signature text-xs italic text-brand-300 mt-0.5">Crafted with care by Dev Francis</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5 text-[10px] text-slate-400">
          <span className="rounded-full bg-ink-800/80 px-2 py-0.5 border border-ink-line/60">100% Offline Capable</span>
          <span>•</span>
          <span className="rounded-full bg-ink-800/80 px-2 py-0.5 border border-ink-line/60">Universal Backup</span>
          <span>•</span>
          <span className="rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 border border-emerald-500/30">v1.0.27</span>
        </div>
      </div>

      {/* 6. SIGN OUT ACTION */}
      <div className="pt-1">
        <button
          onClick={() => {
            if (window.confirm('Sigurado ka nga gusto nimo mo-sign out sa TINDA POS?')) {
              logout()
            }
          }}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-400 shadow-sm transition hover:bg-rose-500/20 active:scale-[0.98]"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          <span>Sign Out ({user?.username ?? 'Account'})</span>
        </button>
      </div>

      {priceGuideOpen && (
        <PriceGuideModal
          open={priceGuideOpen}
          onClose={() => setPriceGuideOpen(false)}
          products={products}
        />
      )}

      {expirationOpen && (
        <ExpirationList
          onClose={() => setExpirationOpen(false)}
        />
      )}
    </div>
  )
}
