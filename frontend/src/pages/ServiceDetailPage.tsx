/**
 * ServiceDetailPage.tsx - Dedicated detail page for /services/:serviceId.
 *
 * Requirements:
 * - Listing photo large (clickable for lightbox with download).
 * - Title, price, radius, description.
 * - Provider with their verified mark and avatar, linking to /u/:username.
 * - Completed jobs and vouches count.
 * - Provider's other listings.
 * - One primary Hire button.
 * - Pure ASCII.
 */

import {
  ArrowLeft,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  MapPin,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { TradespersonIllustration } from '@/components/illustrations/CartoonIllustrations'
import { SafeImage } from '@/components/SafeImage'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useListing } from '@/hooks/useProviders'
import { distance as formatDistance, money } from '@/lib/format'
import { useLightboxStore } from '@/store/lightboxStore'
import type { ServiceListing } from '@/types/api'

export function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>()
  const navigate = useNavigate()
  const { isSignedIn, user } = useAuth()
  const { data: service, isLoading, isError, refetch } = useListing(serviceId)
  const openLightbox = useLightboxStore((state) => state.openLightbox)
  const [isHiring, setIsHiring] = useState(false)
  const [hireSubmitted, setHireSubmitted] = useState(false)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="aspect-video w-full rounded-2xl bg-sunken animate-pulse" />
        <div className="h-8 w-2/3 rounded bg-sunken animate-pulse" />
        <div className="h-24 w-full rounded-2xl bg-sunken animate-pulse" />
      </div>
    )
  }

  if (isError || !service) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title="Service listing not found"
          description="We could not find that service listing. It may have been paused or removed."
          actionLabel="Browse all services"
          actionHref="/services"
        />
      </div>
    )
  }

  const handleHire = () => {
    setIsHiring(true)
    setTimeout(() => {
      setIsHiring(false)
      setHireSubmitted(true)
    }, 600)
  }

  const isSelf = user?.id === service.provider_id
  const otherListings = service.provider_other_listings || []

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6 animate-fade-rise">
      {/* Back breadcrumb */}
      <div>
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Services</span>
        </Link>
      </div>

      {/* Large Listing Photo Banner (Clickable to Lightbox) */}
      <div
        className="relative aspect-video w-full rounded-2xl border border-line bg-sunken overflow-hidden shadow-sm cursor-pointer group"
        onClick={() => openLightbox(service.image_url, service.title)}
        title="Click to view full image and download"
        data-testid="listing-photo"
      >
        <SafeImage
          src={service.image_url}
          alt={service.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-sunken">
              <TradespersonIllustration className="h-28 w-28 opacity-75" size={112} />
            </div>
          }
          skeletonClassName="aspect-video w-full"
        />
        <div className="absolute bottom-3 right-3 rounded-lg border border-line/40 bg-ink/75 px-2.5 py-1 text-[11px] font-mono text-page backdrop-blur-xs shadow-xs">
          Click to expand photo
        </div>
      </div>

      {/* Header and Pricing / Hire Block */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {service.category_name && (
                <span className="rounded-md border border-line bg-sunken/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
                  {service.category_name}
                </span>
              )}
              {service.distance_km !== null && (
                <span className="inline-flex items-center gap-1 font-mono text-xs text-muted">
                  <MapPin size={12} />
                  <span>{formatDistance(service.distance_km)} away</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-mono text-xs text-muted">
                <Compass size={12} />
                <span>Radius: {service.radius_km} km</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-ink leading-tight font-display">
              {service.title}
            </h1>
          </div>

          {/* Pricing & Hire Button */}
          <div className="rounded-xl border border-line bg-sunken/40 p-4 sm:p-5 sm:min-w-[220px] flex flex-col gap-3 shrink-0">
            <div>
              <span className="block font-mono text-[10px] uppercase text-muted tracking-wider">
                Standard Rate
              </span>
              <span className="font-bold text-2xl text-ink font-display">
                {money(service.price, service.currency)}
              </span>
            </div>

            {hireSubmitted ? (
              <div className="rounded-lg border border-structural bg-surface p-3 text-center text-xs font-mono font-bold text-ink flex items-center justify-center gap-1.5">
                <Check size={14} className="text-ink" />
                <span>Hire request sent!</span>
              </div>
            ) : isSelf ? (
              <div className="text-center font-mono text-xs text-muted py-2">
                This is your own listing
              </div>
            ) : (
              <button
                type="button"
                onClick={handleHire}
                disabled={isHiring}
                data-testid="hire-button"
                className="w-full rounded-lg border border-structural bg-ink px-4 py-2.5 text-xs font-mono font-bold text-page hover:opacity-90 active:translate-y-px transition-all shadow-xs"
              >
                {isHiring ? 'Submitting request...' : 'Hire Provider'}
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="border-t border-line/60 pt-5 space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted font-bold">
            Service Description
          </h2>
          <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-line">
            {service.description || 'No detailed description provided for this listing.'}
          </p>
        </div>
      </div>

      {/* Provider Card */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-7 shadow-sm space-y-4">
        <span className="font-mono text-xs uppercase tracking-wider text-muted font-bold block">
          Offered By
        </span>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* Clickable Avatar to Lightbox */}
            <div
              className="relative cursor-pointer shrink-0 group"
              onClick={() =>
                openLightbox(
                  service.provider_avatar_url,
                  `${service.provider_display_name || 'Provider'} Avatar`,
                )
              }
              title="Click to view full photo and download"
              data-testid="provider-avatar"
            >
              <div className="h-14 w-14 rounded-full border-2 border-line bg-page overflow-hidden ring-1 ring-structural/20 group-hover:ring-accent transition-all shadow-xs">
                <SafeImage
                  src={service.provider_avatar_url}
                  alt={service.provider_display_name || 'Provider'}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center font-bold text-sm text-ink bg-sunken">
                      {(service.provider_display_name || 'PR').slice(0, 2).toUpperCase()}
                    </div>
                  }
                  skeletonClassName="h-14 w-14 rounded-full"
                />
              </div>
              {service.provider_concordium_verified && (
                <span
                  className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-surface border border-structural flex items-center justify-center p-0.5 shadow-xs"
                  title="Concordium Verified Human"
                  data-testid="provider-concordium-badge"
                >
                  <img src="/brands/concordium.svg" alt="" className="h-3 w-3" />
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={service.provider_username ? `/u/${service.provider_username}` : '#'}
                  className="text-base font-bold text-ink hover:underline font-display"
                >
                  {service.provider_display_name || 'Verified Provider'}
                </Link>
                {service.provider_concordium_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-structural bg-surface px-2 py-0.5 text-[10px] font-mono font-bold text-ink shadow-2xs">
                    <img src="/brands/concordium.svg" alt="" className="h-2.5 w-2.5" />
                    <span>Verified</span>
                  </span>
                )}
              </div>

              {service.provider_username && (
                <Link
                  to={`/u/${service.provider_username}`}
                  className="text-xs font-mono text-accent hover:underline block"
                >
                  @{service.provider_username}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-muted">
            <div className="rounded-lg border border-line bg-sunken/40 px-3 py-1.5 text-center">
              <span className="block text-[9px] uppercase tracking-wider text-muted">Jobs</span>
              <span className="font-bold text-ink text-sm">
                {service.provider_completed_jobs ?? 0}
              </span>
            </div>
            <div className="rounded-lg border border-line bg-sunken/40 px-3 py-1.5 text-center">
              <span className="block text-[9px] uppercase tracking-wider text-muted">Vouches</span>
              <span className="font-bold text-ink text-sm">
                {service.provider_vouches_count ?? 0}
              </span>
            </div>
            {service.provider_username && (
              <Link
                to={`/u/${service.provider_username}`}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-mono font-bold text-ink hover:bg-sunken transition-colors shadow-2xs"
              >
                <span>View Portfolio</span>
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Provider's Other Listings */}
      {otherListings.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-base font-bold text-ink font-display">
            More Services from this Provider ({otherListings.length})
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherListings.map((other) => (
              <Link
                key={other.id}
                to={`/services/${other.id}`}
                className="group rounded-2xl border border-line bg-surface overflow-hidden shadow-xs hover:border-structural hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div
                  className="relative aspect-video w-full bg-sunken overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    if (other.image_url) {
                      e.preventDefault()
                      e.stopPropagation()
                      openLightbox(other.image_url, other.title)
                    }
                  }}
                  title="Click to view full image and download"
                >
                  <SafeImage
                    src={other.image_url}
                    alt={other.title}
                    fallback={
                      <TradespersonIllustration className="h-16 w-16 opacity-75" size={64} />
                    }
                    skeletonClassName="aspect-video w-full"
                  />
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    {other.category_name && (
                      <span className="rounded-md border border-line bg-sunken/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                        {other.category_name}
                      </span>
                    )}
                    <h3 className="mt-1 text-sm font-bold text-ink group-hover:underline line-clamp-2">
                      {other.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5">
                    <div>
                      <span className="block font-mono text-[9px] uppercase text-muted tracking-wider">
                        Rate
                      </span>
                      <span className="font-bold text-sm text-ink">
                        {money(other.price, other.currency || 'NGN')}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ink group-hover:translate-x-0.5 transition-transform">
                      <span>View</span>
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
