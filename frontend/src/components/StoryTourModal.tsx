/**
 * StoryTourModal.tsx - 8-Scene Paper-Craft Cartoon Story Demo.
 * Pure ASCII, palette compliant (#474329 ink, #F0E5DB sand, #FC75B4 accent).
 * Features Amaka, Tunde, and proxidAI with framer-motion cut-paper choreography.
 * Resumable from localStorage, with Back, Next, Pause/Play, Jump, and Finish controls.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Pause, Play, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Scene1AmakaNeedsPlumber,
  Scene2TrustAndVerified,
  Scene3VoiceScout,
  Scene4TundeWithVan,
  Scene5EscrowSecurity,
  Scene6ConcordiumSettlement,
  Scene7ZeroKnowledgeIdentity,
  Scene8AgentConsentGuards,
} from '@/components/illustrations/StoryScenes'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useTourStore } from '@/store/tourStore'

interface StorySceneData {
  title: string
  subtitle: string
  story: string
  lesson: string
  component: React.ComponentType<{ className?: string; isPlaying?: boolean }>
}

const STORY_SCENES: StorySceneData[] = [
  {
    title: 'LOCAL DISCOVERY',
    subtitle: 'Amaka needs a plumber today',
    story:
      "Water is leaking under Amaka's sink in Ikoyi. She does not want to wait three days or call random unvetted numbers from noticeboards.",
    lesson:
      'ProxID lets her view verified services and live jobs within a strict local radius circle, ranked by distance and reputation.',
    component: Scene1AmakaNeedsPlumber,
  },
  {
    title: 'PROVEN IDENTITY',
    subtitle: 'She is not sure who to trust',
    story:
      'Inviting a stranger into your home requires confidence that they are who they claim, without forcing them to surrender government IDs to central databases.',
    lesson:
      'The Concordium verified human badge proves unique personhood through Zero-Knowledge cryptographic attestations on testnet.',
    component: Scene2TrustAndVerified,
  },
  {
    title: 'VOICE SCOUT',
    subtitle: 'She would rather just ask',
    story:
      'Instead of typing complicated filter queries on a tiny keyboard, Amaka taps the microphone and speaks naturally.',
    lesson:
      'proxidAI parses her request, extracts the trade, urgency, and budget, and outputs structured action chips instantly.',
    component: Scene3VoiceScout,
  },
  {
    title: 'MATCHING WORK',
    subtitle: 'Tunde has a van and wants work',
    story:
      'Tunde is a qualified plumber working 2 km away. His van is equipped and he has two hours open between jobs.',
    lesson:
      "Tunde published his service listing and gets notified the moment Amaka's request matches his skills, tapping Apply right from the card.",
    component: Scene4TundeWithVan,
  },
  {
    title: 'ESCROW SECURITY',
    subtitle: 'Money is held until the work is done',
    story:
      'Amaka does not pay cash up front, and Tunde does not start without guaranteed funding. Trust is enforced by protocol.',
    lesson:
      'The payment is locked safely in Concordium escrow before work begins. Neither party can unilaterally misappropriate the funds.',
    component: Scene5EscrowSecurity,
  },
  {
    title: 'SETTLEMENT',
    subtitle: 'The payment settles on Concordium',
    story:
      'When the pipe is fixed, Amaka marks the job complete. Instant payment settlement takes place on-chain.',
    lesson:
      'x402 payment requirements settle peer-to-peer on Concordium testnet with a verifiable cryptographic transaction hash and zero rent-seeking middlemen.',
    component: Scene6ConcordiumSettlement,
  },
  {
    title: 'ZERO-KNOWLEDGE PRIVACY',
    subtitle: 'Proving identity without revealing data',
    story:
      'At no point were home addresses, passport scans, or national identification numbers stored in an unencrypted server.',
    lesson:
      'Concordium ID identity layers allow both clients and providers to prove personhood and age requirements while retaining absolute personal privacy.',
    component: Scene7ZeroKnowledgeIdentity,
  },
  {
    title: 'AGENT BOUNDARIES',
    subtitle: 'The agent asks before it spends',
    story:
      'proxidAI acts autonomously to match jobs, scout talent, and prepare transactions, but cannot spend your money without explicit consent.',
    lesson:
      'Client spending caps (e.g. NGN 10,000) and Article 12 off-chain audit hashes ensure every AI action is accountable, reversible, and user-approved.',
    component: Scene8AgentConsentGuards,
  },
]

export function StoryTourModal() {
  const navigate = useNavigate()
  const shouldReduce = useReducedMotion() ?? false
  const isTourActive = useTourStore((state) => state.isTourActive)
  const tourType = useTourStore((state) => state.tourType)
  const sceneIndex = useTourStore((state) => state.storyScene)
  const setStoryScene = useTourStore((state) => state.setStoryScene)
  const setTourActive = useTourStore((state) => state.setTourActive)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const status = useAuthStore((state) => state.status)

  const [isPlaying, setIsPlaying] = useState(true)
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1)

  const currentScene = STORY_SCENES[sceneIndex] ?? STORY_SCENES[0]
  const SceneComponent = currentScene.component

  // Auto-advance when playing (7.5 seconds per scene)
  useEffect(() => {
    if (!isTourActive || tourType !== 'story' || !isPlaying) return
    const timer = setTimeout(() => {
      if (sceneIndex < STORY_SCENES.length - 1) {
        setSlideDirection(1)
        setStoryScene(sceneIndex + 1)
      } else {
        setIsPlaying(false)
      }
    }, 7500)
    return () => clearTimeout(timer)
  }, [isTourActive, tourType, isPlaying, sceneIndex, setStoryScene])

  if (!isTourActive || tourType !== 'story') return null

  const handleFinish = () => {
    setTourActive(false, null)
    setStoryScene(0)
    if (status === 'signed-in') {
      void updateProfile({ onboarded: true })
    }
    navigate('/services')
  }

  const handleNext = () => {
    if (sceneIndex < STORY_SCENES.length - 1) {
      setSlideDirection(1)
      setStoryScene(sceneIndex + 1)
    } else {
      handleFinish()
    }
  }

  const handlePrev = () => {
    if (sceneIndex > 0) {
      setSlideDirection(-1)
      setStoryScene(sceneIndex - 1)
    }
  }

  const handleJump = (idx: number) => {
    setSlideDirection(idx > sceneIndex ? 1 : -1)
    setStoryScene(idx)
  }

  // Mobile horizontal swipe detection
  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -45) {
      handleNext()
    } else if (info.offset.x > 45) {
      handlePrev()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Story Demo Tour"
      className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm select-none"
    >
      <div className="relative w-full max-w-lg rounded-2xl border-2 border-structural bg-surface p-4 sm:p-6 shadow-2xl flex flex-col space-y-4 max-h-[96vh] overflow-y-auto">
        {/* Top Header with title, progress & pause/play */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent-ink bg-accent px-2 py-0.5 rounded-md">
              {currentScene.title}
            </span>
            <span className="font-mono text-xs text-muted">
              {sceneIndex + 1} / {STORY_SCENES.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Pause / Play Narration Button */}
            <button
              type="button"
              onClick={() => setIsPlaying((prev) => !prev)}
              data-testid="tour-pause-play-btn"
              className="p-1.5 rounded-lg border border-line bg-surface text-ink hover:bg-sunken transition-colors"
              title={isPlaying ? 'Pause auto-play' : 'Resume auto-play'}
              aria-label={isPlaying ? 'Pause auto-play' : 'Resume auto-play'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleFinish}
              data-testid="tour-close-btn"
              className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-sunken transition-colors"
              title="Close tour"
              aria-label="Close tour"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scene Container with Mobile Swipe & Card Slide Transition */}
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={sceneIndex}
            custom={slideDirection}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={
              shouldReduce
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection * 100 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              shouldReduce
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection * -100 }
            }
            transition={
              shouldReduce
                ? { duration: 0.15 }
                : { duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }
            }
            className="flex flex-col space-y-3 cursor-grab active:cursor-grabbing"
          >
            {/* Paper-craft Vector Illustration */}
            <div className="flex justify-center py-1">
              <SceneComponent
                className="w-full h-auto max-h-[220px] object-contain rounded-xl select-none"
                isPlaying={isPlaying}
              />
            </div>

            {/* Line-by-line Staggered Narration */}
            <div className="space-y-2">
              {/* Line 1: Subtitle */}
              <motion.h2
                initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="font-display text-base sm:text-lg font-bold uppercase tracking-tight text-ink"
              >
                {currentScene.subtitle}
              </motion.h2>

              {/* Line 2: Story Prose */}
              <motion.p
                initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.35 }}
                className="text-xs sm:text-sm text-ink leading-relaxed"
              >
                {currentScene.story}
              </motion.p>

              {/* Line 3: How ProxID Solves this (Lesson) */}
              <motion.div
                initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, duration: 0.35 }}
                className="rounded-xl border border-line bg-sunken/40 p-3 text-xs text-muted"
              >
                <strong className="text-ink font-semibold">How ProxID solves this: </strong>
                <span>{currentScene.lesson}</span>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Scene Jump Dots / Chips */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {STORY_SCENES.map((s, idx) => (
            <button
              key={s.title}
              type="button"
              onClick={() => handleJump(idx)}
              data-testid={`tour-jump-${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-200 ${
                sceneIndex === idx
                  ? 'w-6 bg-structural'
                  : 'w-2 bg-line hover:bg-muted/60'
              }`}
              title={`Jump to Scene ${idx + 1}: ${s.title}`}
              aria-label={`Jump to Scene ${idx + 1}: ${s.title}`}
            />
          ))}
        </div>

        {/* Action Controls: Skip, Back, Next */}
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <button
            type="button"
            onClick={handleFinish}
            data-testid="tour-skip-btn"
            className="text-xs font-semibold text-muted hover:text-ink hover:underline"
          >
            Skip to App
          </button>

          <div className="flex items-center gap-2">
            <Button
              intent="secondary"
              size="sm"
              disabled={sceneIndex === 0}
              onClick={handlePrev}
              data-testid="tour-prev-btn"
            >
              <ArrowLeft size={14} className="mr-1" aria-hidden="true" />
              Back
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={handleNext}
              data-testid="tour-next-btn"
            >
              <span>{sceneIndex === STORY_SCENES.length - 1 ? 'Start Using ProxID' : 'Next Scene'}</span>
              <ArrowRight size={14} className="ml-1" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
