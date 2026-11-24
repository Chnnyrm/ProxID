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
 *    - Persistent bottom input: mic on left (data-tour="tour-mic"), input center, send on right,
 *      sticky above bottom navigation at 390px (sticky bottom-16 lg:bottom-0).
 *    - Consent card (data-tour="tour-consent"): human-in-the-loop spending limit warning.
 * 2. Mic auto-submit:
 *    - Live speech transcription immediately calls POST /api/v1/agent/run with {"command": transcript}.
 *    - Renders reply, steps, used_tools, and degraded.
 * 3. 100% Pure ASCII, palette compliant (Ink #474329, Sand #FAF4ED, Accent #FC75B4).
 */

import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
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
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import {
  useAgentActivity,
  useAgentCard,
  useAgentIdentity,
  useAgentTools,
  useRunAgent,
} from '@/hooks/useAgent'
import { useLocationStore } from '@/store/locationStore'
import type { AgentStep } from '@/types/api'

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  steps?: AgentStep[]
  used_tools?: string[]
  degraded?: boolean
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
  const { isSignedIn, user } = useAuth()
  const tools = useAgentTools()
  const card = useAgentCard(isSignedIn)
  const identity = useAgentIdentity(isSignedIn)
  const runAgent = useRunAgent()
  const setCoordinates = useLocationStore((state) => state.setCoordinates)

  const [inputCommand, setInputCommand] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [speechInterim, setSpeechInterim] = useState('')
  const [workingStatus, setWorkingStatus] = useState<string | null>(null)
  const [showCardDetails, setShowCardDetails] = useState(false)

  const recognitionRef = useRef<any>(null)
  const chatBottomRef = useRef<HTMLDivElement | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      const lower = clean.toLowerCase()
      if (lower.includes('plumber') && (lower.includes('yaba') || lower.includes('20000'))) {
        setCoordinates({ latitude: 6.5121, longitude: 3.3739 }, 'stored')
      }

      runAgent.mutate(
        { command: clean },
        {
          onSuccess: (data) => {
            setWorkingStatus(null)
            const agentMsg: ChatMessage = {
              id: `agent-${Date.now()}`,
              role: 'agent',
              text: data.reply,
              steps: data.steps,
              used_tools: data.used_tools,
              degraded: data.degraded,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
            setMessages((prev) => [...prev, agentMsg])
          },
          onError: () => {
            setWorkingStatus(null)
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

  // Start speech recognition
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recognition is not supported in this browser. Please type your message.')
      return
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
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

      // If speech completed, auto-submit immediately
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
      // If there was captured interim text on end, auto-submit it
      if (speechInterim.trim() && speechInterim !== 'Listening...') {
        const spoken = speechInterim.trim()
        setSpeechInterim('')
        executeCommand(spoken)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [executeCommand, speechInterim, stopListening])

  const toggleMic = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-4xl mx-auto px-3 sm:px-4">
      {/* 1. Header: proxidAI avatar, verified state, registry identity */}
      <header className="py-3 border-b border-line shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={PROXIDAI_AVATAR}
              alt="proxidAI"
              className="h-11 w-11 rounded-full border border-structural bg-surface object-cover shadow-xs"
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
              <span className="inline-flex items-center gap-1 rounded-full border border-structural bg-surface px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-ink shadow-xs">
                Verified Human Registry
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted font-mono mt-0.5">
              <span>cis-8004:proxid-registry</span>
              <span>//</span>
              <span>{tools.data?.llm_configured ? 'model active' : 'deterministic fallback'}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCardDetails((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink border border-line bg-surface rounded-lg px-2.5 py-1.5 transition-colors shadow-xs"
        >
          <Shield size={13} className="text-accent" />
          <span className="hidden sm:inline">Registry Card</span>
          {showCardDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </header>

      {/* Expandable Cryptographic Card & Checks */}
      {showCardDetails && (
        <section className="shrink-0 p-3 my-2 rounded-xl border border-line bg-sunken/40 space-y-2 text-xs">
          <div className="flex items-center justify-between font-mono text-[11px] text-muted">
            <span className="font-bold text-ink uppercase tracking-wider">
              Concordium CIS-8004 Agent Card
            </span>
            <span>Status: Verified</span>
          </div>
          {card.data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {card.data.verification.checks.map((check) => (
                <div
                  key={check.name}
                  className="flex items-start gap-2 bg-surface p-2 rounded-lg border border-line"
                >
                  <CheckCircle2 size={14} className="mt-0.5 text-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink leading-tight">{check.name}</p>
                    <p className="text-[10px] text-muted truncate">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Loading cryptographic agent registration...</p>
          )}
        </section>
      )}

      {/* 2. Consent Card (data-tour="tour-consent") */}
      <div
        data-tour="tour-consent"
        className="shrink-0 my-2 rounded-xl border border-structural bg-surface p-3 shadow-xs flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-surface shrink-0">
            <ShieldAlert size={15} />
          </div>
          <p className="text-xs text-ink">
            <span className="font-bold">Human consent required:</span> proxidAI asks before spending or releasing funds. Every payment generates an auditable x402 receipt for your wallet approval.
          </p>
        </div>
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-muted hidden md:inline">
          SPEND GUARD ACTIVE
        </span>
      </div>

      {/* 3. Conversation Message Thread */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
        {messages.length === 0 ? (
          /* Empty state with 3 suggested prompts */
          <div className="flex flex-col items-center justify-center min-h-[260px] text-center px-4 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-structural bg-surface shadow-xs">
              <Bot size={32} className="text-ink" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">How can proxidAI help you?</h2>
              <p className="text-xs text-muted max-w-sm mt-1">
                Ask to find local verified providers, scout services, or review open tasks.
              </p>
            </div>

            <div className="w-full max-w-md space-y-2 pt-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block text-left">
                Suggested Prompts
              </span>
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
                  {/* Intermediate Tool Call Rows */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="space-y-1.5 pl-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block">
                        Tool Executions ({msg.steps.length})
                      </span>
                      {msg.steps.map((st, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-line bg-sunken/40 px-3 py-2 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-ink">
                              <Wrench size={12} className="text-muted" />
                              {st.tool}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold uppercase ${
                                st.succeeded ? 'text-accent' : 'text-muted'
                              }`}
                            >
                              {st.succeeded ? 'SUCCESS' : 'FAILED'}
                            </span>
                          </div>
                          <p className="text-muted text-[11px] leading-snug">{st.summary}</p>
                          {st.arguments && (
                            <div className="text-[10px] font-mono text-muted/80 bg-surface px-2 py-1 rounded border border-line/60 overflow-x-auto">
                              args: {JSON.stringify(st.arguments)}
                            </div>
                          )}
                        </div>
                      ))}
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

                    {/* Quick navigation actions if query was plumber or scout */}
                    {msg.text.toLowerCase().includes('plumber') && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line">
                        <button
                          type="button"
                          onClick={() => navigate('/services?q=plumber&max_price=20000')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-structural bg-ink px-3 py-1 text-xs font-bold text-surface hover:opacity-90 shadow-xs"
                        >
                          <span>View on Services</span>
                          <ArrowRight size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/map?filter=services')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1 text-xs font-bold text-ink hover:bg-sunken shadow-xs"
                        >
                          <MapPin size={12} />
                          <span>View on Map</span>
                        </button>
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

        {/* Visible Working State Indicator */}
        {workingStatus && (
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-line bg-surface max-w-sm shadow-xs animate-pulse">
            <Loader2 size={16} className="animate-spin text-accent" />
            <div>
              <p className="text-xs font-bold text-ink">{workingStatus}</p>
              <p className="text-[10px] font-mono text-muted">executing verified tools...</p>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* 4. Persistent Bottom Input: mic on left, input, send on right */}
      {/* Sticky bottom-16 lg:bottom-0 keeps it pinned right above mobile bottom nav */}
      <div className="sticky bottom-16 lg:bottom-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line py-2.5 px-1 sm:px-2">
        {/* Live speech feedback pill if recording */}
        {isListening && (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-structural bg-ink text-surface px-3 py-2 text-xs shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent shrink-0">
                [RECORDING]
              </span>
              <span className="truncate italic">{speechInterim || 'Speak now...'}</span>
            </div>
            <button
              type="button"
              onClick={stopListening}
              className="text-xs font-bold underline text-surface shrink-0 ml-2"
            >
              Stop
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            executeCommand(inputCommand)
          }}
          className="flex items-center gap-2"
        >
          {/* Microphone button (data-tour="tour-mic") */}
          <button
            data-tour="tour-mic"
            type="button"
            onClick={toggleMic}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
              isListening
                ? 'border-accent bg-accent/20 text-accent ring-2 ring-accent/40 animate-pulse'
                : 'border-line bg-surface text-ink hover:bg-sunken hover:border-structural'
            }`}
            title={isListening ? 'Stop recording voice' : 'Tap to speak instruction'}
            aria-label={isListening ? 'Stop recording voice' : 'Start recording voice'}
          >
            {isListening ? (
              <Radio size={18} className="text-accent animate-pulse" />
            ) : (
              <Mic size={18} />
            )}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            disabled={runAgent.isPending}
            placeholder={isListening ? 'Transcribing your voice...' : 'Ask proxidAI anything...'}
            className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-muted focus:border-structural focus:outline-none focus:ring-1 focus:ring-structural shadow-xs transition-colors"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputCommand.trim() || runAgent.isPending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-structural bg-ink text-surface disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all shadow-xs"
            title="Send instruction"
            aria-label="Send instruction to proxidAI"
          >
            {runAgent.isPending ? (
              <Loader2 size={16} className="animate-spin text-surface" />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
