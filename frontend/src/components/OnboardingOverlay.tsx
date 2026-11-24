/**
 * OnboardingOverlay.tsx - 4-step spotlight onboarding for first-time visitors.
 *
 * Requirements:
 * - 4 steps, first visit only, dismissible, resumable.
 * - Each step spotlights a real element on the real page.
 * - Responsive at 390px and 1440px.
 * - Palette tokens only, pure ASCII.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Briefcase,
  MapPin,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

interface OnboardingStep {
  target: string
  title: string
  desc: string
  icon: LucideIcon
}

const STEPS: OnboardingStep[] = [
  {
    target: '[data-tour="nav-map"]',
    title: 'LOCAL MAP',
    desc: 'The center of ProxID. Explore attested trades and active tasks nearby within an interactive radius.',
    icon: MapPin,
  },
  {
    target: '[data-tour="nav-services"]',
    title: 'SERVICES DIRECTORY',
    desc: 'Browse specific services offered by verified providers, filtered by distance and Concordium ZK proof.',
    icon: Wrench,
  },
  {
    target: '[data-tour="nav-jobs"]',
    title: 'OPEN JOBS',
    desc: 'Post or accept local tasks without middleman percentages. Work and funds are cryptographically anchored.',
    icon: Briefcase,
  },
  {
    target: '[data-tour="nav-agent"]',
    title: 'PROXIDAI AGENT',
    desc: 'Voice-enabled AI that scouts providers for vague requests, tracks progress, and audits payment trails.',
    icon: Bot,
  },
]

const STORAGE_KEY_SEEN = 'proxid_onboarded_seen_v1'
const STORAGE_KEY_NEVER = 'proxid_onboarded_never_v1'

export default function OnboardingOverlay() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [doNotShowAgain, setDoNotShowAgain] = useState(true)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  // Measure target bounding rect for spotlight
  const updateTargetRect = useCallback(() => {
    const selector = STEPS[step]?.target
    if (!selector) {
      setTargetRect(null)
      return
    }
    const el = document.querySelector(selector)
    if (el) {
      setTargetRect(el.getBoundingClientRect())
    } else {
      setTargetRect(null)
    }
  }, [step])

  useEffect(() => {
    if (!open) return
    updateTargetRect()
    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect, true)
    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect, true)
    }
  }, [open, updateTargetRect])

  // Check first visit
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY_NEVER)) return
      const seen = localStorage.getItem(STORAGE_KEY_SEEN)
      if (seen) return
      // Auto-open on first visit
      setOpen(true)
    } catch {
      // storage unavailable
    }
  }, [])

  // Listen for resume / re-open event
  useEffect(() => {
    const handleReopen = () => {
      setOpen(true)
    }
    window.addEventListener('open-onboarding', handleReopen)
    return () => window.removeEventListener('open-onboarding', handleReopen)
  }, [])

  // Dismiss on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, doNotShowAgain])

  const finish = () => {
    setOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY_SEEN, String(Date.now()))
      if (doNotShowAgain) {
        localStorage.setItem(STORAGE_KEY_NEVER, '1')
      }
    } catch {
      // storage error ignored
    }
  }

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      finish()
    }
  }

  const back = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  if (!open) return null

  const current = STEPS[step] ?? STEPS[0]
  const Icon = current.icon

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] overflow-hidden select-none">
        {/* Darkened overlay backdrop */}
        <div className="absolute inset-0 bg-[#1C1B12]/75 backdrop-blur-[2px] transition-opacity duration-200" />

        {/* Target spotlight cutout */}
        {targetRect && (
          <motion.div
            layoutId="spotlight-box"
            className="absolute rounded-2xl border-2 border-accent pointer-events-none shadow-[0_0_0_9999px_rgba(28,27,18,0.7)]"
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          />
        )}

        {/* Step Card Dialog */}
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={finish}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:text-ink hover:bg-sunken transition-colors"
              aria-label="Skip onboarding"
            >
              <X size={16} />
            </button>

            {/* Header Icon + Step Index */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-structural bg-page text-ink shadow-xs">
                <Icon size={20} className="text-ink" />
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                  Step {step + 1} of {STEPS.length}
                </span>
                <h2 className="font-display text-xl uppercase tracking-tight text-ink leading-tight">
                  {current.title}
                </h2>
              </div>
            </div>

            {/* Content description */}
            <p className="mt-3 text-xs leading-relaxed text-muted">{current.desc}</p>

            {/* Step progress pills */}
            <div className="mt-5 flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === step ? 'w-6 bg-ink' : 'w-2 bg-line'
                  }`}
                />
              ))}
            </div>

            {/* Checkbox: Do not show again */}
            <div className="mt-4 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                id="onboarding-never"
                checked={doNotShowAgain}
                onChange={(e) => setDoNotShowAgain(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line accent-ink cursor-pointer"
              />
              <label htmlFor="onboarding-never" className="cursor-pointer select-none">
                Do not show again on this device
              </label>
            </div>

            {/* Action buttons */}
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <div className="flex items-center gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={back}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink hover:bg-sunken transition-colors"
                  >
                    <ArrowLeft size={12} />
                    <span>Back</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={finish}
                    className="text-xs font-semibold text-muted hover:text-ink transition-colors"
                  >
                    Skip
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={next}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-structural bg-ink px-4 text-xs font-bold text-page hover:opacity-90 transition-opacity active:translate-y-px shadow-xs"
              >
                <span>{step < STEPS.length - 1 ? 'Next' : 'Done'}</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}
