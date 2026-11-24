/**
 * OnboardingOverlay.tsx - 4-step spotlight onboarding tour.
 *
 * Requirements:
 * 1. Spotlight cutout dimming everything except the target element.
 * 2. Pointer/arrow from the tooltip to the target.
 * 3. Pulse ring on the target.
 * 4. Explicit Back and Next, step counter (Step X of 4), and Skip.
 * 5. Moves the person between pages when a step concerns another page, then continues.
 * 6. Four steps, one per idea, max ~10 words:
 *    1. "Your map. Providers near you, every one a verified human." -> target: map on /map
 *    2. "Need something done? Post it, or hire a listing." -> target: nav on /services
 *    3. "Tap the mic and tell proxidAI what you need." -> target: mic on /agent
 *    4. "It asks before it spends anything. That is the point." -> target: consent area on /agent
 * 7. 100% Pure ASCII, palette compliant.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'

interface TourStep {
  route: string
  target: string
  title: string
  text: string
}

const TOUR_STEPS: TourStep[] = [
  {
    route: '/map',
    target: '[data-tour="tour-map"]',
    title: 'LOCAL MAP',
    text: 'Your map. Providers near you, every one a verified human.',
  },
  {
    route: '/services',
    target: '[data-tour="nav-services"]',
    title: 'MARKETPLACE',
    text: 'Need something done? Post it, or hire a listing.',
  },
  {
    route: '/agent',
    target: '[data-tour="tour-mic"]',
    title: 'VOICE AGENT',
    text: 'Tap the mic and tell proxidAI what you need.',
  },
  {
    route: '/agent',
    target: '[data-tour="tour-consent"]',
    title: 'SPEND GUARD',
    text: 'It asks before it spends anything. That is the point.',
  },
]

const STORAGE_KEY_SEEN = 'proxid_onboarded_seen_v2'
const STORAGE_KEY_NEVER = 'proxid_onboarded_never_v2'

export default function OnboardingOverlay() {
  const navigate = useNavigate()
  const location = useLocation()

  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)

  const activeStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0]

  // Find and measure target element
  const measureTarget = useCallback(() => {
    const el = document.querySelector(activeStep.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      // If element is offscreen, gently scroll it into view
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setTargetRect(el.getBoundingClientRect())
    } else {
      setTargetRect(null)
    }
  }, [activeStep.target])

  // Handle route change when step changes
  useEffect(() => {
    if (!open) return

    if (location.pathname !== activeStep.route) {
      setIsNavigating(true)
      navigate(activeStep.route)
      const timer = window.setTimeout(() => {
        measureTarget()
        setIsNavigating(false)
      }, 350)
      return () => {
        clearTimeout(timer)
        setIsNavigating(false)
      }
    } else {
      const timer = window.setTimeout(() => {
        measureTarget()
        setIsNavigating(false)
      }, 100)
      return () => {
        clearTimeout(timer)
        setIsNavigating(false)
      }
    }
  }, [open, stepIndex, activeStep.route, location.pathname, navigate, measureTarget])

  // Track window resize and scroll
  useEffect(() => {
    if (!open) return
    const handleUpdate = () => measureTarget()
    window.addEventListener('resize', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)
    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
    }
  }, [open, measureTarget])

  // Check first visit
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY_NEVER)) return
      const seen = localStorage.getItem(STORAGE_KEY_SEEN)
      if (seen) return
      // Auto open on first visit
      setOpen(true)
    } catch {}
  }, [])

  // Listen for resume / re-open event
  useEffect(() => {
    const handleReopen = () => {
      setStepIndex(0)
      setOpen(true)
    }
    window.addEventListener('open-onboarding', handleReopen)
    return () => window.removeEventListener('open-onboarding', handleReopen)
  }, [])

  // Dismiss on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishTour()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const finishTour = () => {
    setOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY_SEEN, String(Date.now()))
      localStorage.setItem(STORAGE_KEY_NEVER, '1')
    } catch {}
  }

  const nextStep = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((s) => s + 1)
    } else {
      finishTour()
    }
  }

  const prevStep = () => {
    if (stepIndex > 0) {
      setStepIndex((s) => s - 1)
    }
  }

  if (!open) return null

  // Calculate tooltip placement
  const tooltipWidth = Math.min(340, window.innerWidth - 32)
  let tooltipTop = 100
  let tooltipLeft = 20
  let arrowPlacement: 'top' | 'bottom' = 'top'
  let arrowLeft = 40

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom
    const spaceAbove = targetRect.top

    if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
      tooltipTop = Math.min(window.innerHeight - 230, targetRect.bottom + 16)
      arrowPlacement = 'top'
    } else {
      tooltipTop = Math.max(16, targetRect.top - 210)
      arrowPlacement = 'bottom'
    }

    const targetCenterX = targetRect.left + targetRect.width / 2
    tooltipLeft = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetCenterX - tooltipWidth / 2))
    arrowLeft = Math.max(16, Math.min(tooltipWidth - 24, targetCenterX - tooltipLeft))
  } else {
    tooltipTop = window.innerHeight / 2 - 100
    tooltipLeft = window.innerWidth / 2 - tooltipWidth / 2
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] overflow-hidden select-none">
        {/* SVG Spotlight Cutout Mask */}
        <svg
          className="fixed inset-0 pointer-events-none z-[1000] w-full h-full"
          aria-hidden="true"
        >
          <defs>
            <mask id="proxid-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - 6}
                  y={targetRect.top - 6}
                  width={targetRect.width + 12}
                  height={targetRect.height + 12}
                  rx={12}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="#1C1B12"
            fillOpacity="0.75"
            mask="url(#proxid-spotlight-mask)"
          />
        </svg>

        {/* Pulse Ring directly around the target element */}
        {targetRect && (
          <div
            className="fixed pointer-events-none z-[1001] rounded-2xl border-2 border-accent animate-pulse ring-4 ring-accent/30 transition-all duration-300"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
          />
        )}

        {/* Tooltip Card anchored near target */}
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: arrowPlacement === 'top' ? -8 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[1002] rounded-2xl border border-structural bg-surface p-5 shadow-2xl"
          style={{
            top: tooltipTop,
            left: tooltipLeft,
            width: tooltipWidth,
          }}
        >
          {/* Pointer Triangle / Arrow */}
          {targetRect && (
            <div
              className={`absolute h-0 w-0 border-x-8 border-x-transparent ${
                arrowPlacement === 'top'
                  ? '-top-2 border-b-8 border-b-surface'
                  : '-bottom-2 border-t-8 border-t-surface'
              }`}
              style={{ left: arrowLeft - 8 }}
            />
          )}

          {/* Close / Skip button */}
          <button
            type="button"
            onClick={finishTour}
            className="absolute right-3.5 top-3.5 rounded-lg p-1 text-muted hover:text-ink hover:bg-sunken transition-colors"
            title="Skip tour"
            aria-label="Skip tour"
          >
            <X size={15} />
          </button>

          {/* Step Counter */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
              Step {stepIndex + 1} of {TOUR_STEPS.length}
            </span>
            <span className="h-1 w-1 rounded-full bg-accent" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink font-semibold">
              {activeStep.title}
            </span>
          </div>

          {/* Step Text (exact ~10 words, concise) */}
          <p className="mt-2 text-sm sm:text-base font-bold text-ink leading-snug">
            {activeStep.text}
          </p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === stepIndex ? 'w-6 bg-ink' : 'w-2 bg-line'
                }`}
              />
            ))}
          </div>

          {/* Navigation Controls: Back, Skip, Next */}
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
            <div className="flex items-center gap-2">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-xs font-bold text-ink hover:bg-sunken transition-colors shadow-xs"
                >
                  <ArrowLeft size={12} />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finishTour}
                  className="text-xs font-semibold text-muted hover:text-ink transition-colors px-1"
                >
                  Skip
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-structural bg-ink px-4 text-xs font-bold text-surface hover:opacity-90 active:scale-95 transition-all shadow-xs"
            >
              <span>{stepIndex < TOUR_STEPS.length - 1 ? 'Next' : 'Finish'}</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
