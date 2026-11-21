/**
 * "Continue with Google", without a bundler dependency.
 *
 * Ported from the previous project's flow: the browser obtains a Google OAuth access
 * token, and the backend exchanges it for a verified profile through Google's tokeninfo
 * endpoint, checking the audience is this application.
 *
 * The GIS script is loaded on first click rather than on page load, so a visitor who
 * never signs in with Google never downloads it.
 */

import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'

interface TokenResponse {
  access_token?: string
  error?: string
}

interface TokenClient {
  requestAccessToken: () => void
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string
      scope: string
      callback: (response: TokenResponse) => void
      error_callback?: (error: { type: string }) => void
    }) => TokenClient
  }
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts }
  }
}

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''
const SCRIPT_ID = 'google-identity-services'

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  const existing = document.getElementById(SCRIPT_ID)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('script failed')))
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('script failed'))
    document.head.appendChild(script)
  })
}

export function GoogleSignInButton({
  onToken,
  disabled,
}: {
  onToken: (accessToken: string) => Promise<boolean>
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const configured = CLIENT_ID.length > 0

  const start = useCallback(async () => {
    setProblem(null)
    setBusy(true)
    try {
      await loadGis()
      const accounts = window.google?.accounts
      if (!accounts) throw new Error('unavailable')
      const client = accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'openid email profile',
        callback: (response) => {
          if (!response.access_token) {
            setProblem('Google did not return a sign-in token. Try again.')
            setBusy(false)
            return
          }
          void onToken(response.access_token).finally(() => setBusy(false))
        },
        error_callback: () => {
          setProblem('The Google popup closed before sign-in finished. Try again.')
          setBusy(false)
        },
      })
      client.requestAccessToken()
    } catch {
      setProblem(
        'Google sign-in is unavailable in this browser right now. Use your email and password instead.',
      )
      setBusy(false)
    }
  }, [onToken])

  return (
    <div>
      <Button
        type="button"
        intent="secondary"
        size="lg"
        className="w-full"
        onClick={() => void start()}
        loading={busy}
        disabled={disabled || !configured}
      >
        Continue with Google
      </Button>
      {!configured ? (
        <p className="mt-1.5 text-xs text-muted">
          Google sign-in is not configured on this deployment. Set VITE_GOOGLE_CLIENT_ID, or use
          the email form.
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-ink">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
