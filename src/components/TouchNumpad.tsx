import React from 'react'
import { Delete, RotateCcw } from 'lucide-react'
import { playTapTone, hapticTap } from '../lib/feedback'

interface TouchNumpadProps {
  value: string
  totalPesos: number
  onChange: (nextVal: string) => void
}

export function TouchNumpad({ value, totalPesos, onChange }: TouchNumpadProps): React.JSX.Element {
  const handleKey = (key: string) => {
    playTapTone()
    hapticTap()

    if (key === 'CLEAR') {
      onChange('')
      return
    }

    if (key === 'BACKSPACE') {
      onChange(value.length > 1 ? value.slice(0, -1) : '')
      return
    }

    if (key === '.') {
      if (value.includes('.')) return
      onChange(value ? `${value}.` : '0.')
      return
    }

    if (key === '00') {
      if (!value || value === '0') return
      onChange(`${value}00`)
      return
    }

    // Numbers 0-9
    if (value === '0') {
      onChange(key)
    } else {
      // Limit decimal digits to 2
      if (value.includes('.')) {
        const parts = value.split('.')
        if (parts[1] && parts[1].length >= 2) return
      }
      onChange(`${value}${key}`)
    }
  }

  const setExact = () => {
    playTapTone()
    hapticTap()
    onChange(totalPesos.toString())
  }

  const setAmount = (amt: number) => {
    playTapTone()
    hapticTap()
    onChange(amt.toString())
  }

  const addAmount = (plus: number) => {
    playTapTone()
    hapticTap()
    const current = parseFloat(value) || 0
    onChange((current + plus).toString())
  }

  const bills = [20, 50, 100, 200, 500, 1000]

  return (
    <div className="flex flex-col gap-1.5 select-none">
      {/* Quick Denominations */}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={setExact}
          className="flex-1 min-w-[65px] rounded-lg border border-brand-500/40 bg-brand-500/10 px-2 py-1 text-xs font-bold text-brand-300 hover:bg-brand-500/20 active:scale-95 transition"
        >
          Exact ₱{totalPesos}
        </button>
        {bills.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setAmount(b)}
            className={`rounded-lg border px-2 py-1 text-xs font-bold transition active:scale-95 ${b >= totalPesos ? 'border-ink-line bg-ink-900 text-white hover:border-brand-500/50' : 'border-ink-line/50 bg-ink-950/60 text-slate-500 hover:text-slate-300'}`}
          >
            ₱{b}
          </button>
        ))}
      </div>

      {/* Additive Quick Chips (+₱20, +₱50, +₱100) */}
      <div className="flex gap-1">
        <span className="self-center text-[10px] font-semibold uppercase text-slate-500">Add:</span>
        {[20, 50, 100, 500].map((add) => (
          <button
            key={add}
            type="button"
            onClick={() => addAmount(add)}
            className="flex-1 rounded-md border border-ink-line/80 bg-ink-900/60 py-0.5 text-xs font-semibold text-slate-300 hover:bg-ink-800 active:scale-95 transition"
          >
            +{add}
          </button>
        ))}
      </div>

      {/* Numeric Keypad Grid */}
      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleKey(digit)}
            className="flex h-10.5 items-center justify-center rounded-xl border border-ink-line bg-ink-900 text-xl font-bold text-white shadow-xs hover:bg-ink-800 active:scale-95 active:bg-brand-600 transition"
          >
            {digit}
          </button>
        ))}

        {/* Bottom Row */}
        <button
          type="button"
          onClick={() => handleKey('CLEAR')}
          className="flex h-10.5 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-bold text-red-300 hover:bg-red-500/20 active:scale-95 transition"
          title="Clear"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => handleKey('0')}
          className="flex h-10.5 items-center justify-center rounded-xl border border-ink-line bg-ink-900 text-xl font-bold text-white shadow-xs hover:bg-ink-800 active:scale-95 active:bg-brand-600 transition"
        >
          0
        </button>

        <button
          type="button"
          onClick={() => handleKey('BACKSPACE')}
          className="flex h-10.5 items-center justify-center rounded-xl border border-ink-line bg-ink-900 text-white hover:bg-ink-800 active:scale-95 transition"
          title="Backspace"
        >
          <Delete className="h-4 w-4 text-slate-300" />
        </button>
      </div>
    </div>
  )
}
