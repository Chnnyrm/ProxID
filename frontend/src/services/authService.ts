/**
 * Session transport. One place that knows the auth endpoints, so a hook never builds a
 * URL and a route change is one edit.
 */

import { api } from '@/lib/api'
import type { SessionResponse } from '@/lib/contracts'
import type { Me } from '@/types/api'

export const authService = {
  /** Sign in with an email and a password. */
  login: (email: string, password: string) =>
    api.post<SessionResponse>('/auth/login', { email, password }),

  /** Create an account and sign straight in. */
  register: (email: string, password: string, display_name: string, role: string) =>
    api.post<SessionResponse>('/auth/register', { email, password, display_name, role }),

  /** Exchange the Google button's access token for a ProxID session. */
  google: (accessToken: string) =>
    api.post<SessionResponse>('/auth/google', { access_token: accessToken }),

  /**
   * Sign into the seeded judge profile. No OAuth, no wallet.
   * Answers with a usable message when the seed has not run.
   */
  demoLogin: () => api.post<SessionResponse>('/auth/demo-login'),

  /** End the session on the server, not only in the browser. */
  logout: () => api.post<{ message: string }>('/auth/logout'),

  /** The signed-in person, used to restore a session on page load. */
  me: () => api.get<Me>('/users/me'),
}
