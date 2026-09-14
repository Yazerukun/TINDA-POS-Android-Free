import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import { useToast, type Toast } from '../../stores/toast'

const KINDS: Record<Toast['kind'], { icon: React.ComponentType<{ className?: string }>; accent: string; ring: string }> = {
  success: { icon: CheckCircle2, accent: 'text-emerald-400', ring: 'border-emerald-500/30' },
  error: { icon: XCircle, accent: 'text-red-400', ring: 'border-red-500/30' },
  info: { icon: Info, accent: 'text-sky-400', ring: 'border-sky-500/30' },
  warning: { icon: AlertTriangle, accent: 'text-amber-400', ring: 'border-amber-500/30' }
}

export function ToastHost(): React.JSX.Element {
  const { toasts, dismiss } = useToast()
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const k = KINDS[t.kind]
        const Icon = k.icon
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-ink-800/95 p-3 shadow-pop backdrop-blur ${k.ring}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${k.accent}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{t.title}</p>
              {t.message && <p className="mt-0.5 text-xs text-slate-300">{t.message}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}