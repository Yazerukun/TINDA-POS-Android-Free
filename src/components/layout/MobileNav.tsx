import { LayoutDashboard, ShoppingCart, Boxes, BarChart3, Menu } from 'lucide-react'
import tindaIcon from '../../assets/tinda-icon.png'
import { useNav, type PageKey } from '../../stores/nav'
import { useAuth } from '../../stores/auth'
import { useSettings } from '../../stores/settings'
import { hasPermission } from '@shared/roles'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

const SECONDARY: PageKey[] = ['customers', 'utang', 'expenses', 'suppliers', 'transactions', 'backup', 'settings']

const ITEMS: { key: PageKey; label: string; icon: React.ReactNode; permission?: string }[] = [
  { key: 'dashboard', label: 'Home', icon: <LayoutDashboard className="h-5 w-5" />, permission: 'dashboard:view' },
  { key: 'pos', label: 'POS', icon: <ShoppingCart className="h-5 w-5" />, permission: 'pos:use' },
  { key: 'inventory', label: 'Inventory', icon: <Boxes className="h-5 w-5" />, permission: 'products:manage' },
  { key: 'reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" />, permission: 'reports:view' },
  { key: 'more', label: 'More', icon: <Menu className="h-5 w-5" /> }
]

export function MobileTopBar(): React.JSX.Element {
  const { user } = useAuth()
  const { settings } = useSettings()
  const online = useOnlineStatus()

  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 pt-[calc(1.35rem+var(--sait))] pb-3 backdrop-blur-md sm:hidden shadow-sm">
      {/* Brand & Store Identity */}
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={tindaIcon}
          alt="TINDA POS"
          className="h-10 w-10 shrink-0 rounded-xl object-contain shadow-sm active:scale-95 transition"
        />
        <div className="min-w-0">
          <h1 className="truncate text-base font-black leading-tight text-slate-900 tracking-tight">
            {settings?.store_name ?? 'TINDA POS'}
          </h1>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {user?.full_name ? user.full_name : 'Manager'}
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              {user?.roles[0] ?? 'ADMIN'}
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-[11px]">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className={online ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                {online ? 'Online' : 'Offline'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

export function MobileBottomNav(): React.JSX.Element {
  const { page, setPage } = useNav()
  const { user } = useAuth()
  const items = ITEMS.filter((n) => !n.permission || (user ? hasPermission(user.roles, n.permission as never) : false))
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex shrink-0 items-stretch justify-around border-t border-slate-200 bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-lg safe-pb sm:hidden">
      {items.map((n) => {
        const active = page === n.key || (n.key === 'more' && SECONDARY.includes(page))
        return (
          <button
            key={n.key}
            onClick={() => setPage(n.key)}
            aria-label={n.label}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold transition-all ${
              active ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700 active:scale-95'
            }`}
          >
            <div className={`flex h-7 w-12 items-center justify-center rounded-full transition-all ${active ? 'bg-brand-50 text-brand-600 shadow-sm border border-brand-200/60 animate-tab-active' : ''}`}>
              {n.icon}
            </div>
            <span className="truncate px-0.5">{n.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
