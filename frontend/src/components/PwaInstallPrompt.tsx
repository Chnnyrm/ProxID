/**
 * Install prompt nudge for PWA.
 *
 * Shows a friendly cartoon character with an install call-to-action when
 * 'beforeinstallprompt' is fired, or contextual instructions on iOS Safari.
 * Hidden if the user already runs the standalone app or dismissed recently.
 * Pure ASCII only.
 */

import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AgentCharacterIllustration } from '@/components/illustrations/CartoonIllustrations'
import { useTourStore } from '@/store/tourStore'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'proxid-pwa-dismissed'

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const isTourActive = useTourStore((state) => state.isTourActive)

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true)

    if (isStandalone) return

    // Check if user dismissed within last 48 hours
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const diff = Date.now() - parseInt(dismissedAt, 10)
      if (diff < 48 * 60 * 60 * 1000) return
    }

    // Check for iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream: unknown }).MSStream

    if (isIosDevice) {
      setIsIos(true)
      // Delay showing iOS hint slightly so it does not interfere with first paint
      const timer = setTimeout(() => setIsVisible(true), 3500)
      return () => clearTimeout(timer)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setIsVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setIsVisible(false)
  }

  if (!isVisible || isTourActive) return null

  return (
    <div
      role="region"
      aria-label="Install ProxID App"
      className="fixed bottom-16 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-[750] animate-fade-rise"
    >
      <div className="card p-4 bg-surface border-2 border-structural shadow-lg relative flex items-start gap-3">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted hover:text-ink p-1 rounded-lg"
          aria-label="Dismiss install prompt"
        >
          <X size={16} />
        </button>

        <div className="shrink-0 mt-0.5">
          <AgentCharacterIllustration size={48} className="w-12 h-12" />
        </div>

        <div className="flex-1 pr-4">
          <h4 className="font-display text-sm uppercase tracking-wider text-ink font-bold">
            Install ProxID App
          </h4>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            {isIos
              ? 'Install on your iPhone: tap Share in your browser bar, then select "Add to Home Screen".'
              : 'Add to your home screen for quick access, offline search, and instant updates.'}
          </p>

          <div className="mt-3 flex items-center gap-2">
            {!isIos && deferredPrompt ? (
              <button
                type="button"
                onClick={() => void handleInstallClick()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-ink font-semibold text-xs border border-structural shadow-xs hover:brightness-105 active:scale-95 transition-all"
              >
                <Download size={13} />
                <span>Install</span>
              </button>
            ) : isIos ? (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sunken/60 text-ink text-xs font-mono">
                <Share size={12} className="text-accent" />
                <span>Tap Share then Add to Home Screen</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1.5 text-xs text-muted hover:text-ink transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
