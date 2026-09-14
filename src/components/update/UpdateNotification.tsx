import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download, X, FolderOpen, RotateCcw, Sparkles, Loader2 } from 'lucide-react'
import type { UpdateStatusEvent } from '@shared/update'
import { useUpdate } from '../../stores/update'

const IS_ANDROID = Capacitor.getPlatform() === 'android'

/**
 * Non-intrusive update notification. Appears only when action is actually
 * needed (update available / downloading / ready / error), and never
 * interrupts checkout or any other screen flow.
 */
export function UpdateNotification(): React.JSX.Element | null {
  const { event, download, install, dismiss } = useUpdate()
  const [busy, setBusy] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  if (!event) return null

  const s = event.status
  const visible: UpdateStatusEvent['status'][] = ['UPDATE_AVAILABLE', 'DOWNLOADING', 'DOWNLOADED', 'READY_TO_INSTALL', 'ERROR']
  if (!visible.includes(s)) return null

  const version = event.available?.version ?? ''
  const banner = s === 'ERROR' ? (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
      <span className="mt-0.5 shrink-0"><X className="h-4 w-4" /></span>
      <div>
        <p className="font-semibold text-red-200">Update problem</p>
        <p className="mt-0.5 text-red-300/90">{event.message}</p>
      </div>
    </div>
  ) : (
    <div className="flex items-start gap-2 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-sm">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">
          {s === 'UPDATE_AVAILABLE' && <>Update available · v{version}</>}
          {s === 'DOWNLOADING' && <>Downloading update… v{version}</>}
          {s === 'DOWNLOADED' && <>Update download complete</>}
          {s === 'READY_TO_INSTALL' && <>Update ready to install · v{version}</>}
        </p>
        <p className="mt-0.5 text-slate-300">
          {IS_ANDROID
            ? 'Your sales data stays on this device — the update installs over the current app.'
            : event.portable
              ? 'TINDA POS runs from this folder, so it cannot replace itself. Download the new version and run it from its own folder.'
              : 'Your store data stays safe in AppData and is backed up before updating.'}
        </p>
        {s === 'DOWNLOADING' && event.progress && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${event.progress.percent}%` }} />
          </div>
        )}
        {s === 'DOWNLOADING' && event.progress && event.progress.total > 0 && (
          <p className="mt-1 text-xs text-slate-400">{event.progress.percent}%</p>
        )}
        {installError && <p className="mt-1 text-xs text-amber-300">{installError}</p>}
        {s === 'READY_TO_INSTALL' && event.message && <p className="mt-1 text-xs text-slate-300">{event.message}</p>}
        {showNotes && event.available && (
          <div className="mt-3 max-h-44 overflow-y-auto rounded-lg bg-ink-900/70 p-3 text-xs leading-relaxed text-slate-300">
            <p className="mb-1 font-semibold text-white">What&apos;s New in v{event.available.version}</p>
            <pre className="whitespace-pre-wrap font-sans">{event.available.releaseNotes}</pre>
          </div>
        )}
      </div>
      <button onClick={() => void dismiss()} className="rounded p-1 text-slate-500 hover:bg-ink-700 hover:text-white" aria-label="Close">
        <X className="h-4 w-4" />
      </button>
    </div>
  )

  const actions: React.JSX.Element[] = []
  if (s === 'UPDATE_AVAILABLE') {
    actions.push(
      <button key="notes" onClick={() => setShowNotes((v) => !v)} className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs">
        <Sparkles className="h-3.5 w-3.5" /> {showNotes ? 'Hide notes' : "What's New"}
      </button>,
      <button key="download" onClick={() => { setInstallError(null); setBusy(true); void download().finally(() => setBusy(false)) }} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs" disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download Update
      </button>,
      <button key="later" onClick={() => void dismiss()} className="btn-ghost px-3 py-1.5 text-xs">Later</button>
    )
  } else if (s === 'ERROR' && event.available) {
    actions.push(
      <button key="retry" onClick={() => { setInstallError(null); setBusy(true); void download().finally(() => setBusy(false)) }} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs" disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Retry Download
      </button>
    )
  } else if (s === 'DOWNLOADED') {
    actions.push(
      <button key="install" onClick={() => { void install() }} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
        {IS_ANDROID ? <Download className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />} {IS_ANDROID ? 'Install Update' : 'Show in folder'}
      </button>,
      <button key="done" onClick={() => void dismiss()} className="btn-ghost px-3 py-1.5 text-xs">Done</button>
    )
  } else if (s === 'READY_TO_INSTALL') {
    actions.push(
      <button key="restart" onClick={() => { setInstallError(null); setBusy(true); void install().catch(() => { setInstallError('Please finish the current operation before installing the update.') }).finally(() => setBusy(false)) }} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs" disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} {IS_ANDROID ? 'Install Update' : 'Restart & Install'}
      </button>,
      <button key="later" onClick={() => void dismiss()} className="btn-ghost px-3 py-1.5 text-xs">Install Later</button>
    )
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <div className="pointer-events-auto card space-y-3 border border-brand-500/20 p-3 shadow-pop">
        {banner}
        {actions.length > 0 && <div className="flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  )
}
