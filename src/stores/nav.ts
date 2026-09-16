import { create } from 'zustand'

export type PageKey =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'utang'
  | 'expenses'
  | 'suppliers'
  | 'transactions'
  | 'reports'
  | 'backup'
  | 'settings'
  | 'printer'
  | 'update'
  | 'customers'
  | 'more'

interface NavState {
  page: PageKey
  setPage: (p: PageKey) => void
}

export const useNav = create<NavState>((set) => ({
  page: 'dashboard',
  setPage: (p) => set({ page: p })
}))