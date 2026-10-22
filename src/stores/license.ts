import { create } from 'zustand'
import { licenseService } from '../services/licenseService'
import type { LicenseStatus } from '@shared/types'

interface LicenseState {
  status: LicenseStatus | null
  loading: boolean
  error: string | null
  init: () => Promise<void>
  refresh: () => Promise<void>
  activate: (key: string, customerName?: string) => Promise<{ ok: boolean; message: string }>
  deactivate: () => Promise<{ ok: boolean; message: string }>
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  status: null,
  loading: true,
  error: null,

  init: async () => {
    try {
      set({ loading: true, error: null })
      const status = await licenseService.getStatus()
      set({ status, loading: false })
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'Failed to initialize license' })
    }
  },

  refresh: async () => {
    try {
      const status = await licenseService.getStatus()
      set({ status })
    } catch (err: any) {
      set({ error: err?.message || 'Failed to refresh license' })
    }
  },

  activate: async (key: string, customerName?: string) => {
    try {
      set({ loading: true, error: null })
      const res = await licenseService.activate(key, customerName)
      set({ status: res.status, loading: false })
      return { ok: res.ok, message: res.message }
    } catch (err: any) {
      set({ loading: false })
      return { ok: false, message: err?.message || 'Activation failed.' }
    }
  },

  deactivate: async () => {
    try {
      set({ loading: true, error: null })
      const res = await licenseService.deactivate()
      set({ status: res.status, loading: false })
      return { ok: res.ok, message: res.message }
    } catch (err: any) {
      set({ loading: false })
      return { ok: false, message: err?.message || 'Deactivation failed.' }
    }
  }
}))
