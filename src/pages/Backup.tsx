import { useEffect, useState } from 'react'
import { Plus, RotateCcw, FolderOpen, HardDriveDownload, Cloud, Save, Download, Share2, Database } from 'lucide-react'
import type { BackupInfo, StoreSettings } from '@shared/types'
import { shortDateTime } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { DesktopMigrationModal } from '../components/DesktopMigrationModal'
import { toastSuccess, toastError } from '../stores/toast'

export function Backup(): React.JSX.Element {
  const [rows, setRows] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<BackupInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [migrationModalOpen, setMigrationModalOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [backups, currentSettings] = await Promise.all([window.api.backup.list(), window.api.settings.get()])
      setRows(backups)
      setSettings(currentSettings)
    } catch (e) { toastError('Failed to load backups', String((e as Error)?.message || e)) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const create = async () => {
    setBusy(true)
    try {
      const b = await window.api.backup.create('manual')
      toastSuccess('Backup created', b.filename)
      void load()
    } catch (e) { toastError('Backup failed', String((e as Error)?.message || e)) } finally { setBusy(false) }
  }

  const restore = async (b: BackupInfo) => {
    setBusy(true)
    try {
      await window.api.backup.restore(b.filename)
      toastSuccess('Backup restored', 'TINDA POS is restarting...')
      setConfirm(null)
    } catch (e) { toastError('Restore failed', String((e as Error)?.message || e)) } finally { setBusy(false) }
  }

  const chooseSyncFolder = async () => {
    const folder = await window.api.backup.selectSyncFolder()
    if (folder) setSettings((current) => current ? { ...current, backup_location: folder } : current)
  }

  const saveSyncSettings = async () => {
    if (!settings) return
    setBusy(true)
    try {
      const updated = await window.api.settings.update({
        backup_location: settings.backup_location,
        auto_backup_enabled: settings.auto_backup_enabled,
        auto_backup_daily: settings.auto_backup_daily,
        auto_backup_on_exit: settings.auto_backup_on_exit
      })
      setSettings(updated)
      toastSuccess('Backup settings saved')
    } catch (e) { toastError('Save failed', String((e as Error)?.message || e)) } finally { setBusy(false) }
  }

  const exportUniversal = async () => {
    setBusy(true)
    try {
      const text = await window.api.backup.exportTinda()
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `tinda-pos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.tinda-backup`
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toastSuccess('Universal backup exported', 'Saved backup file successfully.')
    } catch (e) { toastError('Export failed', String((e as Error)?.message || e)) } finally { setBusy(false) }
  }

  const shareUniversal = async () => {
    setBusy(true)
    try {
      const text = await window.api.backup.exportTinda()
      const filename = `tinda-pos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.tinda-backup`
      const blob = new Blob([text], { type: 'application/json' })
      const file = new File([blob], filename, { type: 'application/json' })

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'TINDA POS Backup',
          text: 'TINDA POS Universal Backup File',
          files: [file]
        })
        toastSuccess('Backup shared successfully')
      } else {
        await exportUniversal()
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        toastError('Share failed', String((e as Error)?.message || e))
      }
    } finally {
      setBusy(false)
    }
  }

  const shareBackupItem = async (b: BackupInfo) => {
    setBusy(true)
    try {
      let payload = ''
      if (window.api.backup.getPayload) {
        payload = (await window.api.backup.getPayload(b.filename)) || ''
      }
      if (!payload) {
        toastError('Cannot share', 'Backup file payload not found.')
        return
      }
      const blob = new Blob([payload], { type: 'application/json' })
      const file = new File([blob], b.filename, { type: 'application/json' })

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'TINDA POS Backup',
          text: `TINDA POS Backup: ${b.filename}`,
          files: [file]
        })
      } else {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = b.filename
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
        toastSuccess('Backup file downloaded', b.filename)
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        toastError('Share failed', String((e as Error)?.message || e))
      }
    } finally {
      setBusy(false)
    }
  }

  const importUniversal = async (text: string, filename: string) => {
    if (!window.confirm(`Import ${filename}? The store data is replaced by the backup (a safety device backup is saved first).`)) return
    setBusy(true)
    try {
      const { counts } = (await window.api.backup.importTinda(text)) as { counts: Record<string, number> }
      toastSuccess('Universal backup imported', `Restored ${Object.values(counts).reduce((a, b) => a + b, 0)} rows.`)
      void load()
    } catch (e) { toastError('Import failed', String((e as Error)?.message || e)) } finally { setBusy(false) }
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void file.text().then((text) => importUniversal(text, file.name)).catch((e) => toastError('Import failed', String(e)))
  }

  return (
    <div className="px-4 pt-3 pb-8 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-black text-slate-950">Backup &amp; Restore</h1>
        <p className="text-xs font-bold text-slate-600">Your data is stored offline on this device.</p>
      </div>

      {/* Desktop Migration Card */}
      <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shrink-0">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-950 tracking-tight">Import Desktop Database</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  SQLite &amp; Backup
                </span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-medium mt-0.5">
                Migrate directly from Windows PC <code className="text-emerald-800 font-bold font-mono">tindapos.db</code> SQLite or <code className="text-emerald-800 font-bold font-mono">.tinda-backup</code>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setMigrationModalOpen(true)}
            disabled={busy}
            className="btn-primary py-2.5 px-3.5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shrink-0 shadow-md transition active:scale-95"
          >
            <Database className="h-4 w-4" /> Import DB
          </button>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-slate-200 bg-white p-3.5 space-y-1.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Share2 className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-black text-slate-950 tracking-wide uppercase">Universal Cross-Platform Backup</span>
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            Windows &amp; Android
          </span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
          Backups created here (<code className="text-emerald-800 font-mono font-bold text-[10px]">.tinda-backup</code>) can be restored directly on Windows PC TINDA POS, and Windows backups can be imported here seamlessly without losing sales, products, or user roles.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={() => void create()} disabled={busy} className="btn-primary flex items-center justify-center gap-1.5 py-2.5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
          <Plus className="h-4 w-4" /> Back Up Now
        </button>
        <button onClick={() => void shareUniversal()} disabled={busy} className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl border-2 border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:scale-95 transition shadow-xs">
          <Share2 className="h-4 w-4 text-emerald-600" /> Share Backup
        </button>
        <button onClick={() => void exportUniversal()} disabled={busy} className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl border-2 border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:scale-95 transition shadow-xs">
          <Download className="h-4 w-4 text-slate-600" /> Export File
        </button>
        <label className="flex cursor-pointer items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl border-2 border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:scale-95 transition shadow-xs">
          <Save className="h-4 w-4 text-slate-600" /> Import File
          <input type="file" accept=".db,.sqlite,.sqlite3,.tinda-backup,application/json" className="hidden" onChange={onPickFile} />
        </label>
      </div>

      {settings && (
        <div className="card max-w-3xl p-4 border-2 border-slate-200 bg-white shadow-sm rounded-2xl">
          <div className="mb-3 flex items-start gap-3">
            <Cloud className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-black text-slate-950 text-sm">Automatic online backup</p>
              <p className="text-xs text-slate-600 font-medium">Choose a folder inside OneDrive, Google Drive for desktop, or Dropbox. TINDA POS copies backups there and the sync app uploads them whenever internet is available.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input readOnly value={settings.backup_location} placeholder="No synced folder selected" className="input min-w-72 flex-1 text-xs border-2 border-slate-200 bg-slate-50 text-slate-900 font-mono" />
            <button onClick={() => void chooseSyncFolder()} disabled={busy} className="btn-ghost text-xs border-2 border-slate-200 font-bold text-slate-800"><FolderOpen className="mr-1 inline h-4 w-4" /> Choose Folder</button>
            {settings.backup_location && <button onClick={() => void window.api.backup.openSyncFolder()} className="btn-ghost text-xs border-2 border-slate-200 font-bold text-slate-800">Open</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-800">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.auto_backup_enabled} onChange={(e) => setSettings({ ...settings, auto_backup_enabled: e.target.checked })} className="rounded text-emerald-600" /> Enable synced backups</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.auto_backup_daily} onChange={(e) => setSettings({ ...settings, auto_backup_daily: e.target.checked })} className="rounded text-emerald-600" /> Daily on app start</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.auto_backup_on_exit} onChange={(e) => setSettings({ ...settings, auto_backup_on_exit: e.target.checked })} className="rounded text-emerald-600" /> On app exit</label>
          </div>
          <button onClick={() => void saveSyncSettings()} disabled={busy} className="btn-primary mt-3 flex items-center gap-2 text-xs font-black py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"><Save className="h-4 w-4" /> Save Backup Settings</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-14 animate-pulse bg-slate-100 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No backups yet" message="Create your first backup to protect your data." action={<button onClick={() => void create()} className="btn-primary bg-emerald-600 text-white font-black"><Plus className="mr-1 inline h-4 w-4" /> Back Up Now</button>} icon={<HardDriveDownload className="h-7 w-7 text-emerald-600" />} />
      ) : (
        <>
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between font-bold">
            <span className="font-black">{rows.length} backups saved</span>
            {rows[0] && <span className="text-emerald-800">Latest: {shortDateTime(rows[0].created_at)}</span>}
          </div>
          <div className="space-y-2">
            {rows.map((b) => {
              const isUniversal = b.filename.endsWith('.tinda-backup')
              return (
                <div key={b.filename} className="bg-white border-2 border-slate-200 hover:border-emerald-500 p-3.5 rounded-2xl flex items-center justify-between gap-2.5 transition-colors shadow-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-black text-slate-950 text-xs truncate max-w-[200px] sm:max-w-xs">{b.filename}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${isUniversal ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700'}`}>
                        {isUniversal ? 'Universal' : 'Legacy JSON'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 font-semibold mt-1">
                      <span>{shortDateTime(b.created_at)}</span>
                      <span>·</span>
                      <span>{formatBytes(b.size)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => void shareBackupItem(b)}
                      disabled={busy}
                      title="Share or Download file"
                      className="p-2 rounded-xl border-2 border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100 active:scale-95 transition"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirm(b)}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-600" /> Restore
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={() => void window.api.backup.openFolder()} className="btn-ghost flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-950"><FolderOpen className="h-4 w-4" /> Open backup folder</button>
        </>
      )}

      {confirm && (
        <Modal open onClose={() => setConfirm(null)} title="Restore Backup" maxWidth="max-w-sm" footer={
          <>
            <button onClick={() => setConfirm(null)} className="btn-ghost">Cancel</button>
            <button onClick={() => void restore(confirm)} disabled={busy} className="btn-danger">Restore</button>
          </>
        }>
          <p className="text-sm font-semibold text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">Restoring will overwrite current data with the backup from {shortDateTime(confirm.created_at)}. A safety backup will be made first, then TINDA POS will restart automatically.</p>
        </Modal>
      )}

      <DesktopMigrationModal
        open={migrationModalOpen}
        onClose={() => setMigrationModalOpen(false)}
        onSuccess={() => void load()}
      />
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(1)} ${units[i]}`
}
