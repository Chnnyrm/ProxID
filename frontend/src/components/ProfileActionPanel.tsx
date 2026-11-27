/**
 * ProfileActionPanel.tsx
 *
 * Paper-craft illustrated action panel for /profile:
 * - Replaces isolated "post a job" card with dual commerce actions:
 *   1. Post a Job -> /jobs?compose=1
 *   2. Offer a Service -> /services?compose=1
 * - Paper-craft cartoon illustrations (House and Tradesperson).
 * - Single-line explanatory copy for each action.
 * - Flat palette tokens, ink-on-sand controls.
 * - Pure ASCII.
 */

import { ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  HouseIllustration,
  TradespersonIllustration,
} from '@/components/illustrations/CartoonIllustrations'

export function ProfileActionPanel() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="profile-action-panel">
      {/* 1. Post a Job */}
      <Link
        to="/jobs?compose=1"
        data-testid="profile-action-post-job"
        className="group relative flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-structural hover:shadow-md text-left"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sunken/60 border border-line p-2 group-hover:scale-105 transition-transform">
            <HouseIllustration className="h-12 w-12 opacity-90" size={48} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
              Marketplace Request
            </span>
            <h3 className="font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-ink mt-0.5">
              Post a Job
            </h3>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Describe what needs doing to receive bids from verified local tradespeople.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
          <span className="font-mono text-xs font-bold text-ink">Target neighborhood</span>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-structural bg-ink px-3 py-1.5 text-xs font-mono font-bold text-page group-hover:opacity-90 transition-opacity shadow-xs">
            <Plus size={12} />
            <span>Compose Post</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </Link>

      {/* 2. Offer a Service */}
      <Link
        to="/services?compose=1"
        data-testid="profile-action-offer-service"
        className="group relative flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-structural hover:shadow-md text-left"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sunken/60 border border-line p-2 group-hover:scale-105 transition-transform">
            <TradespersonIllustration className="h-12 w-12 opacity-90" size={48} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
              Trade Provider
            </span>
            <h3 className="font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-ink mt-0.5">
              Offer a Service
            </h3>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              List your trade and hourly or fixed rate for clients nearby to book directly.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
          <span className="font-mono text-xs font-bold text-ink">Publish listing</span>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-structural bg-ink px-3 py-1.5 text-xs font-mono font-bold text-page group-hover:opacity-90 transition-opacity shadow-xs">
            <Plus size={12} />
            <span>Create Listing</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </Link>
    </div>
  )
}
