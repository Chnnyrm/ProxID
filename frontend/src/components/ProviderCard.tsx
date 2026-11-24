/**
 * A provider card in the cartoon minimalist visual language:
 * - Illustrated avatar
 * - Name
 * - One price
 * - One status
 * - One action (ink on sand, never pink)
 * - Zero prose / zero sentences
 * - Nested radii: card 16px (rounded-2xl), button 8px (rounded-lg)
 */

import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'

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
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-sm flex flex-col justify-between gap-4 transition-all duration-200 hover:border-structural">
      <div className="flex items-center gap-3">
        {/* Illustrated Avatar */}
        <div className="relative h-12 w-12 shrink-0 rounded-full border-2 border-structural bg-page flex items-center justify-center overflow-hidden">
          {provider.avatar_url ? (
            <img
              src={provider.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-bold text-sm text-ink">{initials}</span>
          )}
          {provider.concordium_verified && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-accent border border-structural flex items-center justify-center"
              title="Verified Human"
            >
              <span className="block h-1.5 w-1.5 rounded-full bg-ink" />
            </span>
          )}
        </div>

        {/* Name + Status */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-ink leading-tight">
            {provider.display_name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5">
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
          </div>
        </div>
      </div>

      {/* Price + Action Row */}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="min-w-0">
          <span className="block font-mono text-[10px] uppercase text-muted tracking-wider">Rate</span>
          <span className="font-bold text-sm text-ink">{displayPrice}</span>
        </div>

        {/* Action: ink on sand, NEVER pink */}
        <button
          type="button"
          disabled={requesting}
          onClick={handleHireClick}
          className="rounded-lg border border-structural bg-ink px-4 py-2 text-xs font-bold text-page transition-colors duration-150 hover:opacity-90 active:translate-y-px disabled:opacity-50"
        >
          {requesting ? 'Connecting...' : 'Request Hire'}
        </button>
      </div>
    </article>
  )
}
