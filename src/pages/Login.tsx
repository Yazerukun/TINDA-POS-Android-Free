import { useState } from 'react'
import { useAuth } from '../stores/auth'
import { ConnectionStatus } from '../components/ConnectionStatus'

export function Login(): React.JSX.Element {
  const { login, loginPin } = useAuth()
  const [mode, setMode] = useState<'password' | 'pin'>('password')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const f = e.currentTarget as HTMLFormElement
    const data = new FormData(f)
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'password') {
        await login(String(data.get('username') ?? ''), String(data.get('password') ?? ''))
      } else {
        await loginPin(String(data.get('pin') ?? ''))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-ink-950 p-6">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-lg font-black text-white">
            TP
          </div>
          <h1 className="text-xl font-bold text-white">TINDA POS</h1>
          <p className="text-xs text-slate-400">Offline POS System</p>
          <ConnectionStatus className="mt-3" />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-ink-900 p-1">
          {(['password', 'pin'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null) }}
              className={`rounded-md py-1.5 text-sm font-semibold transition ${
                mode === m ? 'bg-ink-750 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'password' ? 'Password' : 'Quick PIN'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'password' ? (
            <>
              <input className="input" name="username" placeholder="Username" autoFocus autoComplete="off" />
              <input className="input" name="password" type="password" placeholder="Password" autoComplete="off" />
            </>
          ) : (
            <input className="input text-center text-2xl tracking-[0.5em]" name="pin" type="password" inputMode="numeric" maxLength={4} placeholder="••••" autoFocus autoComplete="off" />
          )}
          {error && <p className="text-sm text-danger-400">{error}</p>}
          <button className="btn-primary mt-1 w-full" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : mode === 'password' ? 'Sign In' : 'Unlock'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          TINDA POS works fully offline. Your data stays on this device.
        </p>
        <p className="dev-signature signature-reveal mt-2 text-center text-sm italic text-slate-600">by Dev Francis</p>
      </div>
    </div>
  )
}
