import { useEffect } from 'react'
import { useAuth } from '../stores/auth'
import { useSettings } from '../stores/settings'
import { useNav } from '../stores/nav'
import { Sidebar } from '../components/layout/Sidebar'
import { MobileTopBar, MobileBottomNav } from '../components/layout/MobileNav'
import { ToastHost } from '../components/ui/ToastHost'
import { UpdateNotification } from '../components/update/UpdateNotification'
import { UpdateModal } from '../components/update/UpdateModal'
import { Dashboard } from '../pages/Dashboard'
import { POS } from '../pages/POS'
import { Inventory } from '../pages/Inventory'
import { Customers } from '../pages/Customers'
import { Utang } from '../pages/Utang'
import { Expenses } from '../pages/Expenses'
import { Suppliers } from '../pages/Suppliers'
import { Transactions } from '../pages/Transactions'
import { Reports } from '../pages/Reports'
import { Backup } from '../pages/Backup'
import { Settings } from '../pages/Settings'
import { More } from '../pages/More'
import { ExpirationAlerts } from '../components/Expiration'

import { ErrorBoundary } from '../components/ui/ErrorBoundary'

export function Shell(): React.JSX.Element {
  const { user } = useAuth()
  const { load } = useSettings()
  const { page } = useNav()

  useEffect(() => {
    load().catch(() => console.error('settings load failed'))
  }, [load])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col pb-[calc(3.5rem+var(--saib))] sm:pb-0">
        <MobileTopBar />
        {user && <ExpirationAlerts key={user.id} remind />}
        <div key={page} className="min-h-0 flex-1 overflow-y-auto animate-page-fade">
          <ErrorBoundary inline>
            {user && page === 'dashboard' && <Dashboard />}
            {user && page === 'pos' && <POS />}
            {user && page === 'inventory' && <Inventory />}
            {user && page === 'customers' && <Customers />}
            {user && page === 'utang' && <Utang />}
            {user && page === 'expenses' && <Expenses />}
            {user && page === 'suppliers' && <Suppliers />}
            {user && page === 'transactions' && <Transactions />}
            {user && page === 'reports' && <Reports />}
            {user && page === 'backup' && <Backup />}
            {user && page === 'settings' && <Settings defaultTab="HOME" />}
            {user && page === 'printer' && <Settings defaultTab="RECEIPT" />}
            {user && page === 'update' && <Settings defaultTab="ABOUT" />}
            {user && page === 'more' && <More />}
          </ErrorBoundary>
        </div>
      </main>
      <MobileBottomNav />
      <ToastHost />
      <UpdateNotification />
      <UpdateModal />
    </div>
  )
}
