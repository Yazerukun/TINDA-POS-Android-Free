import { create } from 'zustand'
import { shouldAutoCheck, type UpdateStatusEvent } from '@shared/update'
import { toastSuccess } from './toast'

const LAST_CHECK_KEY = 'tinda-pos.update.lastCheckedAt'
const AUTO_CHECK_THROTTLE_MS = 10 * 60 * 1000 // 10 minutes

function readLastCheckAt(): number | null {
  try {
    const value = Number(window.localStorage.getItem(LAST_CHECK_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeLastCheckAt(at: number): void {
  try {
    window.localStorage.setItem(LAST_CHECK_KEY, String(at))
  } catch {
    /* storage unavailable — the check still runs, only the throttle is lost */
  }
}

interface UpdateState {
  event: UpdateStatusEvent | null
  initialized: boolean
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
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
  modalOpen: false,
  setModalOpen: (open: boolean) => set({ modalOpen: open }),
  init: async () => {
    if (get().initialized) return
    set({ initialized: true })
    unsubscribe?.()
    unsubscribe = window.api.update.onEvent((event) => set({ event }))
    const event = await window.api.update.state()
    set({ event })

    // Auto-check on window focus & when reconnecting online
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (shouldAutoCheck(readLastCheckAt(), Date.now(), AUTO_CHECK_THROTTLE_MS)) {
          writeLastCheckAt(Date.now())
          void get().check(false).catch(() => {})
        }
      })
      window.addEventListener('online', () => {
        writeLastCheckAt(Date.now())
        void get().check(false).catch(() => {})
      })
    }

    // Launch-time auto check: runs in background so the Bell alerts immediately without tapping
    if (typeof navigator === 'undefined' || navigator.onLine) {
      if (shouldAutoCheck(readLastCheckAt(), Date.now(), AUTO_CHECK_THROTTLE_MS)) {
        writeLastCheckAt(Date.now())
        void get().check(false).catch(() => {})
      }
    }
  },
  check: async (manual) => {
    try {
      const event = await window.api.update.check(manual)
      set({ event })
      if (!manual && event.status === 'UPDATE_AVAILABLE' && event.available) {
        toastSuccess(
          'Software Update Available',
          `v${event.available.version} is ready. Tap the Bell icon to update!`
        )
      }
    } catch {
      /* Silent background check */
    }
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
    const event = await window.api.update.dismiss()
    set({ event, modalOpen: false })
  }
}))