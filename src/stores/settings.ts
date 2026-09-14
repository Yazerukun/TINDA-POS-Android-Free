import { create } from 'zustand'
import type { StoreSettings } from '@shared/types'

interface SettingsState {
  settings: StoreSettings | null
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<StoreSettings>) => Promise<StoreSettings>
}

export const useSettings = create<SettingsState>((set, _get) => ({
  settings: null,
  loaded: false,
  load: async () => {
    const s = await window.api.settings.get()
    set({ settings: s, loaded: true })
  },
  update: async (patch) => {
    const s = await window.api.settings.update(patch)
    set({ settings: s })
    return s
  }
}))