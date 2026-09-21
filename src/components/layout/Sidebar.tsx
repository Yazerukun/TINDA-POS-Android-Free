import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Wallet,
  Receipt,
  Truck,
  ListOrdered,
  BarChart3,
  HardDriveDownload,
  Settings,
  Users,
  LogOut
} from 'lucide-react'
import { useNav, type PageKey } from '../../stores/nav'
import { useAuth } from '../../stores/auth'
import { useSettings } from '../../stores/settings'
import { hasPermission, type Permission } from '@shared/roles'
import { ConnectionStatus } from '../ConnectionStatus'

export const NAV: { key: PageKey; label: string; icon: React.ReactNode; permission: Permission }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, permission: 'dashboard:view' },
  { key: 'pos', label: 'POS', icon: <ShoppingCart className="h-4 w-4" />, permission: 'pos:use' },
  { key: 'inventory', label: 'Inventory', icon: <Boxes className="h-4 w-4" />, permission: 'products:manage' },
  { key: 'customers', label: 'Customers', icon: <Users className="h-4 w-4" />, permission: 'customers:manage' },
  { key: 'utang', label: 'Credit', icon: <Wallet className="h-4 w-4" />, permission: 'pos:utang' },
  { key: 'expenses', label: 'Expenses', icon: <Receipt className="h-4 w-4" />, permission: 'expenses:manage' },
  { key: 'suppliers', label: 'Suppliers', icon: <Truck className="h-4 w-4" />, permission: 'suppliers:manage' },
  { key: 'transactions', label: 'Transactions', icon: <ListOrdered className="h-4 w-4" />, permission: 'transactions:view' },
  { key: 'reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" />, permission: 'reports:view' },
  { key: 'backup', label: 'Backup', icon: <HardDriveDownload className="h-4 w-4" />, permission: 'backup:manage' },
  { key: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, permission: 'settings:manage' },
  { key: 'printer', label: 'Printer', icon: <Receipt className="h-4 w-4" />, permission: 'settings:manage' },
  { key: 'update', label: 'Update', icon: <HardDriveDownload className="h-4 w-4" />, permission: 'settings:manage' }
]

export function Sidebar(): React.JSX.Element {
  const { page, setPage } = useNav()
  const { user, logout } = useAuth()
  const { settings } = useSettings()

  const visible = NAV.filter((n) => (user ? hasPermission(user.roles, n.permission) : false))

  return (
    <aside className="hidden w-16 md:w-56 shrink-0 flex-col border-r border-ink-line bg-ink-900 sm:flex transition-all duration-300">
      <div className="flex items-center justify-center md:justify-start gap-2.5 px-0 py-4 md:px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white shadow-card">
          TP
        </div>
        <div className="hidden min-w-0 md:block">
          <p className="truncate text-sm font-bold leading-tight text-white">TINDA POS</p>
          <p className="truncate text-[11px] text-slate-500">{settings?.store_name ?? 'Sari-Sari Store'}</p>
        </div>
      </div>

      <div className="hidden px-3 pb-2 md:block">
        <ConnectionStatus />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2 md:px-3">
        {visible.map((n) => (
          <button
            key={n.key}
            onClick={() => setPage(n.key)}
            title={n.label}
            className={`group flex w-full items-center justify-center md:justify-start gap-2.5 rounded-lg p-2 text-sm font-medium transition-all ${
              page === n.key
                ? 'bg-brand-600/15 text-brand-400 border-l-2 border-brand-500'
                : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200 border-l-2 border-transparent'
            }`}
          >
            <div className={`${page === n.key ? 'animate-pop' : ''}`}>
              {n.icon}
            </div>
            <span className="hidden md:block">{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-ink-line px-2 py-3 md:px-3">
        <div className="mb-2 flex items-center justify-center md:justify-start gap-2.5 md:px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-slate-300">
            {(user?.full_name || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-xs font-semibold text-slate-200">{user?.full_name}</p>
            <p className="text-[10px] uppercase text-slate-500">
              {user?.roles.join(' · ')}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          title="Logout"
          className="flex w-full items-center justify-center md:justify-start gap-2.5 rounded-lg p-2 text-sm font-medium text-slate-400 hover:bg-danger-500/10 hover:text-danger-400 active:scale-[.98]"
        >
          <LogOut className="h-5 w-5 md:h-4 md:w-4" />
          <span className="hidden md:block">Logout</span>
        </button>
        <p className="dev-signature signature-reveal mt-3 hidden text-center text-xs italic text-slate-600 md:block">by Dev Francis</p>
      </div>
    </aside>
  )
}
