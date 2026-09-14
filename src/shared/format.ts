const pesoFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 })

export function money(c: number): string {
  return pesoFmt.format((c || 0) / 100)
}

export function moneyPlain(c: number): string {
  return ((c || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function moneyShort(c: number): string {
  const v = (c || 0) / 100
  if (Math.abs(v) >= 1000) return '₱' + Math.round(v).toLocaleString()
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: v % 1 === 0 ? 0 : 2 })
}

export function pesosToC(pesos: number): number {
  return Math.round(pesos * 100)
}

/**
 * Local business date as `YYYY-MM-DD`.
 *
 * Never use `toISOString().slice(0, 10)` for a store day: that returns the UTC
 * day, which is still yesterday for every local time before 08:00 in UTC+8.
 */
export function todayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Normalises a date key (`2026-09-15`) or a full datetime
 * (`2026-09-15 00:00:00`, `2026-09-15T00:00:00.000Z`) to the `YYYY-MM-DD` day it
 * falls on, falling back to today when the value is empty or unrecognised.
 *
 * Report ranges are passed in both shapes; appending a time to an
 * already-timed string yields an Invalid Date that throws when formatted.
 */
export function toDateKey(value: string | null | undefined): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? '').trim())
  return match ? match[1] : todayKey()
}

export function nowLocal(): string {
  return new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function shortDate(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'))
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Sep 15, 2026, 1:29 AM" — falls back to the raw value if it cannot be parsed. */
export function shortDateTime(iso: string): string {
  const d = new Date(String(iso ?? '').replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(iso ?? '')
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

// "2 boxes + 19 sachets" style quantity breakdown
export function quantityBreakdown(base: number, units: { name: string; conversion_to_base: number }[]): string {
  let rest = base
  const parts: string[] = []
  const sorted = [...units].filter((u) => u.conversion_to_base > 1).sort((a, b) => b.conversion_to_base - a.conversion_to_base)
  for (const u of sorted) {
    if (rest >= u.conversion_to_base) {
      const n = Math.floor(rest / u.conversion_to_base)
      parts.push(`${n} ${u.name}${n > 1 ? 's' : ''}`)
      rest = rest % u.conversion_to_base
    }
  }
  if (rest > 0 || parts.length === 0) {
    const baseName = units.find((u) => u.conversion_to_base === 1)?.name ?? 'pc'
    parts.push(`${rest} ${baseName}${rest > 1 ? 's' : ''}`)
  }
  return parts.join(' + ')
}