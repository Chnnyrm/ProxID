/**
 * A provider: cryptographic human proof first, then trade/services, then distance.
 *
 * Displays Concordium Zero-Knowledge verification status prominently.
 * Radii nest strictly: card 16px (rounded-2xl), inner 12px (rounded-xl), button 8px (rounded-lg).
 */

import { ArrowUpRight, CheckCircle, MapPin, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DemoBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { distance as formatDistance, money } from '@/lib/format'
import type { Provider } from '@/types/api'

export function ProviderCard({
  provider,
  onRequest,
}: {
  provider: Provider
  onRequest?: (provider: Provider) => void
}) {
  const [requesting, setRequesting] = useState(false)

  const handleHireClick = () => {
    setRequesting(true)
    setTimeout(() => {
      setRequesting(false)
      onRequest?.(provider)
    }, 200)
  }

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-sm transition-all duration-200 hover:border-structural flex flex-col justify-between">
      <div>
        {/* Top Header: Avatar + Title + Distance */}
        <div className="flex items-start gap-3">
          {provider.avatar_url ? (
            <img
              src={provider.avatar_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-sunken text-sm font-bold text-ink"
            >
              {provider.display_name.slice(0, 2).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-ink leading-tight">
                {provider.display_name}
              </h3>
              {provider.distance_km !== null ? (
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {formatDistance(provider.distance_km)}
                </span>
              ) : null}
            </div>

            <p className="mt-1 flex items-center gap-1 text-xs text-muted truncate">
              <MapPin size={12} className="shrink-0" />
              <span>{provider.neighbourhood ?? 'Neighbourhood not set'}</span>
            </p>
          </div>
        </div>

        {/* Concordium Attestation & Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {provider.concordium_verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-structural bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-xs">
              <ShieldCheck size={14} className="text-structural" />
              Concordium Verified Human
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-sunken/40 px-2 py-0.5 text-[11px] text-muted">
              Unverified account
            </span>
          )}

          <DemoBadge isDemo={provider.is_demo} />

          {provider.completed_jobs > 0 ? (
            <Badge tone="quiet">{provider.completed_jobs} jobs completed</Badge>
          ) : null}
        </div>

        {provider.bio ? (
          <p className="mt-3 text-sm text-muted line-clamp-2 leading-relaxed">
            {provider.bio}
          </p>
        ) : null}
      </div>

      {/* Services / Listings or Direct Hire Action */}
      <div className="mt-5 border-t border-line pt-4">
        {provider.services.length > 0 ? (
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
              Offered Services ({provider.services.length})
            </span>
            <ul className="space-y-1.5">
              {provider.services.slice(0, 2).map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-sunken/20 px-3 py-1.5 text-xs text-ink"
                >
                  <span className="truncate font-medium">{service.title}</span>
                  <span className="shrink-0 font-mono font-semibold">{money(service.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted">
            Available for custom quotes and nearby matching.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Link
            to={`/jobs?provider=${provider.id}`}
            className="text-xs font-medium text-muted hover:text-ink hover:underline flex items-center gap-1"
          >
            <span>See job history</span>
            <ArrowUpRight size={12} />
          </Link>

          <button
            type="button"
            disabled={requesting}
            onClick={handleHireClick}
            className="rounded-lg border border-structural bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs transition-colors duration-150 hover:bg-sunken disabled:opacity-50"
          >
            {requesting ? 'Connecting...' : 'Request Hire'}
          </button>
        </div>
      </div>
    </article>
  )
}
