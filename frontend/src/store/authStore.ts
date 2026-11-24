/**
 * Session state.
 *
 * `status` is a three-way value rather than a boolean: "loading" is what keeps a page
 * from flashing the signed-out view before `/users/me` answers. Anything that renders
 * differently for a signed-in person waits for "ready".
 */

import { create } from 'zustand'

import { ApiError } from '@/lib/api'
import { authService } from '@/services/authService'
import type { Me } from '@/types/api'

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

interface AuthState {
  user: Me | null
  status: AuthStatus
  /** A sentence to show when a sign-in attempt failed. */
  error: string | null
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, displayName: string) => Promise<boolean>
  google: (accessToken: string) => Promise<boolean>
  demoLogin: () => Promise<boolean>
  updateProfile: (data: {
    display_name?: string
    bio?: string
    avatar_url?: string
    neighbourhood?: string
    latitude?: number
    longitude?: number
  }) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'We could not reach ProxID. Check your connection and try again.'
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  error: null,

  bootstrap: async () => {
    try {
      const user = await authService.me()
      set({ user, status: 'signed-in', error: null })
    } catch {
      // A missing or expired session is the ordinary case here, not a failure to report.
      set({ user: null, status: 'signed-out' })
    }
  },

  login: async (email, password) => {
    set({ error: null })
    try {
      const session = await authService.login(email, password)
      set({ user: session.user, status: 'signed-in' })
      return true
    } catch (error) {
      set({ error: messageOf(error) })
      return false
    }
  },

  register: async (email, password, displayName) => {
    set({ error: null })
    try {
      const session = await authService.register(email, password, displayName)
      set({ user: session.user, status: 'signed-in' })
      return true
    } catch (error) {
      set({ error: messageOf(error) })
      return false
    }
  },

  google: async (accessToken) => {
    set({ error: null })
    try {
      const session = await authService.google(accessToken)
      set({ user: session.user, status: 'signed-in' })
      return true
    } catch (error) {
      set({ error: messageOf(error) })
      return false
    }
  },

  demoLogin: async () => {
    set({ error: null })
    try {
      const session = await authService.demoLogin()
      set({ user: session.user, status: 'signed-in' })
      return true
    } catch (error) {
      set({ error: messageOf(error) })
      return false
    }
  },

  updateProfile: async (data) => {
    set({ error: null })
    try {
      const updated = await authService.updateProfile(data)
      set({ user: updated })
      return true
    } catch (error) {
      set({ error: messageOf(error) })
      return false
    }
  },

  logout: async () => {
    try {
      await authService.logout()
    } finally {
      // Even a failed call clears the local view: the cookie may be gone already, and
      // leaving a stale name in the header would be a lie.
      set({ user: null, status: 'signed-out', error: null })
    }
  },

  clearError: () => set({ error: null }),
}))
