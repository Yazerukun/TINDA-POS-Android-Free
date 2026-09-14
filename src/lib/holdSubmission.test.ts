import { describe, expect, it, vi } from 'vitest'
import { createHoldSubmission } from './holdSubmission'
import type { CheckoutPayload } from '@shared/ipc'
import type { HeldSale } from '@shared/types'

const payload: CheckoutPayload = { items: [], discount_c: 0, customer_id: null, payments: [] }
const held = { id: 1, token: 'ABC', items: [], subtotal_c: 0, discount_c: 0, total_c: 0, user_id: 1, created_at: '' } as HeldSale

describe('Hold submission UI boundary', () => {
  it('clears cart only after a successful hold', async () => {
    const clear = vi.fn()
    const submit = createHoldSubmission(async () => held, clear)
    await expect(submit(payload)).resolves.toEqual(held)
    expect(clear).toHaveBeenCalledOnce()
  })

  it('blocks duplicate rapid submissions and does not clear on failure', async () => {
    let release!: (value: HeldSale) => void
    const save = vi.fn(() => new Promise<HeldSale>((resolve) => { release = resolve }))
    const clear = vi.fn()
    const submit = createHoldSubmission(save, clear)
    const first = submit(payload)
    await expect(submit(payload)).resolves.toBeNull()
    expect(save).toHaveBeenCalledOnce()
    release(held)
    await expect(first).resolves.toEqual(held)
    expect(clear).toHaveBeenCalledOnce()

    const failedClear = vi.fn()
    const failed = createHoldSubmission(async () => { throw new Error('save failed') }, failedClear)
    await expect(failed(payload)).rejects.toThrow('save failed')
    expect(failedClear).not.toHaveBeenCalled()
  })
})
