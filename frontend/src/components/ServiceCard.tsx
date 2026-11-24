/**
 * ServiceCard.tsx - Card for an individual service listing.
 *
 * Requirements:
 * - The unit of the list is a service listing, not a person.
 * - Shows: cartoon/provider avatar, title, provider name, price, distance, verified badge.
 * - Verified providers get official Concordium mark from /brands/concordium.svg.
 * - Flat palette tokens, nested radii: card 16px (rounded-2xl), button 8px (rounded-lg).
 * - Primary action: ink on sand, NEVER pink.
 * - Pure ASCII.
 */

import { useState } from 'react'

import { distance as formatDistance, money } from '@/lib/format'
import type { ServiceListing } from '@/types/api'

export function ServiceCard({
  service,
  onBook,
}: {
  service: ServiceListing
  onBook?: (service: ServiceListing) => void
}) {
  const [isBooking, setIsBooking] = useState(false)

  const handleBook = () => {
    setIsBooking(true)
    setTimeout(() => {
      setIsBooking(false)
      onBook?.(service)
    }, 200)
  }

  const initials = (service.provider_display_name || 'PR').slice(0, 2).toUpperCase()
  const displayPrice = money(service.price, service.currency)

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-4 transition-all duration-200 hover:border-structural">
      <div className="flex items-start gap-3">
        {/* Avatar with Concordium verification badge */}
        <div className="relative h-12 w-12 shrink-0 rounded-full border-2 border-structural bg-page flex items-center justify-center overflow-hidden">
          {service.provider_avatar_url ? (
            <img
              src={service.provider_avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-bold text-xs text-ink">{initials}</span>
          )}
          {service.provider_concordium_verified && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-surface border border-structural flex items-center justify-center p-0.5 shadow-xs"
              title="Verified Human (Concordium ZK)"
            >
              <img
                src="/brands/concordium.svg"
                alt="Concordium"
                className="h-2.5 w-2.5"
              />
            </span>
          )}
        </div>

        {/* Listing Title + Category + Provider Name */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {service.category_name ? (
              <span className="rounded-md border border-line bg-sunken/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                {service.category_name}
              </span>
            ) : null}
            {service.distance_km !== null ? (
              <span className="font-mono text-[10px] text-muted">
                {formatDistance(service.distance_km)}
              </span>
            ) : null}
          </div>

          <h3 className="mt-1 text-sm font-bold text-ink leading-tight line-clamp-2">
            {service.title}
          </h3>

          <p className="mt-0.5 text-xs text-muted truncate">
            by {service.provider_display_name || 'Verified Provider'}
          </p>
        </div>
      </div>

      {/* Price + Action Row */}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <div>
          <span className="block font-mono text-[9px] uppercase text-muted tracking-wider">
            Standard Rate
          </span>
          <span className="font-bold text-sm text-ink">{displayPrice}</span>
        </div>

        <button
          type="button"
          disabled={isBooking}
          onClick={handleBook}
          className="rounded-lg border border-structural bg-ink px-4 py-2 text-xs font-bold text-page transition-all duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-50 shadow-xs"
        >
          {isBooking ? 'Connecting...' : 'Book Service'}
        </button>
      </div>
    </article>
  )
}
