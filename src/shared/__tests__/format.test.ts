import { describe, expect, it } from 'vitest'
import { shortDateTime, toDateKey, todayKey } from '../format'

describe('todayKey', () => {
  it('returns the local day, not the UTC day', () => {
    // 2026-09-15 01:29 local. In UTC+8 this is 2026-09-14T17:29Z, so
    // toISOString().slice(0, 10) would wrongly say 2026-09-14.
    const localEarlyMorning = new Date(2026, 8, 15, 1, 29, 54)
    expect(todayKey(localEarlyMorning)).toBe('2026-09-15')
  })

  it('zero-pads month and day', () => {
    expect(todayKey(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05')
  })
})

describe('toDateKey', () => {
  it('accepts a plain date key', () => {
    expect(toDateKey('2026-09-15')).toBe('2026-09-15')
  })

  it('accepts a space-separated datetime (the shape report ranges use)', () => {
    // Regression: dayStartIso('2026-09-15 00:00:00') built
    // '2026-09-15 00:00:00T00:00:00' -> Invalid Date -> RangeError.
    expect(toDateKey('2026-09-15 00:00:00')).toBe('2026-09-15')
    expect(toDateKey('2026-09-15 23:59:59')).toBe('2026-09-15')
  })

  it('accepts an ISO instant', () => {
    expect(toDateKey('2026-09-14T17:29:54.250Z')).toBe('2026-09-14')
  })

  it('falls back to today for empty or unrecognised input', () => {
    expect(toDateKey('')).toBe(todayKey())
    expect(toDateKey(null)).toBe(todayKey())
    expect(toDateKey(undefined)).toBe(todayKey())
    expect(toDateKey('not-a-date')).toBe(todayKey())
  })
})

describe('shortDateTime', () => {
  it('formats an ISO instant', () => {
    expect(shortDateTime('2026-09-15T10:30:00.000Z')).toMatch(/2026/)
  })

  it('does not render the raw ISO string', () => {
    expect(shortDateTime('2026-09-14T17:29:54.250Z')).not.toContain('T17:29:54')
  })

  it('falls back to the raw value when it cannot be parsed', () => {
    expect(shortDateTime('not-a-date')).toBe('not-a-date')
    expect(shortDateTime('')).toBe('')
  })
})
