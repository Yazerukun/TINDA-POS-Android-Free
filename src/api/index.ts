import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { githubReleasesApiUrl, planUpdateCheck, type UpdateCheckPlan, type UpdateStatusEvent } from '../shared/update'

/**
 * Native Android updater bridge (see android/app/src/main/java/com/tindapos/free/TindaUpdaterPlugin.java).
 *
 * The WebView cannot do either half of an Android update by itself: GitHub
 * release assets are served without CORS headers, and only a native intent can
 * start the package installer. So the download and the install both happen
 * natively and report progress back through plugin events.
 */
interface NativeUpdateProgress {
  downloaded: number
  total: number
  percent: number
}

interface TindaUpdaterNative {
  getVersion(): Promise<{ versionName: string; versionCode: number; packageName: string }>
  download(options: { url: string; fileName: string }): Promise<{ fileName: string; path: string; bytes: number }>
  install(options: { fileName: string }): Promise<{ launched: boolean; needsPermission: boolean }>
  canInstall(): Promise<{ granted: boolean }>
  openInstallSettings(): Promise<void>
  addListener(eventName: 'progress', listener: (progress: NativeUpdateProgress) => void): Promise<PluginListenerHandle>
}

const TindaUpdater = registerPlugin<TindaUpdaterNative>('TindaUpdater')
const ANDROID_UPDATER = Capacitor.getPlatform() === 'android'

let installedVersion = '0.0.0'
let versionRequest: Promise<string> | null = null
let downloadedApkName: string | null = null

const updateListeners = new Set<(event: UpdateStatusEvent) => void>()

let lastUpdateEvent: UpdateStatusEvent = {
  status: 'IDLE',
  installedVersion,
  portable: false,
  available: null,
  progress: null,
  message: null,
  lastCheckedAt: null,
}

function emitUpdateEvent(partial: Partial<UpdateStatusEvent>): UpdateStatusEvent {
  const event: UpdateStatusEvent = { ...lastUpdateEvent, installedVersion, ...partial }
  lastUpdateEvent = event
  for (const listener of updateListeners) {
    try {
      listener(event)
    } catch {
      /* a broken listener must never stop an update */
    }
  }
  return event
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error:\s*/, '')
}

/** Real installed version, read from the Android package manager. */
async function loadInstalledVersion(force = false): Promise<string> {
  if (ANDROID_UPDATER && (force || !versionRequest)) {
    versionRequest = (async () => {
      try {
        const info = await TindaUpdater.getVersion()
        if (info?.versionName) installedVersion = info.versionName
      } catch {
        /* keep the last known version */
      }
      return installedVersion
    })()
  }
  if (versionRequest) return versionRequest
  return installedVersion
}

