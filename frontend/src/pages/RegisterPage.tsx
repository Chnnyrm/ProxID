/**
 * Create an account.
 * Short, enjoyable sign-up: minimal fields, live password guidance, one clear action.
 */

import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import PasswordStrengthMeter from '@/components/PasswordStrengthMeter'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextField } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, error, clearError, isLoading } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldError, setFieldError] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isBusy = isSubmitting || isLoading

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearError()
    const next: Record<string, string> = {}
    if (displayName.trim().length < 2) {
      next.displayName = 'Tell us what to call you, at least 2 characters.'
    }
    if (!email.includes('@') || !email.includes('.')) {
      next.email = 'Check your email address and try again.'
    }
    if (password.length < 12) {
      next.password = 'Passwords need at least 12 characters.'
    }
    if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.'
    }
    setFieldError(next)
    if (Object.keys(next).length > 0) return

    setIsSubmitting(true)
    try {
      const ok = await register(email.trim().toLowerCase(), password, displayName.trim())
      if (ok) navigate('/jobs')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="animate-fade-rise">
        <CardHeader
          title="Create an account"
          hint="One minute, then you can post or offer work."
        />
        <CardBody>
          <form className="space-y-3" onSubmit={(event) => void submit(event)} noValidate>
            <TextField
              label="Name"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              error={fieldError.displayName ?? null}
              placeholder="Ada Lovelace"
              disabled={isBusy}
              required
            />
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldError.email ?? null}
              placeholder="you@example.com"
              disabled={isBusy}
              required
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldError.password ?? null}
              placeholder="At least 12 characters"
              disabled={isBusy}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isBusy}
                  className="text-muted hover:text-ink focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
            />
            <TextField
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={fieldError.confirmPassword ?? null}
              placeholder="Confirm your password"
              disabled={isBusy}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isBusy}
                  className="text-muted hover:text-ink focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
            />

            {/* Live password guidance */}
            <PasswordStrengthMeter
              password={password}
              confirmPassword={confirmPassword}
              showConfirmMatch={true}
            />

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-line bg-accent-wash p-3 text-sm text-ink"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2"
              loading={isSubmitting}
              loadingText="Creating account..."
              disabled={
                isBusy ||
                password.length < 12 ||
                (confirmPassword.length > 0 && password !== confirmPassword)
              }
            >
              Create account
            </Button>
          </form>
          <p className="mt-3 text-sm text-muted">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-ink underline">
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
