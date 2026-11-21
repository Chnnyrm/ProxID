/**
 * Profile: who you are, whether your humanity is proven, and the verification flow.
 *
 * The verification panel shows the honest state of the flow at every step: a request with
 * a real nonce and expiry, a QR only when one could be issued, and a badge only after an
 * explicit verified answer.
 */

import { QrCode } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DemoBadge, VerifiedBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Skeleton, TextSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useMyJobs } from '@/hooks/useJobs'
import { useApproveVerification, useMyVerification, useRequestVerification } from '@/hooks/useVerification'
import { money, statusLabel, timeAgo } from '@/lib/format'

export function ProfilePage() {
  const { user, isSignedIn, isLoading, logout } = useAuth()
  const verification = useMyVerification(isSignedIn)
  const request = useRequestVerification()
  const approve = useApproveVerification()
  const myJobs = useMyJobs(isSignedIn)
  const [purpose, setPurpose] = useState<'personhood' | 'age_over_18'>('personhood')

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!isSignedIn || !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-xl font-semibold text-ink">Sign in to see your profile</h1>
        <p className="mt-1 text-sm text-muted">
          Your verification, your jobs and your agent live behind a session.
        </p>
        <Button className="mt-4" onClick={() => (window.location.href = '/login')}>
          Go to sign in
        </Button>
      </div>
    )
  }

  const attempt = approvalState(request.data, verification.data)
  const latest = request.data ?? verification.data ?? null

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-ink">{user.display_name}</h1>
              <p className="mt-0.5 truncate text-sm text-muted">{user.email}</p>
              <p className="mt-1 text-sm text-muted">
                {user.neighbourhood ?? 'Neighbourhood not set'}
                {user.latitude !== null && user.longitude !== null
                  ? ` - ${user.latitude.toFixed(3)}, ${user.longitude.toFixed(3)}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <VerifiedBadge verified={user.concordium_verified} />
              <DemoBadge isDemo={user.is_demo} />
              <Button intent="ghost" size="sm" onClick={() => void logout()}>
                Sign out
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Proof of personhood"
          hint="A single-use request, bound to this domain, approved in the Concordium ID app."
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['personhood', 'age_over_18'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPurpose(option)}
                aria-pressed={purpose === option}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-200 ease-house ${
                  purpose === option
                    ? 'border-structural bg-accent text-accent-ink'
                    : 'border-line bg-surface text-ink hover:bg-accent-wash'
                }`}
              >
                {option === 'personhood' ? 'Prove I am a person' : 'Prove I am over 18'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => request.mutate(purpose)}
              loading={request.isPending}
            >
              <QrCode size={15} aria-hidden="true" />
              Start verification
            </Button>
            {attempt?.status === 'pending' && attempt.nonce ? (
              <Button
                intent="secondary"
                onClick={() => approve.mutate(attempt.nonce as string)}
                loading={approve.isPending}
              >
                I approved it in the app
              </Button>
            ) : null}
          </div>

          {request.data ? (
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="quiet">{request.data.purpose}</Badge>
                <Badge tone="neutral">{request.data.status}</Badge>
                <span className="text-xs text-muted">expires {timeAgo(request.data.expires_at)}</span>
              </div>
              <p className="mt-2 text-sm text-ink">{request.data.message}</p>
              <dl className="mt-2 space-y-1 text-xs text-muted">
                <div className="flex justify-between gap-2">
                  <dt>Bound domain</dt>
                  <dd className="text-ink">{request.data.bound_domain}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Request anchor</dt>
                  <dd className="truncate text-ink">{request.data.request_anchor_ref ?? 'none, not anchored'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>QR payload</dt>
                  <dd className="truncate text-ink">{request.data.qr_payload ?? 'none, no verifier connected'}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {approve.data ? (
            <p
              role="status"
              className="rounded-xl border border-line bg-accent-wash p-3 text-sm text-ink"
            >
              {approve.data.message}
            </p>
          ) : null}

          {!request.data && verification.isLoading ? <TextSkeleton lines={3} /> : null}

          {!request.data && !verification.isLoading && !latest ? (
            <p className="text-sm text-muted">
              No verification has been started on this account. Start one above, or press Launch
              Judge Demo to see the seeded flow.
            </p>
          ) : null}

          <p className="text-xs leading-relaxed text-muted">
            Veriox handles the QR, the anchoring and the true-or-false answer. It is not connected
            on this deployment, so a request is created with a real nonce and expiry and no QR, and
            no badge is granted. The badge is written in exactly one place: an explicit verified
            answer from the verifier.
          </p>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Your jobs"
          hint="Posted and in progress, newest first."
          action={<Link to="/jobs" className="text-sm font-medium text-ink underline">All jobs</Link>}
        />
        <CardBody>
          {myJobs.isLoading ? (
            <TextSkeleton lines={3} />
          ) : (myJobs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">
              Nothing yet. Post a job from the jobs page, or launch the judge demo to see a seeded
              room.
            </p>
          ) : (
            <ul className="space-y-2">
              {(myJobs.data ?? []).map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
                  <Link to={`/jobs/${job.id}/room`} className="min-w-0 truncate text-sm font-medium text-ink hover:underline">
                    {job.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    <Badge tone="quiet">{statusLabel(job.status)}</Badge>
                    {money(job.price, job.currency)}
                    <DemoBadge isDemo={job.is_demo} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

/** The approval step, if there is a request waiting for consent. */
function approvalState(
  requested: { nonce: string; status: string } | null | undefined,
  existing: { nonce: string; status: string } | null | undefined,
): { nonce: string | null; status: string } | null {
  const source = requested ?? existing
  if (!source) return null
  return { nonce: source.status === 'pending' ? source.nonce : null, status: source.status }
}
