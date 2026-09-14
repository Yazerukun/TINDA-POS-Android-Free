import type { RoleName } from './types'

export type Permission =
  | 'pos:use'
  | 'pos:hold-sale'
  | 'pos:resume-sale'
  | 'pos:custom-item'
  | 'pos:discount'
  | 'pos:assign-customer'
  | 'pos:utang'
  | 'pos:checkout'
  | 'pos:void' // authorize/execute void of a sale
  | 'pos:refund'
  | 'products:manage'
  | 'products:archive'
  | 'products:price-edit'
  | 'inventory:receive'
  | 'inventory:adjust'
  | 'inventory:count'
  | 'customers:manage'
  | 'customers:delete'
  | 'utang:adjust' // manual ledger adjustments
  | 'utang:approve-overlimit' // approve credit above limit
  | 'expenses:manage'
  | 'expenses:delete'
  | 'suppliers:manage'
  | 'purchases:manage'
  | 'transactions:view'
  | 'transactions:void'
  | 'transactions:refund'
  | 'shifts:manage'
  | 'shifts:view-all'
  | 'reports:view'
  | 'reports:export'
  | 'dashboard:view'
  | 'users:manage'
  | 'settings:manage'
  | 'backup:manage'
  | 'audit:view'

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  ADMIN: [
    'pos:use', 'pos:hold-sale', 'pos:resume-sale', 'pos:custom-item', 'pos:discount',
    'pos:assign-customer', 'pos:utang', 'pos:checkout', 'pos:void', 'pos:refund',
    'products:manage', 'products:archive', 'products:price-edit',
    'inventory:receive', 'inventory:adjust', 'inventory:count',
    'customers:manage', 'customers:delete', 'utang:adjust', 'utang:approve-overlimit',
    'expenses:manage', 'expenses:delete', 'suppliers:manage', 'purchases:manage',
    'transactions:view', 'transactions:void', 'transactions:refund',
    'shifts:manage', 'shifts:view-all',
    'reports:view', 'reports:export',
    'dashboard:view', 'users:manage', 'settings:manage', 'backup:manage', 'audit:view'
  ],

  MANAGER: [
    'pos:use',
    'pos:hold-sale',
    'pos:resume-sale',
    'pos:custom-item',
    'pos:discount',
    'pos:assign-customer',
    'pos:utang',
    'pos:checkout',
    'pos:void',
    'pos:refund',
    'products:manage',
    'products:archive',
    'products:price-edit',
    'inventory:receive',
    'inventory:adjust',
    'inventory:count',
    'customers:manage',
    'utang:adjust',
    'utang:approve-overlimit',
    'expenses:manage',
    'expenses:delete',
    'suppliers:manage',
    'purchases:manage',
    'transactions:view',
    'transactions:void',
    'transactions:refund',
    'shifts:manage',
    'shifts:view-all',
    'reports:view',
    'reports:export',
    'dashboard:view',
    'backup:manage'
  ],

  CASHIER: [
    'pos:use',
    'pos:hold-sale',
    'pos:resume-sale',
    'pos:custom-item',
    'pos:discount',
    'pos:assign-customer',
    'pos:utang',
    'pos:checkout',
    'transactions:view',
    'shifts:manage',
    'reports:view',
    'dashboard:view'
  ]
}

export function permissionsFor(roles: RoleName[]): Set<Permission> {
  const set = new Set<Permission>()
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p)
  return set
}

export function hasPermission(roles: RoleName[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission)
}

export const ALL_PERMISSIONS = Object.values(ROLE_PERMISSIONS).flat() as Permission[]