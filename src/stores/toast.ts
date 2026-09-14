import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
}))

export function toastSuccess(title: string, message?: string): void {
  useToast.getState().push({ kind: 'success', title, message })
}
export function toastError(title: string, message?: string): void {
  useToast.getState().push({ kind: 'error', title, message })
}
export function toastInfo(title: string, message?: string): void {
  useToast.getState().push({ kind: 'info', title, message })
}
export function toastWarning(title: string, message?: string): void {
  useToast.getState().push({ kind: 'warning', title, message })
}