import { useState } from 'react'
import { useAuth } from '../stores/auth'
import { ConnectionStatus } from '../components/ConnectionStatus'
import tindaLogo from '../assets/tinda-logo.png'

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
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 p-6">
      <div className="card w-full max-w-sm p-6 sm:p-8 bg-white border border-slate-200 shadow-xl rounded-2xl">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="relative animate-float-slow mb-1">
            <img
              src={tindaLogo}
              alt="TINDA POS"
              className="h-32 w-auto max-w-[220px] object-contain drop-shadow-sm"
            />
          </div>
          <p className="text-xs font-semibold text-slate-500">Offline POS for Sari-Sari Stores</p>
          <ConnectionStatus className="mt-2.5" />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
          {(['password', 'pin'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null) }}
              className={`rounded-lg py-1.5 text-sm font-semibold transition ${
                mode === m ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800'
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
