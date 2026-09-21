import { formatCustomerStatement } from '@shared/statement'
import type { Customer } from '@shared/types'
import { toastSuccess, toastError } from '../stores/toast'

export async function shareCustomerStatement(customer: Customer, storeName?: string): Promise<void> {
  const text = formatCustomerStatement(customer, storeName)
  const title = `${customer.full_name} - Store Credit Statement`

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text })
      toastSuccess('Statement shared', `Reminder sent for ${customer.full_name}`)
      return
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      toastSuccess('Copied to clipboard', `Statement reminder for ${customer.full_name} copied. You can paste it into SMS or Messenger!`)
      return
    } catch {
      toastError('Share failed', 'Unable to copy statement to clipboard.')
      return
    }
  }

  toastError('Sharing not supported', 'Please copy manually.')
}
