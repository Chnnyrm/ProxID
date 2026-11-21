/**
 * The header: the one structural mocha bar, the theme toggle, and the session state.
 *
 * The nav collapses to a single row of text links at 390px rather than a hamburger,
 * because there are only four destinations and a menu would hide them.
 */

import { Link, NavLink } from 'react-router-dom'

import { DemoBadge } from '@/components/VerifiedBadge'
import { ThemeToggle } from '@/components/ThemeToggle'
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

  return (
    <header className="sticky top-0 z-[700] border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold text-ink">
          <span
            aria-hidden="true"
            className="inline-block h-5 w-5 rounded-[6px] border border-structural bg-accent"
          />
          <span>ProxID</span>
        </Link>

        <nav aria-label="Main" className="min-w-0 flex-1 overflow-x-auto">
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

        <div className="flex shrink-0 items-center gap-2">
          {isLoading ? (
            <span className="skeleton h-7 w-24 rounded-full" aria-hidden="true" />
          ) : isSignedIn ? (
            <>
              {isDemo ? <span className="hidden sm:inline"><DemoBadge isDemo /></span> : null}
              <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink sm:inline">
                {displayName}
              </span>
              <Button intent="ghost" size="sm" onClick={() => void logout()}>
                Sign out
              </Button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-full border border-structural bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-transform duration-200 ease-house active:translate-y-px"
            >
              Sign in
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
