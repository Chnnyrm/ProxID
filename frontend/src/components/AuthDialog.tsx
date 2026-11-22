import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: 'login' | 'register'
}

const ROLES = [
  { value: 'client', label: 'I need work done' },
  { value: 'provider', label: 'I offer services' },
  { value: 'both', label: 'Both' },
]

export function AuthDialog({ open, onOpenChange, defaultTab = 'login' }: AuthDialogProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab)
  const navigate = useNavigate()
  const { login, register, google, demoLogin, error, clearError, isLoading } = useAuth()

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({})

  // Register form
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regRole, setRegRole] = useState('client')
  const [regErrors, setRegErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setTab(defaultTab)
      clearError()
    }
  }, [open, defaultTab, clearError])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isLoading) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isLoading, onOpenChange])

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const errs: { email?: string; password?: string } = {}
    if (!loginEmail.trim()) errs.email = 'Enter the email you signed up with.'
    if (!loginPassword) errs.password = 'Enter your password.'
    setLoginErrors(errs)
    if (Object.keys(errs).length > 0) return

    const ok = await login(loginEmail.trim(), loginPassword)
    if (ok) {
      onOpenChange(false)
      navigate('/jobs')
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const errs: Record<string, string> = {}
    if (regName.trim().length < 2) errs.name = 'Tell us what to call you, at least 2 characters.'
    if (!regEmail.includes('@')) errs.email = 'That email is missing an @. Check it and try again.'
    if (regPassword.length < 12) errs.password = 'Passwords need at least 12 characters.'
    setRegErrors(errs)
    if (Object.keys(errs).length > 0) return

    const ok = await register(regEmail.trim().toLowerCase(), regPassword, regName.trim(), regRole)
    if (ok) {
      onOpenChange(false)
      navigate('/jobs')
    }
  }

  const handleDemoLogin = async () => {
    clearError()
    const ok = await demoLogin()
    if (ok) {
      onOpenChange(false)
      navigate('/jobs')
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
              if (!isLoading) onOpenChange(false)
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
            {/* Close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              aria-label="Close dialog"
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:bg-accent-wash hover:text-ink transition-colors"
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

            {/* Tab selector */}
            <div className="mt-4 flex rounded-xl border border-line bg-sunken/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('login')
                  clearError()
                }}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-all ${
                  tab === 'login'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register')
                  clearError()
                }}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-all ${
                  tab === 'register'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Register
              </button>
            </div>

            {/* Error display */}
            {error ? (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-accent-wash p-3 text-xs text-ink"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            {/* Sign in Tab */}
            {tab === 'login' ? (
              <form onSubmit={(e) => void handleLoginSubmit(e)} className="mt-4 space-y-3" noValidate>
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  error={loginErrors.email ?? null}
                  placeholder="you@example.com"
                  required
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  error={loginErrors.password ?? null}
                  placeholder="Your password"
                  required
                />
                <Button type="submit" size="lg" className="w-full mt-2" loading={isLoading}>
                  Sign in
                </Button>
              </form>
            ) : (
              /* Register Tab */
              <form onSubmit={(e) => void handleRegisterSubmit(e)} className="mt-4 space-y-3" noValidate>
                <TextField
                  label="Full Name"
                  type="text"
                  autoComplete="name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  error={regErrors.name ?? null}
                  placeholder="What should people call you?"
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
                  required
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  hint="At least 12 characters."
                  error={regErrors.password ?? null}
                  placeholder="At least 12 characters"
                  required
                />
                <fieldset>
                  <legend className="mb-1 block text-sm font-medium text-ink">What brings you here?</legend>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRegRole(option.value)}
                        aria-pressed={regRole === option.value}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ease-house ${
                          regRole === option.value
                            ? 'border-structural bg-accent text-accent-ink'
                            : 'border-line bg-surface text-ink hover:bg-accent-wash'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <Button type="submit" size="lg" className="w-full mt-2" loading={isLoading}>
                  Create account
                </Button>
              </form>
            )}

            {/* Google OAuth (only rendered when configured) */}
            <div className="mt-3">
              <GoogleSignInButton
                onToken={async (token) => {
                  const ok = await google(token)
                  if (ok) {
                    onOpenChange(false)
                    navigate('/jobs')
                  }
                  return ok
                }}
                disabled={isLoading}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            {/* Secondary Option: Continue as demo */}
            <div className="rounded-xl border border-line bg-surface-sunken/30 p-3 text-center">
              <Button
                type="button"
                intent="secondary"
                size="md"
                onClick={() => void handleDemoLogin()}
                loading={isLoading}
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
