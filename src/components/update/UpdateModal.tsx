import { useState } from 'react'
import {
  Download,
  X,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  HardDrive
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useUpdate } from '../../stores/update'
import { APP_VERSION } from '../../data/system'
import { Capacitor } from '@capacitor/core'
import tindaIcon from '../../assets/tinda-icon.png'

const IS_ANDROID = Capacitor.getPlatform() === 'android'

export function UpdateModal(): React.JSX.Element | null {
  const { event, modalOpen, setModalOpen, check, download, install } = useUpdate()
  const [busy, setBusy] = useState(false)
  const [showNotes, setShowNotes] = useState(true)

  const status = event?.status ?? 'IDLE'
  const installed = event?.installedVersion ?? APP_VERSION
  const available = event?.available?.version ?? null
  const notes = event?.available?.releaseNotes ?? ''
  const isAvailable = status === 'UPDATE_AVAILABLE' && Boolean(available)
  const isDownloading = status === 'DOWNLOADING'
  const isReady = status === 'DOWNLOADED' || status === 'READY_TO_INSTALL'
  const isChecking = status === 'CHECKING'
  const isError = status === 'ERROR' || status === 'UNABLE_TO_CHECK' || status === 'OFFLINE'
  const isUpToDate = status === 'UP_TO_DATE' || (!isAvailable && !isDownloading && !isReady && !isChecking && !isError)

  const handleCheck = async () => {
    setBusy(true)
    try {
      await check(true)
    } catch (e) {
      console.error('Check update error:', e)
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = async () => {
    setBusy(true)
    try {
      await download()
    } catch (e) {
      console.error('Download update error:', e)
    } finally {
      setBusy(false)
    }
  }

  const handleInstall = async () => {
    setBusy(true)
    try {
      await install()
    } catch (e) {
      console.error('Install update error:', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title="Software Update"
      maxWidth="max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="btn-ghost text-xs"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {isUpToDate && (
              <button
                type="button"
                onClick={() => void handleCheck()}
                disabled={busy || isChecking}
                className="btn-primary flex items-center gap-1.5 text-xs"
              >
                {busy || isChecking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>Check for Updates</span>
              </button>
            )}

            {isError && (
              <button
                type="button"
                onClick={() => void handleCheck()}
                disabled={busy || isChecking}
                className="btn-primary flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Check</span>
              </button>
            )}

            {isAvailable && (
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={busy || isDownloading}
                className="btn-primary flex items-center gap-1.5 text-xs shadow-md shadow-brand-500/20"
              >
                {busy || isDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Download Update</span>
              </button>
            )}

            {isReady && (
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={busy}
                className="btn-primary flex items-center gap-1.5 text-xs shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-500"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Install Update</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* App Version Header Banner */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-ink-line/80 bg-ink-900/90 p-4 shadow-sm">
          <img
            src={tindaIcon}
            alt="TINDA POS"
            className="h-11 w-11 shrink-0 rounded-xl object-contain drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white tracking-tight">TINDA POS Free for Android</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Installed Version: <span className="font-mono font-semibold text-emerald-400">v{installed}</span>
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-ink-line bg-ink-950 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
            {IS_ANDROID ? 'Android' : 'Web/PWA'}
          </span>
        </div>

        {/* State 1: Checking for Updates */}
        {isChecking && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-500/5 p-6 text-center space-y-2">
            <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
            <p className="text-sm font-bold text-white">Checking for Updates…</p>
            <p className="text-xs text-slate-400">Connecting to the official GitHub release channel</p>
          </div>
        )}

        {/* State 2: Update Available */}
        {isAvailable && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-brand-500/35 bg-gradient-to-br from-brand-950/40 via-ink-900 to-ink-950 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/20 border border-brand-500/35 px-2.5 py-0.5 text-xs font-bold text-brand-300">
                  <Sparkles className="h-3 w-3" /> New Version Available: v{available}
                </span>
                {event?.available?.publishedAt && (
                  <span className="text-[11px] text-slate-400">
                    {new Date(event.available.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                A new update has been released with improvements and bug fixes. Updating will keep all your existing sales, customers, and inventory completely intact.
              </p>
            </div>

            {/* Release Notes */}
            {notes && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    What&apos;s New in v{available}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNotes((v) => !v)}
                    className="text-[11px] text-brand-400 hover:text-brand-300 transition"
                  >
                    {showNotes ? 'Collapse Notes' : 'Show Notes'}
                  </button>
                </div>

                {showNotes && (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-ink-line/80 bg-ink-950/90 p-3 text-xs leading-relaxed text-slate-300 font-sans whitespace-pre-wrap no-scrollbar">
                    {notes}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* State 3: Downloading Progress */}
        {isDownloading && (
          <div className="rounded-2xl border border-brand-500/30 bg-ink-900/90 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 text-brand-400 animate-spin" />
                Downloading Update…
              </span>
              <span className="font-mono text-brand-400 font-bold">
                {event?.progress?.percent ?? 0}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${event?.progress?.percent ?? 0}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400">
              Please wait while the release package is downloaded to your device storage.
            </p>
          </div>
        )}

        {/* State 4: Ready to Install */}
        {isReady && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Update Ready to Install</h4>
            <p className="text-xs text-slate-300">
              The update APK has been downloaded and verified. Tap <b>Install Update</b> below to launch the package installer.
            </p>
          </div>
        )}

        {/* State 5: Up to Date */}
        {isUpToDate && !isChecking && (
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-ink-900 to-ink-950 p-5 text-center space-y-2">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 shadow-sm">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-black text-white">You&apos;re Up to Date!</h4>
            <p className="text-xs text-slate-300">
              TINDA POS <span className="font-mono font-semibold text-emerald-400">v{installed}</span> is currently the latest version.
            </p>
            {event?.lastCheckedAt && (
              <p className="text-[11px] text-slate-500">
                Last checked: {new Date(event.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {/* State 6: Error / Offline */}
        {isError && !isChecking && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1 text-amber-200">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Could not connect to update server</span>
            </div>
            <p className="text-xs text-slate-300">
              {event?.message || 'Please check your internet connection or Wi-Fi and try again.'}
            </p>
          </div>
        )}

        {/* Data Safety & GitHub Links */}
        <div className="flex items-center justify-between rounded-xl border border-ink-line/50 bg-ink-950/60 px-3.5 py-2.5 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
            <span>Store data stays 100% offline</span>
          </span>

          <a
            href="https://github.com/Yazerukun/TINDA-POS-Android-Free/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition"
          >
            <span>GitHub Releases</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </Modal>
  )
}
