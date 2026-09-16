import { useEffect, useState } from 'react'
import { Save, Store, Receipt, Users, UserPlus, Pencil, KeyRound, Heart, Coffee, Copy, DatabaseZap, FolderOpen, HardDriveDownload, RotateCcw, Printer, Database, RefreshCw, Loader2, Download, Sparkles, Bluetooth } from 'lucide-react'
import type { BackupInfo, User } from '@shared/types'
import type { DataLocationStatus, PrinterChoice } from '@shared/ipc'
import { printerPick, printerStatusLabel } from '@shared/printer'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { useSettings } from '../stores/settings'
import { toastSuccess, toastError } from '../stores/toast'
import { useUpdate } from '../stores/update'
import { ReceiptPaper } from '../components/ReceiptPaper'

type Tab = 'HOME' | 'RECEIPT' | 'USERS' | 'DATA' | 'ABOUT'

export function Settings({ defaultTab = 'HOME' }: { defaultTab?: Tab }): React.JSX.Element {
  const { load } = useSettings()
  const [tab, setTab] = useState<Tab>(defaultTab)

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6">
      <PageHeader title="Settings" />
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'HOME', icon: Store, label: 'Store' },
          { id: 'RECEIPT', icon: Receipt, label: 'Receipt' },
          { id: 'USERS', icon: Users, label: 'Users' },
          { id: 'DATA', icon: DatabaseZap, label: 'Data' },
          { id: 'ABOUT', icon: Heart, label: 'About' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`shrink-0 flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition ${tab === t.id ? 'border-brand-500/50 bg-brand-600/20 text-brand-300' : 'border-ink-line bg-ink-850 text-slate-300 hover:bg-ink-800 hover:text-white'}`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'HOME' && <StoreSettingsTab />}
      {tab === 'RECEIPT' && <ReceiptSettingsTab />}
      {tab === 'USERS' && <UsersTab />}
      {tab === 'DATA' && <DataTab />}
      {tab === 'ABOUT' && <AboutTab />}
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
    } catch (e) {
      toastError('Database reset failed', String((e as Error)?.message || e))
      setResetting(false)
    }
  }

  const startNewStore = async () => {
    if (newStoreConfirmation !== 'NEW STORE') return
    setResetting(true)
    try { await window.api.backup.startNewStore(newStoreConfirmation) }
    catch (e) { toastError('Start New Store failed', String((e as Error)?.message || e)); setResetting(false) }
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
      <div className="card p-5">
        <h2 className="text-base font-semibold text-slate-100">Database & backups</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data Mode</p><p className="mt-1 font-semibold text-brand-300">{location?.label ?? 'Loading...'}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Database Location</p><p className="mt-1 break-all font-mono text-slate-300">{databaseFile}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Backup Location</p><p className="mt-1 break-all font-mono text-slate-300">{backupDir}</p></div>
          <p className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-300">Moving the TINDA POS executable does not move or reset your store database. Your store data is stored separately for safety.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void window.api.app.openDataDir()} className="btn-ghost flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Open Data Folder</button>
          <button onClick={() => void backupNow()} className="btn-primary flex items-center gap-2"><HardDriveDownload className="h-4 w-4" /> Backup Now</button>
          <button onClick={() => void showRestore()} className="btn-ghost flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Restore Backup</button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-semibold text-slate-100">Data mode</h2>
        <p className="mt-2 text-sm text-slate-400">Shared AppData keeps one safe store database regardless of where the EXE is moved. Portable Data intentionally keeps a separate TindaPOS-Data folder beside the Portable EXE.</p>
        {location?.mode === 'SHARED' ? <button onClick={() => setPortableOpen(true)} disabled={!location?.portableAvailable || resetting} className="btn-ghost mt-4 flex items-center gap-2"><Database className="h-4 w-4" /> Use Portable Data</button> : <button onClick={() => void switchToShared()} disabled={resetting} className="btn-ghost mt-4 flex items-center gap-2"><Database className="h-4 w-4" /> Use Shared AppData</button>}
        {location && !location.portableAvailable && location.mode === 'SHARED' && <p className="mt-2 text-xs text-slate-500">Portable Data can be enabled only when running the Portable edition.</p>}
        {location?.mode === 'PORTABLE' && location.sharedHasData && <p className="mt-2 text-xs text-amber-400">Shared AppData also contains a store. Switching selects it; neither database is overwritten.</p>}
      </div>

      <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-5">
        <h2 className="text-base font-bold text-amber-300">Start New Store</h2>
        <p className="mt-2 text-sm text-slate-300">Creates a fresh store setup while protecting the previous store with a verified safety backup. Existing backup files remain.</p>
        <button onClick={() => setNewStoreOpen(true)} className="btn-ghost mt-4">Start New Store</button>
      </div>

      <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-5">
        <h2 className="text-base font-bold text-red-300">Danger zone — active store database</h2>
        <p className="mt-2 text-sm font-semibold text-red-200">THIS WILL RESET THE ACTIVE STORE DATABASE.</p>
        <p className="mt-1 text-sm text-slate-400">Administrative destructive reset for troubleshooting/reinitialization. Products, sales, users, shifts, and settings will be removed from the active database. A verified safety backup will be created first; if backup creation fails, reset is aborted.</p>
        <button onClick={() => setOpen(true)} className="btn-danger mt-4 flex items-center gap-2"><DatabaseZap className="h-4 w-4" /> Reset Database</button>
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
    </div>
  )
}

