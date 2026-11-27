/**
 * OnboardingOverlay.tsx - Interactive spotlight onboarding tour & Tour Choice selector.
 * Pure ASCII, palette compliant (#474329 ink, #F0E5DB sand, #FC75B4 accent).
 *
 * Requirements:
 * - Only run for authenticated sessions (status === 'signed-in' && user && !user.onboarded).
 * - Never run on /, /login, /register, or /u/:username.
 * - Store "seen" against the account on the backend (user.onboarded).
 * - On first sign-in: offer choice between "A Quick Tour" (5 steps) and "See the Whole Story" (8 scenes).
 * - Scroll target into view, check bounding rect visibility before placing spotlight.
 * - Suppress competing overlays via useTourStore.
 */

import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BookOpen, Sparkles, X, Zap } from 'lucide-react'

import { AgentCharacterIllustration } from '@/components/illustrations/CartoonIllustrations'
import { useAuthStore } from '@/store/authStore'
import { useTourStore } from '@/store/tourStore'

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
    lesson: 'Find verified providers and jobs near you within your custom radius circle.',
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
    lesson: 'Publish a service listing or post an open job to get found by nearby matches.',
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

export function OnboardingOverlay() {
  const navigate = useNavigate()
  const location = useLocation()

  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const updateProfile = useAuthStore((state) => state.updateProfile)

  const isTourActive = useTourStore((state) => state.isTourActive)
  const tourType = useTourStore((state) => state.tourType)
  const setTourActive = useTourStore((state) => state.setTourActive)

  const [open, setOpen] = useState(false)
  const [showChoice, setShowChoice] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  // Check route validity
  const isPublicOrForbidden =
    FORBIDDEN_ROUTES.includes(location.pathname) ||
    location.pathname.startsWith('/u/') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register')

  // Auto-launch choice modal for first-time authenticated users on app routes
  useEffect(() => {
    if (status === 'signed-in' && user && !user.onboarded && !isPublicOrForbidden && !isTourActive) {
      setOpen(true)
      setShowChoice(true)
      setStepIndex(0)
      setTourActive(true, 'quick')
    }
  }, [status, user, isPublicOrForbidden, isTourActive, setTourActive])

  // Listen for manual trigger to replay tour
  useEffect(() => {
    const handleReopen = (e?: Event) => {
      const type = (e as CustomEvent<{ type?: 'quick' | 'story' }>)?.detail?.type
      if (type === 'quick') {
        setShowChoice(false)
        setStepIndex(0)
        setOpen(true)
        setTourActive(true, 'quick')
      } else if (type === 'story') {
        setShowChoice(false)
        setOpen(false)
        useTourStore.getState().setStoryScene(0)
        setTourActive(true, 'story')
      } else {
        setShowChoice(true)
        setStepIndex(0)
        setOpen(true)
        setTourActive(true, 'quick')
      }
    }
    window.addEventListener('open-onboarding', handleReopen)
    return () => window.removeEventListener('open-onboarding', handleReopen)
  }, [setTourActive])

  const activeStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0]

  // Find and measure target element with scroll and visibility verification
  const measureTarget = useCallback(() => {
    if (showChoice || !open || tourType !== 'quick') {
      setTargetRect(null)
      return
    }

    let el = document.querySelector(activeStep.target)
    if (!el && activeStep.target === '[data-tour="tour-verified-badge"]') {
      el = document.querySelector('[data-tour="nav-services"]')
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => {
        const rect = el.getBoundingClientRect()
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom >= 0 &&
          rect.top <= window.innerHeight
        ) {
          setTargetRect(rect)
        } else {
          setTargetRect(null)
        }
      }, 150)
    } else {
      setTargetRect(null)
    }
  }, [showChoice, open, tourType, activeStep])

  // Handle route navigation when step changes
  useEffect(() => {
    if (!open || showChoice || tourType !== 'quick') return

    if (location.pathname !== activeStep.route) {
      navigate(activeStep.route)
      const timer = window.setTimeout(() => {
        measureTarget()
      }, 300)
      return () => clearTimeout(timer)
    } else {
      const timer = window.setTimeout(() => {
        measureTarget()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open, showChoice, tourType, stepIndex, activeStep, location.pathname, navigate, measureTarget])

  // Window resize & scroll listeners
  useEffect(() => {
    if (!open || showChoice || tourType !== 'quick') return
    const handleUpdate = () => measureTarget()
    window.addEventListener('resize', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)
    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
    }
  }, [open, showChoice, tourType, measureTarget])

  const finishTour = () => {
    setOpen(false)
    setShowChoice(false)
    setTourActive(false, null)
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

  const handleStartQuickTour = () => {
    setShowChoice(false)
    setStepIndex(0)
    setTourActive(true, 'quick')
  }

  const handleStartStoryTour = () => {
    setOpen(false)
    setShowChoice(false)
    setTourActive(true, 'story')
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

  if (!open || isPublicOrForbidden || tourType === 'story') return null

  // Calculate tooltip placement for spotlight steps
  const tooltipWidth = Math.min(360, window.innerWidth - 32)
  let tooltipTop = window.innerHeight / 2 - 100
  let tooltipLeft = (window.innerWidth - tooltipWidth) / 2
  let arrowPlacement: 'top' | 'bottom' = 'top'
  let arrowLeft = tooltipWidth / 2

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

    tooltipLeft = Math.max(
      16,
      Math.min(
        window.innerWidth - tooltipWidth - 16,
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
      ),
    )
    arrowLeft = Math.max(
      24,
      Math.min(tooltipWidth - 24, targetRect.left + targetRect.width / 2 - tooltipLeft),
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome and Onboarding Tour"
      className="fixed inset-0 z-[1100] select-none"
    >
      {showChoice ? (
        /* First-time Choice Modal between Quick Tour and Full Story */
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg rounded-2xl border-2 border-structural bg-surface p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between border-b border-line pb-3">
              <div className="flex items-center gap-3">
                <AgentCharacterIllustration size={44} className="shrink-0" />
                <div>
                  <h1 className="font-display text-xl uppercase tracking-tight text-ink font-bold">
                    Welcome to ProxID
                  </h1>
                  <p className="text-xs text-muted">
                    Concordium zero-knowledge proximity index for verified human local work.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={finishTour}
                className="rounded-lg p-1 text-muted hover:text-ink hover:bg-sunken transition-colors"
                title="Dismiss"
                aria-label="Dismiss tour"
              >
                <X size={18} />
              </button>
            </div>

            {/* 2 Choice Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Option 1: Quick Interactive Tour */}
              <div
                onClick={handleStartQuickTour}
                className="group cursor-pointer rounded-xl border border-line bg-surface p-4 hover:border-structural hover:bg-sunken/40 transition-all duration-150 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-page border border-line text-ink">
                      <Zap size={16} className="text-ink" />
                    </span>
                    <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                      A Quick Tour
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    5 interactive spotlights through the app: search, verified badge, voice mic, publishing, and escrow.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-ink pt-2 border-t border-line">
                  <span className="font-mono text-[10px] text-muted">~40 SECONDS</span>
                  <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Start <ArrowRight size={12} />
                  </span>
                </div>
              </div>

              {/* Option 2: Full Cartoon Story Tour */}
              <div
                onClick={handleStartStoryTour}
                className="group cursor-pointer rounded-xl border border-structural bg-accent/10 p-4 hover:border-accent hover:bg-accent/20 transition-all duration-150 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-surface border border-structural text-accent-ink">
                      <BookOpen size={16} className="text-accent-ink" />
                    </span>
                    <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                      See the Story
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    An 8-scene paper-craft cartoon demo following Amaka, Tunde &amp; proxidAI from leaking tap to on-chain settlement.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-accent-ink pt-2 border-t border-line">
                  <span className="font-mono text-[10px] text-muted">GUIDED DEMO</span>
                  <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
                    Watch <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-line">
              <button
                type="button"
                onClick={finishTour}
                className="text-xs text-muted hover:text-ink hover:underline"
              >
                Skip for now
              </button>
              <span className="font-mono text-[10px] text-muted uppercase">
                REPLAY ANYTIME FROM YOUR PROFILE
              </span>
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
  )
}
