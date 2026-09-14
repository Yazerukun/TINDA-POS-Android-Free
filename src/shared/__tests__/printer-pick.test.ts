import { describe, expect, it } from 'vitest'
import { printerPick, printerStatusLabel } from '../printer'
import type { PrinterChoiceLike } from '../printer'

const none: PrinterChoiceLike[] = []
const one = [{ name: 'Receipt Printer', displayName: 'Receipt Printer', isDefault: true }]
const multiple = [
  { name: 'Office LaserJet', displayName: 'Office LaserJet', isDefault: true },
  { name: 'Epson TM-T82IV', displayName: 'Epson TM-T82IV', isDefault: false },
  { name: 'Xprinter XP-Q801K', displayName: 'Xprinter XP-Q801K', isDefault: false }
]

describe('printerPick', () => {
  it('selects the exact saved printer when it still exists (READY)', () => {
    const pick = printerPick(multiple, 'Epson TM-T82IV')
    expect(pick).toEqual({ name: 'Epson TM-T82IV', status: 'READY' })
  })

  it('marks a disappeared saved printer UNAVAILABLE instead of falling back to the default', () => {
    const pick = printerPick(multiple, 'Old Thermal Printer')
    expect(pick).toEqual({ name: 'Old Thermal Printer', status: 'UNAVAILABLE' })
    // Never silently route to the default office printer.
    expect(pick.name).not.toBe('Office LaserJet')
  })

  it('suggests the system default printer when nothing is saved yet', () => {
    const pick = printerPick(multiple, '')
    expect(pick).toEqual({ name: 'Office LaserJet', status: 'NOT_CONFIGURED' })
  })

  it('suggests the only printer when no default is marked', () => {
    const pick = printerPick([{ name: 'Thermal', displayName: 'Thermal', isDefault: false }], '')
    expect(pick.name).toBe('Thermal')
  })

  it('leaves the printer unset when no printers exist', () => {
    expect(printerPick(none, '')).toEqual({ name: '', status: 'NOT_CONFIGURED' })
  })

  it('treats saved selection case-sensitively like the exact Windows device name', () => {
    expect(printerPick([{ name: 'Epson TM-T82IV', displayName: '', isDefault: false }], 'epson tm-t82iv').status).toBe('UNAVAILABLE')
  })

  it('suggests the default when a one-printer system has no saved choice', () => {
    expect(printerPick(one, '')).toEqual({ name: 'Receipt Printer', status: 'NOT_CONFIGURED' })
  })

  it('provides honest status labels', () => {
    expect(printerStatusLabel('READY')).toBe('Ready')
    expect(printerStatusLabel('UNAVAILABLE')).toBe('Unavailable')
    expect(printerStatusLabel('NOT_CONFIGURED')).toBe('Not configured')
  })
})
