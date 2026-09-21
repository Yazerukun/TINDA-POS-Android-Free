import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Customer } from '@shared/types'
import { CartBody, usePosCart } from '../POS'

describe('POS Utang and Customer Integration', () => {
  const dummyCustomer: Customer = {
    id: 99,
    full_name: 'Mang Kanor',
    nickname: 'Kanor',
    phone: '09171234567',
    address: 'Sitio Ilaya',
    notes: null,
    credit_limit_c: 100000,
    balance_c: 45000,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  beforeEach(() => {
    usePosCart.getState().clear()
  })

  it('sets and clears customer in usePosCart correctly', () => {
    expect(usePosCart.getState().customer).toBeNull()
    expect(usePosCart.getState().customer_id).toBeNull()

    usePosCart.getState().setCustomer(dummyCustomer)
    expect(usePosCart.getState().customer).toEqual(dummyCustomer)
    expect(usePosCart.getState().customer_id).toBe(99)

    usePosCart.getState().setCustomer(null)
    expect(usePosCart.getState().customer).toBeNull()
    expect(usePosCart.getState().customer_id).toBeNull()
  })

  it('renders CartBody and displays selected customer name and balance in Cart', () => {
    const htmlWithCustomer = renderToStaticMarkup(
      React.createElement(CartBody, {
        isMobile: false,
        items: [],
        customer: dummyCustomer,
        subtotal: 0,
        total: 0,
        discount_pesos: 0,
        stockConflict: false,
        heldSalesCount: 0,
        holdBusy: false,
        onHold: vi.fn(),
        onClear: vi.fn(),
        onOpenHeld: vi.fn(),
        onOpenCustomer: vi.fn(),
        onCheckout: vi.fn()
      })
    )

    expect(htmlWithCustomer).toContain('Mang Kanor')
    expect(htmlWithCustomer).toContain('450.00')
    expect(htmlWithCustomer).toContain('Change')

    const htmlWithoutCustomer = renderToStaticMarkup(
      React.createElement(CartBody, {
        isMobile: false,
        items: [],
        customer: null,
        subtotal: 0,
        total: 0,
        discount_pesos: 0,
        stockConflict: false,
        heldSalesCount: 0,
        holdBusy: false,
        onHold: vi.fn(),
        onClear: vi.fn(),
        onOpenHeld: vi.fn(),
        onOpenCustomer: vi.fn(),
        onCheckout: vi.fn()
      })
    )

    expect(htmlWithoutCustomer).toContain('Select Customer')
  })
})

