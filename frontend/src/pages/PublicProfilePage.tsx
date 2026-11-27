/**
 * PublicProfilePage.tsx - Shareable unauthenticated portfolio profile (/u/:username).
 *
 * Requirements:
 * - Reachable without authentication.
 * - Avatar, display name, @username, verified state with official Concordium mark (/brands/concordium.svg).
 * - Services offered with prices, linking to each /services/:serviceId.
 * - Jobs completed, vouches received, member since.
 * - Copy link control (with visual confirmation) and Share control.
 * - Image opens in Lightbox with working Download control on click.
 * - Pure ASCII.
 */

import {
  Briefcase,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Share2,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { TradespersonIllustration } from '@/components/illustrations/CartoonIllustrations'
import { ListingSlideshow } from '@/components/ListingSlideshow'
import { SafeImage } from '@/components/SafeImage'
import { usePublicProfile } from '@/hooks/usePublicProfile'
import { money } from '@/lib/format'
import { useLightboxStore } from '@/store/lightboxStore'

export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { data: profile, isLoading, isError, refetch } = usePublicProfile(username)
  const openLightbox = useLightboxStore((state) => state.openLightbox)
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleShare = async () => {
    if (navigator.share && profile) {
      try {
        await navigator.share({
          title: `${profile.display_name} (@${profile.username}) on ProxID`,
          text: `Check out ${profile.display_name}'s verified services and portfolio on ProxID.`,
          url: window.location.href,
        })
      } catch {
        // Fallback to copy
        await handleCopyLink()
      }
    } else {
      await handleCopyLink()
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 animate-pulse space-y-4">
          <div className="h-24 w-24 rounded-full bg-sunken" />
          <div className="h-6 w-48 rounded bg-sunken" />
          <div className="h-4 w-32 rounded bg-sunken" />
        </div>
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title="Portfolio profile not found"
          description={`We could not find a public profile matching @${username || ''}. It may have been removed or changed.`}
          actionLabel="Browse all services"
          actionHref="/services"
        />
      </div>
    )
  }

  const memberDate = profile.member_since
    ? new Date(profile.member_since).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : 'Recent member'

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6 animate-fade-rise">
      {/* Top Portfolio Header Card */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Clickable Avatar with Concordium Verified Badge */}
            <div
              className="relative cursor-pointer group shrink-0"
              onClick={() => openLightbox(profile.avatar_url, `${profile.display_name} Avatar`)}
              title="Click to view full photo and download"
              data-testid="profile-avatar"
            >
              <div className="h-24 w-24 rounded-full border-2 border-line bg-page overflow-hidden ring-2 ring-structural/20 group-hover:ring-accent transition-all shadow-md">
                <SafeImage
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center font-bold text-2xl text-ink bg-sunken">
                      {profile.display_name.slice(0, 2).toUpperCase()}
                    </div>
                  }
                  skeletonClassName="h-24 w-24 rounded-full"
                />
              </div>
              {profile.concordium_verified && (
                <span
                  className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-surface border-2 border-structural flex items-center justify-center p-1 shadow-md"
                  title="Concordium Zero-Knowledge Verified Human"
                  data-testid="concordium-badge"
                >
                  <img
                    src="/brands/concordium.svg"
                    alt="Concordium"
                    className="h-4 w-4"
                  />
                </span>
              )}
            </div>

            {/* Identity details */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-display">
                  {profile.display_name}
                </h1>
                {profile.concordium_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-structural bg-surface px-2.5 py-0.5 text-xs font-mono font-bold text-ink shadow-2xs">
                    <img src="/brands/concordium.svg" alt="" className="h-3 w-3" />
                    <span>Verified Human</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-muted flex-wrap">
                <span className="text-accent font-semibold">@{profile.username}</span>
                {profile.neighbourhood && (
                  <span className="inline-flex items-center gap-1 text-ink/80">
                    <MapPin size={12} className="text-muted" />
                    <span>{profile.neighbourhood}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} />
                  <span>Member since {memberDate}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Share & Copy Link Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              data-testid="copy-link-btn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-mono font-bold text-ink hover:bg-sunken transition-colors shadow-2xs"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-ink" />
                  <span className="text-ink">Copied!</span>
                </>
              ) : (
                <>
                  <ExternalLink size={14} />
                  <span>Copy link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              data-testid="share-btn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-structural bg-ink px-3 py-1.5 text-xs font-mono font-bold text-page hover:opacity-90 transition-opacity shadow-2xs"
            >
              <Share2 size={14} />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-ink/90 leading-relaxed max-w-2xl border-t border-line/60 pt-4">
            {profile.bio}
          </p>
        )}

        {/* Reputation & Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-line pt-4">
          <div className="rounded-xl border border-line bg-sunken/40 p-3 text-center sm:text-left">
            <span className="block font-mono text-[10px] uppercase text-muted tracking-wider">
              Completed Jobs
            </span>
            <span className="font-bold text-lg text-ink font-display">
              {profile.completed_jobs}
            </span>
          </div>
          <div className="rounded-xl border border-line bg-sunken/40 p-3 text-center sm:text-left">
            <span className="block font-mono text-[10px] uppercase text-muted tracking-wider">
              Vouches Received
            </span>
            <span className="font-bold text-lg text-ink font-display">
              {profile.vouches_count}
            </span>
          </div>
          <div className="rounded-xl border border-line bg-sunken/40 p-3 text-center sm:text-left col-span-2 sm:col-span-1">
            <span className="block font-mono text-[10px] uppercase text-muted tracking-wider">
              Verification State
            </span>
            <span className="font-bold text-sm text-ink">
              {profile.concordium_verified ? 'Concordium Attested' : 'Unverified'}
            </span>
          </div>
        </div>
      </div>

      {/* Services Offered Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-ink font-display">
            Services Offered ({profile.services.length})
          </h2>
          <Link
            to="/services"
            className="text-xs font-mono text-muted hover:text-ink transition-colors flex items-center gap-1"
          >
            <span>Explore all services</span>
            <ChevronRight size={12} />
          </Link>
        </div>

        {profile.services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-xs text-muted">
            This provider currently has no active public service listings.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.services.map((svc) => (
              <Link
                key={svc.id}
                to={`/services/${svc.id}`}
                className="group rounded-2xl border border-line bg-surface overflow-hidden shadow-xs hover:border-structural hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                {/* Listing Slideshow */}
                <ListingSlideshow
                  images={svc.image_url ? [svc.image_url] : []}
                  title={svc.title}
                  aspectRatioClass="aspect-video"
                  fallback={
                    <TradespersonIllustration className="h-16 w-16 opacity-75" size={64} />
                  }
                  onImageClick={(url) => openLightbox(url, svc.title)}
                />

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    {svc.category_name && (
                      <span className="rounded-md border border-line bg-sunken/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                        {svc.category_name}
                      </span>
                    )}
                    <h3 className="mt-1 text-sm font-bold text-ink group-hover:underline line-clamp-2">
                      {svc.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-2.5">
                    <div>
                      <span className="block font-mono text-[9px] uppercase text-muted tracking-wider">
                        Rate
                      </span>
                      <span className="font-bold text-sm text-ink">
                        {money(svc.price, 'NGN')}
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
        )}
      </div>
    </div>
  )
}
