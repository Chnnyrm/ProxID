/**
 * ProfileToursCard.tsx
 *
 * Card on /profile for replaying onboarding and narrative tours at any time:
 * - Quick Spotlight Tour (5 steps).
 * - Story Demo Narrative (8 interactive scenes).
 * - Explains they can be replayed whenever wanted.
 * - Restarting resets progress for that tour only.
 * - Pure ASCII.
 */

import { BookOpen, Compass, RotateCcw, Sparkles } from 'lucide-react'

import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useTourStore } from '@/store/tourStore'

export function ProfileToursCard() {
  const setStoryScene = useTourStore((state) => state.setStoryScene)
  const setTourActive = useTourStore((state) => state.setTourActive)

  const handleRestartQuickTour = () => {
    // Reset quick tour and trigger spotlight overlay
    window.dispatchEvent(
      new CustomEvent('open-onboarding', { detail: { type: 'quick' } })
    )
  }

  const handleRestartStoryTour = () => {
    // Reset story demo scene to 0 only and trigger modal
    setStoryScene(0)
    setTourActive(true, 'story')
    window.dispatchEvent(
      new CustomEvent('open-onboarding', { detail: { type: 'story' } })
    )
  }

  return (
    <Card data-testid="profile-tours-card">
      <CardHeader
        title="Tours & Walkthroughs"
        hint="Interactive guides to platform mechanics and cryptography."
      />
      <CardBody className="space-y-4">
        <p className="text-xs text-muted leading-relaxed">
          These interactive tours can be replayed at any time. Whether you want a refresher on navigation or want to review how Concordium zero-knowledge identity safeguards your privacy, restart either tour below.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* 1. Quick Tour */}
          <div className="rounded-xl border border-line bg-sunken/40 p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs font-display uppercase tracking-wider text-ink mb-1">
                <Compass size={14} className="text-ink" />
                <span>Quick Tour</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                5-step interactive spotlight highlighting local services, the Concordium verified badge, voice agent commands, and job posting.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRestartQuickTour}
              data-testid="restart-quick-tour-btn"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-mono font-bold text-ink hover:bg-sunken hover:border-structural transition-colors shadow-xs active:translate-y-px"
            >
              <RotateCcw size={12} />
              <span>Restart Quick Tour</span>
            </button>
          </div>

          {/* 2. Story Demo */}
          <div className="rounded-xl border border-line bg-sunken/40 p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs font-display uppercase tracking-wider text-ink mb-1">
                <BookOpen size={14} className="text-ink" />
                <span>Story Demo</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                8-scene comic walkthrough explaining cryptographic identity anchors, zero-knowledge proofs, micro-escrow, and spending limits.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRestartStoryTour}
              data-testid="restart-story-tour-btn"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-structural bg-ink px-3 py-2 text-xs font-mono font-bold text-page hover:opacity-90 transition-opacity shadow-xs active:translate-y-px"
            >
              <Sparkles size={12} />
              <span>Restart Story Demo</span>
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