async function runOfficialUpdateCheck(): Promise<UpdateCheckPlan> {
  const current = await loadInstalledVersion(true)
  try {
    const response = await fetch(githubReleasesApiUrl(), {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      return { ok: false, code: 'INVALID_RESPONSE', current, latest: null, apk: null, reason: `Update server returned HTTP ${response.status}.` }
    }
    return planUpdateCheck(await response.json(), current)
  } catch {
    return { ok: false, code: 'INVALID_RESPONSE', current, latest: null, apk: null, reason: 'Cannot reach the update server. Check your internet connection.' }
  }
}

async function downloadReleaseApk(plan: UpdateCheckPlan): Promise<{ fileName: string; bytes: number }> {
  const apk = plan.apk
  if (!apk) throw new Error('The release has no APK asset.')
  let handle: PluginListenerHandle | null = null
  try {
    handle = await TindaUpdater.addListener('progress', (progress) => {
      emitUpdateEvent({
        status: 'DOWNLOADING',
        available: plan.latest,
        progress,
        message: `Downloading v${plan.latest?.version ?? ''}…`,
      })
    })
    const result = await TindaUpdater.download({ url: apk.url, fileName: apk.name })
    return { fileName: result?.fileName ?? apk.name, bytes: Number(result?.bytes ?? apk.size) }
  } finally {
    if (handle) await handle.remove().catch(() => undefined)
  }
}

async function launchInstaller(fileName: string): Promise<{ launched: boolean; message: string }> {
  try {
    const result = await TindaUpdater.install({ fileName })
    if (result?.launched) return { launched: true, message: 'Android will now ask you to confirm the install.' }
    if (result?.needsPermission) {
      await TindaUpdater.openInstallSettings().catch(() => undefined)
      return { launched: false, message: 'Allow TINDA POS to install unknown apps, then tap Install Update.' }
    }
    return { launched: false, message: 'Android blocked the install prompt. Tap Install Update to try again.' }
  } catch (error) {
    return { launched: false, message: errorText(error) }
  }
}

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
api.app.info = async () => ({ version: await loadInstalledVersion(), platform: 'android', isElectron: false })
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
  state: async () => {
    // Read the real installed version first so the panel never shows a placeholder.
    await loadInstalledVersion()
    return { ...lastUpdateEvent, installedVersion }
  },
  check: async (manual = false) => {
    emitUpdateEvent({ status: 'CHECKING', message: 'Checking for updates…' })
    const plan = await runOfficialUpdateCheck()
    const lastCheckedAt = new Date().toISOString()
    if (!plan.ok) {
      return emitUpdateEvent({
        status: plan.code === 'UP_TO_DATE' ? 'UP_TO_DATE' : 'UNABLE_TO_CHECK',
        available: plan.latest,
        progress: null,
        message: plan.reason,
        lastCheckedAt,
      })
    }
    return emitUpdateEvent({
      status: 'UPDATE_AVAILABLE',
      available: plan.latest,
      progress: null,
      message: plan.reason,
      lastCheckedAt,
    })
  },
  download: async () => {
    if (!ANDROID_UPDATER) {
      return emitUpdateEvent({ status: 'ERROR', message: 'In-app updates are only available in the installed Android app.' })
    }
    // Android needs a one-time "install unknown apps" grant before it will ever
    // show the install prompt, so ask for it before spending the download.
    const permission = await TindaUpdater.canInstall().catch(() => null)
    if (permission && !permission.granted) {
      await TindaUpdater.openInstallSettings().catch(() => undefined)
      return emitUpdateEvent({
        status: 'UPDATE_AVAILABLE',
        message: 'Allow TINDA POS to install unknown apps, then tap Download Update again.',
      })
    }
    const plan = await runOfficialUpdateCheck()
    if (!plan.ok || !plan.apk) {
      return emitUpdateEvent({
        status: plan.code === 'UP_TO_DATE' ? 'UP_TO_DATE' : 'ERROR',
        available: plan.latest,
        progress: null,
        message: plan.reason,
      })
    }
    const version = plan.latest?.version ?? ''
    emitUpdateEvent({
      status: 'DOWNLOADING',
      available: plan.latest,
      progress: { downloaded: 0, total: plan.apk.size, percent: 0 },
      message: `Downloading v${version}…`,
    })
    let downloaded: { fileName: string; bytes: number }
    try {
      downloaded = await downloadReleaseApk(plan)
    } catch (error) {
      return emitUpdateEvent({
        status: 'ERROR',
        available: plan.latest,
        progress: null,
        message: `Download failed: ${errorText(error)}`,
      })
    }
    downloadedApkName = downloaded.fileName
    const done = { downloaded: downloaded.bytes, total: downloaded.bytes, percent: 100 }
    emitUpdateEvent({ status: 'DOWNLOADED', available: plan.latest, progress: done, message: `Downloaded v${version}.` })
    const install = await launchInstaller(downloaded.fileName)
    return emitUpdateEvent({
      status: install.launched ? 'READY_TO_INSTALL' : 'DOWNLOADED',
      available: plan.latest,
      progress: done,
      message: install.message,
    })
  },
  install: async () => {
    if (!downloadedApkName) {
      return emitUpdateEvent({ status: 'ERROR', message: 'No downloaded update found. Download the update again.' })
    }
    const install = await launchInstaller(downloadedApkName)
    return emitUpdateEvent({ status: install.launched ? 'READY_TO_INSTALL' : 'DOWNLOADED', message: install.message })
  },
  dismiss: async () => emitUpdateEvent({ status: 'DISMISSED', progress: null, message: null }),
  onEvent: (cb: (e: UpdateStatusEvent) => void) => {
    updateListeners.add(cb)
    return () => updateListeners.delete(cb)
  },
}
;(globalThis as any).window.api = api
export default api