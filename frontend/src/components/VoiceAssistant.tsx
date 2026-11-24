/**
 * VoiceAssistant.tsx - Floating push-to-talk mic and companion popup for proxidAI.
 *
 * Adapted from Gigr/frontend/src/components/VoiceAssistant.tsx (459 lines)
 * Pure ASCII, palette compliant (Ink #474329, Sand #FAF4ED, Accent #FC75B4).
 *
 * Tap-to-speak flow:
 * - Tapping the mic button opens the companion speech popup and starts listening immediately.
 * - Live speech transcripts stream in real-time inside the companion card.
 * - Auto-submits on speech completion (silence debounce or onend).
 * - Opens the Agent activity view and shows the tool calls and results.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Loader2, X, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  AnimatePresence,
  useAnimationControls,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

import { useAgentStore } from '@/store/agentStore'
import { agentAudio } from '@/lib/agentAudio'

const BUTTON_RADIUS = 28
/** The body is fully stretched once it trails the pointer by this many pixels. */
const MAX_PULL = 56

/** A blob that lags behind the dragged button, so pulling leaves a tail of it behind. */
function TrailBlob({
  dragX,
  dragY,
  stiffness,
  size,
  colorClass,
}: {
  dragX: MotionValue<number>
  dragY: MotionValue<number>
  stiffness: number
  size: number
  colorClass: string
}) {
  const lx = useSpring(dragX, { stiffness, damping: 20, mass: 0.9 })
  const ly = useSpring(dragY, { stiffness, damping: 20, mass: 0.9 })
  const x = useTransform([lx, dragX] as const, ([a, b]: number[]) => a - b)
  const y = useTransform([ly, dragY] as const, ([a, b]: number[]) => a - b)
  return (
    <motion.span
      aria-hidden="true"
      className={`absolute inset-0 rounded-full transition-colors duration-300 ${colorClass}`}
      style={{ x, y, scale: size }}
    />
  )
}

