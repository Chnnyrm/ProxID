/**
 * OnboardingOverlay.tsx - Interactive spotlight onboarding tour.
 * Pure ASCII, palette compliant (#474329 ink, #F0E5DB sand, #FC75B4 accent).
 *
 * Requirements:
 * - Only run for authenticated sessions (status === 'signed-in' && user && !user.onboarded).
 * - Never run on /, /login, /register, or /u/:username.
 * - Store "seen" against the account on the backend (user.onboarded), not localStorage.
 * - Introduction screen: ProxID in 2 sentences and what proxidAI does.
 * - 5 story scenes with Amaka and Tunde:
 *   1. "Amaka needs a plumber today." -> how to find one near you.
 *   2. "She is not sure who to trust." -> verified badge and what it means.
 *   3. "She would rather ask." -> voice agent and the mic.
 *   4. "Tunde has a van and wants work." -> publish service / post job.
 *   5. "The money is held until the job is done." -> escrow and release.
 * - Spotlight cutout dimming background, arrow, pulse ring, Back, Next/Finish, Skip.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { AgentCharacterIllustration } from '@/components/illustrations/CartoonIllustrations'

interface TourStep {
  route: string
  target: string
  title: string
  story: string
  lesson: string
}

const TOUR_STEPS: TourStep[] = [
  {
    route: '/services',
    target: '[data-tour="nav-services"]',
    title: 'LOCAL SEARCH',
    story: 'Amaka needs a plumber today.',
    lesson: 'Here is how you find verified providers near you within your custom radius.',
  },
  {
    route: '/services',
    target: '[data-tour="tour-verified-badge"]',
    title: 'VERIFIED HUMAN',
    story: 'She is not sure who to trust.',
    lesson: 'The Concordium verified badge proves unique human personhood without revealing private data.',
  },
  {
    route: '/agent',
    target: '[data-tour="tour-mic"]',
    title: 'VOICE SCOUT',
    story: 'She would rather ask.',
    lesson: 'Tap the microphone and tell proxidAI what you need in natural, plain speech.',
  },
  {
    route: '/jobs',
    target: '[data-tour="tour-post-job"]',
    title: 'PUBLISHING WORK',
    story: 'Tunde has a van and wants work.',
    lesson: 'Here is how you publish a service listing or post an open job to get found.',
  },
  {
    route: '/agent',
    target: '[data-tour="tour-consent"]',
    title: 'ESCROW & CONSENT',
    story: 'The money is held until the job is done.',
    lesson: 'Escrow holds funds safely on Concordium and requires your explicit approval before release.',
  },
]

const FORBIDDEN_ROUTES = ['/', '/login', '/register']

export default function OnboardingOverlay() {
  const navigate = useNavigate()
  const location = useLocation()

  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const updateProfile = useAuthStore((state) => state.updateProfile)

  const [open, setOpen] = useState(false)
  const [showIntro, setShowIntro] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)

  // Check route validity
  const isPublicOrForbidden =
    FORBIDDEN_ROUTES.includes(location.pathname) ||
    location.pathname.startsWith('/u/') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register')

  // Auto-launch only for authenticated users who have not onboarded yet on internal app routes
  useEffect(() => {
    if (status === 'signed-in' && user && !user.onboarded && !isPublicOrForbidden) {
      setOpen(true)
      setShowIntro(true)
      setStepIndex(0)
    }
  }, [status, user, isPublicOrForbidden])

  // Listen for manual trigger to replay tour
  useEffect(() => {
    const handleReopen = () => {
      setShowIntro(true)
      setStepIndex(0)
      setOpen(true)
    }
    window.addEventListener('open-onboarding', handleReopen)
    return () => window.removeEventListener('open-onboarding', handleReopen)
  }, [])

  const activeStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0]

  // Find and measure target element
  const measureTarget = useCallback(() => {
    if (showIntro) {
      setTargetRect(null)
      return
    }
    let el = document.querySelector(activeStep.target)
    // Fallback if target element not found on page
    if (!el && activeStep.target === '[data-tour="tour-verified-badge"]') {
      el = document.querySelector('[data-tour="nav-services"]')
    }
    if (el) {
      const rect = el.getBoundingClientRect()
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setTargetRect(el.getBoundingClientRect())
    } else {
      setTargetRect(null)
    }
  }, [showIntro, activeStep])

  // Handle route navigation when step changes
  useEffect(() => {
    if (!open || showIntro) return

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
  }, [open, showIntro, stepIndex, activeStep, location.pathname, navigate, measureTarget])

  // Resize and scroll listener
  useEffect(() => {
    if (!open || showIntro) return
    const handleUpdate = () => measureTarget()
    window.addEventListener('resize', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)
    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
    }
  }, [open, showIntro, measureTarget])

  const finishTour = () => {
    setOpen(false)
    setShowIntro(false)
    if (status === 'signed-in') {
      void updateProfile({ onboarded: true })
    }
  }

  // Dismiss on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishTour()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const startTourFromIntro = () => {
    setShowIntro(false)
    setStepIndex(0)
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

  if (!open || isPublicOrForbidden) return null

  // Calculate tooltip placement for spotlight steps
  const tooltipWidth = Math.min(360, window.innerWidth - 32)
  let tooltipTop = 100
  let tooltipLeft = 20
  let arrowPlacement: 'top' | 'bottom' = 'top'
  let arrowLeft = 40

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom
    const spaceAbove = targetRect.top

    if (spaceBelow >= 240 || spaceBelow >= spaceAbove) {
      tooltipTop = Math.min(window.innerHeight - 250, targetRect.bottom + 16)
      arrowPlacement = 'top'
    } else {
      tooltipTop = Math.max(16, targetRect.top - 230)
      arrowPlacement = 'bottom'
    }

    const targetCenterX = targetRect.left + targetRect.width / 2
    tooltipLeft = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetCenterX - tooltipWidth / 2))
    arrowLeft = Math.max(16, Math.min(tooltipWidth - 24, targetCenterX - tooltipLeft))
  } else {
    tooltipTop = window.innerHeight / 2 - 110
    tooltipLeft = window.innerWidth / 2 - tooltipWidth / 2
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] overflow-hidden select-none">
        {/* Intro Dialog Screen */}
        {showIntro ? (
          <div className="fixed inset-0 z-[1002] flex items-center justify-center p-4 bg-ink/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-structural bg-surface p-6 shadow-2xl text-center space-y-4"
            >
              <div className="flex justify-center">
                <AgentCharacterIllustration size={72} />
              </div>
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
                  WELCOME TO PROXID
                </span>
                <h2 className="text-xl font-bold font-display uppercase text-ink">
                  Your Proximity Trust Index
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-ink leading-relaxed font-medium">
                ProxID connects you to verified local providers in your neighborhood on Concordium.
                proxidAI is your personal scout that discovers work, matches requests, and protects your spending with consent.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={finishTour}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-sunken transition-colors"
                >
                  Skip Tour
                </button>
                <button
                  type="button"
                  onClick={startTourFromIntro}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-structural bg-ink px-5 py-2 text-xs font-bold text-surface hover:opacity-90 active:scale-95 transition-all shadow-xs"
                >
                  <span>Start Interactive Tour</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
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

              {/* Story Scenario & Explanation */}
              <div className="mt-2.5 space-y-1">
                <p className="text-sm font-bold text-ink leading-snug">
                  &ldquo;{activeStep.story}&rdquo;
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  {activeStep.lesson}
                </p>
              </div>

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
          </>
        )}
      </div>
    </AnimatePresence>
  )
}
