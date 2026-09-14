import { create } from 'zustand'
import type { UpdateStatusEvent } from '@shared/update'

interface UpdateState {
  event: UpdateStatusEvent | null
  initialized: boolean
  init: () => Promise<void>
  check: (manual: boolean) => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
  dismiss: () => Promise<void>
}

let unsubscribe: (() => void) | null = null

export const useUpdate = create<UpdateState>((set, get) => ({
  event: null,
  initialized: false,
  init: async () => {
    if (get().initialized) return
    set({ initialized: true })
    unsubscribe?.()
    unsubscribe = window.api.update.onEvent((event) => set({ event }))
    const event = await window.api.update.state()
    set({ event })
  },
  check: async (manual) => {
    const event = await window.api.update.check(manual)
    set({ event })
  },
  download: async () => {
    const event = await window.api.update.download()
    set({ event })
  },
  install: async () => {
    const event = await window.api.update.install()
    set({ event })
  },
  dismiss: async () => {
    await window.api.update.dismiss()
    set({ event: null })
  }
}))