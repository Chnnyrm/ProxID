/**
 * Auth as the components need it: a user, a status, and actions.
 *
 * This hook is the services layer for the auth entity: components import it, and it is
 * the only thing they may import for session behaviour.
 */

import { useCallback } from 'react'

import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const status = useAuthStore((state) => state.status)
  const error = useAuthStore((state) => state.error)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const google = useAuthStore((state) => state.google)
  const demoLogin = useAuthStore((state) => state.demoLogin)
  const logout = useAuthStore((state) => state.logout)
  const clearError = useAuthStore((state) => state.clearError)

  const isSignedIn = status === 'signed-in'
  const isLoading = status === 'loading'

  return {
    user,
    status,
    error,
    isSignedIn,
    isLoading,
    login,
    register,
    google,
    demoLogin,
    logout,
    clearError,
    /** A short label for the header, without leaking an email to a stranger. */
    displayName: user?.display_name ?? null,
    isDemo: user?.is_demo ?? false,
    isVerified: user?.concordium_verified ?? false,
  }
}

/** A stable callback for the "Launch Judge Demo" button. */
export function useLaunchJudgeDemo(onDone?: () => void) {
  const demoLogin = useAuthStore((state) => state.demoLogin)
  return useCallback(async () => {
    const ok = await demoLogin()
    if (ok) onDone?.()
    return ok
  }, [demoLogin, onDone])
}
