/**
 * The job room: the state of the job, the thread with the other side, the payment panel,
 * and the agent.
 *
 * This is where consent and money meet, so every state is named rather than implied: who
 * the job is with, what the next legal action is, and whether anything has settled.
 */

import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  HelpCircle,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AgentActivity } from '@/components/AgentActivity'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PaymentPanel } from '@/components/PaymentPanel'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextAreaField } from '@/components/ui/input'
import { JobRoomSkeleton, TextSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useAgentActivity, useRunAgent } from '@/hooks/useAgent'
import { useChangeJobStatus, useJobRoom, useSendMessage } from '@/hooks/useJobs'
import { clockTime, money, statusLabel } from '@/lib/format'

interface MilestoneStep {
  id: string
  label: string
  description: string
}

const MILESTONES: MilestoneStep[] = [
  { id: 'open', label: 'Posted', description: 'Available for matching' },
  { id: 'assigned', label: 'Assigned', description: 'Provider confirmed' },
  { id: 'in_progress', label: 'In Progress', description: 'Work underway' },
  { id: 'completed', label: 'Completed', description: 'Delivered & verified' },
]

function getStepIndex(status: string): number {
  switch (status) {
    case 'open':
    case 'requested':
      return 0
    case 'assigned':
      return 1
    case 'in_progress':
      return 2
    case 'completed':
      return 3
    case 'cancelled':
    case 'disputed':
      return -1
    default:
      return 0
  }
}

