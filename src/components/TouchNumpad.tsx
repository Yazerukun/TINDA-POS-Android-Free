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
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={setExact}
          className="flex-1 min-w-[75px] rounded-xl border-2 border-emerald-600 bg-emerald-50 px-2 py-1.5 text-xs font-black text-emerald-900 hover:bg-emerald-100 active:scale-95 transition shadow-xs"
        >
          Exact ₱{totalPesos}
        </button>
        {bills.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setAmount(b)}
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-black transition active:scale-95 shadow-xs ${
              b >= totalPesos
                ? 'border-slate-300 bg-white text-slate-950 hover:border-emerald-500 hover:bg-emerald-50/50'
                : 'border-slate-200 bg-slate-100 text-slate-500'
            }`}
          >
            ₱{b}
          </button>
        ))}
      </div>

      {/* Additive Quick Chips (+₱20, +₱50, +₱100, +₱500) */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="self-center text-[10px] font-black uppercase tracking-wider text-slate-700">Add:</span>
        {[20, 50, 100, 500].map((add) => (
          <button
            key={add}
            type="button"
            onClick={() => addAmount(add)}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-1 text-xs font-bold text-slate-800 hover:bg-slate-50 hover:border-emerald-500 active:scale-95 transition shadow-xs"
          >
            +{add}
          </button>
        ))}
      </div>

      {/* Numeric Keypad Grid */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleKey(digit)}
            className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-2xl font-black text-slate-950 shadow-xs hover:bg-slate-50 hover:border-emerald-500 active:scale-95 active:bg-emerald-600 active:text-white transition"
          >
            {digit}
          </button>
        ))}

        {/* Bottom Row */}
        <button
          type="button"
          onClick={() => handleKey('CLEAR')}
          className="flex h-12 items-center justify-center rounded-xl border-2 border-rose-300 bg-rose-50 text-sm font-black text-rose-700 hover:bg-rose-100 active:scale-95 transition"
          title="Clear"
        >
          <RotateCcw className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => handleKey('0')}
          className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-2xl font-black text-slate-950 shadow-xs hover:bg-slate-50 hover:border-emerald-500 active:scale-95 active:bg-emerald-600 active:text-white transition"
        >
          0
        </button>

        <button
          type="button"
          onClick={() => handleKey('BACKSPACE')}
          className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:border-emerald-500 active:scale-95 transition shadow-xs"
          title="Backspace"
        >
          <Delete className="h-5 w-5 text-slate-800" />
        </button>
      </div>
    </div>
  )
}
