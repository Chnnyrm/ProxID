/**
 * A job in a list: what it is, what it pays, where, and how fresh it is.
 *
 * Requirements:
 * - 88x88 thumbnail on the left, radius 12 (rounded-xl)
 * - Skeleton shaped like the image while loading
 * - CartoonIllustrations placeholder (HouseIllustration) if null or error
 * - Never a broken-image icon
 * - Pure ASCII
 */

import { Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { HouseIllustration } from '@/components/illustrations/CartoonIllustrations'
import { SafeImage } from '@/components/SafeImage'
import { Badge } from '@/components/ui/badge'
import { distance, money, statusLabel, timeAgo } from '@/lib/format'
import type { Job } from '@/types/api'

export function JobCard({ job }: { job: Job }) {
  return (
    <article className="animate-fade-rise rounded-card border border-line bg-surface p-3.5 sm:p-4 shadow-sm transition-transform duration-200 ease-house hover:-translate-y-0.5 flex items-start gap-3.5">
      {/* 88x88 thumbnail on the left, radius 12 */}
      <div className="relative h-[88px] w-[88px] shrink-0 rounded-xl overflow-hidden bg-sunken border border-line">
        <SafeImage
          src={job.image_url}
          alt={job.title}
          className="h-full w-full object-cover"
          fallback={
            <HouseIllustration className="h-12 w-12 opacity-80" size={48} />
          }
          skeletonClassName="h-[88px] w-[88px]"
        />
      </div>

      {/* Details column */}
      <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-sm sm:text-base font-semibold leading-tight text-ink line-clamp-2">
              <Link to={`/jobs/${job.id}`} className="hover:underline">
                {job.title}
              </Link>
            </h3>
            <span className="shrink-0 font-mono text-xs sm:text-sm font-bold text-ink">
              {money(job.price, job.currency)}
            </span>
          </div>

          {job.description ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted">{job.description}</p>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={job.status === 'open' ? 'neutral' : 'quiet'}>
            {statusLabel(job.status)}
          </Badge>
          {job.category_name ? <Badge tone="quiet">{job.category_name}</Badge> : null}
          {job.distance_km !== null ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted font-mono">
              <MapPin size={11} aria-hidden="true" />
              {distance(job.distance_km)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted font-mono">
            <Clock size={11} aria-hidden="true" />
            {timeAgo(job.created_at)}
          </span>
        </div>
      </div>
    </article>
  )
}
