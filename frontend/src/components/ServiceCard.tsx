/**
 * ServiceCard.tsx - Card for an individual service listing.
 *
 * Requirements:
 * - The unit of the list is a service listing, not a person.
 * - The whole card is a clickable link to /services/:serviceId, with visible chevron and hover lift.
 * - Listing photo as a 16:9 banner across the card top (opens lightbox on click).
 * - Provider's avatar as a 40px circle overlapping bottom-left (opens lightbox on click).
 * - Provider name links to /u/:username.
 * - Skeleton shaped like image while loading, CartoonIllustrations placeholder if null/error.
 * - Verified providers get official Concordium mark from /brands/concordium.svg.
 * - Flat palette tokens, nested radii: card 16px (rounded-2xl), button 8px (rounded-lg).
 * - Primary action: ink on sand, NEVER pink.
 * - Pure ASCII.
 */

import { ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { TradespersonIllustration } from '@/components/illustrations/CartoonIllustrations'
import { ListingSlideshow } from '@/components/ListingSlideshow'
import { SafeImage } from '@/components/SafeImage'
import { usePrefetchService } from '@/hooks/useProviders'
import { distance as formatDistance, money } from '@/lib/format'
import { useLightboxStore } from '@/store/lightboxStore'
import type { ServiceListing } from '@/types/api'

export function ServiceCard({
  service,
  onBook,
}: {
  service: ServiceListing
  onBook?: (service: ServiceListing) => void
}) {
  const navigate = useNavigate()
  const prefetchService = usePrefetchService()
  const openLightbox = useLightboxStore((state) => state.openLightbox)
  const initials = (service.provider_display_name || 'PR').slice(0, 2).toUpperCase()
  const displayPrice = money(service.price, service.currency)
  const serviceImages = (service.image_urls && service.image_urls.length > 0)
    ? service.image_urls
    : (service.image_url ? [service.image_url] : [])

  return (
    <Link
      to={`/services/${service.id}`}
      data-testid="service-card"
      onMouseEnter={() => prefetchService(service.id)}
      onFocus={() => prefetchService(service.id)}
      className="group rounded-2xl border border-line bg-surface overflow-hidden shadow-xs flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-structural cursor-pointer text-left"
    >
      {/* 16:9 Listing Photo Banner / Slideshow */}
      <div className="relative">
        <ListingSlideshow
          images={serviceImages}
          title={service.title}
          aspectRatioClass="aspect-video"
          fallback={
            <TradespersonIllustration className="h-16 w-16 opacity-75" size={64} />
          }
          onImageClick={(url) => openLightbox(url, service.title)}
        />

        {/* 40px provider avatar overlapping bottom-left corner with hairline ring */}
        <div className="absolute -bottom-5 left-4 z-10">
          <div
            className="relative h-10 w-10 shrink-0 rounded-full border-2 border-surface bg-page flex items-center justify-center overflow-hidden shadow-xs ring-1 ring-line cursor-pointer hover:scale-105 transition-transform"
            onClick={(e) => {
              if (service.provider_avatar_url) {
                e.preventDefault()
                e.stopPropagation()
                openLightbox(service.provider_avatar_url, service.provider_display_name || 'Provider Avatar')
              }
            }}
            title="Click to view avatar and download"
          >
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

          <h3 className="mt-1.5 text-sm font-bold text-ink leading-tight line-clamp-2 group-hover:underline">
            {service.title}
          </h3>

          <div className="mt-1 text-xs text-muted truncate">
            <span>by </span>
            {service.provider_username ? (
              <span
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  navigate(`/u/${service.provider_username}`)
                }}
                className="text-ink font-semibold hover:underline"
              >
                {service.provider_display_name || `@${service.provider_username}`}
              </span>
            ) : (
              <span className="text-ink font-medium">
                {service.provider_display_name || 'Verified Provider'}
              </span>
            )}
          </div>
        </div>

        {/* Price + Action Row with Chevron */}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 mt-1">
          <div>
            <span className="block font-mono text-[9px] uppercase text-muted tracking-wider">
              Standard Rate
            </span>
            <span className="font-bold text-sm text-ink">{displayPrice}</span>
          </div>

          <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ink group-hover:translate-x-1 transition-transform">
            <span>View Service</span>
            <ChevronRight size={15} />
          </div>
        </div>
      </div>
    </Link>
  )
}
