import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', footer }: ModalProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-panel ${maxWidth} flex flex-col`}>
        <div className="mx-auto -mt-1 mb-2 h-1.5 w-12 shrink-0 rounded-full bg-ink-700 sm:hidden" />
        <div className="mb-3 flex shrink-0 items-center justify-between">
          {title && <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>}
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-ink-800 hover:text-white active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{children}</div>
        {footer && <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-ink-line pt-3 pb-[var(--saib)]">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}