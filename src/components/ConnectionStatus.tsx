import { Wifi, WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function ConnectionStatus({ className = '' }: { className?: string }): React.JSX.Element {
  const online = useOnlineStatus()
  const Icon = online ? Wifi : WifiOff
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 ${className}`} title={online ? 'Internet available — cloud sync can upload backups' : 'No internet — POS remains fully usable'}>
      <Icon className="connection-pulse h-3.5 w-3.5 text-emerald-400" />
      <span className="text-[11px] font-semibold text-emerald-400">{online ? 'ONLINE READY' : 'OFFLINE READY'}</span>
    </div>
  )
}
