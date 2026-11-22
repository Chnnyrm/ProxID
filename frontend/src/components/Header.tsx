/**
 * The header: ProxID logo mark, theme toggle, and session-aware navigation.
 *
 * Logged-out visitors see only branding and sign in / sign up actions.
 * Internal routes (Jobs, Providers, Agent, Profile) are strictly hidden until signed in.
 */

import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { AuthDialog } from '@/components/AuthDialog'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DemoBadge } from '@/components/VerifiedBadge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'

const LINKS = [
  { to: '/jobs', label: 'Jobs' },
  { to: '/providers', label: 'Providers' },
  { to: '/agent', label: 'Agent' },
  { to: '/profile', label: 'Profile' },
]

export function Header() {
  const { isSignedIn, displayName, isDemo, logout, isLoading } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')

  const openAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab)
    setAuthOpen(true)
  }

  return (
    <>
      <header className="sticky top-0 z-[700] border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-ink">
            <Logo className="h-6 w-6 shrink-0" />
            <span className="text-base tracking-tight">ProxID</span>
          </Link>

          {/* Navigation: only visible to signed-in users */}
          {isSignedIn ? (
            <nav aria-label="Main" className="min-w-0 flex-1 overflow-x-auto mx-2">
              <ul className="flex items-center gap-1 text-sm">
                {LINKS.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) =>
                        cn(
                          'inline-block rounded-full px-2.5 py-1 font-medium transition-colors duration-200 ease-house',
                          isActive ? 'bg-accent-wash text-ink' : 'text-muted hover:text-ink',
                        )
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex shrink-0 items-center gap-2">
            {isLoading ? (
              <span className="skeleton h-7 w-24 rounded-full" aria-hidden="true" />
            ) : isSignedIn ? (
              <>
                {isDemo ? (
                  <span className="hidden sm:inline">
                    <DemoBadge isDemo />
                  </span>
                ) : null}
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink sm:inline">
                  {displayName}
                </span>
                <Button intent="ghost" size="sm" onClick={() => void logout()}>
                  Sign out
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors duration-200 ease-house hover:bg-accent-wash active:translate-y-px"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="rounded-full border border-structural bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink transition-transform duration-200 ease-house hover:brightness-105 active:translate-y-px"
                >
                  Sign up
                </button>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />
    </>
  )
}
