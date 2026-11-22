/**
 * Sign in page.
 * Provides direct URL access (/login) matching the AuthDialog form.
 */

import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextField } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, google, demoLogin, error, clearError, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({})

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearError()
    const next: { email?: string; password?: string } = {}
    if (!email.trim()) next.email = 'Enter the email you signed up with.'
    if (!password) next.password = 'Enter your password.'
    setFieldError(next)
    if (Object.keys(next).length > 0) return
    const ok = await login(email.trim(), password)
    if (ok) navigate('/jobs')
  }

  const launchDemo = async () => {
    clearError()
    const ok = await demoLogin()
    if (ok) navigate('/jobs')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="animate-fade-rise">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Logo className="w-6 h-6 shrink-0" />
              <span>Sign in</span>
            </div>
          }
          hint="Local work, verified people, one job room."
        />
        <CardBody className="space-y-4">
          <form className="space-y-3" onSubmit={(event) => void submit(event)} noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldError.email ?? null}
              placeholder="you@example.com"
              required
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldError.password ?? null}
              placeholder="Your password"
              required
            />
            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-line bg-accent-wash p-3 text-xs text-ink"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}
            <Button type="submit" size="lg" className="w-full mt-2" loading={isLoading}>
              Sign in
            </Button>
          </form>

          <GoogleSignInButton
            onToken={async (token) => {
              const ok = await google(token)
              if (ok) navigate('/jobs')
              return ok
            }}
            disabled={isLoading}
          />

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="rounded-xl border border-line bg-surface-sunken/30 p-3 text-center">
            <Button
              type="button"
              intent="secondary"
              size="md"
              className="w-full"
              onClick={() => void launchDemo()}
              loading={isLoading}
            >
              Continue as demo
            </Button>
            <p className="mt-1.5 text-[11px] text-muted">
              Explore the seeded profile with zero setup.
            </p>
          </div>

          <p className="text-center text-sm text-muted pt-2">
            No account yet?{' '}
            <Link to="/register" className="font-medium text-ink underline">
              Create one
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
