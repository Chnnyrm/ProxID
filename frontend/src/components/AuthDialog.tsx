import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Eye, EyeOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { Logo } from '@/components/Logo'
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: 'login' | 'register'
}

export function AuthDialog({ open, onOpenChange, defaultTab = 'login' }: AuthDialogProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab)
  const navigate = useNavigate()
  const { login, register, google, demoLogin, error, clearError, isLoading } = useAuth()

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({})

  // Register form state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false)
  const [regErrors, setRegErrors] = useState<Record<string, string>>({})

  // In-flight interaction state for immediate frame feedback
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const isBusy = isLoggingIn || isRegistering || isDemoLoading || isGoogleLoading || isLoading

  useEffect(() => {
    if (open) {
      setTab(defaultTab)
      clearError()
      setLoginErrors({})
      setRegErrors({})
    }
  }, [open, defaultTab, clearError])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isBusy) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isBusy, onOpenChange])

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const errs: { email?: string; password?: string } = {}
    if (!loginEmail.trim()) errs.email = 'Enter the email you signed up with.'
    if (!loginPassword) errs.password = 'Enter your password.'
    setLoginErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsLoggingIn(true)
    try {
      const ok = await login(loginEmail.trim(), loginPassword)
      if (ok) {
        onOpenChange(false)
        navigate('/jobs')
      }
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const cleanName = regName.trim()
    const cleanEmail = regEmail.trim().toLowerCase()
    const errs: Record<string, string> = {}

    if (cleanName.length < 2) {
      errs.name = 'Tell us what to call you, at least 2 characters.'
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      errs.email = 'Check your email address and try again.'
    }
    if (regPassword.length < 12) {
      errs.password = 'Passwords need at least 12 characters.'
    }
    if (regPassword !== regConfirmPassword) {
      errs.confirmPassword = 'Passwords do not match.'
    }
    setRegErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsRegistering(true)
    try {
      const ok = await register(cleanEmail, regPassword, cleanName)
      if (ok) {
        onOpenChange(false)
        navigate('/jobs')
      }
    } finally {
      setIsRegistering(false)
    }
  }

  const handleDemoLogin = async () => {
    clearError()
    setIsDemoLoading(true)
    try {
      const ok = await demoLogin()
      if (ok) {
        onOpenChange(false)
        navigate('/jobs')
      }
    } finally {
      setIsDemoLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-dialog-title"
          className="fixed inset-0 z-[800] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (!isBusy) onOpenChange(false)
            }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl"
          >
            {/* Top in-flight status indicator */}
            {isBusy ? (
              <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-2xl bg-accent-wash">
                <div className="h-full w-full bg-accent animate-pulse" />
              </div>
            ) : null}

            {/* Close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
              aria-label="Close dialog"
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:bg-accent-wash hover:text-ink transition-colors disabled:opacity-40"
            >
              <X size={18} aria-hidden="true" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-1.5">
              <Logo className="w-7 h-7 shrink-0" />
              <span id="auth-dialog-title" className="text-xl font-bold tracking-tight text-ink">
                ProxID
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Sign in or create an account to post jobs, find services, or chat with providers.
            </p>

            {/* Tab selector with unmistakable boundary */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="mt-4 grid grid-cols-2 rounded-xl border border-line bg-sunken/60 p-1"
            >
              <button
                type="button"
                role="tab"
                id="tab-login"
                aria-selected={tab === 'login'}
                aria-controls="panel-login"
                disabled={isBusy}
                onClick={() => {
                  setTab('login')
                  clearError()
                }}
                className={`flex items-center justify-center rounded-lg py-2 text-sm font-semibold transition-all duration-200 ease-house disabled:pointer-events-none ${
                  tab === 'login'
                    ? 'bg-structural text-page shadow-sm'
                    : 'text-muted hover:text-ink hover:bg-surface/50'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                id="tab-register"
                aria-selected={tab === 'register'}
                aria-controls="panel-register"
                disabled={isBusy}
                onClick={() => {
                  setTab('register')
                  clearError()
                }}
                className={`flex items-center justify-center rounded-lg py-2 text-sm font-semibold transition-all duration-200 ease-house disabled:pointer-events-none ${
                  tab === 'register'
                    ? 'bg-structural text-page shadow-sm'
                    : 'text-muted hover:text-ink hover:bg-surface/50'
                }`}
              >
                Register
              </button>
            </div>

            {/* Error alert */}
            {error ? (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-accent-wash p-3 text-xs text-ink"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            {/* Sign in Tab Panel */}
            {tab === 'login' ? (
              <form
                id="panel-login"
                role="tabpanel"
                aria-labelledby="tab-login"
                onSubmit={(e) => void handleLoginSubmit(e)}
                className="mt-4 space-y-3"
                noValidate
              >
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  error={loginErrors.email ?? null}
                  placeholder="you@example.com"
                  disabled={isBusy}
                  required
                />
                <TextField
                  label="Password"
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  error={loginErrors.password ?? null}
                  placeholder="Your password"
                  disabled={isBusy}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      disabled={isBusy}
                      className="text-muted hover:text-ink focus:outline-none"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  required
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-2"
                  loading={isLoggingIn}
                  loadingText="Signing in..."
                  disabled={isBusy || !loginEmail.trim() || !loginPassword}
                >
                  Sign in
                </Button>
              </form>
            ) : (
              /* Register Tab Panel */
              <form
                id="panel-register"
                role="tabpanel"
                aria-labelledby="tab-register"
                onSubmit={(e) => void handleRegisterSubmit(e)}
                className="mt-4 space-y-3"
                noValidate
              >
                <TextField
                  label="Full Name"
                  type="text"
                  autoComplete="name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  error={regErrors.name ?? null}
                  placeholder="What should people call you?"
                  disabled={isBusy}
                  required
                />
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  error={regErrors.email ?? null}
                  placeholder="you@example.com"
                  disabled={isBusy}
                  required
                />
                <TextField
                  label="Password"
                  type={showRegPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  error={regErrors.password ?? null}
                  placeholder="At least 12 characters"
                  disabled={isBusy}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      disabled={isBusy}
                      className="text-muted hover:text-ink focus:outline-none"
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  required
                />
                <TextField
                  label="Confirm Password"
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  error={regErrors.confirmPassword ?? null}
                  placeholder="Confirm your password"
                  disabled={isBusy}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      disabled={isBusy}
                      className="text-muted hover:text-ink focus:outline-none"
                      aria-label={showRegConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  required
                />

                {/* Password strength and live match guidance */}
                <PasswordStrengthMeter
                  password={regPassword}
                  confirmPassword={regConfirmPassword}
                  showConfirmMatch={true}
                />

                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-2"
                  loading={isRegistering}
                  loadingText="Creating account..."
                  disabled={
                    isBusy ||
                    regPassword.length < 12 ||
                    (regConfirmPassword.length > 0 && regPassword !== regConfirmPassword)
                  }
                >
                  Create account
                </Button>
              </form>
            )}

            {/* Google OAuth (only rendered when configured) */}
            <div className="mt-3">
              <GoogleSignInButton
                onToken={async (token) => {
                  setIsGoogleLoading(true)
                  try {
                    const ok = await google(token)
                    if (ok) {
                      onOpenChange(false)
                      navigate('/jobs')
                    }
                    return ok
                  } finally {
                    setIsGoogleLoading(false)
                  }
                }}
                disabled={isBusy}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            {/* Secondary Option: Continue as demo */}
            <div className="rounded-xl border border-line bg-sunken/30 p-3 text-center">
              <Button
                type="button"
                intent="secondary"
                size="md"
                onClick={() => void handleDemoLogin()}
                loading={isDemoLoading}
                loadingText="Entering demo..."
                disabled={isBusy}
                className="w-full"
              >
                Continue as demo
              </Button>
              <p className="mt-1.5 text-[11px] text-muted">
                Explore the seeded profile with zero setup.
              </p>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
