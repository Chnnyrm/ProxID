/**
 * VoiceAssistant.tsx - Floating push-to-talk mic for proxidAI.
 * Pure ASCII, palette compliant (Ink #474329, Sand #FAF4ED, Accent #FC75B4).
 *
 * Requirements:
 * - Tapping mic records audio.
 * - On speech completion, navigates to /agent with command transcript.
 * - Shows live transcription indicator while recording.
 * - No misaligned inline textarea popup.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Loader2 } from 'lucide-react'
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
const MAX_PULL = 56

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
  const { aiSettings } = useAgentStore()

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
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
    (spokenSpeech: string) => {
      const cleanSpeech = spokenSpeech.trim()
      if (!cleanSpeech) return

      stopListening()
      setTranscript('')
      speechBufferRef.current = ''

      if (aiSettings.soundEnabled) {
        agentAudio.playSuccessChime()
      }

      // Navigate directly to /agent with command
      navigate(`/agent?command=${encodeURIComponent(cleanSpeech)}`)
    },
    [aiSettings.soundEnabled, navigate, stopListening],
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

  const handleMicToggle = () => {
    if (isListening) {
      if (speechBufferRef.current.trim()) {
        handleSubmit(speechBufferRef.current)
      } else {
        stopListening()
      }
    } else {
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

  const bodyColor = 'bg-ink'

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
        className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 z-[9999] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
          <defs>
            <filter id="va-goo" filterUnits="userSpaceOnUse" x="-400" y="-400" width="900" height="900">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
              <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
            </filter>
          </defs>
        </svg>

        {/* Live speech feedback pill above mic button */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="absolute -top-12 right-0 whitespace-nowrap bg-surface border border-line px-3 py-1.5 rounded-full shadow-md flex items-center gap-2 pointer-events-none"
            >
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <span className="text-[11px] font-mono font-medium text-ink">
                {transcript ? `"${transcript}"` : 'Listening... speak now'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

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
                ? `"${transcript}" - Tap to submit`
                : 'Listening... Tap to submit'
              : 'proxidAI - Tap to speak (Drag anywhere)'
          }
          aria-label={isListening ? 'Stop recording voice command' : 'Start recording voice command'}
        >
          <Mic className={`w-6 h-6 text-page ${isListening ? 'animate-pulse text-accent' : ''}`} />
        </motion.button>
      </motion.div>
    </>
  )
}
