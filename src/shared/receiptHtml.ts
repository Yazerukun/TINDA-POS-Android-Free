// Pure, dependency-free receipt HTML builder shared by:
//  - src/main/services/printing.ts (silent webContents.print path)
//  - the renderer ReceiptPaper preview (Settings / POS / Transactions)
// Keeping it in one place guarantees the on-screen preview matches the printed
// output exactly. All user text is escaped before it reaches the DOM.
//
// Thermal printing rules enforced here:
//  - pure black-on-white, no backgrounds, no gradients, high contrast
//  - zero page margin + exact paper width, Chromium never adds headers/footers
//  - long product names wrap instead of clipping
//  - totals/SUKLI keep a strong hierarchy without relying on gray text

export type ReceiptWidth = '58mm' | '80mm'

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!)
}

const CURRENCY_SYMBOLS: Record<string, string> = { PHP: '₱', PESO: '₱' }

export function currencySymbol(currency?: string): string {
  if (!currency) return ''
  const key = currency.trim().toUpperCase()
  return CURRENCY_SYMBOLS[key] ?? `${currency.trim()} `
}

function isSeparator(raw: string): boolean {
  const t = raw.trim()
  return t.length >= 3 && /^-+$/.test(t)
}

function isMoneyLine(raw: string): { label: string; amount: string } | null {
  const m = raw.trim().match(/^(Subtotal|Discounts?|TOTAL|TOTAL PAYMENTS|Total Payments|Cash|SUKLI|Gross Sales|Refunds|Cash Refunds|Voids|NET SALES|GCash|Maya|Utang|Expenses|Expected Cash|Actual Cash|Difference|Starting Cash|Cash In|Cash Out)\s+(-?\d[\d,]*(?:\.\d+)?)$/i)
  if (!m) return null
  return { label: m[1]!.replace(/^./, (c) => c.toUpperCase()), amount: m[2]! }
}

// buildReceiptLines emits one plain name row followed by a detail row:
// "  <qty> x <unit price>        <amount>"
function isItemDetail(raw: string): { qty: string; unitPrice: string; amount: string } | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s+x\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/)
  if (!m) return null
  return { qty: m[1]!, unitPrice: m[2]!, amount: m[3]! }
}

const fmt = (raw: string) => {
  const clean = raw.replaceAll(',', '')
  const n = Number(clean) || 0
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: raw.includes(',') })
}

function fmtSigned(raw: string, symbol: string): string {
  const clean = raw.replaceAll(',', '')
  const n = Number(clean) || 0
  const formatted = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: raw.includes(',')
  })
  if (n < 0) return `-${symbol}${formatted}`
  return `${symbol}${formatted}`
}

