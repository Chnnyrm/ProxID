/**
 * StoryTourModal.tsx - 8-Scene Paper-Craft Cartoon Story Demo.
 * Pure ASCII, palette compliant (#474329 ink, #F0E5DB sand, #FC75B4 accent).
 * Features Amaka, Tunde, and proxidAI.
 * Resumable from localStorage, with Back, Next, Skip, and Finish controls.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'

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
  component: React.ComponentType<{ className?: string }>
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
  const isTourActive = useTourStore((state) => state.isTourActive)
  const tourType = useTourStore((state) => state.tourType)
  const sceneIndex = useTourStore((state) => state.storyScene)
  const setStoryScene = useTourStore((state) => state.setStoryScene)
  const setTourActive = useTourStore((state) => state.setTourActive)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const status = useAuthStore((state) => state.status)

  if (!isTourActive || tourType !== 'story') return null

  const currentScene = STORY_SCENES[sceneIndex] ?? STORY_SCENES[0]
  const SceneComponent = currentScene.component

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
      setStoryScene(sceneIndex + 1)
    } else {
      handleFinish()
    }
  }

  const handlePrev = () => {
    if (sceneIndex > 0) {
      setStoryScene(sceneIndex - 1)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Story Demo Tour"
      className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm select-none"
    >
      <div className="relative w-full max-w-lg rounded-2xl border-2 border-structural bg-surface p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 max-h-[95vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent-ink bg-accent px-2 py-0.5 rounded-md">
              {currentScene.title}
            </span>
            <span className="font-mono text-xs text-muted">
              Scene {sceneIndex + 1} of {STORY_SCENES.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="rounded-lg p-1 text-muted hover:text-ink hover:bg-sunken transition-colors"
            title="Skip demo story"
            aria-label="Skip demo story"
          >
            <X size={18} />
          </button>
        </div>

        {/* Paper-craft Vector Illustration */}
        <div className="flex justify-center py-1">
          <SceneComponent className="w-full h-auto max-h-[220px] object-contain rounded-xl" />
        </div>

        {/* Story Prose and Lesson */}
        <div className="space-y-2">
          <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-ink">
            {currentScene.subtitle}
          </h2>
          <p className="text-xs sm:text-sm text-ink leading-relaxed">
            {currentScene.story}
          </p>
          <div className="rounded-xl border border-line bg-sunken/40 p-3 text-xs text-muted">
            <strong className="text-ink font-semibold">How ProxID solves this: </strong>
            <span>{currentScene.lesson}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-line h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-accent h-full transition-all duration-300"
            style={{ width: `${((sceneIndex + 1) / STORY_SCENES.length) * 100}%` }}
          />
        </div>

        {/* Action Controls: Back, Skip, Next */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleFinish}
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
            >
              <ArrowLeft size={14} className="mr-1" aria-hidden="true" />
              Back
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={handleNext}
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
