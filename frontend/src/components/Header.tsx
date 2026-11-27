/**
 * The top header bar:
 * - On mobile (< 1024px): compact bar with logo, theme toggle, and auth actions.
 * - On desktop (>= 1024px): minimal top utility bar complementing the left navigation rail.
 * - Primary actions are ink on sand, NEVER pink.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'

import { AuthDialog } from '@/components/AuthDialog'
import { Logo } from '@/components/Logo'
import { NotificationBell } from '@/components/NotificationBell'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

export function Header() {
  const { isSignedIn, displayName, logout, isLoading } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')

  const openAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab)
    setAuthOpen(true)
  }

  return (
    <>
      <header className="sticky top-0 z-[600] border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          {/* Mobile Logo Mark */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/"
              className="lg:hidden flex shrink-0 items-center gap-2 font-bold tracking-tight text-ink"
            >
              <div className="h-8 w-8 rounded-lg border-2 border-structural bg-page flex items-center justify-center">
                <Logo className="h-5 w-5 shrink-0" />
              </div>
              <span className="font-display text-base tracking-tight font-bold">ProxID</span>
            </Link>

            <span className="hidden lg:inline font-mono text-[10px] uppercase tracking-wider text-muted">
              CONCORDIUM PROXIMITY ATTESTATION // DEVNET 2.0
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {isLoading ? (
              <span className="skeleton h-8 w-24 rounded-lg" aria-hidden="true" />
            ) : isSignedIn ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/messages"
                  className="rounded-lg border border-line bg-surface p-2 text-ink transition-colors hover:bg-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-structural"
                  title="Messages and Job Rooms"
                  aria-label="Messages and Job Rooms"
                >
                  <MessageSquare size={16} aria-hidden="true" />
                </Link>
                <NotificationBell />
                <span className="max-w-[10rem] truncate text-xs font-semibold text-ink">
                  {displayName}
                </span>
                <Button intent="ghost" size="sm" onClick={() => void logout()}>
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-sunken active:translate-y-px"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="rounded-lg border border-structural bg-ink px-3.5 py-1.5 text-xs font-bold text-page transition-colors duration-150 hover:opacity-90 active:translate-y-px shadow-xs"
                >
                  Sign up
                </button>
              </div>
            )}
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />
    </>
  )
}
