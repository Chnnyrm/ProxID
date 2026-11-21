/**
 * A job in a list: what it is, what it pays, where, and how fresh it is.
 *
 * The distance shown is the server's true distance, never a ranked one, so a verified
 * provider's position is never flattered on this card.
 */

import { Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DemoBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { distance, money, statusLabel, timeAgo } from '@/lib/format'
import type { Job } from '@/types/api'

export function JobCard({ job }: { job: Job }) {
  return (
    <article className="animate-fade-rise rounded-card border border-line bg-surface p-4 shadow-sm transition-transform duration-200 ease-house hover:-translate-y-0.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-base font-semibold leading-tight text-ink">
          <Link to={`/jobs/${job.id}`} className="hover:underline">
            {job.title}
          </Link>
        </h3>
        <span className="shrink-0 text-sm font-semibold text-ink">{money(job.price, job.currency)}</span>
      </div>

      {job.description ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{job.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={job.status === 'open' ? 'neutral' : 'quiet'}>{statusLabel(job.status)}</Badge>
        {job.category_name ? <Badge tone="quiet">{job.category_name}</Badge> : null}
        {job.distance_km !== null ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <MapPin size={12} aria-hidden="true" />
            {distance(job.distance_km)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <Clock size={12} aria-hidden="true" />
          {timeAgo(job.created_at)}
        </span>
        <DemoBadge isDemo={job.is_demo} />
      </div>
    </article>
  )
}
