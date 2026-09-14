import { create } from 'zustand'
import { shouldAutoCheck, UPDATE_CHECK_THROTTLE_MS, type UpdateStatusEvent } from '@shared/update'

const LAST_CHECK_KEY = 'tinda-pos.update.lastCheckedAt'

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
    // Launch-time update check (at most once per throttle window), so a newer
    // official APK is offered without the user hunting through Settings.
    if (shouldAutoCheck(readLastCheckAt(), Date.now(), UPDATE_CHECK_THROTTLE_MS)) {
      writeLastCheckAt(Date.now())
      await get().check(false)
    }
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