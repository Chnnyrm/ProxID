/**
 * A provider card in the cartoon minimalist visual language:
 * - 16:9 listing photo banner across the card top
 * - Provider's avatar as a 40px circle overlapping its bottom-left corner with a hairline ring
 * - Official Concordium mark on verified providers
 * - Name, rate, status, action (ink on sand, never pink)
 * - Skeleton shaped like the image while loading, CartoonIllustrations placeholder if null/error
 * - Nested radii: card 16px (rounded-2xl), button 8px (rounded-lg)
 * - Pure ASCII
 */

import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { TradespersonIllustration } from '@/components/illustrations/CartoonIllustrations'
import { SafeImage } from '@/components/SafeImage'
import { money } from '@/lib/format'
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

  const primaryService = provider.services[0]
  const displayPrice = primaryService?.price ? money(primaryService.price) : 'Custom rate'
  const initials = provider.display_name.slice(0, 2).toUpperCase()

  return (
    <article className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-structural">
      {/* 16:9 Listing Photo Banner */}
      <div className="relative">
        <div className="relative aspect-video w-full bg-sunken overflow-hidden">
          <SafeImage
            src={primaryService?.image_url}
            alt={primaryService?.title || provider.display_name}
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
              src={provider.avatar_url}
              alt={provider.display_name}
              fallback={<span className="font-bold text-xs text-ink">{initials}</span>}
              skeletonClassName="h-10 w-10 rounded-full"
            />
            {provider.concordium_verified && (
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
          <h3 className="truncate text-base font-bold text-ink leading-tight">
            {provider.display_name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {provider.concordium_verified ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-ink">
                <ShieldCheck size={13} className="text-structural" />
                Verified
              </span>
            ) : (
              <span className="font-mono text-[11px] text-muted">Active Node</span>
            )}
            {provider.distance_km !== null ? (
              <span className="font-mono text-[11px] text-muted">
                // {provider.distance_km.toFixed(1)} km
              </span>
            ) : null}
            {primaryService?.title ? (
              <span className="rounded-md border border-line bg-sunken/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted truncate max-w-[150px]">
                {primaryService.title}
              </span>
            ) : null}
          </div>
        </div>

        {/* Price + Action Row */}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 mt-1">
          <div className="min-w-0">
            <span className="block font-mono text-[9px] uppercase text-muted tracking-wider">
              Rate
            </span>
            <span className="font-bold text-sm text-ink">{displayPrice}</span>
          </div>

          <button
            type="button"
            disabled={requesting}
            onClick={handleHireClick}
            className="rounded-lg border border-structural bg-ink px-4 py-2 text-xs font-bold text-page transition-colors duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-50 shadow-xs"
          >
            {requesting ? 'Connecting...' : 'Request Hire'}
          </button>
        </div>
      </div>
    </article>
  )
}
