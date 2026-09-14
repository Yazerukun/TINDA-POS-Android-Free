export function Splash({ error }: { error?: string | null }): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-ink-950">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white shadow-pop">
        TP
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white">TINDA POS</h1>
      <p className="text-sm text-slate-400">Offline POS System for Sari-Sari Stores</p>
      {error ? (
        <p className="mt-4 max-w-md rounded-lg border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-center text-sm text-danger-400">
          {error}
        </p>
      ) : (
        <div className="mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-ink-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-500" />
        </div>
      )}
    </div>
  )
}