import { create } from 'zustand'
import type { SessionUser } from '@shared/types'

interface AuthState {
  user: SessionUser | null
  ready: boolean
  firstRun: boolean
  shiftOpen: boolean
  bootstrap: () => Promise<void>
  login: (u: string, p: string) => Promise<SessionUser>
  loginPin: (pin: string) => Promise<SessionUser>
  logout: () => Promise<void>
  setFirstRun: (v: boolean) => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  firstRun: false,
  shiftOpen: false,
  bootstrap: async () => {
    try {
      const s = await window.api.auth.setup()
      set({ firstRun: !s.complete })
      if (s.complete) {
        const status = await window.api.auth.status()
        set({ user: status })
        if (status) {
          const cur = await window.api.shifts.current()
          set({ shiftOpen: !!cur })
        }
      }
    } finally {
      set({ ready: true })
    }
  },
  login: async (u, p) => {
    const r = await window.api.auth.login(u, p)
    set({ user: r.user, firstRun: r.firstRun, shiftOpen: r.shiftOpen })
    return r.user
  },
  loginPin: async (pin) => {
    const r = await window.api.auth.loginPin(pin)
    set({ user: r.user, firstRun: r.firstRun, shiftOpen: r.shiftOpen })
    return r.user
  },
  logout: async () => {
    await window.api.auth.logout()
    set({ user: null })
  },
  setFirstRun: (v) => set({ firstRun: v })
}))