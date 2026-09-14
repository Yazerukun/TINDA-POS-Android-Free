function makeCallable(): any {
  const target: any = () => makeCallable()
  const p = Promise.resolve(null)
  target.then = p.then.bind(p)
  target.catch = p.catch.bind(p)
  target.finally = p.finally.bind(p)
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop]
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      const child = makeCallable()
      t[prop] = child
      return child
    },
  })
}
function makeProxy(): any {
  const store: Record<string, any> = {}
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      const child = makeCallable()
      target[prop] = child
      return child
    },
    set(target, prop, value) {
      target[prop] = value
      return true
    },
  })
}

const page = async () => ({ rows: [], total: 0 })
const adminUser = { id: 1, username: 'admin', full_name: 'Manager', roles: ['ADMIN' as const] }
const xRead = {
  shift_id: 0,
  shift_no: 1,
  cashier_name: 'Manager',
  report_at: '',
  opened_at: new Date().toISOString(),
  starting_cash_c: 0,
  cash_c: 0,
  gcash_c: 0,
  maya_c: 0,
  gross_sales_c: 0,
  discount_c: 0,
  net_sales_c: 0,
  refunds_c: 0,
  voids_c: 0,
  cash_refunds_c: 0,
  cash_in_c: 0,
  cash_out_c: 0,
  expenses_c: 0,
  utang_c: 0,
  expected_cash_c: 0,
  transaction_count: 0,
  void_count: 0,
  split_count: 0,
}

