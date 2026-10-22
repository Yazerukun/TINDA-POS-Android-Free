import { useEffect, useState } from 'react'
import { Save, Store, Receipt, Users, UserPlus, Pencil, KeyRound, Heart, Coffee, Copy, Check, DatabaseZap, FolderOpen, HardDriveDownload, RotateCcw, Printer, Database, RefreshCw, Loader2, Download, Sparkles, Bluetooth, Camera, Award, ShieldCheck, QrCode } from 'lucide-react'
import type { BackupInfo, User } from '@shared/types'
import type { DataLocationStatus, PrinterChoice } from '@shared/ipc'
import { printerPick, printerStatusLabel } from '@shared/printer'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { useSettings } from '../stores/settings'
import { APP_VERSION } from '../data/system'
import { toastSuccess, toastError } from '../stores/toast'
import { useUpdate } from '../stores/update'
import { ReceiptPaper } from '../components/ReceiptPaper'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal'
import { DesktopMigrationModal } from '../components/DesktopMigrationModal'
import tindaIcon from '../assets/tinda-icon.png'
import { useLicenseStore } from '../stores/license'
import { formatLicenseKeyInput, extractLicenseFromScannedText, validateLicenseSyntax } from '../services/securityService'
import { LicenseService } from '../services/licenseService'

type Tab = 'HOME' | 'RECEIPT' | 'USERS' | 'DATA' | 'LICENSE' | 'ABOUT'

