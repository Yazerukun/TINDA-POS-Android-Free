import { useEffect, useState } from 'react'
import { Plus, RotateCcw, FolderOpen, HardDriveDownload, Cloud, Save } from 'lucide-react'
import type { BackupInfo, StoreSettings } from '@shared/types'
import { shortDateTime } from '@shared/format'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { toastSuccess, toastError } from '../stores/toast'

export function Backup(): React.JSX.Element {
  const [rows, setRows] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<BackupInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState<StoreSettings | null>(null)

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

  return (
    <div className="p-6">
      <PageHeader
        title="Backup & Restore"
        subtitle="Your data is stored offline on this computer."
        actions={
          <button onClick={() => void create()} disabled={busy} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Back Up Now</button>
        }
      />

      {settings && (
        <div className="card mb-4 max-w-3xl p-4">
          <div className="mb-3 flex items-start gap-3">
            <Cloud className="mt-0.5 h-5 w-5 text-brand-400" />
            <div>
              <p className="font-semibold text-slate-100">Automatic online backup</p>
              <p className="text-xs text-slate-500">Choose a folder inside OneDrive, Google Drive for desktop, or Dropbox. TINDA POS copies backups there and the Windows sync app uploads them whenever internet is available.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input readOnly value={settings.backup_location} placeholder="No synced folder selected" className="input min-w-72 flex-1" />
            <button onClick={() => void chooseSyncFolder()} disabled={busy} className="btn-ghost"><FolderOpen className="mr-1 inline h-4 w-4" /> Choose Folder</button>
            {settings.backup_location && <button onClick={() => void window.api.backup.openSyncFolder()} className="btn-ghost">Open</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.auto_backup_enabled} onChange={(e) => setSettings({ ...settings, auto_backup_enabled: e.target.checked })} /> Enable synced backups</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.auto_backup_daily} onChange={(e) => setSettings({ ...settings, auto_backup_daily: e.target.checked })} /> Daily on app start</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.auto_backup_on_exit} onChange={(e) => setSettings({ ...settings, auto_backup_on_exit: e.target.checked })} /> On app exit</label>
          </div>
          <button onClick={() => void saveSyncSettings()} disabled={busy} className="btn-primary mt-3 flex items-center gap-2"><Save className="h-4 w-4" /> Save Backup Settings</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-14 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No backups yet" message="Create your first backup to protect your data." action={<button onClick={() => void create()} className="btn-primary"><Plus className="mr-1 inline h-4 w-4" /> Back Up Now</button>} icon={<HardDriveDownload className="h-7 w-7" />} />
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <span className="font-semibold">{rows.length} backups</span>{rows[0] && <> · latest {shortDateTime(rows[0].created_at)}</>}
          </div>
          <div className="card overflow-hidden">
            <table className="table">
              <thead><tr><th>Filename</th><th>Date</th><th>Size</th><th>Type</th><th className="w-40">Actions</th></tr></thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.filename}>
                    <td className="font-medium text-slate-200">{b.filename}</td>
                    <td className="text-slate-400">{shortDateTime(b.created_at)}</td>
                    <td className="text-slate-400">{formatBytes(b.size)}</td>
                    <td><span className="badge bg-ink-700 text-slate-300">manual</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => setConfirm(b)} className="btn-ghost-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => void window.api.backup.openFolder()} className="btn-ghost mt-3 flex items-center gap-2 text-xs"><FolderOpen className="h-4 w-4" /> Open backup folder</button>
        </>
      )}

      {confirm && (
        <Modal open onClose={() => setConfirm(null)} title="Restore Backup" maxWidth="max-w-sm" footer={
          <>
            <button onClick={() => setConfirm(null)} className="btn-ghost">Cancel</button>
            <button onClick={() => void restore(confirm)} disabled={busy} className="btn-danger">Restore</button>
          </>
        }>
          <p className="text-sm text-amber-400">Restoring will overwrite current data with the backup from {shortDateTime(confirm.created_at)}. A safety backup will be made first, then TINDA POS will restart automatically.</p>
        </Modal>
      )}
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
