import { LogOut, LayoutDashboard, ShoppingCart, Boxes, BarChart3, Menu } from 'lucide-react'
import { useNav, type PageKey } from '../../stores/nav'
import { useAuth } from '../../stores/auth'
import { useSettings } from '../../stores/settings'
import { hasPermission } from '@shared/roles'
import { ConnectionStatus } from '../ConnectionStatus'

const SECONDARY: PageKey[] = ['customers', 'utang', 'expenses', 'suppliers', 'transactions', 'backup', 'settings']

const ITEMS: { key: PageKey; label: string; icon: React.ReactNode; permission?: string }[] = [
  { key: 'dashboard', label: 'Home', icon: <LayoutDashboard className="h-5 w-5" />, permission: 'dashboard:view' },
  { key: 'pos', label: 'POS', icon: <ShoppingCart className="h-5 w-5" />, permission: 'pos:use' },
  { key: 'inventory', label: 'Inventory', icon: <Boxes className="h-5 w-5" />, permission: 'products:manage' },
  { key: 'reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" />, permission: 'reports:view' },
  { key: 'more', label: 'More', icon: <Menu className="h-5 w-5" /> }
]

export function MobileTopBar(): React.JSX.Element {
  const { user, logout } = useAuth()
  const { settings } = useSettings()
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-ink-line bg-ink-900 px-4 py-2.5 md:hidden">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-black text-white">TP</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight text-white">TINDA POS</p>
        <p className="truncate text-[11px] text-slate-500">{settings?.store_name ?? 'Sari-Sari Store'}</p>
      </div>
      <ConnectionStatus className="hidden sm:flex" />
      <button
        aria-label="Logout"
        onClick={logout}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-ink-800 hover:text-danger-400"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

export function MobileBottomNav(): React.JSX.Element {
  const { page, setPage } = useNav()
  const { user } = useAuth()
  const items = ITEMS.filter((n) => !n.permission || (user ? hasPermission(user.roles, n.permission as never) : false))
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 shrink-0 items-stretch justify-around border-t border-ink-line bg-ink-900/95 backdrop-blur md:hidden">
      {items.map((n) => {
        const active = page === n.key || (n.key === 'more' && SECONDARY.includes(page))
        return (
          <button
            key={n.key}
            onClick={() => setPage(n.key)}
            aria-label={n.label}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
              active ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {n.icon}
            <span className="truncate px-0.5">{n.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
