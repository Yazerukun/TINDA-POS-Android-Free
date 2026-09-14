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

export function nowLocal(): string {
  return new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function shortDate(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'))
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function shortDateTime(iso: string): string {
  return iso
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