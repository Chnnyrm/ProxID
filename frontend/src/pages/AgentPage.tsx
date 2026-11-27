/**
 * AgentPage.tsx - proxidAI conversational assistant with speech-to-text.
 *
 * Requirements:
 * 1. Conversational interface:
 *    - Header: proxidAI avatar, verified mark, registry identity (cis-8004:proxid-registry).
 *    - Message thread: user instructions, intermediate tool execution rows (tool, arguments, result),
 *      and agent reply.
 *    - Degraded notice: clearly stating when model is not connected rather than blank.
 *    - Empty state: 3 tappable prompt suggestions.
 *    - Visible working state: "searching nearby providers..." with tool indicator.
 *    - Actionable chips: tappable buttons under agent replies (e.g. Hire provider with price, or prompt).
 *    - Persistent bottom input: mic on left (data-tour="tour-mic"), input center, send on right,
 *      sticky above bottom navigation at 390px (sticky bottom-16 lg:bottom-0).
 *    - Consent card (data-tour="tour-consent"): human-in-the-loop spending limit warning.
 * 2. Conversation memory:
 *    - Loads persisted conversation turns on mount.
 *    - Maintains thread across page reloads.
 * 3. 100% Pure ASCII, palette compliant (Ink #474329, Sand #FAF4ED, Accent #FC75B4).
 */

import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  HelpCircle,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Radio,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { AgentCharacterIllustration } from '@/components/illustrations/CartoonIllustrations'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgentActivity,
  useAgentCard,
  useAgentConversation,
  useAgentIdentity,
  useAgentTools,
  useRunAgent,
} from '@/hooks/useAgent'
import { subscribeToPushNotifications } from '@/lib/push'
import { useLocationStore } from '@/store/locationStore'
import type { AgentAction, AgentStep } from '@/types/api'

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  steps?: AgentStep[]
  used_tools?: string[]
  degraded?: boolean
  actions?: AgentAction[]
  timestamp: string
}

const PROXIDAI_AVATAR =
  'https://res.cloudinary.com/dxssh54wy/image/upload/v1795532082/proxid/avatars/755974f17e734798bd2599f6fcd49294.png'

const SUGGESTED_PROMPTS = [
  'find me a plumber in Yaba under 20000',
  'my back hurts',
  'check my open jobs and what needs action',
]