function rowsToHtml(lines: string[], currency: string): string {
  const symbol = currencySymbol(currency)
  const out: string[] = []
  let seenSeparator = false

  const pushRow = (html: string): void => { out.push(html) }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ''
    const trimmed = raw.trim()

    const denomination = trimmed.match(/^(₱[\d,.]+)\s+(\d+)\s+x\s+([\d,.]+)\s+=\s+([\d,.]+)$/)
    if (denomination) {
      const denomRaw = denomination[1]!
      const denomNum = Number(denomRaw.replace(/[^\d.]/g, ''))
      const denomLabel = denomRaw.startsWith('₱') && !Number.isNaN(denomNum)
        ? `₱${denomNum.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        : denomRaw
      pushRow(
        `<div class="tp-denomline">` +
        `<span class="tp-denom">${escapeHtml(denomLabel)}</span>` +
        `<span class="tp-qty">&times;&nbsp;${escapeHtml(denomination[2]!)}</span>` +
        `<span class="tp-amt">${symbol}${fmt(denomination[4]!)}</span>` +
        `</div>`
      )
      continue
    }

    if (isSeparator(raw)) {
      seenSeparator = true
      pushRow('<div class="tp-sep"></div>')
      continue
    }

    // Item rows: product name line + its qty/price/amount detail line.
    const detail = isItemDetail(raw)
    if (detail) continue // handled together with the preceding name row
    const next = lines[i + 1]
    if (next !== undefined && isItemDetail(next)) {
      const d = isItemDetail(next)!
      pushRow(
        `<div class="tp-item"><div class="tp-name">${escapeHtml(raw)}</div>` +
        `<div class="tp-itemline"><span class="tp-qty">${escapeHtml(d.qty)} x ${fmt(d.unitPrice)}</span><span class="tp-amt">${fmt(d.amount)}</span></div></div>`
      )
      i++ // consume the detail line
      continue
    }

    const money = isMoneyLine(raw)
    if (money) {
      const cls = money.label === 'SUKLI' ? 'tp-sukli' : /^(TOTAL|TOTAL PAYMENTS|Total Payments|NET SALES|Actual Cash)$/i.test(money.label) ? 'tp-total' : 'tp-sum'
      const label = money.label === 'SUKLI' ? 'Change / SUKLI' : money.label === 'Cash' ? 'Cash' : money.label
      pushRow(
        `<div class="${cls}"><span class="tp-lbl">${escapeHtml(label)}</span><span class="tp-amt">${fmtSigned(money.amount, symbol)}</span></div>`
      )
      continue
    }

    const statusMatch = trimmed.match(/^Status[:\s]+(BALANCED|OVER|SHORT)$/i)
    if (statusMatch) {
      const statusText = statusMatch[1]!.toUpperCase()
      pushRow(
        `<div class="tp-sum tp-status" data-status="${escapeHtml(statusText)}"><!-- ${escapeHtml(raw)} --><span class="tp-lbl">Status</span><span class="tp-amt tp-badge-status tp-status-${statusText.toLowerCase()}">${escapeHtml(statusText)}</span></div>`
      )
      continue
    }

    const countMatch = trimmed.match(/^(Transactions|Items)\s*[:\s]\s*(\d+)$/i)
    if (countMatch) {
      pushRow(
        `<div class="tp-sum"><span class="tp-lbl">${escapeHtml(countMatch[1]!)}</span><span class="tp-amt">${escapeHtml(countMatch[2]!)}</span></div>`
      )
      continue
    }

    if (/^(DENOMINATION BREAKDOWN|BILLS:|COINS:|SALES SUMMARY|PAYMENT BREAKDOWN|CASH RECONCILIATION)$/i.test(trimmed)) {
      const isSub = /^(BILLS:|COINS:)$/i.test(trimmed)
      pushRow(`<div class="tp-section-head${isSub ? ' tp-sub' : ''}">${escapeHtml(trimmed)}</div>`)
      continue
    }

    if (trimmed === '') {
      pushRow('<div class="tp-gap"></div>')
      continue
    }

    // Brand/header block (before the first separator) is centered; transaction
    // info, cashier, customer, payment method lines, footer stay left-aligned.
    const cls = seenSeparator ? 'tp-row' : `tp-row tp-center${i === 0 ? ' tp-heading' : ''}`
    pushRow(`<div class="${cls}">${escapeHtml(raw)}</div>`)
  }
  return out.join('\n')
}

const baseCss = `
  .tp-sheet { margin: 0 auto; box-sizing: border-box; background: white; color: black; }
  .tp-sheet * { box-sizing: border-box; }
  .tp-sheet { font-family: Consolas, "Courier New", "Lucida Console", monospace; line-height: 1.38; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  .tp-row { font-size: 1em; }
  .tp-center { text-align: center; }
  .tp-heading { font-size: 1.3em; font-weight: 800; }
  .tp-item, .tp-sum, .tp-total, .tp-sukli, .tp-denomline { break-inside: avoid; }
  .tp-gap { height: 0.5em; }
  .tp-sep { border-top: 1px dashed black; margin: 0.35em 0; }
  .tp-section-head { font-size: 1em; font-weight: 800; text-transform: uppercase; margin-top: 0.3em; letter-spacing: 0.03em; }
  .tp-section-head.tp-sub { font-size: 0.9em; font-weight: 700; margin-top: 0.2em; color: #222; }
  .tp-item .tp-name { font-size: 1em; font-weight: 700; }
  .tp-itemline { display: table; width: 100%; table-layout: auto; }
  .tp-itemline > span { display: table-cell; }
  .tp-qty { font-size: 0.95em; white-space: nowrap; }
  .tp-amt { font-variant-numeric: tabular-nums; text-align: right; width: 1%; white-space: nowrap; padding-left: 0.5em; }
  .tp-item .tp-amt, .tp-sum .tp-amt { font-weight: 700; }
  .tp-sum, .tp-total, .tp-sukli { display: table; width: 100%; table-layout: auto; }
  .tp-lbl { display: table-cell; }
  .tp-sum { font-size: 1em; }
  .tp-total { font-size: 1.2em; font-weight: 800; border-top: 3px double black; border-bottom: 3px double black; margin-top: 0.3em; padding: 0.3em 0; }
  .tp-total .tp-amt { font-weight: 800; display: table-cell; text-align: right; }
  .tp-sukli { font-size: 1.1em; font-weight: 900; margin-top: 0.12em; padding: 0.1em 0; }
  .tp-sukli .tp-lbl, .tp-sukli .tp-amt { font-weight: 900; display: table-cell; }
  .tp-sukli .tp-amt { text-align: right; }
  .tp-denomline { display: table; width: 100%; table-layout: fixed; font-size: 0.95em; line-height: 1.35; }
  .tp-denom { display: table-cell; text-align: left; width: 34%; white-space: nowrap; font-weight: 600; }
  .tp-denomline .tp-qty { display: table-cell; text-align: center; width: 26%; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .tp-denomline .tp-amt { display: table-cell; text-align: right; width: 40%; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 700; }
  .tp-badge-status { font-weight: 800; letter-spacing: 0.05em; }
  .tp-status-balanced { color: #000; }
  .tp-status-over { color: #000; }
  .tp-status-short { color: #000; }
`
export function receiptCss(width: ReceiptWidth): string {
  const paperWidth = width === '80mm' ? '80mm' : '58mm'
  const contentWidth = width === '80mm' ? '72mm' : '48mm'
  const fontSize = width === '80mm' ? '11.5px' : '9.5px'
  return `
    ${baseCss}
    @page { size: ${paperWidth} auto; margin: 0; }
    .tp-sheet { width: ${contentWidth}; padding: 2mm 0 4mm; font-size: ${fontSize}; }
  `
}

export function receiptBodyHtml(lines: string[], width: ReceiptWidth, currency = ''): string {
  return `<div class="tp-sheet">${rowsToHtml(lines, currency)}</div>`
}

export function receiptHtml(lines: string[], width: ReceiptWidth, currency = ''): string {
  const docReset = 'html, body { margin: 0; padding: 0; background: white; color: black; }'
  return `<!doctype html><html><head><meta charset="utf-8"><style>${docReset}${receiptCss(width)}</style></head><body>${receiptBodyHtml(lines, width, currency)}</body></html>`
}
