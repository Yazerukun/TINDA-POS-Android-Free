import { useEffect, useState } from 'react'
import { useAuth } from './stores/auth'
import { useUpdate } from './stores/update'
import { Splash } from './components/Splash'
import { FirstRun } from './pages/FirstRun'
import { Login } from './pages/Login'
import { Shell } from './layouts/Shell'
import { useConnectionNotifications } from './hooks/useOnlineStatus'

export default function App(): React.JSX.Element {
  useConnectionNotifications()
  const { user, ready, firstRun, bootstrap } = useAuth()
  const { init: initUpdate } = useUpdate()
  const [bootErr, setBootErr] = useState<string | null>(null)

  useEffect(() => {
    bootstrap().catch((e) => setBootErr(String(e?.message ?? e)))
    initUpdate().catch(() => undefined)
  }, [bootstrap, initUpdate])

  if (!ready) return <Splash error={bootErr} />
  if (firstRun) return <FirstRun />
  if (!user) return <Login />
  return <Shell />
}
