import type { Customer } from './types'
import { money } from './format'

export function formatCustomerStatement(customer: Customer, storeName?: string): string {
  const store = (storeName && storeName.trim()) || 'TINDA POS'
  const nick = customer.nickname ? ` (${customer.nickname})` : ''
  return [
    `*STORE CREDIT STATEMENT*`,
    `Store: ${store}`,
    `Customer: ${customer.full_name}${nick}`,
    `Current Balance: ${money(customer.balance_c)}`,
    `Credit Limit: ${money(customer.credit_limit_c)}`,
    ``,
    `Friendly Reminder: Please settle your store credit account when convenient. Thank you for your patronage!`
  ].join('\n')
}