function AboutTab(): React.JSX.Element {
  const copyMaya = async () => {
    try {
      await navigator.clipboard.writeText('09912255156')
      toastSuccess('Maya number copied')
    } catch { toastError('Could not copy number') }
  }
  return (
    <div className="max-w-xl space-y-4">
      <SoftwareUpdatePanel />
      <div className="card overflow-hidden">
        <div className="developer-card p-8 text-center">
          <div className="coffee-float relative z-10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop ring-1 ring-white/10"><Coffee className="h-7 w-7" /></div>
          <p className="dev-signature signature-reveal relative z-10 text-3xl italic text-white">Crafted with care</p>
          <p className="mt-1 text-sm text-slate-400">by</p>
          <p className="dev-signature signature-reveal relative z-10 text-2xl font-bold text-brand-300">Dev Francis</p>
          <div className="mx-auto my-5 h-px max-w-xs bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
          <p className="text-sm text-slate-300">TINDA POS is free. If it helps your store, you may support the developer with a small coffee donation.</p>
          <button onClick={() => void copyMaya()} className="donation-card mx-auto mt-4 flex items-center gap-3 rounded-xl px-5 py-3 text-left">
            <div className="maya-logo-shell flex h-11 w-20 shrink-0 items-center justify-center rounded-xl bg-white shadow-card"><MayaMark /></div>
            <span><span className="dev-signature block text-base font-bold text-brand-300">Buy me a coffee</span><span className="font-mono text-lg font-bold tracking-wider text-white">0991 225 5156</span><span className="block text-[9px] uppercase tracking-[0.18em] text-slate-500">Maya · tap to copy</span></span>
            <Copy className="ml-2 h-4 w-4 text-slate-400" />
          </button>
          <p className="mt-3 text-[10px] text-slate-600">Donations are optional and do not unlock any features.</p>
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
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Download className="h-4 w-4 text-brand-400" /> Software Update</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${event.status === 'ERROR' || event.status === 'OFFLINE' || event.status === 'UNABLE_TO_CHECK' ? 'bg-red-500/15 text-red-300' : event.status === 'CHECKING' || event.status === 'DOWNLOADING' ? 'bg-brand-500/15 text-brand-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{label}</span>
      </div>
      <div className="space-y-1 text-sm text-slate-300">
        <p>Installed version: <span className="font-mono text-white">v{installed}</span></p>
        {available && <p>Available version: <span className="font-mono text-white">v{available}</span></p>}
        {event.lastCheckedAt && <p className="text-xs text-slate-500">Last checked: {new Date(event.lastCheckedAt).toLocaleString()}</p>}
        {note && <p className="pt-1 text-xs text-slate-400">{note}</p>}
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
        <div className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2">
          <div>
            <p className="text-sm text-slate-200">Allow negative stock</p>
            <p className="text-xs text-slate-500">Let sales go below zero stock</p>
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
    <div className="card max-w-xl p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2"><div><p className="text-sm text-slate-200">Show TINDA POS App Name</p><p className="text-xs text-slate-500">Turn this off to remove TINDA POS from the receipt heading.</p></div><Toggle on={f.receipt_show_app_name} onClick={() => set({receipt_show_app_name: !f.receipt_show_app_name})}/></div>
        <div><label className="label">Receipt Title</label><input value={f.receipt_title} onChange={e=>set({receipt_title:e.target.value})} placeholder="JUAN STORE" className="input w-full"/></div>
        <div><label className="label">Receipt Header (shown on top)</label><textarea value={f.receipt_header} onChange={(e) => set({ receipt_header: e.target.value })} rows={2} className="input w-full" /></div>
        <div><label className="label">Receipt Footer (message at bottom)</label><textarea value={f.receipt_footer} onChange={(e) => set({ receipt_footer: e.target.value })} rows={2} className="input w-full" /></div>
        <div>
          <label className="label">Printer</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto mb-2 pr-1">
            <button
               type="button"
               onClick={() => set({ receipt_printer: '' })}
               className={`flex text-left flex-col items-start rounded-lg border p-3 transition ${!f.receipt_printer ? 'border-brand-500 bg-brand-500/10' : 'border-ink-line bg-ink-850 hover:bg-ink-800'}`}
            >
              <span className={`font-semibold ${!f.receipt_printer ? 'text-brand-300' : 'text-slate-300'}`}>None</span>
              <span className="text-xs text-slate-500 mt-0.5">Disable receipt printing</span>
            </button>
            {printers.map(p => (
               <button
                 key={p.name}
                 type="button"
                 onClick={() => set({ receipt_printer: p.name })}
                 className={`flex text-left flex-col items-start rounded-lg border p-3 transition ${f.receipt_printer === p.name ? 'border-brand-500 bg-brand-500/10' : 'border-ink-line bg-ink-850 hover:bg-ink-800'}`}
               >
                 <span className={`font-semibold line-clamp-1 ${f.receipt_printer === p.name ? 'text-brand-300' : 'text-slate-300'}`}>{p.displayName}</span>
                 <span className="text-xs text-slate-500 mt-0.5">{p.isDefault ? 'System Default' : p.name}</span>
               </button>
            ))}
            {pick.status === 'UNAVAILABLE' && (
               <button type="button" className="flex text-left flex-col items-start rounded-lg border border-brand-500 bg-brand-500/10 p-3">
                 <span className="font-semibold text-brand-300 line-clamp-1">{pick.name}</span>
                 <span className="text-xs text-amber-400 mt-0.5">Currently unavailable</span>
               </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-line px-3 py-2">
          <div>
            <p className="text-sm text-slate-200">Status: <span className={`font-semibold ${pick.status === 'READY' ? 'text-emerald-400' : pick.status === 'UNAVAILABLE' ? 'text-amber-400' : 'text-slate-400'}`}>{printerStatusLabel(pick.status)}</span></p>
            <p className="text-xs text-slate-500">Ready when selected printer is paired or available.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void window.api.printer.openBluetoothSettings?.()} className="btn-ghost flex items-center gap-1.5 text-xs text-brand-300"><Bluetooth className="h-3.5 w-3.5" /> Pair Bluetooth</button>
            <button type="button" onClick={() => void loadPrinters()} disabled={refreshing} className="btn-ghost flex items-center gap-1.5 text-xs">{refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh</button>
          </div>
        </div>
        {pick.status === 'UNAVAILABLE' && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">Selected receipt printer is unavailable: <span className="font-mono">{pick.name}</span>. Check if Bluetooth is turned on and paired, then press Refresh. Sales are never blocked or rolled back.</p>}
        {pick.status === 'NOT_CONFIGURED' && printers.length === 0 && <p className="rounded-lg border border-ink-line bg-ink-900 px-3 py-2 text-xs text-slate-400">No receipt printer configured. Select Android System Print (WiFi / PDF) or pair a Bluetooth thermal receipt printer (58mm/80mm), then press Refresh.</p>}
        <div className="flex items-center justify-between rounded-lg border border-ink-line px-3 py-2"><div><p className="text-sm text-slate-200">Auto Print After Sale</p><p className="text-xs text-slate-500">One silent print job, sent immediately after the sale commits.</p></div><Toggle on={f.auto_print_after_sale} onClick={() => set({ auto_print_after_sale: !f.auto_print_after_sale })} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Paper Width</label><select value={f.receipt_paper_width} onChange={(e) => set({ receipt_paper_width: e.target.value as '58mm' | '80mm' })} className="input w-full"><option value="58mm">58mm (portable thermal)</option><option value="80mm">80mm (standard desktop)</option></select></div><div><label className="label">Copies</label><input type="number" min={1} max={3} value={f.receipt_copies} onChange={(e) => set({ receipt_copies: Math.max(1, Math.min(3, Math.trunc(Number(e.target.value) || 1))) })} className="input w-full" /></div></div>
        <div><p className="label">Live Receipt Preview</p><ReceiptPaper width={f.receipt_paper_width} lines={[...f.receipt_header.trim().split(/\r?\n/).filter(Boolean), ...(f.receipt_title.trim() ? [f.receipt_title.trim()] : []), ...(f.receipt_show_app_name && f.receipt_title.trim().toUpperCase() !== 'TINDA POS' ? ['TINDA POS'] : []), settings?.store_name || 'My Sari-Sari Store','--------------------------------','TPOS-PREVIEW','1 x Sample Item        10.00','TOTAL                  10.00','--------------------------------',f.receipt_footer || 'Salamat po!']}/></div>
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
            <div key={u.id} className="card p-4 flex flex-col gap-2">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-white">{u.full_name}</p>
                    <p className="text-sm text-slate-400">@{u.username}</p>
                  </div>
                  <div><span className={`badge ${u.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></div>
               </div>
               <p className="text-xs text-slate-500 uppercase tracking-wide">{u.roles.join(', ')}</p>
               <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setEditing({ id: u.id, username: u.username, password: '', pin: '', full_name: u.full_name, roles: u.roles })} className="btn-ghost-2 h-10 w-10 p-0 flex items-center justify-center rounded-lg" title="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setResetPin({ id: u.id, full_name: u.full_name })} className="btn-ghost-2 h-10 w-10 p-0 flex items-center justify-center rounded-lg" title="Reset PIN"><KeyRound className="h-4 w-4" /></button>
               </div>
            </div>
         ))}
      </div>
      <div className="hidden md:block card overflow-hidden">
        <table className="table">
          <thead><tr><th>User</th><th>Username</th><th>Roles</th><th>Status</th><th className="w-28 text-right">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-slate-200">{u.full_name}</td>
                <td className="text-slate-400">{u.username}</td>
                <td className="text-slate-300">{u.roles.join(', ')}</td>
                <td><span className={`badge ${u.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
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
