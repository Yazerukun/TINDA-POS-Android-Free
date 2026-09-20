import tindaLogo from '../assets/tinda-logo.png'

export function Splash({ error }: { error?: string | null }): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-ink-950 px-6">
      <div className="relative flex flex-col items-center animate-logo-pop">
        <div className="relative animate-float-slow">
          <img
            src={tindaLogo}
            alt="TINDA POS"
            className="h-48 w-auto max-w-[280px] object-contain animate-neon-pulse"
          />
        </div>
        <p className="mt-2 text-xs font-semibold tracking-wider text-slate-400">
          Offline POS for Sari-Sari Stores
        </p>
      </div>
      {error ? (
        <p className="mt-4 max-w-md rounded-lg border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-center text-sm text-danger-400">
          {error}
        </p>
      ) : (
        <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-ink-850 shadow-inner">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-500" />
        </div>
      )}
    </div>
  )
}