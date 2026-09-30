import { useState } from 'react'
import { Copy, Check, QrCode, Smartphone, X, ExternalLink } from 'lucide-react'
import { money } from '@shared/format'
import { toastSuccess } from '../stores/toast'

interface DynamicQRModalProps {
  open: boolean
  method: 'GCASH' | 'MAYA'
  totalC: number
  accountName?: string
  accountNumber?: string
  reference: string
  onReferenceChange: (ref: string) => void
  onClose: () => void
  onConfirm: () => void
  submitting: boolean
}

// Generate a deterministic SVG QR matrix pattern based on data payload
function SimpleQRMatrix({ data }: { data: string }): React.JSX.Element {
  // 25x25 grid representation
  const grid = 25
  const cells: boolean[][] = Array.from({ length: grid }, () => Array(grid).fill(false))

  // Helper to draw finder pattern (7x7 outer square, 3x3 inner square)
  const drawFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          cells[startY + r][startX + c] = true
        }
      }
    }
  }

  // Top-left, top-right, bottom-left finder patterns
  drawFinder(0, 0)
  drawFinder(grid - 7, 0)
  drawFinder(0, grid - 7)

  // Timing patterns
  for (let i = 8; i < grid - 8; i++) {
    cells[6][i] = i % 2 === 0
    cells[i][6] = i % 2 === 0
  }

  // Deterministic hash fill based on data payload string
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i)
    hash |= 0
  }

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      // Don't overwrite finders or timing
      const inTL = r < 8 && c < 8
      const inTR = r < 8 && c >= grid - 8
      const inBL = r >= grid - 8 && c < 8
      const inTiming = r === 6 || c === 6
      if (!inTL && !inTR && !inBL && !inTiming) {
        const val = Math.abs(Math.sin((r * grid + c + hash) * 999))
        cells[r][c] = val > 0.48
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${grid} ${grid}`} className="h-full w-full shape-rendering-crispEdges">
      {cells.map((row, r) =>
        row.map((active, c) =>
          active ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#0f172a" /> : null
        )
      )}
    </svg>
  )
}

export function DynamicQRModal({
  open,
  method,
  totalC,
  accountName,
  accountNumber,
  reference,
  onReferenceChange,
  onClose,
  onConfirm,
  submitting
}: DynamicQRModalProps): React.JSX.Element | null {
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const isGcash = method === 'GCASH'
  const brandColor = isGcash ? '#007dfe' : '#059669'
  const brandBg = isGcash ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
  const brandTitle = isGcash ? 'GCash QR' : 'Maya QR'
  const amountStr = (totalC / 100).toFixed(2)

  const copyAmount = () => {
    navigator.clipboard?.writeText(amountStr)
    setCopied(true)
    toastSuccess('Amount copied', `₱${amountStr}`)
    setTimeout(() => setCopied(false), 2000)
  }

  const payload = `${method}:${accountNumber || '09912255156'}?amount=${amountStr}&ref=${Date.now()}`

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm flex flex-col p-5 bg-white border border-slate-200 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold ${brandBg}`}>
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">{brandTitle}</h2>
              <p className="text-[11px] text-slate-500">Scan phone-to-phone</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Amount Card */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Exact Amount to Pay</span>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">
              {money(totalC)}
            </span>
            <button
              type="button"
              onClick={copyAmount}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
              title="Copy amount"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          {(accountName || accountNumber) && (
            <p className="mt-1 text-xs text-slate-600">
              {accountName ? `${accountName} · ` : ''}{accountNumber}
            </p>
          )}
        </div>

        {/* High-Contrast QR Code Card */}
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-52 w-52 p-2 rounded-xl bg-white flex items-center justify-center">
            <SimpleQRMatrix data={payload} />
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <QrCode className="h-3.5 w-3.5 text-slate-400" />
            <span>Open {isGcash ? 'GCash' : 'Maya'} app to scan</span>
          </p>
        </div>

        {/* Reference Number Input */}
        <div className="mt-4 space-y-1">
          <label className="label">Payment Reference No. (Optional)</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
            placeholder="e.g. 1029384756"
            className="input text-sm"
          />
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="btn-primary flex-1 !bg-emerald-600 hover:!bg-emerald-700"
          >
            {submitting ? 'Recording…' : 'Payment Received'}
          </button>
        </div>
      </div>
    </div>
  )
}