export function Settings({ defaultTab = 'HOME' }: { defaultTab?: Tab }): React.JSX.Element {
  const { load } = useSettings()
  const { status: license, init: initLicense } = useLicenseStore()
  const [tab, setTab] = useState<Tab>(defaultTab)

  useEffect(() => { void load() }, [load])
  useEffect(() => { void initLicense() }, [initLicense])
  useEffect(() => {
    if (defaultTab) setTab(defaultTab)
  }, [defaultTab])

  return (
    <div className="px-4 pt-3 pb-8 max-w-lg mx-auto md:max-w-3xl space-y-4">
      <PageHeader title="Settings" />
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'HOME', icon: Store, label: 'Store' },
          { id: 'RECEIPT', icon: Receipt, label: 'Receipt' },
          { id: 'USERS', icon: Users, label: 'Users' },
          { id: 'DATA', icon: DatabaseZap, label: 'Data' },
          {
            id: 'LICENSE',
            icon: Sparkles,
            label: license?.isVip ? (license.isDemo ? 'VIP Demo' : 'VIP Pro') : 'VIP License',
            badge: license?.isVip ? (license.isDemo ? 'DEMO' : 'ACTIVE') : undefined
          },
          { id: 'ABOUT', icon: Heart, label: 'About' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`shrink-0 flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-bold transition shadow-xs ${tab === t.id ? 'border-emerald-600 bg-emerald-600 text-white font-black' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.badge && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${tab === t.id ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === 'HOME' && <StoreSettingsTab />}
      {tab === 'RECEIPT' && <ReceiptSettingsTab />}
      {tab === 'USERS' && <UsersTab />}
      {tab === 'DATA' && <DataTab />}
      {tab === 'LICENSE' && <LicenseTab />}
      {tab === 'ABOUT' && <AboutTab onNavigateLicense={() => setTab('LICENSE')} />}
    </div>
  )
}

function DataTab(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [newStoreOpen, setNewStoreOpen] = useState(false)
  const [portableOpen, setPortableOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [newStoreConfirmation, setNewStoreConfirmation] = useState('')
  const [resetting, setResetting] = useState(false)
  const [databaseFile, setDatabaseFile] = useState('Loading...')
  const [backupDir, setBackupDir] = useState('Loading...')
  const [backups, setBackups] = useState<BackupInfo[] | null>(null)
  const [location, setLocation] = useState<DataLocationStatus | null>(null)
  const [migrationModalOpen, setMigrationModalOpen] = useState(false)

  const [confirmOp, setConfirmOp] = useState<{ title: string; desc: string; action: () => Promise<void> } | null>(null)

  useEffect(() => {
    void Promise.all([window.api.app.databaseFile(), window.api.backup.dir(), window.api.backup.locationStatus()]).then(([database, backup, status]) => {
      setDatabaseFile(database)
      setBackupDir(backup)
      setLocation(status)
    }).catch((e) => toastError('Could not load data locations', String((e as Error)?.message || e)))
  }, [])

  const backupNow = async () => {
    try { const backup = await window.api.backup.create('Settings Data page'); toastSuccess('Safety backup created', backup.filename) }
    catch (e) { toastError('Backup failed', String((e as Error)?.message || e)) }
  }

  const showRestore = async () => {
    try { setBackups(await window.api.backup.list()) }
    catch (e) { toastError('Could not load backups', String((e as Error)?.message || e)) }
  }

  const restore = (backup: BackupInfo) => {
    setConfirmOp({
      title: 'Restore Backup',
      desc: `Restore ${backup.filename}? Current data will be safety-backed up first.`,
      action: async () => {
        try { await window.api.backup.restore(backup.filename); toastSuccess('Backup restored', 'TINDA POS is restarting...') }
        catch (e) { toastError('Restore failed', String((e as Error)?.message || e)) }
      }
    })
  }

  const reset = async () => {
    if (confirmation !== 'RESET') return
    setResetting(true)
    try {
      await window.api.backup.resetDatabase(confirmation)
      toastSuccess('Database reset complete. Backups preserved.')
      window.location.reload()
    } catch (e) {
      toastError('Database reset failed', String((e as Error)?.message || e))
      setResetting(false)
    }
  }
const startNewStore = async () => {
    if (newStoreConfirmation !== 'NEW STORE') return
    setResetting(true)
    try {
      await window.api.backup.startNewStore(newStoreConfirmation)
      toastSuccess('New store started. Safety backup preserved.')
      window.location.reload()
    } catch (e) { toastError('Start New Store failed', String((e as Error)?.message || e)); setResetting(false) }
  }

  const switchToPortable = (choice: 'FRESH' | 'COPY') => {
    setConfirmOp({
      title: 'Use Portable Data',
      desc: `${choice === 'COPY' ? 'Copy the current store into' : 'Start a fresh store in'} Portable Data? A verified safety backup is created first. The Shared AppData database remains unchanged.`,
      action: async () => {
        setResetting(true)
        try { await window.api.backup.usePortableData(choice) }
        catch (e) { toastError('Portable Data activation failed', String((e as Error)?.message || e)); setResetting(false); setConfirmOp(null) }
      }
    })
  }

  const switchToShared = () => {
    setConfirmOp({
      title: 'Use Shared AppData',
      desc: `Switch to the existing Shared AppData database at ${location?.sharedRoot}? Neither database will be overwritten.`,
      action: async () => {
        setResetting(true)
        try { await window.api.backup.useSharedAppData() }
        catch (e) { toastError('Data mode switch failed', String((e as Error)?.message || e)); setResetting(false); setConfirmOp(null) }
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Desktop Database Migration Card */}
      <div className="card p-5 border-2 border-emerald-500 bg-emerald-50/70 shadow-sm rounded-2xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-950">Desktop Database Migration</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  VIP Feature
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Import <code className="text-emerald-800 font-bold">tindapos.db</code> SQLite or <code className="text-emerald-800 font-bold">.tinda-backup</code> directly from Windows PC.
              </p>
            </div>
          </div>
          <button
            onClick={() => setMigrationModalOpen(true)}
            className="btn-primary py-2.5 px-4 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md shrink-0 transition active:scale-95"
          >
            <Database className="h-4 w-4" /> Import Desktop DB
          </button>
        </div>
      </div>

      <div className="card p-5 border-2 border-slate-200 bg-white shadow-sm">
        <h2 className="text-base font-extrabold text-slate-950">Database & backups</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Data Mode</p><p className="mt-1 font-black text-emerald-700">{location?.label ?? 'Loading...'}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Database Location</p><p className="mt-1 break-all font-mono font-medium text-slate-900">{databaseFile}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Backup Location</p><p className="mt-1 break-all font-mono font-medium text-slate-900">{backupDir}</p></div>
          <p className="rounded-xl border-2 border-sky-200 bg-sky-50 p-3 text-xs font-semibold text-sky-950">Moving the TINDA POS executable does not move or reset your store database. Your store data is stored separately for safety.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void window.api.app.openDataDir()} className="btn-ghost flex items-center gap-2 border-2 border-slate-200 font-bold text-slate-800"><FolderOpen className="h-4 w-4" /> Open Data Folder</button>
          <button onClick={() => void backupNow()} className="btn-primary flex items-center gap-2 bg-emerald-600 text-white font-bold"><HardDriveDownload className="h-4 w-4" /> Backup Now</button>
          <button onClick={() => void showRestore()} className="btn-ghost flex items-center gap-2 border-2 border-slate-200 font-bold text-slate-800"><RotateCcw className="h-4 w-4" /> Restore Backup</button>
        </div>
      </div>

      <div className="card p-5 border-2 border-slate-200 bg-white shadow-sm">
        <h2 className="text-base font-extrabold text-slate-950">Data mode</h2>
        <p className="mt-2 text-sm font-medium text-slate-600">Shared AppData keeps one safe store database regardless of where the EXE is moved. Portable Data intentionally keeps a separate TindaPOS-Data folder beside the Portable EXE.</p>
        {location?.mode === 'SHARED' ? <button onClick={() => setPortableOpen(true)} disabled={!location?.portableAvailable || resetting} className="btn-ghost mt-4 flex items-center gap-2 border-2 border-slate-200 font-bold text-slate-800"><Database className="h-4 w-4" /> Use Portable Data</button> : <button onClick={() => void switchToShared()} disabled={resetting} className="btn-ghost mt-4 flex items-center gap-2 border-2 border-slate-200 font-bold text-slate-800"><Database className="h-4 w-4" /> Use Shared AppData</button>}
        {location && !location.portableAvailable && location.mode === 'SHARED' && <p className="mt-2 text-xs font-bold text-slate-500">Portable Data can be enabled only when running the Portable edition.</p>}
        {location?.mode === 'PORTABLE' && location.sharedHasData && <p className="mt-2 text-xs font-bold text-amber-700">Shared AppData also contains a store. Switching selects it; neither database is overwritten.</p>}
      </div>

      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-xs">
        <h2 className="text-base font-extrabold text-amber-950">Start New Store</h2>
        <p className="mt-2 text-sm font-medium text-amber-900">Creates a fresh store setup while protecting the previous store with a verified safety backup. Existing backup files remain.</p>
        <button onClick={() => setNewStoreOpen(true)} className="btn-ghost mt-4 border-2 border-amber-300 bg-white font-bold text-amber-950">Start New Store</button>
      </div>

      <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-5 shadow-xs">
        <h2 className="text-base font-extrabold text-rose-950">Danger zone — active store database</h2>
        <p className="mt-2 text-sm font-black text-rose-800">THIS WILL RESET THE ACTIVE STORE DATABASE.</p>
        <p className="mt-1 text-sm font-medium text-rose-950">Administrative destructive reset for troubleshooting/reinitialization. Products, sales, users, shifts, and settings will be removed from the active database. A verified safety backup will be created first; if backup creation fails, reset is aborted.</p>
        <button onClick={() => setOpen(true)} className="btn-danger mt-4 flex items-center gap-2 font-bold"><DatabaseZap className="h-4 w-4" /> Reset Database</button>
      </div>

      {open && <Modal open onClose={() => { if (!resetting) { setOpen(false); setConfirmation('') } }} title="Reset Database" maxWidth="max-w-md" footer={
        <>
          <button onClick={() => { setOpen(false); setConfirmation('') }} disabled={resetting} className="btn-ghost">Cancel</button>
          <button onClick={() => void reset()} disabled={resetting || confirmation !== 'RESET'} className="btn-danger">{resetting ? 'Resetting...' : 'Reset and Restart'}</button>
        </>
      }>
        <p className="text-sm font-semibold text-red-300">THIS WILL RESET THE ACTIVE STORE DATABASE.</p>
        <p className="mt-2 text-sm text-amber-400">A verified safety backup will be created first. The app will restart and show first-time setup.</p>
        <div className="mt-4"><label className="label">Type RESET to confirm</label><input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="input w-full" autoFocus /></div>
      </Modal>}

      {newStoreOpen && <Modal open onClose={() => { if (!resetting) { setNewStoreOpen(false); setNewStoreConfirmation('') } }} title="Start New Store" maxWidth="max-w-md" footer={<><button onClick={() => setNewStoreOpen(false)} disabled={resetting} className="btn-ghost">Cancel</button><button onClick={() => void startNewStore()} disabled={resetting || newStoreConfirmation !== 'NEW STORE'} className="btn-danger">{resetting ? 'Preparing...' : 'Start Fresh and Restart'}</button></>}>
        <p className="text-sm font-semibold text-amber-300">The current store database will be replaced with a fresh database.</p><p className="mt-2 text-sm text-slate-400">A verified safety backup is created first. If backup creation or verification fails, this operation aborts. Existing backup files remain.</p><div className="mt-4"><label className="label">Type NEW STORE to confirm</label><input value={newStoreConfirmation} onChange={(e) => setNewStoreConfirmation(e.target.value)} className="input w-full" autoFocus /></div>
      </Modal>}

      {portableOpen && <Modal open onClose={() => setPortableOpen(false)} title="Use Portable Data" maxWidth="max-w-md" footer={<button onClick={() => setPortableOpen(false)} className="btn-ghost">Cancel</button>}>
        <p className="mb-3 text-sm text-slate-400">Portable data will be stored beside this Portable EXE at:</p><p className="mb-4 break-all font-mono text-xs text-brand-300">{location?.portableRoot}</p><div className="grid gap-3"><button onClick={() => void switchToPortable('FRESH')} className="rounded-lg border border-ink-line p-3 text-left hover:border-brand-500"><span className="block font-semibold text-white">Start Fresh</span><span className="text-xs text-slate-400">Keep Shared AppData unchanged and open first-run setup in a new portable database.</span></button><button onClick={() => void switchToPortable('COPY')} className="rounded-lg border border-ink-line p-3 text-left hover:border-brand-500"><span className="block font-semibold text-white">Copy Current Store</span><span className="text-xs text-slate-400">Checkpoint, safety-back up, copy, integrity-check, and preserve the original Shared AppData database.</span></button></div>
      </Modal>}

      {backups && <Modal open onClose={() => setBackups(null)} title="Restore Backup" maxWidth="max-w-lg" footer={<button onClick={() => setBackups(null)} className="btn-ghost">Cancel</button>}>
        <p className="mb-3 text-sm text-amber-400">Restoring replaces the active database, creates a safety backup, verifies integrity, and restarts TINDA POS.</p>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {backups.length === 0 && <p className="py-5 text-center text-sm text-slate-500">No backups available.</p>}
          {backups.map((backup) => <button key={backup.filename} onClick={() => void restore(backup)} className="flex w-full items-center justify-between rounded-lg border border-ink-line p-3 text-left hover:border-brand-500/50"><span className="font-mono text-xs text-slate-300">{backup.filename}</span><RotateCcw className="h-4 w-4 text-brand-400" /></button>)}
        </div>
      </Modal>}

      {confirmOp && <Modal open onClose={() => { if (!resetting) setConfirmOp(null) }} title={confirmOp.title} maxWidth="max-w-md" footer={
        <>
          <button onClick={() => setConfirmOp(null)} disabled={resetting} className="btn-ghost">Cancel</button>
          <button onClick={() => void confirmOp.action()} disabled={resetting} className="btn-danger">{resetting ? 'Processing...' : 'Confirm'}</button>
        </>
      }>
        <p className="text-sm text-slate-300">{confirmOp.desc}</p>
      </Modal>}

      <DesktopMigrationModal
        open={migrationModalOpen}
        onClose={() => setMigrationModalOpen(false)}
        onSuccess={() => {
          void Promise.all([window.api.app.databaseFile(), window.api.backup.dir(), window.api.backup.locationStatus()]).then(([database, backup, status]) => {
            setDatabaseFile(database)
            setBackupDir(backup)
            setLocation(status)
          })
        }}
      />
    </div>
  )
}

function LicenseTab(): React.JSX.Element {
  const { status, activate, deactivate } = useLicenseStore()
  const [keyInput, setKeyInput] = useState('')
  const [customerInput, setCustomerInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedMid, setCopiedMid] = useState(false)
  const [copiedMaya, setCopiedMaya] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [certOpen, setCertOpen] = useState(false)
  const [keyValidity, setKeyValidity] = useState<'IDLE' | 'CHECKING' | 'MATCH' | 'MISMATCH' | 'INVALID'>('IDLE')

  // Real-time cryptographic key check against current hardware Machine ID
  useEffect(() => {
    const clean = keyInput.trim().toUpperCase()
    if (!clean) {
      setKeyValidity('IDLE')
      return
    }
    const syntax = validateLicenseSyntax(clean)
    if (!syntax.formatOk) {
      setKeyValidity('INVALID')
      return
    }
    if (!status?.machineId) return

    let active = true
    setKeyValidity('CHECKING')
    void LicenseService.getInstance().verifyKey(clean, status.machineId).then((valid) => {
      if (active) {
        setKeyValidity(valid ? 'MATCH' : 'MISMATCH')
      }
    })
    return () => {
      active = false
    }
  }, [keyInput, status?.machineId])

  const copyMachineId = async () => {
    if (!status?.machineId) return
    try {
      await navigator.clipboard.writeText(status.machineId)
      setCopiedMid(true)
      toastSuccess('Machine ID copied to clipboard!', status.machineId)
      setTimeout(() => setCopiedMid(false), 2500)
    } catch {
      toastError('Could not copy Machine ID')
    }
  }

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

  const handleScanQr = (scannedText: string) => {
    const extracted = extractLicenseFromScannedText(scannedText)
    if (extracted) {
      setKeyInput(extracted)
      toastSuccess('VIP License Key Scanned!', extracted)
    } else {
      toastError('No valid VIP License Key found in QR Code', scannedText.slice(0, 35))
    }
  }

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyInput.trim()) {
      toastError('Please enter a license key')
      return
    }
    setSubmitting(true)
    try {
      const res = await activate(keyInput.trim().toUpperCase(), customerInput.trim() || undefined)
      if (res.ok) {
        toastSuccess('License Activated!', res.message)
        setKeyInput('')
        setCustomerInput('')
        setCertOpen(true)
      } else {
        toastError('Activation Failed', res.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    setSubmitting(true)
    try {
      const res = await deactivate()
      if (res.ok) {
        toastSuccess('License Deactivated', res.message)
        setConfirmDeactivate(false)
      } else {
        toastError('Deactivation Failed', res.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* 1. STATUS BANNER */}
      {status?.isVip && !status?.isDemo ? (
        <div className="card p-5 border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  VIP PRO LIFETIME
                </span>
                <span className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-black text-emerald-800">
                  OFFLINE ACTIVE
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-950 pt-1">
                {status.customerName ? status.customerName : 'VIP Store Terminal'}
              </h2>
              <p className="text-xs font-bold text-slate-600">
                {status.statusMessage}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCertOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border-2 border-emerald-600 bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition"
              >
                <Award className="h-4 w-4 text-amber-300 fill-amber-300" />
                <span>Certificate</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeactivate(true)}
                className="btn-ghost text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 px-2.5 py-1.5"
              >
                Deactivate
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] uppercase font-black text-slate-500">Official License Key</span>
              <p className="font-mono font-black text-slate-900 break-all select-all">{status.licenseKey}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-slate-500">Activated Timestamp</span>
              <p className="font-bold text-slate-900">
                {status.activatedAt ? new Date(status.activatedAt).toLocaleString() : 'Permanent Lifetime'}
              </p>
            </div>
          </div>
        </div>
      ) : status?.isDemo && status?.isVip ? (
        <div className="card p-5 border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  24-HOUR VIP DEMO
                </span>
                <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-black text-amber-800">
                  TRIAL ACTIVE
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-950 pt-1">
                Full VIP Features Unlocked
              </h2>
              <p className="text-xs font-bold text-amber-900">
                Expires: {status.demoExpiresAt ? new Date(status.demoExpiresAt).toLocaleString() : 'In 24 Hours'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 border-2 border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-800">
                COMMUNITY EDITION
              </span>
              <h2 className="text-xl font-black text-slate-950 mt-1">Free 100% Offline POS</h2>
              <p className="text-xs font-semibold text-slate-600">
                Upgrade to VIP Pro for ₱500 one-time to permanently unlock multi-device features and desktop database import.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. HARDWARE MACHINE ID CARD */}
      <div className="card p-5 border-2 border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-950">
            Hardware Machine ID (Tablet / Mobile)
          </h3>
          <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full uppercase">
            Hardware Anchored
          </span>
        </div>
        <p className="text-xs text-slate-600 font-semibold mb-3">
          This Machine ID uniquely identifies your Android tablet or phone. Share this ID with Dev Ian to receive your cryptographically signed VIP license key.
        </p>

        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-slate-200 bg-slate-50">
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Your Device Machine ID
            </span>
            <span className="block font-mono text-base sm:text-lg font-black text-slate-950 tracking-wider break-all select-all">
              {status?.machineId || 'Loading...'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void copyMachineId()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black bg-emerald-600 text-white shadow-xs active:scale-95 transition"
          >
            {copiedMid ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy ID</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. ACTIVATION FORM WITH 1-TAP QR SCAN & AUTO-HYPHENATION */}
      <div className="card p-5 border-2 border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-950">
            Activate VIP License Key
          </h3>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 shadow-xs hover:bg-emerald-100 active:scale-95 transition"
          >
            <Camera className="h-3.5 w-3.5 text-emerald-700" />
            <span>Scan License QR</span>
          </button>
        </div>
        <p className="text-xs text-slate-600 font-semibold mb-4">
          Enter the license key issued by Dev Ian, or scan the QR code directly from your other device screen.
        </p>

        <form onSubmit={handleActivate} className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">VIP License Key *</label>
              <span className="text-[10px] font-bold text-slate-400">Auto-hyphenates</span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="VIP-XXXX-XXXX-XXXX-XXXX"
                value={keyInput}
                onChange={(e) => setKeyInput(formatLicenseKeyInput(e.target.value))}
                className="input w-full font-mono text-base uppercase tracking-wider font-bold pr-10"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-emerald-700 transition"
                title="Scan License QR with Camera"
              >
                <QrCode className="h-5 w-5" />
              </button>
            </div>

            {/* Live Real-Time Validation Pill */}
            <div className="pt-2 text-xs font-bold">
              {keyValidity === 'IDLE' && (
                <span className="text-slate-500 font-medium">Format: VIP-XXXX-XXXX-XXXX-XXXX (24 characters)</span>
              )}
              {keyValidity === 'INVALID' && keyInput.length > 0 && (
                <span className="text-slate-500 font-mono">
                  {keyInput.length} / 24 chars {keyInput.length === 24 ? '(Prefix must be VIP or DEMO)' : ''}
                </span>
              )}
              {keyValidity === 'CHECKING' && (
                <span className="flex items-center gap-1 text-slate-600 font-semibold">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  Verifying mathematical signature...
                </span>
              )}
              {keyValidity === 'MATCH' && (
                <span className="inline-flex items-center gap-1.5 text-emerald-900 font-black bg-emerald-100 border border-emerald-400 px-2.5 py-1 rounded-lg">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  ✓ Authentic Key — Cryptographically Verified for this Device!
                </span>
              )}
              {keyValidity === 'MISMATCH' && (
                <span className="inline-flex items-center gap-1.5 text-amber-950 font-black bg-amber-100 border border-amber-400 px-2.5 py-1 rounded-lg">
                  ⚠ Cryptographically valid key, but issued for a different Machine ID.
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="label">Store / Customer Name (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Aling Nena Store"
              value={customerInput}
              onChange={(e) => setCustomerInput(e.target.value)}
              className="input w-full font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !keyInput.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm font-black shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying Cryptographic Key...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Activate VIP Pro Lifetime</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 4. MAYA PAYMENT & DEV CONTACT */}
      <div className="card p-5 border-2 border-emerald-300 bg-emerald-50/40 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-emerald-200/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-12 items-center justify-center rounded bg-white px-1 shadow-xs border border-emerald-200">
              <MayaMark />
            </div>
            <div>
              <span className="text-xs font-black uppercase text-emerald-950">Dev Ian (Maya Wallet)</span>
              <p className="text-[10px] font-bold text-emerald-800">₱500 One-Time Lifetime License</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white">
            100% Offline
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-200 bg-white shadow-xs">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Maya Mobile Number
            </span>
            <span className="font-mono text-lg font-black text-slate-950 tracking-wider">
              0991 225 5156
            </span>
            <span className="text-[11px] text-slate-600 font-semibold block mt-0.5">
              Account Name: <strong className="text-slate-900 font-black">Francis</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => void copyMaya()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black bg-emerald-600 text-white shadow-xs active:scale-95 transition"
          >
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
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-emerald-200/60 text-xs text-slate-700 space-y-1.5 font-semibold">
          <p className="font-black text-slate-950">How to get your VIP Pro license key:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 font-medium">
            <li>Copy your <strong>Machine ID</strong> above.</li>
            <li>Send ₱500 to Maya <strong>0991 225 5156</strong>.</li>
            <li>Message Dev Ian on Facebook: <a href="https://www.facebook.com/Ukauru" target="_blank" rel="noreferrer" className="text-emerald-700 font-black underline">facebook.com/Ukauru</a> with your payment screenshot & Machine ID.</li>
            <li>Receive your QR Code or 24-character key and activate instantly.</li>
          </ol>
        </div>
      </div>

      {/* 5. ROYAL CERTIFICATE OF AUTHENTICITY MODAL */}
      {certOpen && status?.isVip && (
        <Modal
          open
          onClose={() => setCertOpen(false)}
          title="Certificate of Authenticity"
          maxWidth="max-w-md"
          footer={
            <div className="flex items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={() => {
                  const summary = [
                    '═══════════════════════════════════════════',
                    '💎 TINDA POS VIP PRO — CERTIFICATE OF AUTHENTICITY',
                    '═══════════════════════════════════════════',
                    `Store: ${status.customerName || 'Registered TINDA POS Merchant'}`,
                    `Machine ID: ${status.machineId}`,
                    `License Key: ${status.licenseKey}`,
                    `Tier: VIP PRO LIFETIME`,
                    `Validation: 100% Offline Cryptographically Signed`,
                    `Authority: Francis (Dev Ian) • Maya 0991 225 5156`,
                    `Activated: ${status.activatedAt ? new Date(status.activatedAt).toLocaleString() : 'Permanent'}`,
                    '═══════════════════════════════════════════'
                  ].join('\n')
                  void navigator.clipboard.writeText(summary)
                  toastSuccess('Official Certificate copied to clipboard!')
                }}
                className="btn-ghost flex items-center gap-1.5 text-xs font-black text-emerald-800 border-2 border-slate-200 bg-white"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Certificate</span>
              </button>
              <button type="button" onClick={() => setCertOpen(false)} className="btn-primary">
                Done
              </button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            {/* Certificate Parchment Frame */}
            <div className="relative rounded-2xl border-4 border-emerald-600 bg-gradient-to-b from-emerald-50/50 via-white to-amber-50/30 p-5 shadow-inner text-center">
              {/* Crest Badge */}
              <div className="mx-auto -mt-2 mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 text-amber-950 shadow-md border-2 border-amber-300">
                <Award className="h-8 w-8 fill-amber-950 text-amber-950" />
              </div>

              <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-800">
                TINDA POS PHILIPPINES
              </span>
              <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight mt-0.5">
                Certificate of Authenticity
              </h3>
              <p className="text-[11px] font-bold text-slate-600 mb-4">
                Official VIP Pro Lifetime License
              </p>

              <div className="rounded-xl border-2 border-slate-200 bg-white p-3 text-left space-y-2.5 text-xs shadow-xs">
                <div>
                  <span className="block text-[9px] font-black uppercase text-slate-400">Licensed Store / Merchant</span>
                  <span className="block font-black text-slate-950 text-sm">
                    {status.customerName || 'Official Registered Store'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-black uppercase text-slate-400">Hardware Machine ID</span>
                  <span className="block font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-xs break-all select-all">
                    {status.machineId}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-black uppercase text-slate-400">Cryptographic Key</span>
                  <span className="block font-mono font-bold text-slate-800 text-xs break-all select-all">
                    {status.licenseKey}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-400">Activated Date</span>
                    <span className="font-bold text-slate-800">
                      {status.activatedAt ? new Date(status.activatedAt).toLocaleDateString() : 'Permanent'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-400">Issuing Authority</span>
                    <span className="font-bold text-emerald-800">Dev Ian (Francis)</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-black text-emerald-900 bg-emerald-100/70 border border-emerald-300 py-1.5 px-3 rounded-full">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                <span>100% OFFLINE VERIFIED • ZERO CLOUD REQUIRED</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. CAMERA QR SCANNER MODAL */}
      {scannerOpen && (
        <BarcodeScannerModal
          open
          onClose={() => setScannerOpen(false)}
          onScan={handleScanQr}
          title="Scan VIP License QR Code"
        />
      )}

      {/* 7. CONFIRM DEACTIVATE MODAL */}
      {confirmDeactivate && (
        <Modal
          open
          onClose={() => setConfirmDeactivate(false)}
          title="Deactivate VIP License"
          maxWidth="max-w-md"
          footer={
            <>
              <button onClick={() => setConfirmDeactivate(false)} className="btn-ghost">
                Cancel
              </button>
              <button onClick={handleDeactivate} className="btn-danger">
                Confirm Deactivate
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-700 font-medium">
            Are you sure you want to deactivate VIP Pro on this device? The app will revert to Community Edition. Your transaction and inventory data will remain intact.
          </p>
        </Modal>
      )}
    </div>
  )
}

function AboutTab({ onNavigateLicense }: { onNavigateLicense?: () => void }): React.JSX.Element {
  const { status: license } = useLicenseStore()
  const [copiedMaya, setCopiedMaya] = useState(false)
  const copyMaya = async () => {
    try {
      await navigator.clipboard.writeText('09912255156')
      setCopiedMaya(true)
      toastSuccess('Maya number copied!', '0991 225 5156')
      setTimeout(() => setCopiedMaya(false), 2500)
    } catch { toastError('Could not copy number') }
  }

  return (
    <div className="max-w-xl space-y-4 pb-12">
      {/* 1. APP BRANDING HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-6 text-center shadow-sm">
        {/* Circular Animated Crest */}
        <div className="relative mx-auto flex items-center justify-center py-2 mb-3">
          <div className="absolute h-24 w-24 rounded-full border border-dashed border-emerald-400/40 animate-orbit-ring" />
          <div className="absolute h-20 w-20 rounded-full bg-emerald-500/10 blur-lg animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500 bg-white p-2.5 shadow-sm">
            <img
              src={tindaIcon}
              alt="TINDA POS"
              className="h-full w-full rounded-full object-contain"
            />
          </div>
        </div>

        <h2 className="text-xl font-black tracking-tight text-slate-950">
          TINDA POS Free for Android & Tablet
        </h2>
        <p className="mt-0.5 text-xs text-emerald-700 font-bold">
          Offline POS System for Philippine Retail & Sari-Sari Stores
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
            v{APP_VERSION} Stable
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
            100% Offline Capable
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
            Zero Cloud Dependency
          </span>
        </div>

        <div className="mx-auto my-4 h-px max-w-xs bg-slate-200" />

        <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
          <span className="italic text-slate-500 font-medium">Crafted with care by</span>
          <span className="font-bold text-emerald-700">Dev Francis</span>
        </div>
      </div>

      {/* 2. VIP PRO CALLOUT CARD */}
      <div className="overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-black uppercase text-slate-950">
              {license?.isVip ? (license.isDemo ? '24-Hour VIP Demo Active' : 'VIP Pro Lifetime Active') : 'Upgrade to VIP Pro'}
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {license?.isVip
              ? 'All premium tablet and hardware-locked features are unlocked.'
              : 'Unlock tablet dual-pane counter, desktop database import, and lifetime support.'}
          </p>
        </div>
        {onNavigateLicense && (
          <button
            onClick={onNavigateLicense}
            className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs active:scale-95 transition"
          >
            {license?.isVip ? 'Manage' : 'Upgrade'}
          </button>
        )}
      </div>

      {/* 3. DEDICATED BUY ME A COFFEE / MAYA CARD */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-300 bg-white p-5 shadow-sm">
        {/* Header with animated coffee cup */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-600 shadow-sm">
            <div className="pointer-events-none absolute -top-2 flex items-end gap-1">
              <span className="h-2 w-0.5 rounded-full bg-amber-500 animate-steam-1" />
              <span className="h-3 w-0.5 rounded-full bg-amber-600 animate-steam-2" />
              <span className="h-2 w-0.5 rounded-full bg-amber-500 animate-steam-3" />
            </div>
            <Coffee className="h-6 w-6 animate-coffee-catchy" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-950">Buy me a coffee</h3>
              <span className="rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-800">
                Support Updates
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Support development & continuous free updates
            </p>
          </div>
        </div>

        {/* English Description */}
        <p className="mt-3.5 text-xs text-slate-700 font-medium leading-relaxed">
          TINDA POS is 100% free and offline-ready. If it helps your store thrive, you can support future development and upcoming updates by buying the developer a coffee!
        </p>

        {/* Dedicated Maya Payment Box */}
        <div className="mt-4 overflow-hidden rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 shadow-xs">
          <div className="flex items-center justify-between border-b border-emerald-200 bg-emerald-100/50 px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-12 items-center justify-center rounded-md bg-white px-1 shadow-xs border border-emerald-200">
                <MayaMark />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                Maya Official Wallet
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-800">Philippines</span>
          </div>

          <div className="flex items-center justify-between p-4 gap-3">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-wider text-slate-600 font-black">
                Account Number (Mobile)
              </span>
              <span className="block font-mono text-xl font-black tracking-wider text-slate-950 select-all">
                0991 225 5156
              </span>
              <span className="block text-[11px] text-slate-600 mt-0.5 font-medium">
                Recipient: <span className="font-bold text-slate-900">Francis</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => void copyMaya()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black transition shadow-sm active:scale-95 bg-emerald-600 text-white"
            >
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
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] text-slate-500">
          Voluntary donation · Dev Francis (0991 225 5156) · Thank you for your support!
        </p>
      </div>

      {/* 3. SOFTWARE UPDATE PANEL */}
      <SoftwareUpdatePanel />

      {/* 4. APP SYSTEM SPECS / LOCAL STORAGE INFO */}
      <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 shadow-xs">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-3">
          System Information
        </h4>
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Database Engine</span>
            <span className="font-extrabold text-slate-950 mt-0.5 block">SQLite / IndexedDB</span>
            <span className="text-[10px] text-emerald-700 font-bold">Local & Secure</span>
          </div>
          <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Network State</span>
            <span className="font-extrabold text-slate-950 mt-0.5 block">Zero Cloud</span>
            <span className="text-[10px] text-emerald-700 font-bold">Always Functional</span>
          </div>
          <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Thermal Printer</span>
            <span className="font-extrabold text-slate-950 mt-0.5 block">58mm / 80mm</span>
            <span className="text-[10px] text-slate-500 font-semibold">Bluetooth & System</span>
          </div>
          <div className="rounded-xl border-2 border-slate-200 bg-white p-3 shadow-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Target Platform</span>
            <span className="font-extrabold text-slate-950 mt-0.5 block">Android 8.0 - 15+</span>
            <span className="text-[10px] text-slate-500 font-semibold">Universal APK</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SoftwareUpdatePanel(): React.JSX.Element | null {
  const { event, check, download, install, dismiss } = useUpdate()
  const [busy, setBusy] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  if (!event) return null

  const installed = event.installedVersion
  const label = statusLabel(event.status)
  const note = event.message
  const available = event.available?.version ?? ''

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Download className="h-4 w-4 text-emerald-600" /> Software Update</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${event.status === 'ERROR' || event.status === 'OFFLINE' || event.status === 'UNABLE_TO_CHECK' ? 'bg-red-50 text-red-800 border border-red-300' : event.status === 'CHECKING' || event.status === 'DOWNLOADING' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-emerald-50 text-emerald-800 border border-emerald-300'}`}>{label}</span>
      </div>
      <div className="space-y-1 text-sm font-semibold text-slate-700">
        <p>Installed version: <span className="font-mono font-bold text-slate-950">v{installed}</span></p>
        {available && <p>Available version: <span className="font-mono font-bold text-emerald-700">v{available}</span></p>}
        {event.lastCheckedAt && <p className="text-xs text-slate-500 font-medium">Last checked: {new Date(event.lastCheckedAt).toLocaleString()}</p>}
        {note && <p className="pt-1 text-xs text-slate-600 font-medium">{note}</p>}
        {event.status === 'DOWNLOADING' && event.progress && (
          <div className="pt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${event.progress.percent}%` }} />
            </div>
            <p className="pt-1 text-xs text-slate-500">{event.progress.percent}%</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setBusy(true); void check(true).finally(() => setBusy(false)) }}
          disabled={busy || event.status === 'CHECKING' || event.status === 'DOWNLOADING'}
          className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          {event.status === 'CHECKING' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Check for Updates
        </button>
        {event.status === 'UPDATE_AVAILABLE' && event.available && (
          <button onClick={() => { setBusy(true); void download().finally(() => setBusy(false)) }} disabled={busy} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Download Update
          </button>
        )}
        {event.status === 'ERROR' && event.available && (
          <button onClick={() => { setBusy(true); void download().finally(() => setBusy(false)) }} disabled={busy} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Retry Download
          </button>
        )}
        {(event.status === 'DOWNLOADED' || event.status === 'READY_TO_INSTALL') && (
          <button onClick={() => { setBusy(true); void install().finally(() => setBusy(false)) }} disabled={busy} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Install Update
          </button>
        )}
        {event.status === 'UPDATE_AVAILABLE' && (
          <button onClick={() => void dismiss()} className="btn-ghost px-3 py-1.5 text-xs">Later</button>
        )}
        {event.available && (
          <button onClick={() => setShowNotes((v) => !v)} className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"><Sparkles className="h-3.5 w-3.5" /> {showNotes ? 'Hide What\'s New' : 'What\'s New'}</button>
        )}
      </div>
      {showNotes && event.available && (
        <div className="mt-3 max-h-44 overflow-y-auto rounded-lg bg-ink-900/70 p-3 text-xs leading-relaxed text-slate-300">
          <p className="mb-1 font-semibold text-white">What&apos;s New in v{event.available.version}</p>
          <pre className="whitespace-pre-wrap font-sans">{event.available.releaseNotes}</pre>
        </div>
      )}
    </div>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case 'CHECKING': return 'Checking for updates…'
    case 'UP_TO_DATE': return 'Up to date'
    case 'UPDATE_AVAILABLE': return 'Update available'
    case 'DOWNLOADING': return 'Downloading'
    case 'DOWNLOADED': return 'Downloaded'
    case 'READY_TO_INSTALL': return 'Ready to install'
    case 'OFFLINE': return 'Offline'
    case 'UNABLE_TO_CHECK': return 'Unable to check'
    case 'ERROR': return 'Update failed'
    case 'DISMISSED': return 'Up to date'
    default: return 'Idle'
  }
}

function MayaMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 76 32" className="h-8 w-[4.5rem]" role="img" aria-label="Maya">
      <g className="maya-spark" fill="#00a86b"><path d="M5 8h7l5 7 5-7h7L17 24Z" /><path d="M17 8h6l-6 8-6-8Z" opacity=".55" /></g>
      <text className="maya-mark" x="30" y="22" fill="#111827" fontFamily="Arial, sans-serif" fontSize="17" fontWeight="800" letterSpacing="-1">maya</text>
    </svg>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button type="button" onClick={onClick} className={`h-6 w-11 rounded-full transition ${on ? 'bg-brand-600' : 'bg-ink-700'}`}>
      <span className={`block h-5 w-5 rounded-full bg-white transition ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function StoreSettingsTab(): React.JSX.Element {
  const { settings, update } = useSettings()
  const [f, setF] = useState({
    store_name: settings?.store_name ?? '',
    owner_name: settings?.owner_name ?? '',
    address: settings?.address ?? '',
    phone: settings?.phone ?? '',
    tin: settings?.tin ?? '',
    default_low_stock: settings?.default_low_stock ?? 5,
    allow_negative_inventory: settings?.allow_negative_inventory ?? false,
    default_tax_c: settings?.default_tax_c ?? 0
  })
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }))

  const save = async () => {
    setSaving(true)
    try {
      await update({ store_name: f.store_name, owner_name: f.owner_name, address: f.address, phone: f.phone, tin: f.tin, default_low_stock: f.default_low_stock, allow_negative_inventory: f.allow_negative_inventory, default_tax_c: f.default_tax_c })
      toastSuccess('Settings saved')
    } catch (e) { toastError('Save failed', String((e as Error)?.message || e)) } finally { setSaving(false) }
  }

  return (
    <div className="card max-w-xl p-5">
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Store Name *</label><input value={f.store_name} onChange={(e) => set({ store_name: e.target.value })} className="input w-full" /></div>
          <div><label className="label">Owner Name</label><input value={f.owner_name} onChange={(e) => set({ owner_name: e.target.value })} className="input w-full" /></div>
          <div><label className="label">Phone</label><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className="input w-full" /></div>
          <div className="sm:col-span-2"><label className="label">Address</label><input value={f.address} onChange={(e) => set({ address: e.target.value })} className="input w-full" /></div>
          <div><label className="label">TIN</label><input value={f.tin} onChange={(e) => set({ tin: e.target.value })} className="input w-full" /></div>
          <div><label className="label">Default Tax (₱)</label><input type="number" min={0} value={f.default_tax_c / 100} onChange={(e) => set({ default_tax_c: Math.round(parseFloat(e.target.value || '0') * 100) })} className="input w-full" /></div>
          <div className="sm:col-span-2"><label className="label">Default Low Stock Alert</label><input type="number" min={0} value={f.default_low_stock} onChange={(e) => set({ default_low_stock: parseInt(e.target.value || '0', 10) })} className="input w-full" /></div>
        </div>
        <div className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div>
            <p className="text-sm font-bold text-slate-900">Allow negative stock</p>
            <p className="text-xs font-medium text-slate-500">Let sales go below zero stock</p>
          </div>
          <Toggle on={f.allow_negative_inventory} onClick={() => set({ allow_negative_inventory: !f.allow_negative_inventory })} />
        </div>
        <button onClick={() => void save()} disabled={saving} className="btn-primary flex items-center gap-2"><Save className="h-4 w-4" /> Save Settings</button>
      </div>
    </div>
  )
}

function ReceiptSettingsTab(): React.JSX.Element {
  const { settings, update } = useSettings()
  const [f, setF] = useState({ receipt_header: settings?.receipt_header ?? '', receipt_title: settings?.receipt_title ?? '', receipt_show_app_name: settings?.receipt_show_app_name ?? true, receipt_footer: settings?.receipt_footer ?? '', receipt_printer: settings?.receipt_printer ?? '', auto_print_after_sale: settings?.auto_print_after_sale ?? false, receipt_paper_width: settings?.receipt_paper_width ?? '80mm' as '58mm' | '80mm', receipt_copies: settings?.receipt_copies ?? 1 })
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }))
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [printers, setPrinters] = useState<PrinterChoice[]>([])

  useEffect(() => {
    if (settings) setF({ receipt_header: settings.receipt_header, receipt_title: settings.receipt_title, receipt_show_app_name: settings.receipt_show_app_name, receipt_footer: settings.receipt_footer, receipt_printer: settings.receipt_printer, auto_print_after_sale: settings.auto_print_after_sale, receipt_paper_width: settings.receipt_paper_width, receipt_copies: settings.receipt_copies })
  }, [settings])

  // Refresh the installed printer list (also used by the Refresh Printers button
  // so a newly connected/installed printer appears without restarting the app).
  const loadPrinters = async (): Promise<void> => {
    setRefreshing(true)
    try {
      const list = await window.api.printer.list()
      setPrinters(list)
    } catch (e) {
      toastError('Could not list printers', String((e as Error)?.message || e))
    } finally {
      setRefreshing(false)
    }
  }
  useEffect(() => { void loadPrinters() }, [])

  // First setup only: when nothing is saved yet and Windows reports a default
  // printer, suggest it in the dropdown. The owner still confirms by pressing
  // Save — TINDA POS never silently prints to a random default printer.
  useEffect(() => {
    if (!settings) return
    const pick = printerPick(printers, settings.receipt_printer)
    if (pick.status === 'NOT_CONFIGURED' && pick.name) {
      setF((prev) => (prev.receipt_printer === settings.receipt_printer ? { ...prev, receipt_printer: pick.name } : prev))
    }
  }, [printers, settings])

  const pick = printerPick(printers, f.receipt_printer)

  const save = async () => {
    setSaving(true)
    try {
      await update({ receipt_header: f.receipt_header, receipt_title: f.receipt_title, receipt_show_app_name: f.receipt_show_app_name, receipt_footer: f.receipt_footer })
      await window.api.printer.save({ name: f.receipt_printer, autoPrint: f.auto_print_after_sale, paperWidth: f.receipt_paper_width, copies: f.receipt_copies })
      toastSuccess('Receipt settings saved')
    } catch (e) { toastError('Save failed', String((e as Error)?.message || e)) } finally { setSaving(false) }
  }

  const testPrint = async () => {
    try {
      await window.api.printer.save({ name: f.receipt_printer, autoPrint: f.auto_print_after_sale, paperWidth: f.receipt_paper_width, copies: f.receipt_copies })
      const result = await window.api.printer.testPrint()
      if (result.ok) toastSuccess('Test print sent', result.message)
      else toastError('Test print failed', result.message)
    } catch (e) { toastError('Test print failed', String((e as Error)?.message || e)) }
  }

  return (
    <div className="card max-w-xl p-5 border-2 border-slate-200 bg-white shadow-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5"><div><p className="text-sm font-bold text-slate-900">Show TINDA POS App Name</p><p className="text-xs font-medium text-slate-500">Turn this off to remove TINDA POS from the receipt heading.</p></div><Toggle on={f.receipt_show_app_name} onClick={() => set({receipt_show_app_name: !f.receipt_show_app_name})}/></div>
        <div><label className="label">Receipt Title</label><input value={f.receipt_title} onChange={e=>set({receipt_title:e.target.value})} placeholder="JUAN STORE" className="input w-full"/></div>
        <div><label className="label">Receipt Header (shown on top)</label><textarea value={f.receipt_header} onChange={(e) => set({ receipt_header: e.target.value })} rows={2} className="input w-full" /></div>
        <div><label className="label">Receipt Footer (message at bottom)</label><textarea value={f.receipt_footer} onChange={(e) => set({ receipt_footer: e.target.value })} rows={2} className="input w-full" /></div>
        <div>
          <label className="label">Printer</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto mb-2 pr-1">
            <button
               type="button"
               onClick={() => set({ receipt_printer: '' })}
               className={`flex text-left flex-col items-start rounded-xl border-2 p-3 transition shadow-xs ${!f.receipt_printer ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'}`}
            >
              <span className={`font-bold ${!f.receipt_printer ? 'text-emerald-700' : 'text-slate-900'}`}>None</span>
              <span className="text-xs text-slate-500 mt-0.5 font-medium">Disable receipt printing</span>
            </button>
            {printers.map(p => (
               <button
                 key={p.name}
                 type="button"
                 onClick={() => set({ receipt_printer: p.name })}
                 className={`flex text-left flex-col items-start rounded-xl border-2 p-3 transition shadow-xs ${f.receipt_printer === p.name ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'}`}
               >
                 <span className={`font-bold line-clamp-1 ${f.receipt_printer === p.name ? 'text-emerald-700' : 'text-slate-900'}`}>{p.displayName}</span>
                 <span className="text-xs text-slate-500 mt-0.5 font-medium">{p.isDefault ? 'System Default' : p.name}</span>
               </button>
            ))}
            {pick.status === 'UNAVAILABLE' && (
               <button type="button" className="flex text-left flex-col items-start rounded-xl border-2 border-amber-400 bg-amber-50 p-3 shadow-xs">
                 <span className="font-bold text-amber-900 line-clamp-1">{pick.name}</span>
                 <span className="text-xs text-amber-700 mt-0.5 font-semibold">Currently unavailable</span>
               </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <div>
            <p className="text-sm font-bold text-slate-900">Status: <span className={`font-black ${pick.status === 'READY' ? 'text-emerald-700' : pick.status === 'UNAVAILABLE' ? 'text-amber-700' : 'text-slate-600'}`}>{printerStatusLabel(pick.status)}</span></p>
            <p className="text-xs font-medium text-slate-500">Ready when selected printer is paired or available.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void window.api.printer.openBluetoothSettings?.()} className="btn-ghost flex items-center gap-1.5 text-xs font-bold text-emerald-700 border-2 border-slate-200 bg-white"><Bluetooth className="h-3.5 w-3.5" /> Pair Bluetooth</button>
            <button type="button" onClick={() => void loadPrinters()} disabled={refreshing} className="btn-ghost flex items-center gap-1.5 text-xs font-bold text-slate-800 border-2 border-slate-200 bg-white">{refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh</button>
          </div>
        </div>
        {pick.status === 'UNAVAILABLE' && <p className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Selected receipt printer is unavailable: <span className="font-mono">{pick.name}</span>. Check if Bluetooth is turned on and paired, then press Refresh. Sales are never blocked or rolled back.</p>}
        {pick.status === 'NOT_CONFIGURED' && printers.length === 0 && <p className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">No receipt printer configured. Select Android System Print (WiFi / PDF) or pair a Bluetooth thermal receipt printer (58mm/80mm), then press Refresh.</p>}
        <div className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5"><div><p className="text-sm font-bold text-slate-900">Auto Print After Sale</p><p className="text-xs font-medium text-slate-500">One silent print job, sent immediately after the sale commits.</p></div><Toggle on={f.auto_print_after_sale} onClick={() => set({ auto_print_after_sale: !f.auto_print_after_sale })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Paper Width</label>
            <select value={f.receipt_paper_width} onChange={(e) => set({ receipt_paper_width: e.target.value as '58mm' | '80mm' })} className="input w-full">
              <option value="58mm">58mm (portable thermal)</option>
              <option value="80mm">80mm (standard desktop)</option>
            </select>
          </div>
          <div>
            <label className="label">Copies</label>
            <input type="number" min={1} max={3} value={f.receipt_copies} onChange={(e) => set({ receipt_copies: Math.max(1, Math.min(3, Math.trunc(Number(e.target.value) || 1))) })} className="input w-full" />
          </div>
        </div>
        <div>
          <p className="label">Live Receipt Preview</p>
          <ReceiptPaper
            width={f.receipt_paper_width}
            lines={[
              settings?.store_name || 'TINDA POS',
              ...f.receipt_header.trim().split(/\r?\n/).filter(Boolean),
              ...(f.receipt_show_app_name ? [(f.receipt_title.trim() || 'TINDA POS')] : []),
              ...(settings?.address ? [settings.address] : []),
              ...(settings?.phone ? [settings.phone] : []),
              ...(settings?.tin ? [`TIN: ${settings.tin}`] : []),
              '--------------------------------',
              'No: 20260920-0001',
              'Date: Sep 20, 2026, 7:30 PM',
              'Cashier: Manager',
              '--------------------------------',
              'Sample Product Item',
              '1 x 25.00 25.00',
              'Snack / Beverage',
              '2 x 15.00 30.00',
              '--------------------------------',
              'Subtotal 55.00',
              'TOTAL 55.00',
              'Cash 100.00',
              'SUKLI 45.00',
              '--------------------------------',
              ...(f.receipt_footer.trim() ? f.receipt_footer.trim().split(/\r?\n/).filter(Boolean) : ['Salamat po!']),
              'Items: 3'
            ]}
          />
        </div>
        <p className="rounded-lg border border-ink-line bg-ink-900 px-3 py-2 text-xs text-slate-400">Supports direct Bluetooth ESC/POS thermal printers (58mm & 80mm) and Android System Print (WiFi, Mopria, Save as PDF). Sales always complete safely even if printer is offline.</p>
        <div className="flex gap-2"><button onClick={() => void save()} disabled={saving} className="btn-primary flex items-center gap-2"><Save className="h-4 w-4" /> Save Receipt</button><button onClick={() => void testPrint()} disabled={!f.receipt_printer} className="btn-ghost flex items-center gap-2"><Printer className="h-4 w-4" /> Test Print</button></div>
      </div>
    </div>
  )
}

interface UserForm { id: number | null; username: string; password: string; pin: string; full_name: string; roles: string[] }

function UsersTab(): React.JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [editing, setEditing] = useState<UserForm | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [resetPin, setResetPin] = useState<{ id: number; full_name: string } | null>(null)

  const load = async () => {
    try {
      const [u, r] = await Promise.all([window.api.users.list(), window.api.users.roles()])
      setUsers(u)
      setRoles(r)
    } catch (e) { toastError('Failed to load users', String((e as Error)?.message || e)) }
  }
  useEffect(() => { void load() }, [])

  const save = async (f: UserForm) => {
    try {
      if (f.id) {
        await window.api.users.update(f.id, { username: f.username, full_name: f.full_name, roles: f.roles, password: f.password || undefined, pin: f.pin || undefined })
        toastSuccess('User updated')
      } else {
        await window.api.users.create({ username: f.username, password: f.password, pin: f.pin, full_name: f.full_name, roles: f.roles })
        toastSuccess('User created')
      }
      setEditing(null)
      void load()
    } catch (e) { toastError('Save failed', String((e as Error)?.message || e)) }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex justify-between">
        <p className="text-sm text-slate-400">{users.length} users</p>
        <button onClick={() => setEditing({ id: null, username: '', password: '', pin: '', full_name: '', roles: ['CASHIER'] })} className="btn-primary flex items-center gap-2"><UserPlus className="h-4 w-4" /> New User</button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:hidden">
         {users.map(u => (
            <div key={u.id} className="card border-2 border-slate-200 bg-white p-4 flex flex-col gap-2 shadow-sm">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-slate-950">{u.full_name}</p>
                    <p className="text-sm font-semibold text-slate-600">@{u.username}</p>
                  </div>
                  <div><span className={`badge border ${u.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' : 'bg-slate-100 text-slate-700 border-slate-300 font-bold'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></div>
               </div>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{u.roles.join(', ')}</p>
               <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setEditing({ id: u.id, username: u.username, password: '', pin: '', full_name: u.full_name, roles: u.roles })} className="btn-secondary border-2 border-slate-200 h-10 w-10 p-0 flex items-center justify-center rounded-lg text-slate-800" title="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setResetPin({ id: u.id, full_name: u.full_name })} className="btn-secondary border-2 border-slate-200 h-10 w-10 p-0 flex items-center justify-center rounded-lg text-slate-800" title="Reset PIN"><KeyRound className="h-4 w-4" /></button>
               </div>
            </div>
         ))}
      </div>
      <div className="hidden md:block card border-2 border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="table">
          <thead><tr><th>User</th><th>Username</th><th>Roles</th><th>Status</th><th className="w-28 text-right">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-black text-slate-950">{u.full_name}</td>
                <td className="text-slate-600 font-semibold">{u.username}</td>
                <td className="text-slate-800 font-bold">{u.roles.join(', ')}</td>
                <td><span className={`badge border ${u.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' : 'bg-slate-100 text-slate-700 border-slate-300 font-bold'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing({ id: u.id, username: u.username, password: '', pin: '', full_name: u.full_name, roles: u.roles })} className="btn-ghost-2 h-9 w-9 p-0 flex items-center justify-center rounded-lg" title="Edit"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setResetPin({ id: u.id, full_name: u.full_name })} className="btn-ghost-2 h-9 w-9 p-0 flex items-center justify-center rounded-lg" title="Reset PIN"><KeyRound className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <UserModal form={editing} roles={roles} onSave={save} onClose={() => setEditing(null)} />}
      {resetPin && <ResetPinModal user={resetPin} onClose={() => setResetPin(null)} />}
    </div>
  )
}

function UserModal({ form, roles, onSave, onClose }: { form: UserForm; roles: string[]; onSave: (f: UserForm) => void; onClose: () => void }): React.JSX.Element {
  const [f, setF] = useState<UserForm>(form)
  const set = (patch: Partial<UserForm>) => setF((p) => ({ ...p, ...patch }))
  const isNew = f.id === null

  return (
    <Modal open onClose={onClose} title={isNew ? 'New User' : `Edit ${f.full_name}`} maxWidth="max-w-md" footer={
      <>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => onSave(f)} className="btn-primary">Save</button>
      </>
    }>
      <form onSubmit={(e) => { e.preventDefault(); onSave(f) }} className="space-y-3">
        <div><label className="label">Full Name *</label><input required value={f.full_name} onChange={(e) => set({ full_name: e.target.value })} className="input w-full" /></div>
        <div><label className="label">Username *</label><input required value={f.username} onChange={(e) => set({ username: e.target.value })} className="input w-full" /></div>
        {isNew && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Password *</label><input type="password" required value={f.password} onChange={(e) => set({ password: e.target.value })} className="input w-full" /></div>
            <div><label className="label">PIN (4 digits) *</label><input required value={f.pin} maxLength={4} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '') })} className="input w-full" /></div>
          </div>
        )}
        <div><label className="label">Roles</label>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button key={r} type="button" onClick={() => set({ roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] })} className={`badge cursor-pointer border ${f.roles.includes(r) ? 'bg-brand-600/20 text-brand-300 border-brand-500/40' : 'bg-ink-800 text-slate-400 border-ink-line'}`}>{r}</button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

function ResetPinModal({ user, onClose }: { user: { id: number; full_name: string }; onClose: () => void }): React.JSX.Element {
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (pin.length !== 4) { toastError('PIN must be 4 digits'); return }
    setSaving(true)
    try {
      await window.api.auth.adminResetPin(user.id, pin)
      toastSuccess('PIN reset')
      onClose()
    } catch (e) { toastError('Reset failed', String((e as Error)?.message || e)) } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Reset PIN — ${user.full_name}`} maxWidth="max-w-xs" footer={
      <>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => void submit()} disabled={saving} className="btn-primary">Reset</button>
      </>
    }>
      <label className="label">New 4-digit PIN</label>
      <input value={pin} maxLength={4} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="input w-full text-2xl tracking-widest" autoFocus />
    </Modal>
  )
}