const api = makeProxy()
// ---- auth / app ----
api.auth.status = async () => null
api.auth.setup = async () => ({ complete: false })
api.auth.completeSetup = async (payload: any) => ({
  user: { id: 1, username: payload?.admin?.username ?? 'admin', full_name: payload?.admin?.full_name ?? 'Manager', roles: ['ADMIN'] },
  firstRun: false,
  shiftOpen: false,
})
api.auth.login = async (u: string) => ({ user: { ...adminUser, username: u }, firstRun: false, shiftOpen: false })
api.auth.loginPin = async () => ({ user: adminUser, firstRun: false, shiftOpen: false })
api.auth.logout = async () => {}
api.auth.adminResetPin = async () => {}
api.app.info = async () => ({ version: '1.0.12-dev', platform: 'android', isElectron: false })
api.app.isOnline = async () => true
api.app.dataDir = async () => '/data'
// ---- settings / users ----
api.settings.get = async () => ({})
api.settings.update = async (p: any) => p
api.users.list = async () => []
api.users.roles = async () => ['ADMIN', 'CASHIER']
api.users.create = async () => {}
api.users.update = async () => {}
// ---- categories / products ----
api.categories.list = async () => []
api.categories.create = async (name: string) => ({ id: 0, name, created_at: '' })
api.categories.remove = async () => {}
api.products.count = async () => 0
api.products.search = async () => page()
api.products.get = async () => null
api.products.upsert = async (p: any) => p
api.products.create = async (p: any) => p
api.products.update = async () => {}
api.products.archive = async () => {}
api.products.previewCsv = async () => ({ invalid: 0, rows: [], errors: [] })
api.products.csvTemplate = async () => ''
api.products.importCsv = async () => ({ created: 0, updated: 0, skipped: 0 })
// ---- inventory ----
api.inventory.expiration = async () => []
api.inventory.batchDate = async () => {}
api.inventory.movements = async () => page()
api.inventory.receiving = async () => page()
api.inventory.restock = async () => {}
api.inventory.withdraw = async () => {}
// ---- suppliers / customers ----
api.suppliers.list = async () => []
api.suppliers.create = async (s: any) => s
api.suppliers.update = async () => {}
api.customers.list = async () => page()
api.customers.create = async (c: any) => c
api.customers.update = async () => {}
api.customers.ledger = async () => []
api.customers.pay = async () => ({})
api.customers.adjust = async () => ({})
api.customers.approveOverlimit = async () => ({})
// ---- POS / shifts ----
api.pos.held = async () => []
api.pos.hold = async () => ({ id: 1 })
api.pos.resumeHeld = async () => {}
api.pos.deleteHeld = async () => {}
api.pos.checkout = async () => ({
  sale: { id: 0, transaction_no: 'DEMO-000000', total_c: 0 },
  print: { ok: false, code: 'NO_PRINTER' as const, message: 'Printing is not available on the Android demo build yet.' },
  change_c: 0,
  tendered_c: 0,
  total_c: 0,
})
api.pos.reprint = async () => []
api.shifts.current = async () => null
api.shifts.open = async () => ({})
api.shifts.list = async () => []
// ---- printer ----
api.printer.list = async () => []
api.printer.save = async () => {}
api.printer.testPrint = async () => ({ ok: false, code: 'NO_PRINTER' as const, message: 'No printer configured yet.' })
api.printer.printReceipt = async () => ({ ok: false, code: 'NO_PRINTER' as const, message: 'No printer configured yet.' })
// ---- transactions ----
api.transactions.list = async () => page()
api.transactions.refund = async () => ({})
api.transactions.void = async () => {}
// ---- expenses ----
api.expenses.categories = async () => []
api.expenses.createCategory = async () => {}
api.expenses.list = async () => page()
api.expenses.create = async (e: any) => e
api.expenses.update = async () => {}
api.expenses.remove = async () => {}
// ---- reports ----
api.reports.sales = async () => ({ summary: { cost_c: 0, discount_c: 0, profit_c: 0, sales_total_c: 0, transactions: 0, items_sold: 0, refunds_c: 0, expenses_c: 0 }, chart: [], rows: [] })
api.reports.inventory = async () => ({ rows: [], summary: { inventory_value_c: 0, low_stock: 0, out_of_stock: 0, total_units: 0 } })
api.reports.utang = async () => ({ rows: [], total_outstanding_c: 0 })
api.reports.xRead = async () => ({ ...xRead, lines: [], payments: [] })
api.reports.printXRead = async () => ({ report: { ...xRead, lines: [], payments: [] } })
api.reports.cashCountExpected = async () => 0
api.reports.cashCount = async () => ({ id: 0, shift_id: 0, cashier_name: 'Manager', expected_cash_c: 0, actual_cash_c: 0, status: 'BALANCED', created_at: '' })
api.reports.cashCounts = async () => []
api.reports.cashCountPrint = async () => ({ ok: false, message: 'Nothing to print yet.' })
api.reports.finalizeZ = async () => {}
api.reports.exportCsv = async () => ({ path: '' })
// ---- backup ----
api.backup.list = async () => []
api.backup.dir = async () => ''
api.backup.locationStatus = async () => ({ mode: 'SHARED', label: 'Shared AppData', root: '/', databaseFile: 'tinda.db', backupDir: '/' })
api.backup.create = async () => ({ filename: 'demo-backup.zip', path: '' })
api.backup.restore = async () => {}
api.backup.selectSyncFolder = async () => null
api.backup.openSyncFolder = async () => {}
api.backup.openFolder = async () => {}
api.backup.resetDatabase = async () => {}
api.backup.startNewStore = async () => {}
api.backup.usePortableData = async () => {}
api.backup.useSharedAppData = async () => {}
// ---- audit / update ----
api.audit.list = async () => []
api.update = {
  state: async () => ({ state: 'idle', installedVersion: appVersion, available: null, portable: false, events: [] }),
  check: async (manual = false) => {
    const result = await runOfficialUpdateCheck()
    if (result.status !== 'idle') {
      const ev: UpdateStatusEvent = {
        id: `upd-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: result.status,
        manual,
        installedVersion: appVersion,
        available: result.available ?? null,
        message: result.message ?? null,
      }
      emitUpdateStatus(ev)
    }
    return result
  },
      emitUpdateStatus(ev)
    }
    return result
  },
  download: async () => ({ status: 'idle', installedVersion: appVersion, available: null, message: 'Download not available on this platform yet (native bridge pending).' }),
  install: async () => {},
  dismiss: async () => emitUpdateStatus({ id: `upd-${Date.now()}`, timestamp: new Date().toISOString(), status: 'dismissed', manual: false, installedVersion: appVersion, available: null, message: null }),
  onEvent: (cb: (e: UpdateStatusEvent) => void) => {
    updateListeners.add(cb)
    return () => updateListeners.delete(cb)
  },
}
;(globalThis as any).window.api = api
export default api