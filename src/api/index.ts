// The Android app's `window.api`: the same surface the screens use on desktop,
// now backed by the on-device Dexie/IndexedDB store (see src/data/*) instead of
// the old in-memory stub. The in-app updater stays native (TindaUpdaterPlugin).

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { githubReleasesApiUrl, planUpdateCheck, type UpdateCheckPlan, type UpdateStatusEvent } from '../shared/update'
import type { TindaApi } from '../shared/ipc'
import * as catalog from '../data/catalog'
import * as stock from '../data/stock'
import * as people from '../data/people'
import * as sales from '../data/sales'
import * as accounting from '../data/accounting'
import * as system from '../data/system'
import * as tindaBackup from '../data/tindaBackupAndroid'
import * as printerService from '../data/printerService'
import * as priceReferences from '../data/priceReferences'
import { onInventoryChanged } from '../data/util'

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

let installedVersion = system.APP_VERSION
let versionRequest: Promise<string> | null = null
const APK_NAME_KEY = 'tinda-pos.update.downloadedApk'

function getStoredApkName(): string | null {
  try {
    return window.localStorage.getItem(APK_NAME_KEY) || null
  } catch {
    return null
  }
}

function setStoredApkName(name: string | null): void {
  try {
    if (name) window.localStorage.setItem(APK_NAME_KEY, name)
    else window.localStorage.removeItem(APK_NAME_KEY)
  } catch {
    // Ignore storage issues
  }
}

let downloadedApkName: string | null = getStoredApkName()

const updateListeners = new Set<(event: UpdateStatusEvent) => void>()

