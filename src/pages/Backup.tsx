import { useEffect, useState } from 'react'
import { Plus, RotateCcw, FolderOpen, HardDriveDownload, Cloud, Save, Download, Share2 } from 'lucide-react'
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
        <h1 className="text-xl font-black text-white">Backup & Restore</h1>
        <p className="text-xs text-slate-400">Your data is stored offline on this device.</p>
      </div>

      <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-950/40 via-ink-900/60 to-ink-900/80 p-3.5 space-y-1.5 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/20 text-brand-400">
            <Share2 className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-bold text-white tracking-wide uppercase">Universal Cross-Platform Backup</span>
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Windows &amp; Android
          </span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Backups created here (<code className="text-brand-300 font-mono text-[10px]">.tinda-backup</code>) can be restored directly on Windows PC TINDA POS, and Windows backups can be imported here seamlessly without losing sales, products, or user roles.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={() => void create()} disabled={busy} className="btn-primary flex items-center justify-center gap-1.5 py-2.5 text-xs rounded-xl">
          <Plus className="h-4 w-4" /> Back Up Now
        </button>
        <button onClick={() => void shareUniversal()} disabled={busy} className="btn-ghost flex items-center justify-center gap-1.5 py-2.5 text-xs rounded-xl border border-brand-500/40 text-brand-300 bg-brand-500/10 active:scale-95 transition">
          <Share2 className="h-4 w-4" /> Share Backup
        </button>
        <button onClick={() => void exportUniversal()} disabled={busy} className="btn-ghost flex items-center justify-center gap-1.5 py-2.5 text-xs rounded-xl border border-ink-line">
          <Download className="h-4 w-4" /> Export File
        </button>
        <label className="btn-ghost flex cursor-pointer items-center justify-center gap-1.5 py-2.5 text-xs rounded-xl border border-ink-line">
          <Save className="h-4 w-4" /> Import File
          <input type="file" accept=".tinda-backup,application/json" className="hidden" onChange={onPickFile} />
        </label>
      </div>

      {settings && (
        <div className="card max-w-3xl p-4">
          <div className="mb-3 flex items-start gap-3">
            <Cloud className="mt-0.5 h-5 w-5 text-brand-400" />
            <div>
              <p className="font-semibold text-slate-100">Automatic online backup</p>
              <p className="text-xs text-slate-500">Choose a folder inside OneDrive, Google Drive for desktop, or Dropbox. TINDA POS copies backups there and the sync app uploads them whenever internet is available.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input readOnly value={settings.backup_location} placeholder="No synced folder selected" className="input min-w-72 flex-1 text-xs" />
            <button onClick={() => void chooseSyncFolder()} disabled={busy} className="btn-ghost text-xs"><FolderOpen className="mr-1 inline h-4 w-4" /> Choose Folder</button>
            {settings.backup_location && <button onClick={() => void window.api.backup.openSyncFolder()} className="btn-ghost text-xs">Open</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.auto_backup_enabled} onChange={(e) => setSettings({ ...settings, auto_backup_enabled: e.target.checked })} /> Enable synced backups</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.auto_backup_daily} onChange={(e) => setSettings({ ...settings, auto_backup_daily: e.target.checked })} /> Daily on app start</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.auto_backup_on_exit} onChange={(e) => setSettings({ ...settings, auto_backup_on_exit: e.target.checked })} /> On app exit</label>
          </div>
          <button onClick={() => void saveSyncSettings()} disabled={busy} className="btn-primary mt-3 flex items-center gap-2 text-xs py-2"><Save className="h-4 w-4" /> Save Backup Settings</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-14 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No backups yet" message="Create your first backup to protect your data." action={<button onClick={() => void create()} className="btn-primary"><Plus className="mr-1 inline h-4 w-4" /> Back Up Now</button>} icon={<HardDriveDownload className="h-7 w-7" />} />
      ) : (
        <>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
            <span className="font-semibold">{rows.length} backups</span>
            {rows[0] && <span>latest {shortDateTime(rows[0].created_at)}</span>}
          </div>
          <div className="space-y-2">
            {rows.map((b) => {
              const isUniversal = b.filename.endsWith('.tinda-backup')
              return (
                <div key={b.filename} className="card p-3 flex items-center justify-between gap-2.5 hover:border-ink-600 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-white text-xs truncate max-w-[200px] sm:max-w-xs">{b.filename}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${isUniversal ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'bg-ink-700 text-slate-400'}`}>
                        {isUniversal ? 'Universal' : 'Legacy JSON'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
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
                      className="p-1.5 rounded-lg border border-ink-line text-slate-300 hover:text-white hover:bg-ink-700 active:scale-95 transition"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirm(b)}
                      disabled={busy}
                      className="btn-ghost-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-brand-300 border border-brand-500/30"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={() => void window.api.backup.openFolder()} className="btn-ghost flex items-center gap-2 text-xs"><FolderOpen className="h-4 w-4" /> Open backup folder</button>
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
