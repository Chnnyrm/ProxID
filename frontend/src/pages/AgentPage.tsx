/**
 * The agent screen: run it, read what it did, and inspect the two things that make it
 * accountable, its card with the five checks and its own scoped identity.
 * Matches Gigr's activity and AI agent patterns.
 */

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  Command,
  ExternalLink,
  HelpCircle,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AgentActivity } from '@/components/AgentActivity'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
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
import { useLocationStore } from '@/store/locationStore'

const SUGGESTIONS = [
  'find me a plumber in Yaba under 20000',
  'my back hurts',
  'Find a plumber within 3 km who is a verified human.',
  'Verify the nearest available electrical repair provider.',
]

export function AgentPage() {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const tools = useAgentTools()
  const activity = useAgentActivity(isSignedIn)
  const card = useAgentCard(isSignedIn)
  const identity = useAgentIdentity(isSignedIn)
  const runAgent = useRunAgent()
  const [command, setCommand] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const recognitionRef = useRef<any>(null)
  const setCoordinates = useLocationStore((state) => state.setCoordinates)

  // Speech Recognition for inline mic
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recognition is not supported in this browser.')
      return
    }
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let finalSpeech = ''
      let interimSpeech = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalSpeech += event.results[i][0].transcript
        } else {
          interimSpeech += event.results[i][0].transcript
        }
      }
      const text = (finalSpeech || interimSpeech).trim()
      if (text) {
        setCommand(text)
      }
    }

    recognition.onerror = () => {
      stopListening()
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [stopListening])

  const toggleMic = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [])

  const executeCommand = (cmdText: string) => {
    const clean = cmdText.trim()
    if (!clean) return
    stopListening()

    const lower = clean.toLowerCase()
    // If asking for plumber in Yaba, center location store coordinates on Yaba
    if (lower.includes('plumber') && (lower.includes('yaba') || lower.includes('20000'))) {
      setCoordinates({ latitude: 6.5121, longitude: 3.3739 }, 'stored')
    }

    runAgent.mutate(
      { command: clean },
      {
        onSuccess: () => {
          void activity.refetch()
        },
      },
    )
  }

  const handleSuggestion = (prompt: string) => {
    setCommand(prompt)
    executeCommand(prompt)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">proxidAI Agent</h1>
            <Badge tone="quiet">autonomous assistant</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            The agent coordinates, messages and discovers verified work. It cannot move money unilaterally:
            all payments generate an auditable record requiring human authorization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tools.isLoading ? (
            <Skeleton className="h-6 w-32 rounded-full" />
          ) : (
            <Badge tone={tools.data?.llm_configured ? 'neutral' : 'quiet'}>
              {tools.data?.llm_configured ? 'model connected' : 'model fallback mode'}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* Left Column: Command input and activity feed */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Run Control"
              hint="Give proxidAI a specific task. Every tool invocation is logged."
              action={<Terminal size={16} className="text-muted" aria-hidden="true" />}
            />
            <CardBody className="space-y-4">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  executeCommand(command)
                }}
              >
                <div className="relative">
                  <TextAreaField
                    label="Agent instruction"
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    placeholder="e.g. find me a plumber in Yaba under 20000, or my back hurts"
                    error={runAgent.isError ? 'Agent run failed. Check network connection and try again.' : null}
                  />
                  <div className="absolute right-3 top-8 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleMic}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                        isListening
                          ? 'border-accent bg-accent/20 text-accent animate-pulse ring-2 ring-accent/40'
                          : 'border-line bg-surface text-muted hover:text-ink hover:bg-sunken'
                      }`}
                      title={isListening ? 'Stop listening' : 'Speak instruction (Mic)'}
                      aria-label={isListening ? 'Stop recording voice instruction' : 'Start recording voice instruction'}
                    >
                      {isListening ? <Mic className="h-4 w-4 text-accent animate-ping" /> : <Mic className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isListening && (
                  <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-wash/30 px-3 py-2 text-xs text-ink">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                      [LISTENING]
                    </span>
                    <span className="text-muted">Listening to voice... transcript updates live above</span>
                    <button
                      type="button"
                      onClick={stopListening}
                      className="ml-auto text-[11px] font-bold text-ink underline"
                    >
                      Done speaking
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">
                      Suggestions:
                    </span>
                    {SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestion(s)}
                        className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-muted hover:border-structural hover:text-ink transition-colors duration-150"
                      >
                        {idx === 0
                          ? 'Plumber in Yaba (<20k)'
                          : idx === 1
                            ? 'My back hurts (scout)'
                            : idx === 2
                              ? 'Verified plumber'
                              : 'Verify provider'}
                      </button>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    loading={runAgent.isPending}
                    loadingLabel="Running agent..."
                    disabled={!isSignedIn || !command.trim() || runAgent.isPending}
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    Run agent
                  </Button>
                </div>
              </form>

              {!isSignedIn ? (
                <div className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
                  Sign in or launch the judge demo from the header to run the agent.
                </div>
              ) : null}

              {runAgent.data ? (
                <div className="rounded-xl border border-line bg-surface p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-semibold text-ink flex items-center gap-1">
                      <Bot size={13} className="text-accent" aria-hidden="true" />
                      Agent Response
                    </span>
                    {runAgent.data.degraded ? <Badge tone="demo">fallback answer</Badge> : null}
                  </div>
                  <div className="text-sm leading-relaxed text-ink whitespace-pre-line bg-sunken/40 p-3 rounded-xl border border-line">
                    {runAgent.data.reply}
                  </div>

                  {/* Tool execution steps with arguments and result */}
                  {runAgent.data.steps && runAgent.data.steps.length > 0 && (
                    <div className="space-y-1.5 border-t border-line pt-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Tool Execution ({runAgent.data.steps.length} step{runAgent.data.steps.length > 1 ? 's' : ''}):
                      </span>
                      <AgentActivity
                        steps={runAgent.data.steps}
                        loading={false}
                        emptyHint=""
                      />
                    </div>
                  )}

                  {/* If plumber query in Yaba, offer 1-click navigate button */}
                  {runAgent.data.reply.toLowerCase().includes('plumber') && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
                      <button
                        type="button"
                        onClick={() => navigate('/services?q=plumber&max_price=20000')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-structural bg-ink px-3 py-1.5 text-xs font-bold text-page hover:opacity-90 transition-opacity shadow-xs"
                      >
                        <span>View on Services</span>
                        <ArrowRight size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/map?filter=services')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:bg-sunken transition-colors shadow-xs"
                      >
                        <MapPin size={12} />
                        <span>View Yaba on Map</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="border-t border-line pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Execution Log
                  </span>
                  {activity.data && (
                    <span className="text-xs text-muted">{activity.data.length} step(s) recorded</span>
                  )}
                </div>

                {activity.isLoading && isSignedIn ? (
                  <TextSkeleton lines={4} />
                ) : activity.isError ? (
                  <ErrorState
                    title="Could not load activity log"
                    message="Failed to retrieve recent agent executions."
                    onRetry={() => void activity.refetch()}
                  />
                ) : (activity.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={<Command size={20} />}
                    title="No agent actions yet"
                    description={
                      isSignedIn
                        ? 'Submit a command above or choose a suggestion to watch the agent execute tools.'
                        : 'Sign in to access your agent execution history.'
                    }
                  />
                ) : (
                  <AgentActivity
                    steps={activity.data}
                    loading={activity.isLoading && isSignedIn}
                    emptyHint="No agent actions yet. Ask it to do something above."
                  />
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Agent card and scoped identity */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Concordium Agent Card"
              hint="Five deterministic checks, re-evaluated on each action."
            />
            <CardBody className="space-y-3">
              {!isSignedIn ? (
                <p className="text-sm text-muted">Sign in to view this account&apos;s cryptographic agent card.</p>
              ) : card.isLoading ? (
                <TextSkeleton lines={5} />
              ) : card.isError ? (
                <ErrorState
                  title="Card unavailable"
                  message="Unable to verify agent card from the registry."
                  onRetry={() => void card.refetch()}
                />
              ) : card.data ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={card.data.verification.valid ? 'verified' : 'quiet'}>
                      {card.data.verification.valid ? 'Card verified' : 'Not verified'}
                    </Badge>
                    <Badge tone="quiet">registry {card.data.registry_address}</Badge>
                    <Badge tone="quiet">{card.data.registered ? 'registered' : 'not registered'}</Badge>
                  </div>
                  <ul className="space-y-2 mt-2">
                    {card.data.verification.checks.map((check) => (
                      <li key={check.name} className="flex items-start gap-2.5 text-sm">
                        {check.passed ? (
                          <BadgeCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                        ) : (
                          <XCircle size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                        )}
                        <span className="min-w-0">
                          <span className="font-medium text-ink">{check.name}</span>{' '}
                          <span className="text-xs text-muted block">{check.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <details className="mt-3 rounded-xl border border-line bg-sunken/30 p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted hover:text-ink">
                      Raw card payload
                    </summary>
                    <pre className="mt-2 max-h-56 overflow-auto text-[11px] leading-relaxed text-muted bg-surface p-2 rounded-lg">
                      {JSON.stringify(card.data.card, null, 2)}
                    </pre>
                  </details>
                </>
              ) : (
                <p className="text-sm text-muted">No card information available for this account.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Identity & Spending Policy"
              hint="Autonomous agent credentials separated from owner wallet."
            />
            <CardBody className="space-y-3">
              {identity.isLoading && isSignedIn ? (
                <Skeleton className="h-20 w-full" />
              ) : identity.isError ? (
                <ErrorState
                  title="Identity error"
                  message="Could not load agent identity details."
                  onRetry={() => void identity.refetch()}
                />
              ) : identity.data ? (
                <>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2 border-b border-line pb-1.5">
                      <dt className="text-muted">Agent account</dt>
                      <dd className="font-mono text-xs truncate text-ink">
                        {identity.data.agent_account_address ?? 'Not issued'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-line pb-1.5">
                      <dt className="text-muted">Separate from human</dt>
                      <dd className="text-ink font-medium">{identity.data.separate_account ? 'Yes' : 'No'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Agent IDP</dt>
                      <dd className="text-ink font-medium">{identity.data.idp_configured ? 'Configured' : 'Not configured'}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted">{identity.data.note}</p>

                  {card.data ? (
                    <div className="rounded-xl border border-line bg-sunken/30 p-3 text-xs space-y-1">
                      <p className="font-semibold text-ink">Spending Limits Policy</p>
                      <p className="text-muted">
                        Max per payment: {money(card.data.spending_limits.per_payment_cap)}. Daily limit:{' '}
                        {money(card.data.spending_limits.daily_cap)}.
                      </p>
                      <p className="text-muted">
                        Allowlist: {card.data.spending_limits.recipient_allowlist.length} address(es). Enforced by{' '}
                        {card.data.spending_limits.enforced_by}.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">Sign in to view the agent&apos;s identity configuration.</p>
              )}

              <div className="flex items-start gap-2 rounded-xl border border-line bg-accent-wash/30 p-3 text-xs text-ink">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span>
                  Protocol-level account locks require DevNet consensus. Spending limits are enforced in application layer
                  and verified against Concordium zero-knowledge proofs.
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
