/**
 * RequireAuthModal.tsx - Cartoon-style interactive auth nudge.
 * Pure ASCII, palette compliant (#474329 ink, #F0E5DB sand, #FC75B4 accent).
 *
 * Requirements:
 * - Cartoon illustration
 * - One sentence naming what they were trying to do ("Sign in to <action>.")
 * - Two buttons: "Sign in" and "Create account"
 * - Used for every gated action across the app.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LogIn, UserPlus } from 'lucide-react'

import { useAuthNudgeStore } from '@/store/authNudgeStore'
import { AuthDialog } from '@/components/AuthDialog'
import { TradespersonIllustration } from '@/components/illustrations/CartoonIllustrations'

export function RequireAuthModal() {
  const { isOpen, action, closeNudge } = useAuthNudgeStore()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authDialogTab, setAuthDialogTab] = useState<'login' | 'register'>('login')

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ action?: string }>
      useAuthNudgeStore.getState().openNudge(customEvent.detail?.action || 'continue with this action')
    }
    window.addEventListener('proxid-require-auth', handleEvent)
    return () => window.removeEventListener('proxid-require-auth', handleEvent)
  }, [])

  const handleSignIn = () => {
    closeNudge()
    setAuthDialogTab('login')
    setAuthDialogOpen(true)
  }

  const handleCreateAccount = () => {
    closeNudge()
    setAuthDialogTab('register')
    setAuthDialogOpen(true)
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm rounded-2xl border border-structural bg-surface p-6 shadow-2xl text-center space-y-4"
            >
              <button
                type="button"
                onClick={closeNudge}
                className="absolute right-3.5 top-3.5 rounded-lg p-1 text-muted hover:text-ink hover:bg-sunken transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              <div className="flex justify-center pt-2">
                <TradespersonIllustration size={80} />
              </div>

              <div className="space-y-1.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                  AUTHENTICATION REQUIRED
                </span>
                <p className="text-sm sm:text-base font-bold text-ink leading-snug">
                  Sign in to {action}.
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  Join ProxID to connect with verified providers, track orders, and protect payments on Concordium.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="w-full inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-structural bg-ink text-xs font-bold text-surface hover:opacity-90 active:scale-95 transition-all shadow-xs"
                >
                  <LogIn size={14} />
                  <span>Sign in</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateAccount}
                  className="w-full inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink hover:bg-sunken active:scale-95 transition-all shadow-xs"
                >
                  <UserPlus size={14} />
                  <span>Create account</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultTab={authDialogTab}
      />
    </>
  )
}
