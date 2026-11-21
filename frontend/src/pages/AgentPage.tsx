/**
 * The agent screen: run it, read what it did, and inspect the two things that make it
 * accountable, its card with the five checks and its own scoped identity.
 */

import { AlertTriangle, BadgeCheck, XCircle } from 'lucide-react'
import { useState } from 'react'

import { AgentActivity } from '@/components/AgentActivity'
import { DemoBadge } from '@/components/VerifiedBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextAreaField } from '@/components/ui/input'
import { Skeleton, TextSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgentActivity,
  useAgentCard,
  useAgentIdentity,
  useAgentTools,
  useRunAgent,
} from '@/hooks/useAgent'
import { money } from '@/lib/format'

export function AgentPage() {
  const { isSignedIn } = useAuth()
  const tools = useAgentTools()
  const activity = useAgentActivity(isSignedIn)
  const card = useAgentCard(isSignedIn)
  const identity = useAgentIdentity(isSignedIn)
  const runAgent = useRunAgent()
  const [command, setCommand] = useState('')

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">The agent</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        The agent books, messages and reports. It cannot move money: a payment it starts is a
        record a human acts on, and the rail is not connected in this build.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader
            title="Ask it for something"
            hint="Concrete requests work best. Every tool call is logged."
            action={
              <Badge tone={tools.data?.llm_configured ? 'neutral' : 'quiet'}>
                {tools.isLoading ? 'checking model' : tools.data?.llm_configured ? 'model connected' : 'model not connected'}
              </Badge>
            }
          />
          <CardBody className="space-y-3">
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!command.trim()) return
                runAgent.mutate({ command: command.trim() }, { onSuccess: () => setCommand('') })
              }}
            >
              <TextAreaField
                label="Command"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Find a plumber within 3 km who is a verified human."
              />
              <Button type="submit" loading={runAgent.isPending} disabled={!isSignedIn || !command.trim()}>
                Run the agent
              </Button>
            </form>

            {!isSignedIn ? (
              <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
                Sign in, or launch the judge demo from the home page, to run the agent.
              </p>
            ) : null}

            {runAgent.data ? (
              <div className="rounded-xl border border-line bg-surface p-3">
                <p className="text-sm text-ink">{runAgent.data.reply}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {runAgent.data.used_tools.map((tool, index) => (
                    <Badge key={`${tool}-${index}`} tone="quiet">
                      {tool}
                    </Badge>
                  ))}
                  {runAgent.data.degraded ? <Badge tone="demo">degraded answer</Badge> : null}
                </div>
              </div>
            ) : null}

            <div className="border-t border-line pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recent actions</p>
              <AgentActivity
                steps={activity.data}
                loading={activity.isLoading && isSignedIn}
                emptyHint={isSignedIn ? 'Nothing yet. Ask it to do something above.' : 'Sign in to see the log.'}
              />
            </div>
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Agent card"
              hint="Five checks, re-run every time. An owner can revoke."
              action={card.data ? <DemoBadge isDemo={card.data.is_demo} /> : null}
            />
            <CardBody className="space-y-3">
              {!isSignedIn ? (
                <p className="text-sm text-muted">Sign in to see this account&apos;s agent card.</p>
              ) : card.isLoading ? (
                <TextSkeleton lines={5} />
              ) : card.data ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={card.data.verification.valid ? 'verified' : 'quiet'}>
                      {card.data.verification.valid ? 'Card verified' : 'Not verified'}
                    </Badge>
                    <Badge tone="quiet">registry {card.data.registry_address}</Badge>
                    <Badge tone="quiet">{card.data.registered ? 'registered' : 'not registered'}</Badge>
                  </div>
                  <ul className="space-y-1.5">
                    {card.data.verification.checks.map((check) => (
                      <li key={check.name} className="flex items-start gap-2 text-sm">
                        {check.passed ? (
                          <BadgeCheck size={14} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
                        ) : (
                          <XCircle size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                        )}
                        <span className="min-w-0">
                          <span className="font-medium text-ink">{check.name}</span>{' '}
                          <span className="text-muted">{check.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <details className="rounded-xl border border-line bg-sunken/30 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-ink">
                      The card this build would publish
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto text-[11px] leading-relaxed text-muted">
                      {JSON.stringify(card.data.card, null, 2)}
                    </pre>
                  </details>
                </>
              ) : (
                <p className="text-sm text-muted">We could not read the card just now. Try again.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Identity and limits" hint="The agent's own account, not the human's." />
            <CardBody className="space-y-3">
              {identity.isLoading && isSignedIn ? (
                <Skeleton className="h-20 w-full" />
              ) : identity.data ? (
                <>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Agent account</dt>
                      <dd className="truncate text-ink">{identity.data.agent_account_address ?? 'not issued'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Separate from human</dt>
                      <dd className="text-ink">{identity.data.separate_account ? 'yes' : 'no'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Agent IDP</dt>
                      <dd className="text-ink">{identity.data.idp_configured ? 'configured' : 'not configured'}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted">{identity.data.note}</p>

                  {card.data ? (
                    <div className="rounded-xl border border-line bg-sunken/30 p-3 text-xs">
                      <p className="font-medium text-ink">Spending limits</p>
                      <p className="mt-1 text-muted">
                        {money(card.data.spending_limits.per_payment_cap)} per payment,{' '}
                        {money(card.data.spending_limits.daily_cap)} per day, allowlist of{' '}
                        {card.data.spending_limits.recipient_allowlist.length} recipient(s).
                      </p>
                      <p className="mt-1 text-muted">{card.data.spending_limits.enforced_by}.</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">Sign in to see the agent&apos;s own identity.</p>
              )}

              <p className="flex items-start gap-2 rounded-xl border border-line bg-accent-wash p-3 text-xs text-ink">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Protocol-level account locks are DevNet only, so the caps and the allowlist are
                  enforced by ProxID itself. They are written to swap into protocol locks later.
                </span>
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