export function JobRoomPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { user } = useAuth()
  const room = useJobRoom(jobId)
  const sendMessage = useSendMessage(jobId ?? '')
  const changeStatus = useChangeJobStatus(jobId ?? '')
  const activity = useAgentActivity(true)
  const runAgent = useRunAgent()
  const [draft, setDraft] = useState('')
  const [command, setCommand] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const threadEnd = useRef<HTMLDivElement | null>(null)

  const messageCount = room.data?.messages.length ?? 0
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messageCount])

  if (room.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <JobRoomSkeleton />
      </div>
    )
  }

  if (room.isError || !room.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorState
          title="We could not open that job room"
          message="It may have been removed, or it may not be yours. Nothing was changed."
          onRetry={() => void room.refetch()}
        />
      </div>
    )
  }

  const { job, client, provider, messages } = room.data
  const isClient = user?.id === job.client_id
  const isProvider = user?.id === job.provider_id
  const canPay = isClient && job.status === 'assigned'
  const currentStep = getStepIndex(job.status)
  const isTerminal = job.status === 'cancelled' || job.status === 'disputed'

  const handleStatusChange = (nextStatus: string, actionName: string) => {
    setPendingAction(actionName)
    changeStatus.mutate(
      { status: nextStatus },
      {
        onSettled: () => setPendingAction(null),
      },
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All jobs
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-ink">{job.title}</h1>
            <Badge tone="neutral">{statusLabel(job.status)}</Badge>
            {provider ? <VerifiedBadge verified={provider.concordium_verified} /> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {money(job.price, job.currency)} - posted by {client.display_name}
            {provider ? ` - with ${provider.display_name}` : ' - no provider assigned yet'}
          </p>
        </div>
      </div>

      {/* Lifecycle Milestones */}
      <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Contract Lifecycle</span>
          </div>
          <span className="text-xs text-muted">
            {isTerminal ? `Job is ${job.status}` : `Step ${currentStep + 1} of 4: ${MILESTONES[currentStep]?.label}`}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MILESTONES.map((step, idx) => {
            const isDone = !isTerminal && currentStep > idx
            const isCurrent = !isTerminal && currentStep === idx
            return (
              <div
                key={step.id}
                className={`relative rounded-xl border p-3 transition-colors ${
                  isCurrent
                    ? 'border-structural bg-accent-wash/30'
                    : isDone
                      ? 'border-line bg-sunken/40'
                      : 'border-line/60 bg-surface opacity-75'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 size={16} className="shrink-0 text-accent" aria-hidden="true" />
                  ) : isCurrent ? (
                    <Circle size={16} className="shrink-0 text-ink fill-accent" aria-hidden="true" />
                  ) : (
                    <Circle size={16} className="shrink-0 text-muted" aria-hidden="true" />
                  )}
                  <span className={`text-xs font-semibold ${isCurrent ? 'text-ink' : isDone ? 'text-ink' : 'text-muted'}`}>
                    {step.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-tight text-muted">{step.description}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0 space-y-4">
          {job.description ? (
            <Card>
              <CardBody>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Scope of Work</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{job.description}</p>
              </CardBody>
            </Card>
          ) : null}

          {/* Messages Thread */}
          <Card>
            <CardHeader
              title="Job room messages"
              hint={
                provider
                  ? `${client.display_name} and ${provider.display_name}. Visible to both parties.`
                  : 'Waiting for a provider to accept this job.'
              }
              action={<Badge tone="quiet">{messages.length} messages</Badge>}
            />
            <CardBody className="space-y-4">
              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <EmptyState
                    icon={<MessageSquare size={20} />}
                    title="No messages in this room yet"
                    description="Say what you need, agree on scope, and confirm availability."
                  />
                ) : (
                  messages.map((message) => {
                    const mine = message.sender_id === user?.id
                    const fromAgent = message.author_kind === 'agent'
                    return (
                      <div
                        key={message.id}
                        className={`rounded-2xl border p-3.5 text-sm transition-shadow duration-150 ${
                          fromAgent
                            ? 'border-accent bg-accent-wash text-ink'
                            : mine
                              ? 'ml-auto max-w-[85%] border-structural bg-surface text-ink shadow-sm'
                              : 'mr-auto max-w-[85%] border-line bg-sunken/40 text-ink'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-xs text-muted">
                          <span className="font-semibold text-ink flex items-center gap-1">
                            {fromAgent ? (
                              <>
                                <Bot size={13} className="text-accent" aria-hidden="true" />
                                ProxID Agent
                              </>
                            ) : mine ? (
                              'You'
                            ) : (
                              message.sender_display_name ?? 'Participant'
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} aria-hidden="true" />
                            {clockTime(message.created_at)}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{message.body}</p>
                      </div>
                    )
                  })
                )}
                <div ref={threadEnd} />
              </div>

              <form
                className="space-y-2 border-t border-line pt-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!draft.trim()) return
                  sendMessage.mutate(draft.trim(), { onSuccess: () => setDraft('') })
                }}
              >
                <TextAreaField
                  label="Reply in this room"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Confirm arrival time, ask clarifying questions, or update progress..."
                  error={sendMessage.isError ? 'We could not send that. Nothing was posted. Please try again.' : null}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={sendMessage.isPending}
                    loadingLabel="Sending..."
                    disabled={!draft.trim() || sendMessage.isPending}
                  >
                    <Send size={14} aria-hidden="true" />
                    Send message
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {/* Next Action Box */}
          <Card>
            <CardHeader
              title="Contract Actions"
              hint="Only legal transitions permitted in this state."
            />
            <CardBody className="space-y-3">
              {job.status === 'open' && isClient ? (
                <div className="rounded-xl border border-line bg-sunken/30 p-3 text-sm text-muted">
                  This job is open to verified providers nearby. You can hire a specific provider from the Providers page.
                </div>
              ) : null}

              {job.status === 'open' && !isClient && (
                <Button
                  loading={pendingAction === 'apply' && changeStatus.isPending}
                  loadingLabel="Accepting..."
                  disabled={changeStatus.isPending}
                  onClick={() => handleStatusChange('assigned', 'apply')}
                  className="w-full"
                >
                  <ShieldCheck size={15} aria-hidden="true" />
                  Accept this job as provider
                </Button>
              )}

              {job.status === 'requested' && isProvider ? (
                <Button
                  loading={pendingAction === 'accept' && changeStatus.isPending}
                  loadingLabel="Accepting job..."
                  disabled={changeStatus.isPending}
                  onClick={() => handleStatusChange('assigned', 'accept')}
                  className="w-full"
                >
                  <ShieldCheck size={15} aria-hidden="true" />
                  Accept this job
                </Button>
              ) : null}

              {job.status === 'assigned' && isProvider ? (
                <Button
                  loading={pendingAction === 'start' && changeStatus.isPending}
                  loadingLabel="Starting work..."
                  disabled={changeStatus.isPending}
                  onClick={() => handleStatusChange('in_progress', 'start')}
                  className="w-full"
                >
                  Start work
                </Button>
              ) : null}

              {job.status === 'in_progress' && isClient ? (
                <Button
                  loading={pendingAction === 'complete' && changeStatus.isPending}
                  loadingLabel="Completing..."
                  disabled={changeStatus.isPending}
                  onClick={() => handleStatusChange('completed', 'complete')}
                  className="w-full"
                >
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Mark complete
                </Button>
              ) : null}

              {['open', 'requested', 'assigned', 'in_progress'].includes(job.status) && (isClient || isProvider) ? (
                <Button
                  intent="danger"
                  loading={pendingAction === 'cancel' && changeStatus.isPending}
                  loadingLabel="Cancelling..."
                  disabled={changeStatus.isPending}
                  onClick={() => handleStatusChange('cancelled', 'cancel')}
                  className="w-full"
                >
                  Cancel job
                </Button>
              ) : null}

              {isTerminal && (
                <p className="text-xs text-muted">
                  This job has concluded with status &quot;{job.status}&quot;. No further actions may be taken.
                </p>
              )}

              {changeStatus.isError ? (
                <p role="alert" className="text-xs text-ink bg-accent/20 border border-accent p-2 rounded-lg">
                  That action is not permitted in the job&apos;s current state. Refresh the page to synchronize.
                </p>
              ) : null}
            </CardBody>
          </Card>

          {/* Payment Panel */}
          {isClient || isProvider ? (
            <PaymentPanel jobId={job.id} amount={job.price} currency={job.currency} />
          ) : null}

          {/* Agent Activity Panel */}
          <Card>
            <CardHeader
              title="proxidAI Room Assistant"
              hint="Ask for a summary or action. Every tool call is logged."
              action={<Bot size={16} className="text-accent" aria-hidden="true" />}
            />
            <CardBody className="space-y-3">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!command.trim()) return
                  runAgent.mutate(
                    { command: command.trim(), jobId: job.id },
                    { onSuccess: () => setCommand('') },
                  )
                }}
              >
                <TextAreaField
                  label="Agent command"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Summarise this job and tell me what happens next."
                />
                <Button
                  type="submit"
                  loading={runAgent.isPending}
                  loadingLabel="Consulting agent..."
                  disabled={!command.trim() || runAgent.isPending}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  Ask the agent
                </Button>
              </form>

              {runAgent.data ? (
                <div className="rounded-xl border border-line bg-surface p-3 text-sm">
                  <p className="text-ink">{runAgent.data.reply}</p>
                  {runAgent.data.degraded ? (
                    <p className="mt-2 text-xs text-muted">
                      Language model not configured on this host. Fallback answer generated from job state.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {activity.isLoading ? (
                <TextSkeleton lines={3} />
              ) : (
                <AgentActivity
                  steps={activity.data}
                  loading={activity.isLoading}
                  emptyHint="No agent actions yet in this job room. Ask it to do something above."
                />
              )}
            </CardBody>
          </Card>

          {canPay ? (
            <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
              The payment panel records an x402 receipt for settlement. The live chain rail is not configured in this build.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
