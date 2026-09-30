import tindaLogo from '../assets/tinda-logo.png'

export function Splash({ error }: { error?: string | null }): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6">
      <div className="relative flex flex-col items-center animate-logo-pop">
        <div className="relative animate-float-slow">
          <img
            src={tindaLogo}
            alt="TINDA POS"
            className="h-48 w-auto max-w-[280px] object-contain drop-shadow-md"
          />
        </div>
        <p className="mt-2 text-xs font-semibold tracking-wider text-slate-500">
          Offline POS for Sari-Sari Stores
        </p>
      </div>
      {error ? (
        <p className="mt-4 max-w-md rounded-xl border border-danger-500/40 bg-white px-4 py-3 text-center text-sm text-danger-600 shadow-sm">
          {error}
        </p>
      ) : (
        <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-slate-200 shadow-inner">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />
        </div>
      )}
    </div>
  )
}