export default function VoiceAssistant() {
  const navigate = useNavigate()
  const { aiSettings, submitCommand, openPanel, navigateTarget, clearNavigateTarget } = useAgentStore()

  const [isOpen, setIsOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [typedCommand, setTypedCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Drag physics for mic button
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const massX = useSpring(dragX, { stiffness: 340, damping: 15, mass: 0.7 })
  const massY = useSpring(dragY, { stiffness: 340, damping: 15, mass: 0.7 })
  const pullX = useTransform([massX, dragX] as const, ([m, d]: number[]) => m - d)
  const pullY = useTransform([massY, dragY] as const, ([m, d]: number[]) => m - d)
  const pullAmount = useTransform([pullX, pullY] as const, ([x, y]: number[]) =>
    Math.min(1, Math.hypot(x, y) / MAX_PULL),
  )

  const lastAngleRef = useRef(0)
  const pullAngle = useTransform([pullX, pullY] as const, ([x, y]: number[]) => {
    if (Math.hypot(x, y) > 1) lastAngleRef.current = (Math.atan2(y, x) * 180) / Math.PI
    return lastAngleRef.current
  })
  const stretchX = useTransform(pullAmount, (a: number) => 1 + a * 0.8)
  const stretchY = useTransform(pullAmount, (a: number) => 1 - a * 0.34)
  const bodyX = useTransform([pullAmount, pullAngle] as const, ([a, deg]: number[]) =>
    Math.cos((deg * Math.PI) / 180) * a * 0.8 * BUTTON_RADIUS,
  )
  const bodyY = useTransform([pullAmount, pullAngle] as const, ([a, deg]: number[]) =>
    Math.sin((deg * Math.PI) / 180) * a * 0.8 * BUTTON_RADIUS,
  )
  const squash = useAnimationControls()
  const [isDragging, setIsDragging] = useState(false)
  const draggedRef = useRef(false)
  const [ripples, setRipples] = useState<number[]>([])

  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechBufferRef = useRef<string>('')

  const showToast = (msg: string) => {
    setToastMessage(msg)
    window.setTimeout(() => setToastMessage(null), 3500)
  }

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
    agentAudio.stopSonarPulse()
  }, [])

  const handleSubmit = useCallback(
    async (spokenSpeech: string) => {
      const cleanSpeech = spokenSpeech.trim()
      if (!cleanSpeech) return

      stopListening()
      setIsProcessing(true)

      try {
        const result = await submitCommand(cleanSpeech)
        if (result) {
          setIsOpen(false)
          openPanel()
          if (aiSettings.soundEnabled) {
            agentAudio.playSuccessChime()
          }
          showToast(`proxidAI: ${cleanSpeech.slice(0, 45)}`)

          // Check if action navigates or moves screen
          const target = useAgentStore.getState().navigateTarget
          if (target) {
            clearNavigateTarget()
            navigate(target)
          }
        }
      } catch {
        showToast('Failed to execute command.')
      } finally {
        setIsProcessing(false)
        setTranscript('')
        setTypedCommand('')
        speechBufferRef.current = ''
      }
    },
    [aiSettings.soundEnabled, clearNavigateTarget, navigate, openPanel, stopListening, submitCommand],
  )

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('Voice recognition not supported in this browser.')
      return
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = aiSettings.voiceLanguage || 'en-US'

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

      const activeSpeech = (finalSpeech || interimSpeech).trim()
      if (activeSpeech) {
        setTranscript(activeSpeech)
        speechBufferRef.current = activeSpeech

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
        }
        silenceTimerRef.current = setTimeout(() => {
          if (speechBufferRef.current) {
            handleSubmit(speechBufferRef.current)
          }
        }, 1200)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('[voice] Speech recognition error:', event.error)
      stopListening()
      if (event.error === 'not-allowed') {
        showToast('Microphone access denied. Check permissions.')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      agentAudio.stopSonarPulse()
      if (speechBufferRef.current) {
        handleSubmit(speechBufferRef.current)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setTranscript('')
    speechBufferRef.current = ''

    if (aiSettings.soundEnabled) {
      agentAudio.playSonarPulse()
    }
  }, [aiSettings.voiceLanguage, aiSettings.soundEnabled, handleSubmit, stopListening])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
      }
      agentAudio.stopSonarPulse()
    }
  }, [])

  if (!aiSettings.voiceEnabled) return null

  const handleMicToggle = () => {
    if (isListening) {
      if (speechBufferRef.current.trim()) {
        handleSubmit(speechBufferRef.current)
      } else {
        stopListening()
        setIsOpen(false)
      }
    } else {
      setIsOpen(true)
      startListening()
    }
  }

  const handleButtonClick = () => {
    if (draggedRef.current) return
    const id = Date.now()
    setRipples((prev) => [...prev, id])
    window.setTimeout(() => setRipples((prev) => prev.filter((r) => r !== id)), 650)
    handleMicToggle()
  }

  const handleClose = () => {
    stopListening()
    setIsOpen(false)
    setTranscript('')
    setTypedCommand('')
    speechBufferRef.current = ''
  }

  // Ink button with accent pulse when listening
  const bodyColor = isListening ? 'bg-ink' : 'bg-ink'

  const pressSquash = () => {
    void squash.start({
      scaleX: 1.14,
      scaleY: 0.84,
      transition: { type: 'spring', stiffness: 620, damping: 16 },
    })
  }

  const releaseSquash = () => {
    void squash.start({
      scaleX: [1.14, 0.9, 1.05, 0.98, 1],
      scaleY: [0.84, 1.12, 0.96, 1.02, 1],
      transition: { duration: 0.5, ease: 'easeOut' },
    })
  }

  return (
    <>
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] rounded-xl border border-structural bg-ink px-4 py-2.5 text-xs font-semibold text-page shadow-lg"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating draggable mic button */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.12}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 24 }}
        style={{ x: dragX, y: dragY }}
        onPointerDown={pressSquash}
        onPointerUp={releaseSquash}
        onPointerCancel={releaseSquash}
        onDragStart={() => {
          draggedRef.current = true
          setIsDragging(true)
        }}
        onDragEnd={() => {
          setIsDragging(false)
          releaseSquash()
          window.setTimeout(() => {
            draggedRef.current = false
          }, 80)
        }}
        className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 z-[9999] w-14 h-14 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
          <defs>
            <filter id="va-goo" filterUnits="userSpaceOnUse" x="-400" y="-400" width="900" height="900">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
              <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
            </filter>
          </defs>
        </svg>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ filter: 'url(#va-goo) drop-shadow(0 8px 12px rgba(28,27,18,0.25))' }}
        >
          <TrailBlob dragX={dragX} dragY={dragY} stiffness={240} size={0.9} colorClass={bodyColor} />
          <TrailBlob dragX={dragX} dragY={dragY} stiffness={140} size={0.74} colorClass={bodyColor} />
          <TrailBlob dragX={dragX} dragY={dragY} stiffness={85} size={0.58} colorClass={bodyColor} />
          <TrailBlob dragX={dragX} dragY={dragY} stiffness={52} size={0.42} colorClass={bodyColor} />
          <motion.span className="absolute inset-0" animate={squash} initial={{ scaleX: 1, scaleY: 1 }}>
            <motion.span className="absolute inset-0" style={{ x: bodyX, y: bodyY, rotate: pullAngle }}>
              <motion.span
                aria-hidden="true"
                className={`absolute inset-0 rounded-full transition-colors duration-300 ${bodyColor}`}
                style={{ scaleX: stretchX, scaleY: stretchY }}
              />
            </motion.span>
          </motion.span>
        </div>

        {/* Idle breathing halo */}
        {!isListening && !isDragging && (
          <motion.span
            aria-hidden="true"
            className="absolute -inset-1 rounded-full border border-structural/40 pointer-events-none"
            animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Active recording sonar ring with pink accent */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping pointer-events-none" />
            <span
              className="absolute -inset-2 rounded-full border border-accent/60 animate-ping pointer-events-none"
              style={{ animationDuration: '2s', animationDelay: '0.3s' }}
            />
          </>
        )}

        {/* Tap ripples */}
        <AnimatePresence>
          {ripples.map((id) => (
            <motion.span
              key={id}
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-2 border-accent/80 pointer-events-none"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2.1, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </AnimatePresence>

        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 520, damping: 14 }}
          onClick={handleButtonClick}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto text-page shadow-md ${
            isListening ? 'ring-4 ring-accent/50' : ''
          }`}
          title={
            isListening
              ? transcript
                ? `"${transcript}" - Tap to send`
                : 'Listening... Tap to send'
              : 'proxidAI - Tap to speak (Drag anywhere)'
          }
          aria-label={isListening ? 'Stop recording voice command' : 'Start recording voice command'}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin text-page" />
          ) : (
            <Mic className={`w-6 h-6 text-page ${isListening ? 'animate-pulse text-accent' : ''}`} />
          )}
        </motion.button>
      </motion.div>

      {/* Speech Companion Popup Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-36 right-4 lg:bottom-24 lg:right-8 z-[9999] w-84 max-w-[calc(100vw-2rem)]"
          >
            <div className="bg-surface rounded-2xl shadow-xl border border-line overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-sunken/40">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isListening ? 'bg-accent animate-pulse' : 'bg-structural'
                    }`}
                  />
                  <span className="text-xs font-semibold tracking-tight text-ink font-display uppercase">
                    proxidAI
                  </span>
                  <span className="text-[10px] font-mono text-muted">
                    {isListening ? '[LISTENING]' : isProcessing ? '[PROCESSING]' : '[READY]'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1 rounded-lg text-muted hover:text-ink hover:bg-sunken transition-colors"
                  aria-label="Close assistant"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Live speech typing display */}
              <div className="p-4 min-h-[96px] flex flex-col justify-center">
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-muted">
                    <Loader2 className="w-4 h-4 animate-spin text-ink" />
                    <span className="text-xs font-medium">Processing instruction...</span>
                  </div>
                ) : transcript ? (
                  <div className="text-xs text-ink font-medium leading-relaxed bg-sunken/50 p-3 rounded-xl border border-line">
                    "{transcript}"
                  </div>
                ) : isListening ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 bg-accent rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-accent rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-accent rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                    <span className="text-xs text-muted">Listening to your voice... speak now</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted text-center py-2">
                    Tap the mic to speak, or type your request below.
                  </p>
                )}
              </div>

              {/* Text input fallback */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (typedCommand.trim()) handleSubmit(typedCommand)
                }}
                className="p-2.5 pt-0 flex gap-1.5 items-center"
              >
                <input
                  type="text"
                  value={typedCommand}
                  onChange={(e) => setTypedCommand(e.target.value)}
                  placeholder="Or type an instruction..."
                  disabled={isProcessing}
                  className="flex-1 text-xs bg-sunken/50 border border-line rounded-xl px-3 py-2 text-ink placeholder-muted focus:outline-none focus:ring-1 focus:ring-structural"
                />
                <button
                  type="submit"
                  disabled={!typedCommand.trim() || isProcessing}
                  className="h-8 w-8 rounded-xl bg-ink hover:opacity-90 text-page flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors shadow-xs"
                  title="Send"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
