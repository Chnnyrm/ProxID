/**
 * A provider: the human proof first, then the work, then the distance.
 *
 * The verified badge leads because it is the product's promise; the star rating is
 * deliberately absent while there is no ratings table, rather than showing a zero that
 * would read as a bad score.
 */

import { Link } from 'react-router-dom'

import { DemoBadge, VerifiedBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { distance as formatDistance, money } from '@/lib/format'
import type { Provider } from '@/types/api'

export function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <article className="animate-fade-rise rounded-card border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {provider.avatar_url ? (
          <img
            src={provider.avatar_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-sunken text-sm font-semibold text-ink"
          >
            {provider.display_name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight text-ink">
            {provider.display_name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted">
            {provider.neighbourhood ?? 'Neighbourhood not set'}
            {provider.distance_km !== null ? ` - ${formatDistance(provider.distance_km)}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <VerifiedBadge verified={provider.concordium_verified} />
        <DemoBadge isDemo={provider.is_demo} />
        {provider.completed_jobs > 0 ? (
          <Badge tone="quiet">{provider.completed_jobs} jobs completed</Badge>
        ) : null}
      </div>

      {provider.bio ? <p className="mt-2 line-clamp-2 text-sm text-muted">{provider.bio}</p> : null}

      {provider.services.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {provider.services.slice(0, 3).map((service) => (
            <li key={service.id} className="flex items-baseline justify-between gap-2 text-sm">
              <Link to={`/jobs?provider=${provider.id}`} className="min-w-0 truncate text-ink hover:underline">
                {service.title}
              </Link>
              <span className="shrink-0 font-medium text-ink">{money(service.price)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          No published listings yet. Post a job and they can respond.
        </p>
      )}
    </article>
  )
}
