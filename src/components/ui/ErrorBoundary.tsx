import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-ink-950 p-6 text-center">
          <div className="card max-w-md p-6 border-danger-500/30">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-500/20 text-danger-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-white">Something went wrong</h2>
            <p className="mt-2 text-xs text-slate-400">
              {this.state.error?.message ?? 'An unexpected display error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-6 w-full flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
