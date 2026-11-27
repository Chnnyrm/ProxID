/**
 * MessagesPage.tsx - Aggregated Messages and Contract Rooms Inbox.
 * Pure ASCII, palette compliant (#474329 ink, #F0E5DB sand, #FC75B4 accent).
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Search,
  ShieldCheck,
  User,
  Wrench,
} from 'lucide-react'

import { EmptyState } from '@/components/EmptyState'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { CardSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useMyJobs } from '@/hooks/useJobs'
import { money, statusLabel, timeAgo } from '@/lib/format'
import type { Job } from '@/types/api'

export function MessagesPage() {
  const { isSignedIn, user } = useAuth()
  const myJobs = useMyJobs(isSignedIn)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          icon={<MessageSquare size={28} />}
          title="Sign in to view your conversations"
          description="Your active job rooms, contractor proposals, and mediated discussions are private to your session."
          actionLabel="Sign in"
          onAction={() => {
            window.location.href = '/login'
          }}
        />
      </div>
    )
  }

  const jobs = myJobs.data ?? []

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'active') {
      return ['assigned', 'in_progress', 'requested', 'disputed'].includes(job.status)
    }
    if (filter === 'completed') {
      return ['completed', 'cancelled'].includes(job.status)
    }
    return true
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-tight text-ink font-bold flex items-center gap-2">
            <MessageSquare size={22} className="text-accent" />
            <span>Messages &amp; Job Rooms</span>
          </h1>
          <p className="mt-1 text-xs text-muted">
            Private contract threads with Concordium Article 12 audit trails and real-time escrow updates.
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          {(['all', 'active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors duration-150 ${
                filter === tab
                  ? 'border-structural bg-accent text-accent-ink shadow-xs'
                  : 'border-line bg-surface text-ink hover:bg-sunken'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {myJobs.isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={28} />}
          title="No job rooms found"
          description={
            filter === 'active'
              ? 'You have no active ongoing job rooms right now.'
              : 'You have not participated in any job rooms yet. When you post a job, accept work, or hire a provider, your private collaboration room opens here.'
          }
          actionLabel="Browse Services"
          onAction={() => {
            window.location.href = '/services'
          }}
        />
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const isClient = user?.id === job.client_id
            const otherPartyName = isClient
              ? job.provider_display_name || 'Hired Provider'
              : job.client_display_name || 'Client'
            const isDisputed = job.status === 'disputed'

            return (
              <Card
                key={job.id}
                className={`transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                  isDisputed ? 'border-amber-500/50 bg-amber-500/5' : ''
                }`}
              >
                <CardBody className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-ink text-base truncate">{job.title}</h2>
                      <Badge tone={isDisputed ? 'neutral' : 'quiet'}>
                        {statusLabel(job.status)}
                      </Badge>
                      {job.category_name && (
                        <span className="font-mono text-[10px] text-muted uppercase tracking-wider">
                          // {job.category_name}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <div className="flex items-center gap-1.5 text-ink font-medium">
                        <User size={13} className="text-muted" />
                        <span>With: {otherPartyName}</span>
                        {isClient && job.provider_concordium_verified && (
                          <ShieldCheck size={14} className="text-accent fill-accent/20" title="Verified Human" />
                        )}
                        {!isClient && job.client_concordium_verified && (
                          <ShieldCheck size={14} className="text-accent fill-accent/20" title="Verified Human" />
                        )}
                      </div>
                      <span>&bull;</span>
                      <span className="font-mono font-semibold text-ink">
                        {money(job.price, job.currency)}
                      </span>
                      <span>&bull;</span>
                      <span>updated {timeAgo(job.updated_at || job.created_at)}</span>
                    </div>

                    {isDisputed && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                        <AlertTriangle size={13} className="shrink-0" />
                        <span>Escrow held pending dispute resolution</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/jobs/${job.id}/room`} className="w-full sm:w-auto">
                      <Button intent="primary" size="sm" className="w-full sm:w-auto">
                        <MessageSquare size={13} className="mr-1" aria-hidden="true" />
                        Open Room
                      </Button>
                    </Link>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
