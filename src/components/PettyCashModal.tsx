import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, Loader2 } from 'lucide-react'
import { Modal } from './ui/Modal'
import { money } from '@shared/format'
import { toastSuccess, toastError } from '../stores/toast'
import { playSuccessChime, hapticSuccess, playErrorTone, hapticError } from '../lib/feedback'

interface PettyCashModalProps {
  open: boolean
  onClose: () => void
  onDone?: () => void
}

export function PettyCashModal({ open, onClose, onDone }: PettyCashModalProps): React.JSX.Element | null {
  const [type, setType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const amountC = Math.round((parseFloat(amount) || 0) * 100)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amountC <= 0) {
      toastError('Invalid amount', 'Please enter a valid amount.')
      return
    }
    if (!reason.trim()) {
      toastError('Reason required', 'Please enter a reason or notes for the cash movement.')
      return
    }

    setSubmitting(true)
    try {
      await window.api.shifts.cashMovement({
        type,
        amount_c: amountC,
        reason: reason.trim()
      })
      playSuccessChime()
      hapticSuccess()
      toastSuccess(
        type === 'CASH_IN' ? 'Cash In recorded' : 'Cash Out recorded',
        `${money(amountC)} — ${reason}`
      )
      onDone?.()
      onClose()
    } catch (err) {
      playErrorTone()
      hapticError()
      toastError('Petty Cash error', String((err as Error)?.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  const presets = [50, 100, 200, 500, 1000]

  return (
    <Modal open onClose={onClose} title="Petty Cash / Drawer Movement" maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        {/* Type Selector: Cash In vs Cash Out */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setType('CASH_IN')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition ${
              type === 'CASH_IN'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>Cash In (Dugang Sukli)</span>
          </button>
          <button
            type="button"
            onClick={() => setType('CASH_OUT')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition ${
              type === 'CASH_OUT'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Cash Out (Gasto/Kuha)</span>
          </button>
        </div>

        {/* Amount Input */}
        <div>
          <label className="label">Amount (₱)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₱</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input pl-8 text-xl font-bold tracking-tight"
            />
          </div>
          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition"
              >
                +₱{preset}
              </button>
            ))}
          </div>
        </div>

        {/* Reason / Notes */}
        <div>
          <label className="label">Reason / Purpose *</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={type === 'CASH_IN' ? 'e.g. Dugang barya/sensilyo sa kaha' : 'e.g. Palit snack, load, o bayad kuryente'}
            className="input"
            required
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || amountC <= 0}
            className={`btn-primary flex items-center gap-1.5 ${
              type === 'CASH_OUT' ? '!bg-rose-600 hover:!bg-rose-700' : ''
            }`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>Confirm {type === 'CASH_IN' ? 'Cash In' : 'Cash Out'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
