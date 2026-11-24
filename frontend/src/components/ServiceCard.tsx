/**
 * ServiceCard.tsx - Card for an individual service listing.
 *
 * Requirements:
 * - The unit of the list is a service listing, not a person.
 * - Listing photo as a 16:9 banner across the card top.
 * - Provider's avatar as a 40px circle overlapping its bottom-left corner with a hairline ring.
 * - Skeleton shaped like the image while loading, CartoonIllustrations placeholder if null or error.
 * - Verified providers get official Concordium mark from /brands/concordium.svg.
 * - Flat palette tokens, nested radii: card 16px (rounded-2xl), button 8px (rounded-lg).
 * - Primary action: ink on sand, NEVER pink.
 * - Pure ASCII.
 */

import { useState } from 'react'

import { TradespersonIllustration } from '@/components/illustrations/CartoonIllustrations'
import { SafeImage } from '@/components/SafeImage'
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
    <article className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-structural">
      {/* 16:9 Listing Photo Banner */}
      <div className="relative">
        <div className="relative aspect-video w-full bg-sunken overflow-hidden">
          <SafeImage
            src={service.image_url}
            alt={service.title}
            fallback={
              <TradespersonIllustration className="h-16 w-16 opacity-75" size={64} />
            }
            skeletonClassName="aspect-video w-full"
          />
        </div>

        {/* 40px provider avatar overlapping bottom-left corner with hairline ring */}
        <div className="absolute -bottom-5 left-4">
          <div className="relative h-10 w-10 shrink-0 rounded-full border-2 border-surface bg-page flex items-center justify-center overflow-hidden shadow-xs ring-1 ring-line">
            <SafeImage
              src={service.provider_avatar_url}
              alt={service.provider_display_name || ''}
              fallback={<span className="font-bold text-xs text-ink">{initials}</span>}
              skeletonClassName="h-10 w-10 rounded-full"
            />
            {service.provider_concordium_verified && (
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-surface border border-structural flex items-center justify-center p-0.5 shadow-xs"
                title="Verified Human (Concordium ZK)"
              >
                <img
                  src="/brands/concordium.svg"
                  alt="Concordium"
                  className="h-2 w-2"
                />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card body with padding clearing avatar overlap */}
      <div className="pt-7 px-4 pb-4 sm:px-5 sm:pb-5 flex-1 flex flex-col justify-between gap-3">
        <div>
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

          <h3 className="mt-1.5 text-sm font-bold text-ink leading-tight line-clamp-2">
            {service.title}
          </h3>

          <p className="mt-1 text-xs text-muted truncate">
            by {service.provider_display_name || 'Verified Provider'}
          </p>
        </div>

        {/* Price + Action Row */}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 mt-1">
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
      </div>
    </article>
  )
}
