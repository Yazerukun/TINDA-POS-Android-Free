import { useEffect, useRef, useSyncExternalStore } from 'react'
import { toastInfo, toastSuccess } from '../stores/toast'

const POLL_INTERVAL_MS = 15_000
const listeners = new Set<() => void>()
let online = false
let pollTimer: ReturnType<typeof setInterval> | undefined
let checking = false

function publish(nextOnline: boolean): void {
  if (online === nextOnline) return
  online = nextOnline
  listeners.forEach((listener) => listener())
}

async function checkConnection(): Promise<void> {
  if (checking) return
  checking = true
  try {
    publish(await window.api.app.isOnline())
  } catch {
    publish(false)
  } finally {
    checking = false
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    void checkConnection()
    pollTimer = setInterval(() => void checkConnection(), POLL_INTERVAL_MS)
    window.addEventListener('online', checkConnection)
    window.addEventListener('offline', checkConnection)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(pollTimer)
      pollTimer = undefined
      window.removeEventListener('online', checkConnection)
      window.removeEventListener('offline', checkConnection)
    }
  }
}

const getSnapshot = (): boolean => online

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function useConnectionNotifications(): void {
  const currentOnline = useOnlineStatus()
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      return
    }

    if (currentOnline) {
      toastSuccess('Internet connected', 'ONLINE READY — configured cloud backups can sync now.')
    } else {
      toastInfo('Offline mode', 'Sales continue normally. Pending cloud backups will sync later.')
    }
  }, [currentOnline])
}
