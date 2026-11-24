/**
 * Navigation icon bar matching mobile app UX:
 * - 5 icons maximum, labels under them.
 * - Mobile (< 1024px): primary bottom navigation bar.
 * - Desktop (>= 1024px): left navigation rail.
 * - Flat palette tokens, 8px button radius, zero pink controls.
 */

import { Bot, Briefcase, Home, MapPin, User, Wrench } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  tour?: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/map', label: 'Map', icon: MapPin, tour: 'nav-map' },
  { to: '/services', label: 'Services', icon: Wrench, tour: 'nav-services' },
  { to: '/jobs', label: 'Jobs', icon: Briefcase, tour: 'nav-jobs' },
  { to: '/agent', label: 'Agent', icon: Bot, tour: 'nav-agent' },
  { to: '/profile', label: 'Profile', icon: User, tour: 'nav-profile' },
]

export function Navigation() {
  const location = useLocation()
  const { isSignedIn, displayName } = useAuth()

  return (
    <>
      {/* 1. Desktop Left Rail (>= 1024px) */}
      <aside
        aria-label="Desktop navigation rail"
        className="hidden lg:flex fixed left-0 top-0 bottom-0 w-24 z-[700] flex-col items-center justify-between border-r border-line bg-surface py-6 select-none"
      >
        {/* Top: Brand Logo */}
        <Link
          to="/"
          className="flex flex-col items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-structural rounded-xl p-1"
          title="ProxID Home"
        >
          <div className="h-10 w-10 rounded-xl border-2 border-structural bg-page flex items-center justify-center shadow-xs">
            <Logo className="h-6 w-6" />
          </div>
          <span className="font-display text-sm uppercase tracking-wider text-ink font-bold">
            PROXID
          </span>
        </Link>

        {/* Center: 5 Nav Icons with Labels Underneath */}
        <nav aria-label="Main navigation" className="flex flex-col items-center gap-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)

            return (
              <Link
                key={item.to}
                to={item.to}
                data-tour={item.tour}
                className={`group flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-all duration-150 ${
                  isActive
                    ? 'border border-structural bg-page text-ink shadow-xs'
                    : 'border border-transparent text-muted hover:text-ink hover:bg-sunken/40'
                }`}
              >
                <Icon
                  size={20}
                  className={`transition-transform duration-150 ${
                    isActive ? 'scale-110 text-ink' : 'group-hover:scale-105'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`mt-1 font-mono text-[9px] uppercase tracking-wider ${
                    isActive ? 'font-bold text-ink' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Theme Toggle & Session Info */}
        <div className="flex flex-col items-center gap-3">
          <ThemeToggle />
          {isSignedIn && displayName ? (
            <div
              className="h-8 w-8 rounded-full border border-structural bg-sunken flex items-center justify-center font-bold text-xs text-ink shadow-xs"
              title={displayName}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          ) : null}
        </div>
      </aside>

      {/* 2. Mobile Bottom Bar (< 1024px) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-[700] border-t border-line bg-surface/95 backdrop-blur-md px-2 py-1.5 flex items-center justify-around select-none safe-area-pb"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)

          return (
            <Link
              key={item.to}
              to={item.to}
              data-tour={item.tour}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-colors ${
                isActive ? 'text-ink font-bold' : 'text-muted hover:text-ink'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform ${
                  isActive ? 'bg-sunken border border-structural scale-105 text-ink' : ''
                }`}
              >
                <Icon size={18} aria-hidden="true" />
              </div>
              <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
