import { describe, it, expect } from 'vitest'
import { formatCustomerStatement } from '../statement'
import type { Customer } from '../types'

describe('formatCustomerStatement', () => {
  const mockCustomer: Customer = {
    id: 1,
    full_name: 'Juan Dela Cruz',
    nickname: 'Boss Juan',
    phone: '09171234567',
    address: 'Brgy. Central',
    credit_limit_c: 500000,
    balance_c: 125050,
    is_active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  }

  it('formats customer statement with store name and nickname', () => {
    const text = formatCustomerStatement(mockCustomer, 'My Sari-Sari Store')
    expect(text).toContain('*STORE CREDIT STATEMENT*')
    expect(text).toContain('Store: My Sari-Sari Store')
    expect(text).toContain('Customer: Juan Dela Cruz (Boss Juan)')
    expect(text).toContain('Current Balance: ₱1,250.50')
    expect(text).toContain('Credit Limit: ₱5,000.00')
    expect(text).toContain('Friendly Reminder')
  })

  it('falls back to default store name if blank', () => {
    const text = formatCustomerStatement({ ...mockCustomer, nickname: null }, '')
    expect(text).toContain('Store: TINDA POS')
    expect(text).toContain('Customer: Juan Dela Cruz')
  })
})
