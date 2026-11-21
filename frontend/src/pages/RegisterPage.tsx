/**
 * Create an account. The role picker is a choice between offering work and needing it,
 * and it is the only thing that decides which tools a new person sees.
 */

import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { TextField } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

const ROLES = [
  { value: 'client', label: 'I need work done' },
  { value: 'provider', label: 'I offer services' },
  { value: 'both', label: 'Both' },
]

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, error, clearError, isLoading } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('client')
  const [fieldError, setFieldError] = useState<Record<string, string>>({})

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearError()
    const next: Record<string, string> = {}
    if (displayName.trim().length < 2) next.displayName = 'Tell us what to call you, at least 2 characters.'
    if (!email.includes('@')) next.email = 'That email is missing an @. Check it and try again.'
    if (password.length < 12) next.password = 'Passwords need at least 12 characters.'
    setFieldError(next)
    if (Object.keys(next).length > 0) return
    const ok = await register(email.trim().toLowerCase(), password, displayName.trim(), role)
    if (ok) navigate('/jobs')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="animate-fade-rise">
        <CardHeader title="Create an account" hint="Two minutes, then you can post or offer work." />
        <CardBody>
          <form className="space-y-3" onSubmit={(event) => void submit(event)} noValidate>
            <TextField
              label="Name"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              error={fieldError.displayName ?? null}
              placeholder="What should people call you?"
            />
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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="At least 12 characters. A phrase you can remember beats a symbol soup."
              error={fieldError.password ?? null}
            />
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-ink">What brings you here?</legend>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    aria-pressed={role === option.value}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200 ease-house ${
                      role === option.value
                        ? 'border-structural bg-accent text-accent-ink'
                        : 'border-line bg-surface text-ink hover:bg-accent-wash'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-line bg-accent-wash p-3 text-sm text-ink">
                <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" loading={isLoading}>
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
