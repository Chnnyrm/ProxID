/**
 * The WebMCP bootstrap.
 *
 * Wires the pure tool definitions to the real app: the authenticated HTTP client, the auth
 * store, and `document.modelContext` when the browser exposes it.
 *
 * Tools execute inside the person's own open, already-authenticated tab, so an agent that
 * calls one acts as that person. Sign-in only decides which tools are registered at all.
 *
 * Call `initWebMCP()` once at boot. In a browser without WebMCP it is a no-op.
 */

import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  createWebMCPTools,
  type CurrentUser,
  type ToolApi,
  type ToolDeps,
} from './tools'
import { createRegistrar, type ModelContext, type WebMCPTool } from './registry'

function getModelContext(): ModelContext | null {
  if (typeof window === 'undefined') return null
  const documentContext = (document as Document & { modelContext?: ModelContext }).modelContext
  if (documentContext) return documentContext
  const navigatorContext = (navigator as Navigator & { modelContext?: ModelContext }).modelContext
  return navigatorContext ?? null
}

function hasRegisterTool(): boolean {
  const context = getModelContext()
  return Boolean(context && typeof context.registerTool === 'function')
}

/**
 * Adapt the shared client to the tool surface. The client already sends the session cookie
 * and the CSRF header, so a tool call authenticates exactly like a click.
 */
const adapter: ToolApi = {
  get: <T,>(path: string, params?: Record<string, unknown>) =>
    api.get<T>(withQuery(path, params)),
  post: <T,>(path: string, body?: unknown) => api.post<T>(path, body),
  patch: <T,>(path: string, body?: unknown) => api.patch<T>(path, body),
}

function withQuery(path: string, params?: Record<string, unknown>): string {
  if (!params) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const rendered = search.toString()
  return rendered ? `${path}?${rendered}` : path
}

let started = false
let activeNavigator: ((route: string) => void) | null = null

export function setWebMCPNavigate(navigationFunction: (route: string) => void): void {
  activeNavigator = navigationFunction
}

export function initWebMCP(): void {
  if (started || typeof window === 'undefined') return
  started = true

  const currentUser = (): CurrentUser | null => {
    const user = useAuthStore.getState().user
    if (!user) return null
    return {
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      is_verified: user.concordium_verified,
      role: user.role,
      is_demo: user.is_demo,
    }
  }

  const deps: ToolDeps = {
    api: adapter,
    currentUser,
    navigate: (route) => activeNavigator?.(route),
  }
  const tools: WebMCPTool[] = createWebMCPTools(deps)

  const registrar = createRegistrar({
    tools,
    publicToolNames: new Set(['get_auth_status', 'search_providers', 'get_provider_reputation']),
    isSignedIn: () => Boolean(currentUser()),
    getModelContext,
    onAuthChange: (listener) =>
      useAuthStore.subscribe((state, previous) => {
        if (state.user !== previous.user || state.status !== previous.status) listener()
      }),
  })

  registrar.start()

  // Some hosts attach `document.modelContext` after first paint. Re-check briefly rather
  // than requiring a reload.
  if (!hasRegisterTool()) {
    let attempts = 0
    const timer = window.setInterval(() => {
      attempts += 1
      if (hasRegisterTool()) {
        void registrar.sync()
        window.clearInterval(timer)
      } else if (attempts >= 10) {
        window.clearInterval(timer)
      }
    }, 500)
  }
}
