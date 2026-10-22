import { useState, useEffect } from 'react'
import { ChevronRight, Store, Sparkles, CalendarClock, LogOut, Coffee, Copy, Check } from 'lucide-react'
import { NAV } from '../components/layout/Sidebar'
import { useNav, type PageKey } from '../stores/nav'
import { useAuth } from '../stores/auth'
import { useSettings } from '../stores/settings'
import { APP_VERSION } from '../data/system'
import { hasPermission } from '@shared/roles'
import type { Product } from '@shared/types'
import { useLicenseStore } from '../stores/license'
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
  utang: 'Track and settle customer utang',
  expenses: 'Record store expenses',
  suppliers: 'Manage suppliers & purchases',
  transactions: 'View sales and receipt history',
  backup: 'Back up, restore & sync your data',
  settings: 'Store, users & data options',
  license: 'VIP Pro hardware licensing & activation',
  printer: 'Receipt printer configuration',
  update: 'Software update & about'
}

const GROUPS: { title: string; keys: PageKey[] }[] = [
  { title: 'Store Operations', keys: ['customers', 'utang', 'expenses', 'suppliers', 'transactions'] },
  { title: 'System & Data', keys: ['backup', 'settings', 'license', 'printer', 'update'] }
]

export function More(): React.JSX.Element {
  const { setPage } = useNav()
  const { user, logout } = useAuth()
  const { settings } = useSettings()
  const { status: license } = useLicenseStore()
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
      <div className="flex items-center gap-3.5 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <img
          src={tindaIcon}
          alt="TINDA POS"
          onClick={() => setPage('license')}
          className="h-12 w-12 shrink-0 rounded-2xl object-contain shadow-sm active:scale-95 transition cursor-pointer"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-black text-slate-950 tracking-tight">
              {settings?.store_name ?? 'TINDA POS'}
            </h1>
            {license?.isVip ? (
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black text-white ${license.isDemo ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                {license.isDemo ? 'DEMO' : 'VIP PRO'}
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-600">
                COMMUNITY
              </span>
            )}
          </div>
          <p className="truncate text-xs font-semibold text-slate-600">
            {settings?.address ? settings.address : 'Offline POS for Sari-Sari Stores'}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-emerald-800">
              v{APP_VERSION} Stable
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {user?.full_name ? `Logged in: ${user.full_name}` : 'Local Account'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. VIP PRO HERO BANNER */}
      <div className={`overflow-hidden rounded-2xl border-2 p-4 shadow-sm flex items-center justify-between gap-3 ${
        license?.isVip
          ? 'border-emerald-400 bg-gradient-to-r from-emerald-50 via-white to-emerald-50'
          : 'border-emerald-300 bg-white'
      }`}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-950">
                {license?.isVip ? (license.isDemo ? '24-Hour VIP Demo Active' : 'VIP Pro Lifetime Active') : 'Upgrade to VIP Pro'}
              </span>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black text-white">
                {license?.isVip ? 'UNLOCKED' : '₱500'}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              {license?.isVip
                ? 'Hardware-locked offline lifetime license active on this device.'
                : '100% Offline hardware license for tablet counter & desktop import.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setPage('license')}
          className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs active:scale-95 transition"
        >
          {license?.isVip ? 'Manage' : 'View'}
        </button>
      </div>

      {/* 2. TINDA BANTAY HERO BANNER */}
      <div className="overflow-hidden rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 shadow-sm">
        <button
          onClick={() => setPriceGuideOpen(true)}
          className="flex w-full items-center gap-3.5 p-4 text-left transition active:scale-[0.99] hover:bg-emerald-100/50"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-black text-slate-950">TINDA BANTAY · Price Guide</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white"></span>
                </span>
                LIVE
              </span>
            </div>
            <p className="truncate text-xs font-semibold text-slate-600 mt-0.5">
              172-item market price reference · DTI e-Presyo synced
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
        </button>
      </div>

      {/* 3. GROUPED OPERATION & SYSTEM CARDS */}
      {GROUPS.map((group) => {
        const keys = group.keys.filter(can)
        if (keys.length === 0) return null
        return (
          <div key={group.title} className="space-y-1.5">
            <p className="px-1 text-[11px] font-black uppercase tracking-wider text-slate-600">{group.title}</p>
            <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
              {keys.map((k) => {
                const item = NAV.find((n) => n.key === k)!
                return (
                  <button
                    key={k}
                    onClick={() => setPage(k)}
                    className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition active:bg-slate-50 hover:bg-slate-50/70"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-slate-950">{item.label}</span>
                      {SUBTITLES[k] && <span className="block truncate text-xs font-semibold text-slate-600 mt-0.5">{SUBTITLES[k]}</span>}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                )
              })}
              {group.title === 'Store Operations' && (
                <button
                  onClick={() => setExpirationOpen(true)}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition active:bg-slate-50 hover:bg-slate-50/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <CalendarClock className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-950">Expiration Dates</span>
                    <span className="block truncate text-xs font-semibold text-slate-600 mt-0.5">Track shelf life, batches & expiring products</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* 4. BUY ME A COFFEE / MAYA DONATION CARD */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-600 shadow-sm">
            {/* Animated rising steam wisps */}
            <div className="pointer-events-none absolute -top-2 flex items-end gap-1">
              <span className="h-2 w-0.5 rounded-full bg-amber-500 animate-steam-1" />
              <span className="h-3 w-0.5 rounded-full bg-amber-600 animate-steam-2" />
              <span className="h-2 w-0.5 rounded-full bg-amber-500 animate-steam-3" />
            </div>
            <Coffee className="h-6 w-6 animate-coffee-catchy" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-950">Buy me a coffee</h3>
              <span className="rounded-full bg-emerald-50 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                For More Updates
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Support development & continuous updates
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-xs text-slate-700 font-medium leading-relaxed">
          TINDA POS is 100% free and offline-ready. If it helps your store thrive, you can support future development and upcoming updates by buying the developer a coffee!
        </p>

        {/* Maya Payment Box */}
        <div className="mt-3.5 overflow-hidden rounded-xl border-2 border-emerald-300 bg-emerald-50/40 shadow-xs">
          <div className="flex items-center justify-between border-b border-emerald-200 bg-emerald-100/50 px-3.5 py-1.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-11 items-center justify-center rounded bg-white px-1 shadow-xs border border-emerald-200">
                <MayaMark />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                Maya Wallet
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-800">Tap to copy number</span>
          </div>

          <button
            type="button"
            onClick={() => void copyMaya()}
            className="flex w-full items-center justify-between px-3.5 py-3 transition hover:bg-emerald-100/60 active:bg-emerald-100"
          >
            <div className="text-left">
              <span className="block text-[10px] uppercase tracking-wider text-slate-600 font-black">
                Account Number
              </span>
              <span className="block font-mono text-lg font-black tracking-wider text-slate-950">
                0991 225 5156
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition active:scale-95 shadow-sm">
              {copiedMaya ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied!</span>
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

        <p className="mt-2 text-center text-[10px] font-semibold text-slate-500">
          Voluntary donation · Dev Francis (0991 225 5156) · Thank you for your support!
        </p>
      </div>

      {/* 5. DEVELOPER & APP CREDITS */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-5 text-center flex flex-col items-center space-y-2 shadow-sm">
        {/* Modern Circular Animated App Crest */}
        <div className="relative flex items-center justify-center py-1">
          {/* Subtle spinning dashed orbit ring */}
          <div className="absolute h-20 w-20 rounded-full border border-dashed border-emerald-400/50 animate-orbit-ring" />
          
          {/* Breathing ambient neon glow aura */}
          <div className="absolute h-16 w-16 rounded-full bg-emerald-500/15 blur-lg animate-pulse" />

          {/* Circular Badge with emerald border & pulse */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-500 bg-white p-2 shadow-sm">
            <img
              src={tindaIcon}
              alt="TINDA POS"
              className="h-full w-full rounded-full object-contain"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-black tracking-wide text-slate-950">TINDA POS Free for Android</p>
          <p className="dev-signature text-xs italic text-emerald-700 font-bold mt-0.5">Crafted with care by Dev Francis</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5 text-[10px] text-slate-600 font-semibold">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 border border-slate-200">100% Offline Capable</span>
          <span>•</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 border border-slate-200">Universal Backup</span>
          <span>•</span>
          <span className="rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5 border border-emerald-300 font-bold">v{APP_VERSION}</span>
        </div>
      </div>

      {/* 6. SIGN OUT ACTION */}
      <div className="pt-1">
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to sign out of TINDA POS?')) {
              logout()
            }
          }}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-500 shadow-sm transition hover:bg-rose-500/20 active:scale-[0.98]"
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