let lastUpdateEvent: UpdateStatusEvent = {
  status: 'IDLE',
  installedVersion,
  portable: false,
  available: null,
  progress: null,
  message: null,
  lastCheckedAt: null
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
      cache: 'no-store'
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
        message: `Downloading v${plan.latest?.version ?? ''}…`
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

const api = {
  app: {
    info: async () => ({ ...(await system.appInfo()), version: await loadInstalledVersion() }),
    dataDir: system.backupDir,
    databaseFile: async () => 'tinda-pos-free (device storage)',
    openDataDir: async () => undefined,
    checkIntegrity: async () => ({ ok: true, message: 'Local database is stored on this device.' }),
    isOnline: async () => navigator.onLine !== false
  },
  update: {
    state: async () => {
      await loadInstalledVersion()
      return { ...lastUpdateEvent, installedVersion }
    },
    check: async (manual = false) => {
      emitUpdateEvent({ status: 'CHECKING', message: manual ? 'Checking for updates…' : 'Checking for updates…' })
      const plan = await runOfficialUpdateCheck()
      const lastCheckedAt = new Date().toISOString()
      if (!plan.ok) {
        return emitUpdateEvent({
          status: plan.code === 'UP_TO_DATE' ? 'UP_TO_DATE' : 'UNABLE_TO_CHECK',
          available: plan.latest,
          progress: null,
          message: plan.reason,
          lastCheckedAt
        })
      }
      return emitUpdateEvent({ status: 'UPDATE_AVAILABLE', available: plan.latest, progress: null, message: plan.reason, lastCheckedAt })
    },
    download: async () => {
      if (!ANDROID_UPDATER) {
        return emitUpdateEvent({ status: 'ERROR', message: 'In-app updates are only available in the installed Android app.' })
      }
      const permission = await TindaUpdater.canInstall().catch(() => null)
      if (permission && !permission.granted) {
        await TindaUpdater.openInstallSettings().catch(() => undefined)
        return emitUpdateEvent({
          status: 'UPDATE_AVAILABLE',
          message: 'Allow TINDA POS to install unknown apps, then tap Download Update again.'
        })
      }
      const plan = await runOfficialUpdateCheck()
      if (!plan.ok || !plan.apk) {
        return emitUpdateEvent({
          status: plan.code === 'UP_TO_DATE' ? 'UP_TO_DATE' : 'ERROR',
          available: plan.latest,
          progress: null,
          message: plan.reason
        })
      }
      const version = plan.latest?.version ?? ''
      emitUpdateEvent({
        status: 'DOWNLOADING',
        available: plan.latest,
        progress: { downloaded: 0, total: plan.apk.size, percent: 0 },
        message: `Downloading v${version}…`
      })
      let downloaded: { fileName: string; bytes: number }
      try {
        downloaded = await downloadReleaseApk(plan)
      } catch (error) {
        return emitUpdateEvent({ status: 'ERROR', available: plan.latest, progress: null, message: `Download failed: ${errorText(error)}` })
      }
      downloadedApkName = downloaded.fileName
      setStoredApkName(downloaded.fileName)
      const done = { downloaded: downloaded.bytes, total: downloaded.bytes, percent: 100 }
      emitUpdateEvent({ status: 'DOWNLOADED', available: plan.latest, progress: done, message: `Downloaded v${version}.` })
      const install = await launchInstaller(downloaded.fileName)
      return emitUpdateEvent({
        status: install.launched ? 'READY_TO_INSTALL' : 'DOWNLOADED',
        available: plan.latest,
        progress: done,
        message: install.message
      })
    },
    install: async () => {
      let apkName = downloadedApkName || getStoredApkName()
      if (!apkName && lastUpdateEvent.available?.version) {
        apkName = `TindaPOS-Free-${lastUpdateEvent.available.version}.apk`
      }
      if (!apkName) {
        apkName = 'tinda-pos-free-update.apk'
      }
      const install = await launchInstaller(apkName)
      return emitUpdateEvent({
        status: install.launched ? 'READY_TO_INSTALL' : 'DOWNLOADED',
        available: lastUpdateEvent.available,
        message: install.message
      })
    },
    dismiss: async () => emitUpdateEvent({ status: 'DISMISSED', progress: null, message: null }),
    onEvent: (callback: (event: UpdateStatusEvent) => void) => {
      updateListeners.add(callback)
      return () => updateListeners.delete(callback)
    }
  },
  auth: {
    status: system.authStatus,
    setup: system.setupComplete,
    completeSetup: system.completeSetup,
    login: system.login,
    loginPin: system.loginPin,
    logout: system.logout,
    changePassword: system.changePassword,
    changePin: system.changePin,
    adminResetPin: system.adminResetPin
  },
  users: {
    list: system.listUsers,
    create: system.createUser,
    update: system.updateUser,
    roles: system.roles
  },
  settings: {
    get: system.getSettings,
    update: system.updateSettings
  },
  categories: {
    list: catalog.listCategories,
    create: catalog.createCategory,
    createSub: (name: string, parentId: number) => catalog.createCategory(name, parentId),
    remove: catalog.removeCategory
  },
  products: {
    search: catalog.searchProducts,
    get: catalog.getProduct,
    create: catalog.createProduct,
    update: catalog.updateProduct,
    archive: (id: number) => catalog.archiveProduct(id, 'ARCHIVED'),
    restore: (id: number) => catalog.archiveProduct(id, 'ACTIVE'),
    count: catalog.countProducts,
    csvTemplate: catalog.csvTemplate,
    previewCsv: catalog.previewCsv,
    importCsv: catalog.importCsv
  },
  inventory: {
    expiration: stock.expirationEntries,
    batchDate: stock.setBatchDate,
    onChanged: onInventoryChanged,
    movements: stock.listMovements,
    receiving: stock.listReceiving,
    receive: stock.receive,
    adjust: stock.adjust,
    count: stock.countStock,
    movement: stock.movement,
    restock: stock.restock,
    withdraw: stock.withdraw
  },
  suppliers: {
    list: catalog.listSuppliers,
    create: catalog.createSupplier,
    update: catalog.updateSupplier,
    products: catalog.supplierProducts,
    purchases: catalog.supplierPurchases
  },
  customers: {
    list: people.listCustomers,
    get: people.getCustomer,
    create: people.createCustomer,
    update: people.updateCustomer,
    ledger: people.customerLedger,
    pay: people.payCredit,
    adjust: people.adjustCredit,
    revoke: people.revokeCredit,
    approveOverlimit: people.approveOverlimit
  },
  pos: {
    searchProducts: async (query: string) => (await catalog.searchProducts(query, { limit: 50 })).rows,
    checkout: sales.checkout,
    hold: sales.holdSale,
    held: sales.heldSales,
    resumeHeld: sales.resumeHeld,
    deleteHeld: sales.deleteHeld,
    reprint: sales.reprint
  },
  printer: {
    list: system.printerList,
    save: system.printerSave,
    testPrint: system.testPrint,
    printReceipt: sales.printSaleReceipt,
    shareReceipt: printerService.shareReceipt,
    openBluetoothSettings: printerService.openBluetoothSettings
  },
  transactions: {
    list: sales.listTransactions,
    get: sales.getTransaction,
    refund: sales.refundSale,
    void: sales.voidSale
  },
  expenses: {
    categories: people.listExpenseCategories,
    createCategory: people.createExpenseCategory,
    list: people.listExpenses,
    create: people.createExpense,
    update: people.updateExpense,
    remove: people.removeExpense
  },
  shifts: {
    current: accounting.currentShift,
    open: accounting.openShift,
    close: accounting.closeShift,
    cashMovement: accounting.cashMovement,
    list: accounting.listShifts,
    summary: accounting.shiftSummary
  },
  reports: {
    cashCount: accounting.saveCashCount,
    cashCounts: accounting.listCashCounts,
    cashCountExpected: accounting.cashCountExpected,
    cashCountPrint: accounting.cashCountPrint,
    sales: accounting.salesReport,
    inventory: accounting.inventoryReport,
    utang: people.utangReport,
    cashier: accounting.cashierReport,
    shifts: accounting.shiftsReport,
    exportCsv: accounting.exportCsv,
    xRead: accounting.xRead,
    printXRead: accounting.printXRead,
    finalizeZ: accounting.finalizeZ,
    zHistory: accounting.zHistory,
    printZRead: accounting.printZRead
  },
  backup: {
    list: system.listBackups,
    create: system.createBackup,
    restore: system.restoreBackup,
    exportTinda: tindaBackup.exportUniversalBackup,
    getPayload: system.getBackupPayload,
    importTinda: tindaBackup.importUniversalBackup,
    openFolder: system.openFolder,
    selectSyncFolder: system.selectSyncFolder,
    openSyncFolder: system.openFolder,
    dir: system.backupDir,
    resetDatabase: system.resetDatabase,
    startNewStore: system.startNewStore,
    locationStatus: system.backupLocationStatus,
    usePortableData: system.usePortableData,
    useSharedAppData: system.useSharedAppData
  },
  audit: {
    list: system.auditList
  },
  priceReferences: {
    search: priceReferences.searchPriceReferences,
    get: priceReferences.getPriceReference,
    getByProduct: priceReferences.getPriceReferenceByProductId,
    getByBarcode: priceReferences.getPriceReferenceByBarcode,
    matchForProduct: priceReferences.matchForProduct,
    link: priceReferences.linkPriceReference,
    unlink: priceReferences.unlinkPriceReference,
    sync: priceReferences.syncPriceReferences,
    status: priceReferences.getPriceReferenceStatus,
    compare: async (retailPriceC: number, reference: import('../shared/types').PriceReference | null) =>
      priceReferences.comparePrice(retailPriceC, reference)
  }
} as unknown as TindaApi

;(globalThis as any).window.api = api
export default api
