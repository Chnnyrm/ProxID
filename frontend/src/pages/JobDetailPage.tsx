/**
 * JobDetailPage.tsx
 *
 * Dedicated detail page for /jobs/:jobId.
 * Shows full job specifications, client card (with Concordium verification, avatar, username,
 * other open jobs), verified provider card, and contextual actions.
 *
 * Requirements:
 * - Shows client: avatar, display name, verified state with Concordium mark, linking to /u/:username.
 * - Shows client's other open jobs.
 * - Direct Apply flow creating an application in the database.
 * - If already applied, shows Applied.
 * - Photo and avatar click open in Lightbox with working Download control.
 * - Pure ASCII.
 */

import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { HouseIllustration } from '@/components/illustrations/CartoonIllustrations'
import { SafeImage } from '@/components/SafeImage'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { JobDetailSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useAppliedJobIds, useApplyJob, useChangeJobStatus, useJob, useSendMessage } from '@/hooks/useJobs'
import { distance, money, statusLabel, timeAgo } from '@/lib/format'
import { useLightboxStore } from '@/store/lightboxStore'

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { user, isSignedIn } = useAuth()
  const jobQuery = useJob(jobId)
  const changeStatus = useChangeJobStatus(jobId ?? '')
  const sendMessage = useSendMessage(jobId ?? '')
  const applyJob = useApplyJob()
  const appliedQuery = useAppliedJobIds(isSignedIn)
  const openLightbox = useLightboxStore((state) => state.openLightbox)

  const [applying, setApplying] = useState(false)
  const [applyMessage, setApplyMessage] = useState('')
  const [showApplyBox, setShowApplyBox] = useState(false)
  const [justApplied, setJustApplied] = useState(false)

  if (jobQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <JobDetailSkeleton />
      </div>
    )
  }

  if (jobQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorState
          title="We could not open this job"
          message="The job may have been removed or is temporarily unavailable. Check your connection and try again."
          onRetry={() => void jobQuery.refetch()}
        />
      </div>
    )
  }

  const job = jobQuery.data
  if (!job) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title="Job not found"
          description="We could not find a job matching this identifier. It may have expired or been deleted."
          actionLabel="Browse all jobs"
          actionHref="/jobs"
        />
      </div>
    )
  }

  const appliedIds = appliedQuery.data || []
  const isApplied = Boolean(job.applied || appliedIds.includes(job.id) || justApplied)
  const isClient = user?.id === job.client_id
  const isProvider = user?.id === job.provider_id
  const otherJobs = job.client_other_jobs || []

  const handleApply = async () => {
    if (!isSignedIn) {
      window.dispatchEvent(
        new CustomEvent('proxid-require-auth', {
          detail: { action: 'apply for this job' },
        })
      )
      return
    }
    if (!jobId) return
    setApplying(true)
    try {
      await applyJob.mutateAsync({
        jobId,
        message: applyMessage.trim() || undefined,
        proposedPrice: job.price,
      })
      if (applyMessage.trim()) {
        await sendMessage.mutateAsync(applyMessage.trim()).catch(() => {})
      }
      setJustApplied(true)
      setShowApplyBox(false)
    } catch {
      // error handled by hook
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5 animate-fade-rise">
      {/* Back breadcrumb */}
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Jobs</span>
        </Link>
      </div>

      {/* Job Photo Banner (Clickable to Lightbox) */}
      {job.image_url && (
        <div
          className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs cursor-pointer group"
          onClick={() => openLightbox(job.image_url, job.title)}
          title="Click to view full photo and download"
          data-testid="job-banner-image"
        >
          <div className="relative aspect-[21/9] sm:aspect-video w-full max-h-[340px] overflow-hidden bg-sunken">
            <SafeImage
              src={job.image_url}
              alt={job.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              fallback={
                <HouseIllustration className="h-20 w-20 opacity-80" size={80} />
              }
              skeletonClassName="aspect-[21/9] sm:aspect-video w-full max-h-[340px]"
            />
            <div className="absolute bottom-3 right-3 rounded-lg border border-line/40 bg-ink/75 px-2.5 py-1 text-[11px] font-mono text-page backdrop-blur-xs shadow-xs">
              Click to expand photo
            </div>
          </div>
        </div>
      )}

      {/* Main Job Title & Budget Header */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge tone={job.status === 'open' ? 'neutral' : 'quiet'}>
                {statusLabel(job.status)}
              </Badge>
              {job.category_name ? (
                <Badge tone="quiet">{job.category_name}</Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl font-display">
              {job.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-muted">
              <span className="flex items-center gap-1">
                <Clock size={13} aria-hidden="true" />
                <span>Posted {timeAgo(job.created_at)}</span>
              </span>
              {job.distance_km !== null ? (
                <span className="flex items-center gap-1">
                  <MapPin size={13} aria-hidden="true" />
                  <span>{distance(job.distance_km)} away</span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Budget display */}
          <div className="rounded-2xl border border-line bg-sunken/40 px-5 py-4 text-right">
            <span className="text-xs uppercase tracking-wider text-muted font-mono block">
              Budget
            </span>
            <span className="text-2xl font-bold font-mono text-ink">
              {money(job.price, job.currency)}
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {/* Room button */}
          {(isClient || isProvider) && (
            <Button
              size="md"
              onClick={() => navigate(`/jobs/${job.id}/room`)}
            >
              <MessageCircle size={15} aria-hidden="true" />
              <span>Open Job Room</span>
            </Button>
          )}

          {/* Apply button or Applied badge */}
          {!isClient && (
            isSignedIn ? (
              job.status === 'open' ? (
                isApplied ? (
                  <span
                    data-testid="detail-applied-badge"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-sunken px-4 py-2 text-xs font-mono font-bold text-muted cursor-not-allowed"
                  >
                    <Check size={14} className="text-muted" />
                    <span>Applied for this job</span>
                  </span>
                ) : (
                  <Button
                    size="md"
                    data-testid="detail-apply-btn"
                    onClick={() => setShowApplyBox((open) => !open)}
                  >
                    <Zap size={15} aria-hidden="true" />
                    <span>{showApplyBox ? 'Close application' : 'Apply for this job'}</span>
                  </Button>
                )
              ) : null
            ) : (
              <Button
                size="md"
                intent="secondary"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('proxid-require-auth', {
                      detail: { action: 'apply for this job' },
                    })
                  )
                }}
              >
                <span>Sign in to apply</span>
              </Button>
            )
          )}

          {isClient && job.status === 'open' ? (
            <Link to="/services">
              <Button size="md" intent="secondary">
                <span>Browse matching services</span>
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Inline Application Box if provider clicked Apply */}
      {showApplyBox && !isClient && !isApplied ? (
        <Card className="animate-fade-rise border-accent">
          <CardHeader
            title="Introduce yourself"
            hint="Send a brief proposal note to the client. This will record your application directly."
          />
          <CardBody className="space-y-3">
            <textarea
              rows={3}
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="Hi, I can handle this job today. I have the necessary tools and verified credentials."
              className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={applying}
                loadingText="Submitting application..."
                onClick={() => void handleApply()}
                data-testid="submit-apply-btn"
              >
                Submit Application
              </Button>
              <Button
                size="sm"
                intent="ghost"
                onClick={() => setShowApplyBox(false)}
                disabled={applying}
              >
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Description Section */}
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-ink mb-3 font-display">Job Details</h2>
        <div className="prose prose-sm max-w-none text-ink leading-relaxed whitespace-pre-line text-sm">
          {job.description || 'No description provided.'}
        </div>
      </div>

      {/* Participant Cards: Real Client & Verified Provider */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Client Card (Requirement 6) */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
              Posted By
            </span>
            {job.client_username && (
              <Link
                to={`/u/${job.client_username}`}
                className="text-xs font-mono font-bold text-ink hover:underline flex items-center gap-1"
                data-testid="client-portfolio-link"
              >
                <span>View Portfolio</span>
                <ChevronRight size={12} />
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3.5">
            {/* Clickable Client Avatar */}
            <div
              className="relative cursor-pointer shrink-0 group"
              onClick={() =>
                openLightbox(
                  job.client_avatar_url,
                  `${job.client_display_name || 'Client'} Avatar`,
                )
              }
              title="Click to view avatar and download"
              data-testid="client-avatar"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-sunken overflow-hidden font-bold text-ink text-sm shadow-xs group-hover:ring-2 group-hover:ring-accent transition-all">
                <SafeImage
                  src={job.client_avatar_url}
                  alt={job.client_display_name || 'Client'}
                  fallback={<User size={20} aria-hidden="true" />}
                  skeletonClassName="h-12 w-12 rounded-full"
                />
              </div>
              {job.client_concordium_verified && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-surface border border-structural flex items-center justify-center p-0.5 shadow-xs"
                  title="Concordium Verified Human"
                  data-testid="client-concordium-badge"
                >
                  <img src="/brands/concordium.svg" alt="" className="h-2.5 w-2.5" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  to={job.client_username ? `/u/${job.client_username}` : '#'}
                  className="truncate text-sm font-bold text-ink hover:underline font-display"
                  data-testid="client-name"
                >
                  {job.client_display_name || 'Client'}
                </Link>
                {job.client_concordium_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-structural bg-surface px-1.5 py-0.2 text-[9px] font-mono font-bold text-ink shadow-2xs">
                    <img src="/brands/concordium.svg" alt="" className="h-2.5 w-2.5" />
                    <span>Verified</span>
                  </span>
                )}
              </div>

              {job.client_username && (
                <Link
                  to={`/u/${job.client_username}`}
                  className="text-xs font-mono text-accent hover:underline block truncate"
                  data-testid="client-username"
                >
                  @{job.client_username}
                </Link>
              )}
              <p className="truncate text-[11px] text-muted">
                {job.client_neighbourhood
                  ? `Location: ${job.client_neighbourhood}`
                  : 'Platform Client'}
              </p>
            </div>
          </div>
        </div>

        {/* Verified Provider Card */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted font-mono block">
            Assigned Provider
          </span>
          {job.provider_id ? (
            <div className="flex items-center gap-3.5">
              <div
                className="relative cursor-pointer shrink-0"
                onClick={() =>
                  openLightbox(
                    job.provider_avatar_url,
                    `${job.provider_display_name || 'Provider'} Avatar`,
                  )
                }
                title="Click to view full photo and download"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent bg-accent-wash text-accent font-bold text-sm shadow-xs overflow-hidden">
                  <SafeImage
                    src={job.provider_avatar_url}
                    alt={job.provider_display_name || 'Provider'}
                    fallback={<ShieldCheck size={22} aria-hidden="true" />}
                    skeletonClassName="h-12 w-12 rounded-full"
                  />
                </div>
                {job.provider_concordium_verified && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-surface border border-structural flex items-center justify-center p-0.5 shadow-xs">
                    <img src="/brands/concordium.svg" alt="" className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    to={job.provider_username ? `/u/${job.provider_username}` : '#'}
                    className="truncate text-sm font-bold text-ink hover:underline font-display"
                  >
                    {job.provider_display_name || 'Verified Provider'}
                  </Link>
                  <VerifiedBadge verified={job.provider_concordium_verified ?? true} />
                </div>
                {job.provider_username && (
                  <span className="text-xs font-mono text-accent block truncate">
                    @{job.provider_username}
                  </span>
                )}
                <p className="text-xs text-muted">
                  Concordium zero-knowledge verified human
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted py-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-line bg-sunken/40">
                <Clock size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink">No provider assigned yet</p>
                <p className="text-[11px] text-muted">Open to verified providers nearby</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client's Other Open Jobs Section (Requirement 6) */}
      {otherJobs.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-ink font-display">
            Other Open Jobs from {job.client_display_name || 'this Client'} ({otherJobs.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {otherJobs.map((other) => (
              <Link
                key={other.id}
                to={`/jobs/${other.id}`}
                className="group rounded-xl border border-line bg-page p-3.5 shadow-2xs hover:border-structural hover:shadow-xs transition-all flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-ink truncate group-hover:underline">
                    {other.title}
                  </h4>
                  <span className="font-mono text-xs font-bold text-muted">
                    {money(other.price, other.currency)}
                  </span>
                </div>
                <ChevronRight
                  size={15}
                  className="text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
