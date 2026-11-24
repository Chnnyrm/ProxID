/**
 * JobDetailPage.tsx
 *
 * Dedicated detail page for /jobs/:jobId.
 * Shows full job specifications, client card, verified provider card, and contextual actions.
 *
 * Matches Gigr detail pattern: skeletons, empty states, instant feedback, pure palette tokens.
 */

import {
  ArrowLeft,
  Calendar,
  CheckCircle,
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
import { useChangeJobStatus, useJob, useSendMessage } from '@/hooks/useJobs'
import { distance, money, statusLabel, timeAgo } from '@/lib/format'

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { user, isSignedIn } = useAuth()
  const jobQuery = useJob(jobId)
  const changeStatus = useChangeJobStatus(jobId ?? '')
  const sendMessage = useSendMessage(jobId ?? '')

  const [applying, setApplying] = useState(false)
  const [applyMessage, setApplyMessage] = useState('')
  const [showApplyBox, setShowApplyBox] = useState(false)

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

  const isClient = user?.id === job.client_id
  const isProvider = user?.id === job.provider_id

  const handleApply = async () => {
    if (!jobId) return
    setApplying(true)
    try {
      if (applyMessage.trim()) {
        await sendMessage.mutateAsync(applyMessage.trim())
      }
      navigate(`/jobs/${jobId}/room`)
    } catch {
      // error handled by hook
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Back breadcrumb */}
      <div className="mb-4">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Jobs</span>
        </Link>
      </div>

      {/* Job Photo Banner */}
      {job.image_url && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
          <div className="relative aspect-[21/9] sm:aspect-video w-full max-h-[340px] overflow-hidden bg-sunken">
            <SafeImage
              src={job.image_url}
              alt={job.title}
              fallback={
                <HouseIllustration className="h-20 w-20 opacity-80" size={80} />
              }
              skeletonClassName="aspect-[21/9] sm:aspect-video w-full max-h-[340px]"
            />
          </div>
        </div>
      )}

      {/* Main Job Title & Budget Header */}
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
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
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {job.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
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

          <div className="text-right">
            <span className="block text-xs uppercase tracking-wider text-muted font-medium">
              Budget
            </span>
            <span className="text-2xl font-bold text-ink sm:text-3xl">
              {money(job.price, job.currency)}
            </span>
          </div>
        </div>

        {/* Quick action bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {isClient || isProvider ? (
            <Link to={`/jobs/${job.id}/room`}>
              <Button size="md">
                <MessageCircle size={15} aria-hidden="true" />
                <span>Open Job Room</span>
              </Button>
            </Link>
          ) : isSignedIn ? (
            job.status === 'open' ? (
              <Button
                size="md"
                onClick={() => setShowApplyBox((open) => !open)}
              >
                <Zap size={15} aria-hidden="true" />
                <span>{showApplyBox ? 'Close application' : 'Apply for this job'}</span>
              </Button>
            ) : null
          ) : (
            <Link to="/login">
              <Button size="md" intent="secondary">
                <span>Sign in to apply</span>
              </Button>
            </Link>
          )}

          {isClient && job.status === 'open' ? (
            <Link to="/providers">
              <Button size="md" intent="secondary">
                <span>Invite providers nearby</span>
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Inline Application Box if provider clicked Apply */}
      {showApplyBox && !isClient ? (
        <Card className="mt-4 animate-fade-rise border-accent">
          <CardHeader
            title="Introduce yourself"
            hint="Send a brief note to the client. This will open the job room thread."
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
                loadingText="Sending application..."
                onClick={() => void handleApply()}
              >
                Send & Open Room
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
      <div className="mt-5 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-ink mb-3">Job Details</h2>
        <div className="prose prose-sm max-w-none text-ink leading-relaxed whitespace-pre-line text-sm">
          {job.description || 'No description provided.'}
        </div>
      </div>

      {/* Participant Cards: Client & Provider */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* Client Card */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Posted By
          </span>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-sunken font-bold text-ink text-sm">
              <User size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-ink">
                Client (Job Owner)
              </h3>
              <p className="truncate text-xs text-muted">
                Local Client in {job.neighbourhood || 'Lagos'}
              </p>
            </div>
          </div>
        </div>

        {/* Verified Provider Card */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Assigned Provider
          </span>
          {job.provider_id ? (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-accent bg-accent-wash text-accent font-bold text-sm">
                <ShieldCheck size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-sm font-semibold text-ink">
                    Verified Provider
                  </h3>
                  <VerifiedBadge verified={true} />
                </div>
                <p className="text-xs text-muted">
                  Concordium zero-knowledge verified human
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 text-muted">
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
    </div>
  )
}
