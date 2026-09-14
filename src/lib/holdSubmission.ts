import type { CheckoutPayload } from '@shared/ipc'
import type { HeldSale } from '@shared/types'

/** Single-flight UI boundary: only a successful hold is allowed to clear cart. */
export function createHoldSubmission(
  save: (payload: CheckoutPayload) => Promise<HeldSale>,
  clearCart: () => void
): (payload: CheckoutPayload) => Promise<HeldSale | null> {
  let pending = false
  return async (payload) => {
    if (pending) return null
    pending = true
    try {
      const held = await save(payload)
      clearCart()
      return held
    } finally {
      pending = false
    }
  }
}