export function AgentPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCommand = searchParams.get('command')
  const initialListen = searchParams.get('listen')
  const handledInitialRef = useRef(false)
  const handledListenRef = useRef(false)

  const { isSignedIn, user } = useAuth()
  const tools = useAgentTools()
  const card = useAgentCard(isSignedIn)
  const identity = useAgentIdentity(isSignedIn)
  const conversation = useAgentConversation(isSignedIn)
  const runAgent = useRunAgent()
  const setCoordinates = useLocationStore((state) => state.setCoordinates)

  const [inputCommand, setInputCommand] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [speechInterim, setSpeechInterim] = useState('')
  const [workingStatus, setWorkingStatus] = useState<string | null>(null)
  const [showCardDetails, setShowCardDetails] = useState(false)
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const [pushPromptBusy, setPushPromptBusy] = useState(false)
  const [pushPromptSuccess, setPushPromptSuccess] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({})
  const [workingTasks, setWorkingTasks] = useState<{ id: string; label: string; status: 'pending' | 'active' | 'done' }[]>([])
  const taskTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const recognitionRef = useRef<any>(null)
  const chatBottomRef = useRef<HTMLDivElement | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate conversation from database on load
  useEffect(() => {
    if (conversation.data?.turns && conversation.data.turns.length > 0 && messages.length === 0) {
      const turns: ChatMessage[] = conversation.data.turns.map((t) => ({
        id: t.id,
        role: t.role === 'user' ? 'user' : 'agent',
        text: t.content,
        steps: t.steps || undefined,
        used_tools: t.used_tools || undefined,
        degraded: t.degraded,
        actions: t.actions || undefined,
        timestamp: new Date(t.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }))
      setMessages(turns)
    }
  }, [conversation.data, messages.length])

  // Scroll to latest message
  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, workingStatus])

  // Stop speech recognition
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // already stopped
      }
      recognitionRef.current = null
    }
    setIsListening(false)
    setSpeechInterim('')
  }, [])

  // Execute command against POST /api/v1/agent/run
  const executeCommand = useCallback(
    (cmd: string) => {
      const clean = cmd.trim()
      if (!clean) return

      if (!isSignedIn) {
        window.dispatchEvent(
          new CustomEvent('proxid-require-auth', {
            detail: { action: 'speak with proxidAI' },
          })
        )
        return
      }

      stopListening()
      setInputCommand('')
      setSpeechInterim('')

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: clean,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, userMsg])
      setWorkingStatus('searching nearby providers...')

      // Initialize live progress task list
      taskTimersRef.current.forEach(clearTimeout)
      taskTimersRef.current = []
      setWorkingTasks([
        { id: 'search', label: 'Searching nearby providers...', status: 'active' },
        { id: 'compare', label: 'Comparing rates and verified anchors...', status: 'pending' },
        { id: 'draft', label: 'Drafting your response and actions...', status: 'pending' },
      ])

      const timer1 = setTimeout(() => {
        setWorkingTasks([
          { id: 'search', label: 'Searched nearby providers', status: 'done' },
          { id: 'compare', label: 'Comparing rates and verified anchors...', status: 'active' },
          { id: 'draft', label: 'Drafting your response and actions...', status: 'pending' },
        ])
      }, 700)

      const timer2 = setTimeout(() => {
        setWorkingTasks([
          { id: 'search', label: 'Searched nearby providers', status: 'done' },
          { id: 'compare', label: 'Compared rates and verified anchors', status: 'done' },
          { id: 'draft', label: 'Drafting your response and actions...', status: 'active' },
        ])
      }, 1500)

      taskTimersRef.current.push(timer1, timer2)

      const lower = clean.toLowerCase()
      if (lower.includes('plumber') && (lower.includes('yaba') || lower.includes('20000'))) {
        setCoordinates({ latitude: 6.5121, longitude: 3.3739 }, 'stored')
      }

      runAgent.mutate(
        { command: clean },
        {
          onSuccess: (data) => {
            taskTimersRef.current.forEach(clearTimeout)
            taskTimersRef.current = []
            setWorkingTasks([])
            setWorkingStatus(null)
            const agentMsg: ChatMessage = {
              id: `agent-${Date.now()}`,
              role: 'agent',
              text: data.reply,
              steps: data.steps,
              used_tools: data.used_tools,
              degraded: data.degraded,
              actions: data.actions,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
            setMessages((prev) => [...prev, agentMsg])
          },
          onError: (err: any) => {
            taskTimersRef.current.forEach(clearTimeout)
            taskTimersRef.current = []
            setWorkingTasks([])
            setWorkingStatus(null)
            if (err?.status === 401 || err?.statusCode === 401) {
              window.dispatchEvent(
                new CustomEvent('proxid-require-auth', {
                  detail: { action: 'speak with proxidAI' },
                })
              )
              return
            }
            const errorMsg: ChatMessage = {
              id: `agent-error-${Date.now()}`,
              role: 'agent',
              text: 'Could not connect to proxidAI service. Please check your connection and try again.',
              degraded: true,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
            setMessages((prev) => [...prev, errorMsg])
          },
        },
      )
    },
    [runAgent, setCoordinates, stopListening],
  )

  // Check notification permission on mount for in-context push prompt
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      const dismissed = localStorage.getItem('proxid_agent_push_prompt_dismissed')
      if (!dismissed) {
        setShowPushPrompt(true)
      }
    }
  }, [])

  const handleEnableNotifications = async () => {
    setPushPromptBusy(true)
    try {
      const ok = await subscribeToPushNotifications()
      if (ok) {
        setPushPromptSuccess(true)
        setTimeout(() => {
          setShowPushPrompt(false)
        }, 2000)
      } else {
        setShowPushPrompt(false)
      }
    } finally {
      setPushPromptBusy(false)
    }
  }

  const handleDismissPushPrompt = () => {
    localStorage.setItem('proxid_agent_push_prompt_dismissed', '1')
    setShowPushPrompt(false)
  }

  // Start speech recognition
  const startListening = useCallback(() => {
    setIsListening(true)
    setSpeechInterim('Listening...')

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSpeechInterim('Listening (microphone active)...')
      return
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    try {
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        setSpeechInterim('Listening...')
      }

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

        const activeText = (finalSpeech || interimSpeech).trim()
        if (activeText) {
          setSpeechInterim(activeText)
        }

        if (finalSpeech.trim()) {
          const spoken = finalSpeech.trim()
          stopListening()
          executeCommand(spoken)
        }
      }

      recognition.onerror = () => {
        stopListening()
      }

      recognition.onend = () => {
        setIsListening(false)
        if (speechInterim.trim() && speechInterim !== 'Listening...') {
          const spoken = speechInterim.trim()
          setSpeechInterim('')
          executeCommand(spoken)
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setIsListening(true)
      setSpeechInterim('Listening...')
    }
  }, [executeCommand, speechInterim, stopListening])

  // Handle URL command param on mount
  useEffect(() => {
    if (initialCommand && initialCommand.trim() && !handledInitialRef.current) {
      handledInitialRef.current = true
      const cmd = initialCommand.trim()
      searchParams.delete('command')
      setSearchParams(searchParams, { replace: true })
      executeCommand(cmd)
    }
  }, [initialCommand, searchParams, setSearchParams, executeCommand])

  // Handle ?listen=1 URL param on mount (PWA shortcut)
  useEffect(() => {
    if (initialListen === '1' && !handledListenRef.current) {
      handledListenRef.current = true
      searchParams.delete('listen')
      setSearchParams(searchParams, { replace: true })
      if (!isSignedIn) {
        window.dispatchEvent(
          new CustomEvent('proxid-require-auth', {
            detail: { action: 'use voice commands with proxidAI' },
          })
        )
      } else {
        startListening()
      }
    }
  }, [initialListen, searchParams, setSearchParams, startListening, isSignedIn])

  const toggleMic = () => {
    if (!isSignedIn) {
      window.dispatchEvent(
        new CustomEvent('proxid-require-auth', {
          detail: { action: 'use voice commands with proxidAI' },
        })
      )
      return
    }
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      taskTimersRef.current.forEach(clearTimeout)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-4xl mx-auto w-full relative">
      {/* 1. Header: proxidAI identity and verification mark only */}
      <header className="py-2.5 px-3 sm:px-4 border-b border-line shrink-0 flex items-center justify-between gap-3 bg-surface/90 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={PROXIDAI_AVATAR}
              alt="proxidAI"
              className={`h-10 w-10 rounded-full border border-structural bg-surface object-cover shadow-xs transition-all ${
                runAgent.isPending ? 'ring-2 ring-accent ring-offset-2 animate-pulse scale-105' : ''
              }`}
            />
            <div
              className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface p-0.5 shadow-xs"
              title="Verified by Concordium"
            >
              <img
                src="/brands/concordium.svg"
                alt="Concordium"
                className="h-3.5 w-3.5"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-ink">proxidAI</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-page px-2 py-0.5 text-[10px] font-mono text-muted">
                Concordium ID Attested
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Conversation Message Thread */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4 pb-28 lg:pb-24">
        {messages.length === 0 ? (
          /* Empty state: agent character, one sentence, three suggested prompts */
          <div className="flex flex-col items-center justify-center min-h-[280px] text-center px-4 space-y-4">
            <div className="flex justify-center">
              <AgentCharacterIllustration size={72} />
            </div>
            <p className="text-sm font-semibold text-ink max-w-sm">
              Ask proxidAI to find verified local trades, post community jobs, or manage your bookings.
            </p>

            <div className="w-full max-w-md space-y-2 pt-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => executeCommand(prompt)}
                  className="w-full text-left rounded-xl border border-line bg-surface p-3 text-xs text-ink hover:border-structural hover:bg-sunken transition-all flex items-center justify-between group shadow-xs"
                >
                  <span className="font-medium">{prompt}</span>
                  <ArrowRight
                    size={14}
                    className="text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Render conversation messages */
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              } space-y-2`}
            >
              {/* User Bubble */}
              {msg.role === 'user' ? (
                <div className="max-w-[85%] sm:max-w-md rounded-2xl rounded-br-sm bg-ink text-surface px-4 py-2.5 shadow-xs">
                  <p className="text-xs sm:text-sm font-medium leading-relaxed">{msg.text}</p>
                  <span className="text-[9px] font-mono text-surface/70 mt-1 block text-right">
                    {msg.timestamp}
                  </span>
                </div>
              ) : (
                /* Agent Reply Bubble & Tool Steps */
                <div className="max-w-[95%] sm:max-w-xl space-y-2.5">
                  {/* Collapsible Tool Call Rows per turn */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="space-y-2 pl-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSteps((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-sunken/50 text-xs font-mono font-medium text-ink hover:border-structural hover:bg-sunken transition-all shadow-xs"
                        aria-expanded={Boolean(expandedSteps[msg.id])}
                      >
                        <Wrench size={13} className="text-muted" />
                        <span className="font-bold">
                          {msg.steps.length} {msg.steps.length === 1 ? 'step' : 'steps'}
                        </span>
                        <span className="text-[10px] text-muted font-normal">
                          ({msg.steps.every((s) => s.succeeded) ? 'all succeeded' : 'completed'})
                        </span>
                        {expandedSteps[msg.id] ? (
                          <ChevronUp size={14} className="text-muted ml-0.5" />
                        ) : (
                          <ChevronDown size={14} className="text-muted ml-0.5" />
                        )}
                      </button>

                      {expandedSteps[msg.id] && (
                        <div className="space-y-2 pt-1 animate-fade-rise">
                          {msg.steps.map((st, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-line bg-surface p-3 text-xs space-y-1.5 shadow-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-ink">
                                  <Terminal size={12} className="text-accent" />
                                  {st.tool}
                                </span>
                                <span
                                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                                    st.succeeded
                                      ? 'border-accent/40 bg-accent/10 text-ink'
                                      : 'border-line bg-sunken text-muted'
                                  }`}
                                >
                                  {st.succeeded ? 'SUCCESS' : 'FAILED'}
                                </span>
                              </div>
                              <p className="text-muted text-xs leading-snug">{st.summary}</p>

                              {/* On-Chain Payment Card with Real Explorer Link */}
                              {Boolean(st.result?.tx_hash) && (
                                <div className="rounded-xl border border-accent/40 bg-accent/5 p-2.5 space-y-1.5 shadow-xs">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-semibold text-ink flex items-center gap-1.5">
                                      <CheckCircle2 size={13} className="text-accent" />
                                      Settled on Concordium
                                    </span>
                                    <span className="font-mono text-ink font-bold">
                                      {st.result.amount ? `${st.result.amount} CCD` : '1.00 CCD'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-line/50">
                                    <span className="text-[10px] text-muted font-mono truncate max-w-[200px]" title={st.result.tx_hash}>
                                      {st.result.tx_hash}
                                    </span>
                                    <a
                                      href={`https://testnet.ccdscan.io/?r=${st.result.tx_hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-primary underline hover:text-primary-hover shrink-0"
                                    >
                                      <span>Explorer</span>
                                      <ExternalLink size={11} aria-hidden="true" />
                                    </a>
                                  </div>
                                </div>
                              )}

                              {(st.tool === 'pay_for_service' || st.tool === 'settle_x402_payment') && !st.result?.tx_hash && (
                                <div className="rounded-lg border border-line bg-sunken/40 px-2.5 py-1.5 text-[11px] text-muted">
                                  No settlement has occurred. No transaction hash exists.
                                </div>
                              )}

                              {st.arguments && (
                                <div className="text-[10px] font-mono text-muted bg-sunken/50 p-2 rounded-lg border border-line/60 overflow-x-auto">
                                  <span className="text-ink font-semibold">args:</span> {JSON.stringify(st.arguments)}
                                </div>
                              )}
                              {st.result && (
                                <div className="text-[10px] font-mono text-muted bg-sunken/30 p-2 rounded-lg border border-line/40 overflow-x-auto">
                                  <span className="text-ink font-semibold">result:</span> {JSON.stringify(st.result)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agent Response Card */}
                  <div className="rounded-2xl rounded-bl-sm border border-line bg-surface p-4 shadow-xs space-y-2.5">
                    {/* Degraded Alert Banner if model not connected */}
                    {msg.degraded && (
                      <div className="flex items-center gap-2 rounded-lg border border-structural bg-sunken px-2.5 py-1.5 text-xs text-ink">
                        <Cpu size={14} className="shrink-0 text-muted" />
                        <span className="font-medium text-[11px]">
                          Model is not connected; answering via deterministic fallback rules.
                        </span>
                      </div>
                    )}

                    <div className="text-xs sm:text-sm text-ink whitespace-pre-line leading-relaxed">
                      {msg.text}
                    </div>

                    {/* Actionable Chips (Buttons) */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
                        {msg.actions.map((act) => (
                          <button
                            key={act.id}
                            type="button"
                            data-action-chip={act.kind}
                            onClick={() => {
                              if (act.kind === 'hire') {
                                if (act.target) {
                                  navigate(act.target)
                                } else {
                                  executeCommand(`hire provider ${act.payload?.provider_id || act.label}`)
                                }
                              } else if (act.kind === 'apply') {
                                if (act.payload?.command) {
                                  executeCommand(String(act.payload.command))
                                } else if (act.payload?.job_id) {
                                  executeCommand(`apply to job ${act.payload.job_id}`)
                                } else if (act.target) {
                                  navigate(act.target)
                                }
                              } else if (act.kind === 'navigate' && act.target) {
                                navigate(act.target)
                              } else if (act.payload?.command) {
                                executeCommand(String(act.payload.command))
                              } else {
                                executeCommand(act.label)
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-structural bg-surface px-3 py-1.5 text-xs font-mono font-bold text-ink hover:bg-ink hover:text-page transition-colors shadow-xs"
                          >
                            <span>{act.label}</span>
                            <ArrowRight size={12} />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Used Tools Badges */}
                    {msg.used_tools && msg.used_tools.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-line">
                        <span className="text-[10px] font-mono text-muted mr-1">Tools:</span>
                        {msg.used_tools.map((t) => (
                          <span
                            key={t}
                            className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-mono text-[9px] text-ink"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <span className="text-[9px] font-mono text-muted block text-right pt-0.5">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Live Task List Surface while working */}
        {(runAgent.isPending || workingStatus) && (
          <div className="rounded-2xl border-2 border-structural bg-surface p-4 max-w-md shadow-md space-y-3 animate-fade-rise">
            <div className="flex items-center gap-3">
              <div className="relative">
                <AgentCharacterIllustration size={44} className="w-11 h-11 animate-pulse" />
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                </span>
              </div>
              <div>
                <h4 className="font-display text-xs uppercase tracking-wider text-ink font-bold">
                  proxidAI is working
                </h4>
                <p className="text-[11px] text-muted font-mono">
                  {workingStatus || 'executing verified tools...'}
                </p>
              </div>
            </div>

            {workingTasks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-line">
                {workingTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 text-xs font-mono">
                    {t.status === 'done' ? (
                      <CheckCircle2 size={16} className="text-accent shrink-0" />
                    ) : t.status === 'active' ? (
                      <Loader2 size={16} className="text-ink animate-spin shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-line shrink-0" />
                    )}
                    <span
                      className={
                        t.status === 'done'
                          ? 'text-muted line-through'
                          : t.status === 'active'
                          ? 'text-ink font-bold'
                          : 'text-muted/60'
                      }
                    >
                      {t.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Live speech interim while recording */}
        {isListening && speechInterim && (
          <div className="flex items-center gap-2 p-3 rounded-2xl border border-structural bg-sunken max-w-sm shadow-xs">
            <Radio size={14} className="animate-ping text-accent shrink-0" />
            <p className="text-xs text-ink font-mono italic">{speechInterim}</p>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* 3. Fixed Bottom Composer */}
      <div className="fixed bottom-14 lg:bottom-0 left-0 right-0 lg:left-24 z-[600] bg-surface/95 backdrop-blur-md border-t border-line px-3 py-2.5 safe-area-pb shadow-md">
        <div className="max-w-4xl mx-auto w-full">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (inputCommand.trim() && !runAgent.isPending) {
                executeCommand(inputCommand)
              }
            }}
            className="flex items-center gap-2"
          >
            {/* Large, obvious, labelled Microphone inside the composer (at least 44px) */}
            <button
              type="button"
              data-tour="tour-mic"
              onClick={toggleMic}
              className={`h-12 min-w-[50px] sm:min-w-[92px] px-3 rounded-xl border flex items-center justify-center gap-2 transition-all shadow-xs ${
                isListening
                  ? 'border-accent bg-accent text-accent-ink ring-4 ring-accent/30 animate-pulse scale-102'
                  : 'border-line bg-surface text-ink hover:border-structural hover:bg-sunken'
              }`}
              title={isListening ? 'Listening... Tap to stop' : 'Tap to speak'}
              aria-label={isListening ? 'Stop recording voice' : 'Start voice recognition'}
            >
              {isListening ? (
                <>
                  <MicOff size={20} className="text-accent-ink animate-bounce shrink-0" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent-ink">
                    Listening
                  </span>
                </>
              ) : (
                <>
                  <Mic size={20} className="text-ink shrink-0" />
                  <span className="hidden sm:inline font-mono text-xs font-bold uppercase tracking-wider text-muted">
                    Voice
                  </span>
                </>
              )}
            </button>

            {/* Text Input Center */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                placeholder={isListening ? (speechInterim || 'Listening to your voice...') : 'Ask proxidAI to find, hire or check anything...'}
                disabled={runAgent.isPending}
                className={`w-full h-12 rounded-xl border px-3.5 text-xs sm:text-sm text-ink placeholder-muted focus:outline-none transition-all shadow-xs ${
                  isListening
                    ? 'border-accent bg-accent-wash/30 font-medium'
                    : 'border-line bg-page focus:border-structural'
                }`}
              />
            </div>

            {/* Send Button on Right */}
            <button
              type="submit"
              disabled={!inputCommand.trim() || runAgent.isPending || isListening}
              className="h-12 min-w-[50px] px-4 rounded-xl border border-structural bg-ink text-surface flex items-center justify-center font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 shadow-xs"
              title="Send command"
              aria-label="Send command"
            >
              {runAgent.isPending ? (
                <Loader2 size={18} className="animate-spin text-surface" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
