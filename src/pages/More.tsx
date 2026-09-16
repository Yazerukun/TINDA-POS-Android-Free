import { ChevronRight } from 'lucide-react'
import { NAV } from '../components/layout/Sidebar'
import { PageHeader } from '../components/ui/PageHeader'
import { useNav, type PageKey } from '../stores/nav'
import { useAuth } from '../stores/auth'
import { useSettings } from '../stores/settings'
import { hasPermission } from '@shared/roles'

const SUBTITLES: Partial<Record<PageKey, string>> = {
  customers: 'Customer credit, contacts & balances',
  utang: 'Track and settle customer utang',
  expenses: 'Record store expenses',
  suppliers: 'Manage suppliers & purchases',
  transactions: 'View sales and receipt history',
  backup: 'Back up, restore & sync your data',
  settings: 'Store, users & data options',
  printer: 'Receipt printer configuration',
  update: 'Software update & about'
}

const GROUPS: { title: string; keys: PageKey[] }[] = [
  { title: 'Sales & Money', keys: ['customers', 'utang', 'expenses', 'suppliers', 'transactions'] },
  { title: 'System', keys: ['backup', 'settings', 'printer', 'update'] }
]

export function More(): React.JSX.Element {
  const { setPage } = useNav()
  const { user } = useAuth()
  const { settings } = useSettings()

  const can = (k: PageKey) => {
    const item = NAV.find((n) => n.key === k)
    return item && user ? hasPermission(user.roles, item.permission) : false
  }

  return (
    <div className="p-6">
      <PageHeader title="More" subtitle={settings?.store_name ?? 'Sari-Sari Store'} />
      {GROUPS.map((group) => {
        const keys = group.keys.filter(can)
        if (keys.length === 0) return null
        return (
          <div className="mb-4" key={group.title}>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</p>
            <div className="card divide-y divide-ink-line overflow-hidden">
              {keys.map((k) => {
                const item = NAV.find((n) => n.key === k)!
                return (
                  <button
                    key={k}
                    onClick={() => setPage(k)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-800 active:bg-ink-800"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-slate-300">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-100">{item.label}</span>
                      {SUBTITLES[k] && <span className="block truncate text-xs text-slate-500">{SUBTITLES[k]}</span>}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
