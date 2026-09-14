import { useEffect } from 'react'
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
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-panel ${maxWidth}`}>
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-lg font-bold text-white">{title}</h2>}
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-ink-700 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2 border-t border-ink-line pt-4">{footer}</div>}
      </div>
    </div>
  )
}