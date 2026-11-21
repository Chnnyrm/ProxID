/**
 * The job room: the state of the job, the thread with the other side, the payment panel,
 * and the agent.
 *
 * This is where consent and money meet, so every state is named rather than implied: who
 * the job is with, what the next legal action is, and whether anything has settled.
 */

import { ArrowLeft, Bot, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AgentActivity } from '@/components/AgentActivity'
import { PaymentPanel } from '@/components/PaymentPanel'
import { DemoBadge, VerifiedBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextAreaField } from '@/components/ui/input'
import { Skeleton, TextSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useAgentActivity, useRunAgent } from '@/hooks/useAgent'
import { useChangeJobStatus, useJobRoom, useSendMessage } from '@/hooks/useJobs'
import { clockTime, money, statusLabel } from '@/lib/format'

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
  const threadEnd = useRef<HTMLDivElement | null>(null)

  const messageCount = room.data?.messages.length ?? 0
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messageCount])

  if (room.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (room.isError || !room.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-ink">We could not open that job room</h1>
        <p className="mt-1 text-sm text-muted">
          It may have been removed, or it may not be yours. Nothing was changed.
        </p>
        <Button className="mt-4" intent="secondary" onClick={() => void room.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const { job, client, provider, messages } = room.data
  const isClient = user?.id === job.client_id
  const isProvider = user?.id === job.provider_id
  const canPay = isClient && job.status === 'assigned'

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={14} aria-hidden="true" /> All jobs
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-ink">{job.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {money(job.price, job.currency)} - posted by {client.display_name}
            {provider ? ` - with ${provider.display_name}` : ' - no provider yet'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{statusLabel(job.status)}</Badge>
          {provider ? <VerifiedBadge verified={provider.concordium_verified} /> : null}
          <DemoBadge isDemo={job.is_demo} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0 space-y-4">
          {job.description ? (
            <Card>
              <CardBody>
                <p className="whitespace-pre-line text-sm text-ink">{job.description}</p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Job room"
              hint={
                provider
                  ? `${client.display_name} and ${provider.display_name}. Messages are visible to both.`
                  : 'Waiting for a provider to accept.'
              }
              action={<Badge tone="quiet">{messages.length} messages</Badge>}
            />
            <CardBody className="space-y-3">
              <ol className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <li className="text-sm text-muted">
                    No messages yet. Say what you need and when you are available.
                  </li>
                ) : (
                  messages.map((message) => {
                    const mine = message.sender_id === user?.id
                    const fromAgent = message.author_kind === 'agent'
                    return (
                      <li
                        key={message.id}
                        className={`animate-fade-rise rounded-xl border p-3 text-sm ${
                          fromAgent
                            ? 'border-accent bg-accent-wash'
                            : mine
                              ? 'border-line bg-sunken/50'
                              : 'border-line bg-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-muted">
                          <span className="font-medium text-ink">
                            {fromAgent ? 'ProxID agent' : message.sender_display_name ?? 'Someone'}
                          </span>
                          <span>{clockTime(message.created_at)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-line text-ink">{message.body}</p>
                      </li>
                    )
                  })
                )}
                <div ref={threadEnd} />
              </ol>

              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!draft.trim()) return
                  sendMessage.mutate(draft.trim(), { onSuccess: () => setDraft('') })
                }}
              >
                <TextAreaField
                  label="Reply in the room"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Confirm the time, or ask a question."
                  error={sendMessage.isError ? 'We could not send that. Nothing was posted. Try again.' : null}
                />
                <Button type="submit" loading={sendMessage.isPending} disabled={!draft.trim()}>
                  <Send size={15} aria-hidden="true" />
                  Send
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Next action" hint="Only the moves the other side can see." />
            <CardBody className="flex flex-wrap gap-2">
              {job.status === 'open' && isClient ? (
                <p className="text-sm text-muted">
                  Open. Providers nearby can see it, and you can hire one from the providers page.
                </p>
              ) : null}
              {job.status === 'requested' && isProvider ? (
                <Button
                  loading={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ status: 'assigned' })}
                >
                  Accept this job
                </Button>
              ) : null}
              {job.status === 'assigned' && isProvider ? (
                <Button
                  loading={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ status: 'in_progress' })}
                >
                  Start work
                </Button>
              ) : null}
              {job.status === 'in_progress' && isClient ? (
                <Button
                  loading={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ status: 'completed' })}
                >
                  Mark complete
                </Button>
              ) : null}
              {['open', 'requested', 'assigned', 'in_progress'].includes(job.status) && (isClient || isProvider) ? (
                <Button
                  intent="danger"
                  loading={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ status: 'cancelled' })}
                >
                  Cancel job
                </Button>
              ) : null}
              {changeStatus.isError ? (
                <p role="alert" className="text-sm text-ink">
                  That change was not allowed. The room shows the job&apos;s real state: refresh and
                  look again.
                </p>
              ) : null}
            </CardBody>
          </Card>

          {isClient || isProvider ? (
            <PaymentPanel jobId={job.id} amount={job.price} currency={job.currency} />
          ) : null}

          <Card>
            <CardHeader
              title="Agent"
              hint="Ask for something concrete. Every tool call is logged."
              action={<Bot size={16} aria-hidden="true" />}
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
                  label="Command"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Summarise this job and tell me what happens next."
                />
                <Button type="submit" loading={runAgent.isPending} disabled={!command.trim()}>
                  Ask the agent
                </Button>
              </form>

              {runAgent.data ? (
                <div className="rounded-xl border border-line bg-surface p-3 text-sm">
                  <p className="text-ink">{runAgent.data.reply}</p>
                  {runAgent.data.degraded ? (
                    <p className="mt-2 text-xs text-muted">
                      The language model is not connected on this deployment, so this answer was
                      assembled from what the account already shows.
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
                  emptyHint="No agent actions yet. Ask it to do something above."
                />
              )}
            </CardBody>
          </Card>

          {canPay ? (
            <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
              The payment panel is above. It records a receipt and reports the rail as not
              configured: nothing is charged, and no transaction hash exists to show.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
