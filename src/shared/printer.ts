// Pure helpers for choosing the receipt printer in Settings.
// Shared so the exact same selection rules can be unit-tested without Electron.

export interface PrinterChoiceLike {
  name: string
  displayName?: string
  isDefault?: boolean
}

export type PrinterStatus = 'READY' | 'UNAVAILABLE' | 'NOT_CONFIGURED'

export interface PrinterPick {
  name: string
  status: PrinterStatus
}

// Selection rules:
//  1. A previously saved printer that still exists -> select it (READY).
//  2. A previously saved printer that disappeared  -> keep it visible and mark
//     UNAVAILABLE so the store owner must choose again (no silent fallback to an
//     office printer). Actual print jobs also fail safely in submitPrint.
//  3. Nothing saved yet -> suggest the system default printer when one exists;
//     otherwise, when exactly one printer is installed, suggest it (common on
//     dedicated thermal-printer machines). The owner confirms by pressing Save.
//     With several printers and no default, leave it unset.
export function printerPick(printers: PrinterChoiceLike[], saved: string): PrinterPick {
  const savedName = (saved || '').trim()
  if (savedName) {
    if (printers.some((p) => p.name === savedName)) return { name: savedName, status: 'READY' }
    return { name: savedName, status: 'UNAVAILABLE' }
  }
  const systemDefault = printers.find((p) => p.isDefault)
  const only = printers.length === 1 ? printers[0] : undefined
  const suggested = systemDefault ?? only
  return { name: suggested ? suggested.name : '', status: 'NOT_CONFIGURED' }
}

export function printerStatusLabel(status: PrinterStatus): string {
  switch (status) {
    case 'READY': return 'Ready'
    case 'UNAVAILABLE': return 'Unavailable'
    case 'NOT_CONFIGURED': return 'Not configured'
  }
}
