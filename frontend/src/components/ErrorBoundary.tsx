/**
 * ErrorBoundary.tsx - Catches runtime render errors across routed pages.
 *
 * Prevents a single broken component from unmounting the whole React app tree into a blank page.
 * Provides a retry button and navigation to safety.
 * Clears error automatically when resetKey (route path) changes.
 * Pure ASCII only.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, RefreshCw, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Changing resetKey clears the error - pass location.pathname so navigating recovers. */
  resetKey?: string
  /** Component or page area label, e.g. "This page". */
  label?: string
  /** Render compact card rather than full-page layout. */
  compact?: boolean
}

interface State {
  error: Error | null
  componentStack: string | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    error: null,
    componentStack: null,
    showDetails: false,
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.label ?? 'page'}]`, error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  override componentDidUpdate(prevProps: Props): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  reset = (): void => {
    this.setState({ error: null, componentStack: null, showDetails: false })
  }

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  render(): ReactNode {
    const { error, componentStack, showDetails } = this.state
    if (!error) {
      return this.props.children
    }

    const { compact, label } = this.props
    const title = label ? `${label} could not load` : 'This page could not load'

    const errorDetails = showDetails ? (
      <div className="mt-4 text-left">
        <pre className="max-h-56 overflow-auto rounded-xl border border-line bg-sunken p-3 font-mono text-[11px] leading-relaxed text-ink whitespace-pre-wrap">
          {error.name}: {error.message}
          {componentStack ? `\n\nComponent Stack:\n${componentStack}` : ''}
        </pre>
      </div>
    ) : null

    if (compact) {
      return (
        <div className="rounded-2xl border border-structural bg-surface p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                {title}
              </h3>
              <p className="mt-1 text-xs text-muted">
                {error.message || 'An unexpected error occurred while rendering.'}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" intent="primary" onClick={this.reset}>
                  <RefreshCw size={12} className="mr-1.5" /> Try again
                </Button>
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink"
                >
                  <span>Details</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              {errorDetails}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="mx-auto max-w-md text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-structural bg-surface text-ink shadow-xs">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-xl font-bold uppercase tracking-wider text-ink">
              {title}
            </h1>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              {error.message || 'An unexpected error occurred in this view.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button size="sm" intent="primary" onClick={this.reset}>
              <RefreshCw size={13} className="mr-1.5" /> Try again
            </Button>
            <Button
              size="sm"
              intent="secondary"
              onClick={() => {
                this.reset()
                window.location.href = '/map'
              }}
            >
              <MapPin size={13} className="mr-1.5" /> Go to Map
            </Button>
          </div>
          <div>
            <button
              type="button"
              onClick={this.toggleDetails}
              className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink transition-colors"
            >
              <span>{showDetails ? 'Hide details' : 'Show error details'}</span>
              <ChevronDown
                size={12}
                className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
          {errorDetails}
        </div>
      </div>
    )
  }
}
