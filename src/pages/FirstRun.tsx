import { useState } from 'react'
import { Store, UserRound, ReceiptText, Check, Loader2, Database } from 'lucide-react'
import { useAuth } from '../stores/auth'

type Step = 0 | 1 | 2

export function FirstRun(): React.JSX.Element {
  const [step, setStep] = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // wizard form state
  const [store, setStore] = useState({ store_name: '', owner_name: '', address: '', phone: '' })
  const [admin, setAdmin] = useState({ username: 'admin', password: '', pin: '', full_name: 'Manager' })
  const [receipt, setReceipt] = useState({ header: '', footer: 'Salamat po!' })
  const [loadDemo, setLoadDemo] = useState(true)

  const steps: { icon: React.ReactNode; title: string; sub: string }[] = [
    { icon: <Store className="h-5 w-5" />, title: 'Store Details', sub: 'Tell us about your sari-sari store.' },
    { icon: <UserRound className="h-5 w-5" />, title: 'Admin Account', sub: 'Set up the owner/manager login.' },
    { icon: <ReceiptText className="h-5 w-5" />, title: 'Receipt & Data', sub: 'Receipt footer and demo data.' }
  ]

  const canNext = (): boolean => {
    if (step === 0) return store.store_name.trim().length > 0
    if (step === 1) return admin.username.trim().length > 0 && admin.password.length >= 4 && admin.pin.length === 4
    return true
  }

  const submit = async () => {
    setSubmitting(true)
    setErr(null)
    try {
      const payload = {
        store,
        admin,
        receipt,
        data_dir: await window.api.app.dataDir(),
        load_demo: loadDemo
      }
      await window.api.auth.completeSetup(payload)
      await useAuth.getState().login(admin.username, admin.password)
    } catch (e) {
      setErr(String((e as Error)?.message || e))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-ink-950 p-4">
      <div className="card w-full max-w-lg p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-base font-black text-white">TP</div>
          <h1 className="text-xl font-bold text-white">Set up TINDA POS</h1>
          <p className="text-xs text-slate-400">A few quick steps to get your store running.</p>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                  i < step ? 'border-emerald-500 bg-emerald-500 text-white' : i === step ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-ink-line bg-ink-800 text-slate-500'
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : s.icon}
              </div>
              <span className={`text-center text-[10px] font-semibold ${i === step ? 'text-brand-400' : 'text-slate-500'}`}>{s.title}</span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-64">
          {step === 0 && (
            <div className="space-y-3">
              <Input label="Store Name *" value={store.store_name} onChange={(v) => setStore({ ...store, store_name: v })} placeholder="e.g. Aling Nena's Store" />
              <Input label="Owner Name" value={store.owner_name} onChange={(v) => setStore({ ...store, owner_name: v })} />
              <Input label="Address" value={store.address} onChange={(v) => setStore({ ...store, address: v })} />
              <Input label="Phone" value={store.phone} onChange={(v) => setStore({ ...store, phone: v })} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <Input label="Manager Full Name" value={admin.full_name} onChange={(v) => setAdmin({ ...admin, full_name: v })} />
              <Input label="Username *" value={admin.username} onChange={(v) => setAdmin({ ...admin, username: v })} />
              <Input label="Password * (min 4)" type="password" value={admin.password} onChange={(v) => setAdmin({ ...admin, password: v })} />
              <Input label="Quick PIN * (4 digits)" type="password" value={admin.pin} onChange={(v) => setAdmin({ ...admin, pin: v.replace(/\D/g, '').slice(0, 4) })} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Input label="Receipt Header" value={receipt.header} onChange={(v) => setReceipt({ ...receipt, header: v })} placeholder="e.g. Store address line" />
              <Input label="Receipt Footer" value={receipt.footer} onChange={(v) => setReceipt({ ...receipt, footer: v })} />
              <button
                onClick={() => setLoadDemo(!loadDemo)}
                className="flex w-full items-center justify-between rounded-lg border border-ink-line px-3 py-2.5 text-left"
              >
                <span className="flex items-center gap-2 text-sm text-slate-200"><Database className="h-4 w-4 text-brand-400" /> Load sample data</span>
                <span className={`h-6 w-11 rounded-full transition ${loadDemo ? 'bg-brand-600' : 'bg-ink-700'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${loadDemo ? 'translate-x-5' : 'translate-x-0.5'}`} /></span>
              </button>
              <p className="text-xs text-slate-500">Sample data adds ~18 common sari-sari items so you can try the POS immediately.</p>
            </div>
          )}
        </div>

        {err && <p className="mt-2 text-sm text-danger-400">{err}</p>}

        <div className="mt-6 flex justify-between">
          <button onClick={() => setStep((s) => (s > 0 ? (s - 1) as Step : s))} disabled={step === 0} className="btn-ghost">Back</button>
          {step < 2 ? (
            <button onClick={() => canNext() && setStep((s) => (s + 1) as Step)} disabled={!canNext()} className="btn-primary">Next</button>
          ) : (
            <button onClick={() => void submit()} disabled={submitting || !canNext()} className="btn-primary flex items-center gap-2">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up…</> : <>Finish Setup</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }): React.JSX.Element {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input" autoComplete="off" />
    </div>
  )
}