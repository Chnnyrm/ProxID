/**
 * JobCard.tsx - A job in a list: what it is, what it pays, where, and how fresh it is.
 *
 * Requirements:
 * - Whole card is a clickable link to /jobs/:id with visible chevron and hover lift.
 * - 88x88 thumbnail on the left, radius 12 (rounded-xl), clickable for Lightbox download.
 * - Apply button directly on the card for open unapplied jobs.
 * - If already applied, shows Applied (disabled pill, non-reapply).
 * - Skeleton shaped like image while loading, HouseIllustration placeholder if null/error.
 * - Pure ASCII.
 */

import { Check, ChevronRight, Clock, MapPin, Send, X, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { HouseIllustration } from '@/components/illustrations/CartoonIllustrations'
import { ListingSlideshow } from '@/components/ListingSlideshow'
import { SafeImage } from '@/components/SafeImage'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useAppliedJobIds, useApplyJob, usePrefetchJob } from '@/hooks/useJobs'
import { distance, money, statusLabel, timeAgo } from '@/lib/format'
import { useLightboxStore } from '@/store/lightboxStore'
import type { Job } from '@/types/api'

export function JobCard({ job }: { job: Job }) {
  const navigate = useNavigate()
  const prefetchJob = usePrefetchJob()
  const { isSignedIn, user } = useAuth()
  const openLightbox = useLightboxStore((state) => state.openLightbox)
  const appliedQuery = useAppliedJobIds(isSignedIn)
  const applyJob = useApplyJob()

  const [showApplyModal, setShowApplyModal] = useState(false)
  const [proposalMessage, setProposalMessage] = useState('')
  const [justApplied, setJustApplied] = useState(false)

  const appliedIds = appliedQuery.data || []
  const isApplied = Boolean(job.applied || appliedIds.includes(job.id) || justApplied)
  const isClient = user?.id === job.client_id
  const isOpen = job.status === 'open'
  const jobImages = (job.image_urls && job.image_urls.length > 0)
    ? job.image_urls
    : (job.image_url ? [job.image_url] : [])

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isSignedIn) {
      window.dispatchEvent(
        new CustomEvent('proxid-require-auth', {
          detail: { action: 'apply for this job' },
        })
      )
      return
    }
    setShowApplyModal(true)
  }

  const handleSubmitApply = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await applyJob.mutateAsync({
        jobId: job.id,
        message: proposalMessage.trim() || undefined,
        proposedPrice: job.price,
      })
      setJustApplied(true)
      setShowApplyModal(false)
    } catch {
      // Handled by query mutation
    }
  }

  return (
    <>
      <Link
        to={`/jobs/${job.id}`}
        data-testid="job-card"
        onMouseEnter={() => prefetchJob(job.id)}
        onFocus={() => prefetchJob(job.id)}
        className="group animate-fade-rise rounded-2xl border border-line bg-surface p-4 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-structural flex flex-col justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-3.5">
          {/* 88x88 thumbnail or slideshow on the left, radius 12 */}
          <div className="relative h-[88px] w-[88px] shrink-0 rounded-xl overflow-hidden bg-sunken border border-line">
            <ListingSlideshow
              images={jobImages}
              title={job.title}
              aspectRatioClass="h-[88px] w-[88px]"
              fallback={
                <HouseIllustration className="h-12 w-12 opacity-80" size={48} />
              }
              onImageClick={(url) => openLightbox(url, job.title)}
            />
          </div>

          {/* Details column */}
          <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 text-sm sm:text-base font-bold leading-tight text-ink line-clamp-2 group-hover:underline">
                  {job.title}
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
              <Badge tone={isOpen ? 'neutral' : 'quiet'}>
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
        </div>

        {/* Card Footer: Apply Action & Chevron */}
        <div className="flex items-center justify-between border-t border-line/60 pt-2.5 mt-1">
          <div>
            {isClient ? (
              <span className="font-mono text-[10px] uppercase text-muted tracking-wider">
                Your Job Post
              </span>
            ) : isOpen ? (
              isApplied ? (
                <span
                  data-testid="applied-badge"
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-sunken px-2.5 py-1 text-xs font-mono font-bold text-muted cursor-not-allowed"
                >
                  <Check size={12} className="text-muted" />
                  <span>Applied</span>
                </span>
              ) : (
                <button
                  type="button"
                  data-testid="card-apply-btn"
                  onClick={handleApplyClick}
                  className="inline-flex items-center gap-1 rounded-lg border border-structural bg-ink px-3 py-1 text-xs font-mono font-bold text-page hover:opacity-90 active:translate-y-px transition-all shadow-xs"
                >
                  <Zap size={12} />
                  <span>Apply</span>
                </button>
              )
            ) : null}
          </div>

          <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ink group-hover:translate-x-1 transition-transform">
            <span>View Job</span>
            <ChevronRight size={15} />
          </div>
        </div>
      </Link>

      {/* Quick Apply Modal */}
      {showApplyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Apply to Job"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-2xs p-4 animate-fade-in"
          onClick={(e) => {
            e.stopPropagation()
            setShowApplyModal(false)
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink font-display">Apply for Job</h3>
                <p className="text-xs text-muted truncate max-w-xs">{job.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-sunken hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitApply} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-muted tracking-wider mb-1">
                  Introductory Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={proposalMessage}
                  onChange={(e) => setProposalMessage(e.target.value)}
                  placeholder="Hi, I am available to start and have the required tools..."
                  className="w-full rounded-xl border border-line bg-page p-3 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-muted bg-sunken/40 rounded-xl p-3 border border-line">
                <span>Proposed Rate:</span>
                <span className="font-bold text-ink text-sm">
                  {money(job.price, job.currency)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-mono text-ink hover:bg-sunken"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyJob.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-structural bg-ink px-4 py-1.5 text-xs font-mono font-bold text-page hover:opacity-90 disabled:opacity-50 shadow-xs"
                >
                  {applyJob.isPending ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <Send size={12} />
                      <span>Submit Application</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
