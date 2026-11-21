/**
 * Sign in. Three ways in: email and password, Google, and the judge demo.
 *
 * The demo button is here as well as on the landing page because a judge often lands
 * straight on a deep link and needs the same one click.
 */

import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from '@/components/GoogleSignInButton'
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
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="animate-fade-rise">
        <CardHeader title="Sign in" hint="Local work, verified people, one job room." />
        <CardBody className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={() => void launchDemo()}
            loading={isLoading}
          >
            Launch Judge Demo
          </Button>
          <p className="text-xs text-muted">
            Signs you into the seeded demo profile. No OAuth, no wallet, and every screen says the
            data is seeded.
          </p>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form className="space-y-3" onSubmit={(event) => void submit(event)} noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldError.email ?? null}
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldError.password ?? null}
              placeholder="Your password"
            />
            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-line bg-accent-wash p-3 text-sm text-ink">
                <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}
            <Button type="submit" size="lg" className="w-full" loading={isLoading}>
              Sign in
            </Button>
          </form>

          <GoogleSignInButton onToken={async (token) => (await google(token)) as boolean} disabled={isLoading} />

          <p className="text-sm text-muted">
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
