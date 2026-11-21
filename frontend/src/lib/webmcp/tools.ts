/**
 * The agent's tool definitions, as a plain data module.
 *
 * Ported from the previous project's registry. Kept: search_providers,
 * get_provider_reputation, post_job, accept_job, send_message. The wallet and escrow tools
 * are gone; in their place are initiate_x402_payment and settle_x402_payment, which call
 * the backend endpoints that answer `not_configured` in this build.
 *
 * Nothing here touches the DOM, React or a fetch: the HTTP client and the current-user
 * getter are injected, so every tool is testable with a fake client and the whole surface
 * can be reasoned about in one file.
 */

import type { WebMCPTool } from './registry'

export interface ToolApi {
  get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T>
  post<T = unknown>(path: string, body?: unknown): Promise<T>
  patch<T = unknown>(path: string, body?: unknown): Promise<T>
}

export interface CurrentUser {
  id: string
  display_name?: string | null
  email?: string | null
  is_verified?: boolean
  role?: string | null
  is_demo?: boolean
}

export interface ToolDeps {
  api: ToolApi
  currentUser: () => CurrentUser | null
  /** Navigate the tab to an app route. Optional: a host may not allow it. */
  navigate?: (route: string) => void
}

/**
 * Tools an agent may call signed out. Browsing is public: a person deciding whether to
 * sign up should be able to ask what is nearby first.
 */
export const PUBLIC_TOOL_NAMES: ReadonlySet<string> = new Set([
  'get_auth_status',
  'search_providers',
  'get_provider_reputation',
])

/** Tools that require a session. They are not registered at all while signed out. */
export const AUTHED_TOOL_NAMES: readonly string[] = [
  'post_job',
  'accept_job',
  'send_message',
  'get_job_status',
  'initiate_x402_payment',
  'settle_x402_payment',
  'navigate_to',
]

export const ALL_TOOL_NAMES: ReadonlySet<string> = new Set([
  ...PUBLIC_TOOL_NAMES,
  ...AUTHED_TOOL_NAMES,
])

const ok = (payload: Record<string, unknown>) => ({ ok: true, ...payload })
const fail = (error: string) => ({ ok: false, error })

/** A human-readable detail out of an axios-shaped or fetch-shaped error. */
function detailOf(error: unknown): string {
  const candidate = error as { response?: { data?: { error?: { message?: string } } }; message?: string }
  const nested = candidate?.response?.data?.error?.message
  if (typeof nested === 'string' && nested) return nested
  return candidate?.message ? String(candidate.message) : 'The request did not succeed.'
}

/** First line of defence; registration gating is the second. */
function requireUser(currentUser: CurrentUser | null): { ok: true } | { ok: false; error: string } {
  if (!currentUser) {
    return {
      ok: false,
      error:
        'Not signed in. Ask the person to sign in, or to press Launch Judge Demo, before using ' +
        'account tools. Browsing with search_providers still works signed out.',
    }
  }
  return { ok: true }
}

interface ServiceShape {
  id: string
  provider_id: string
  category_id?: string | null
  category_name?: string | null
  title: string
  description?: string | null
  price: number
  currency?: string
  latitude?: number | null
  longitude?: number | null
  distance_km?: number | null
  provider_display_name?: string | null
  provider_concordium_verified?: boolean
  is_demo?: boolean
}

interface ProviderShape {
  id: string
  display_name: string
  concordium_verified: boolean
  completed_jobs: number
  services: { id: string; title: string; price: number }[]
  is_demo: boolean
  distance_km?: number | null
}

interface JobShape {
  id: string
  title: string
  status: string
  price: number
  currency?: string
  description?: string | null
  distance_km?: number | null
  is_demo?: boolean
  provider_id?: string | null
  x402_tx_hash?: string | null
}

function serviceCard(service: ServiceShape) {
  return {
    id: service.id,
    title: service.title,
    price: service.price,
    currency: service.currency ?? 'NGN',
    distance_km: service.distance_km ?? null,
    provider_id: service.provider_id,
    provider_display_name: service.provider_display_name ?? null,
    provider_verified_human: Boolean(service.provider_concordium_verified),
    provider_is_demo: Boolean(service.is_demo),
    description: (service.description ?? '').slice(0, 180),
  }
}

function jobCard(job: JobShape) {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    price: job.price,
    currency: job.currency ?? 'NGN',
    distance_km: job.distance_km ?? null,
    is_demo: Boolean(job.is_demo),
    settlement_hash: job.x402_tx_hash ?? null,
  }
}

export function createWebMCPTools(deps: ToolDeps): WebMCPTool[] {
  const { api, currentUser } = deps

  return [
    {
      name: 'get_auth_status',
      description:
        'Check whether the person is signed in to ProxID, and whether the session is the seeded ' +
        'judge demo. Call this first: if signed_in is false, ask them to sign in or press Launch ' +
        'Judge Demo before using account tools such as post_job or initiate_x402_payment.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const user = currentUser()
        if (!user) {
          return ok({
            signed_in: false,
            is_demo: false,
            available_tools: [...PUBLIC_TOOL_NAMES],
            note: 'Signed out. Browsing works; posting, messaging and paying need a session.',
          })
        }
        return ok({
          signed_in: true,
          user: {
            id: user.id,
            display_name: user.display_name ?? null,
            role: user.role ?? null,
            is_verified: Boolean(user.is_verified),
            is_demo: Boolean(user.is_demo),
          },
          is_demo: Boolean(user.is_demo),
          available_tools: [...ALL_TOOL_NAMES],
          note: user.is_demo
            ? 'This is the seeded judge demo. Everything it touches is marked demo data and nothing is on chain.'
            : null,
        })
      },
    },

    {
      name: 'search_providers',
      description:
        'Find providers to hire, nearest first. Pass latitude and longitude when known, so results are ' +
        'ranked by real distance. Returns each listing with its provider, the human-verification flag and ' +
        'the demo flag. Prices are in the job currency (NGN).',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What the person needs, for example "plumber".' },
          latitude: { type: 'number', description: 'Their latitude, for proximity ranking.' },
          longitude: { type: 'number', description: 'Their longitude, for proximity ranking.' },
          radius_km: { type: 'number', description: 'Search radius in kilometres. Default 5. Zero means no limit.' },
          verified_only: { type: 'boolean', description: 'Only providers with a human proof.' },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input: unknown) => {
        const args = (input ?? {}) as {
          query?: string
          latitude?: number
          longitude?: number
          radius_km?: number
          verified_only?: boolean
        }
        let services: ServiceShape[]
        try {
          if (typeof args.latitude === 'number' && typeof args.longitude === 'number') {
            services = await api.get<ServiceShape[]>('/services/search/nearby', {
              latitude: args.latitude,
              longitude: args.longitude,
              radius_km: args.radius_km ?? 5,
              verified_only: args.verified_only ?? false,
              limit: 10,
            })
          } else if (args.query) {
            services = await api.get<ServiceShape[]>('/services/search/text', {
              q: args.query,
              limit: 10,
            })
          } else {
            return fail(
              'Give a query, or the person\'s latitude and longitude, so there is something to search for.',
            )
          }
        } catch (error) {
          return fail(detailOf(error))
        }

        const results = services.slice(0, 10).map(serviceCard)
        return ok({
          count: results.length,
          results,
          note: results.length
            ? 'Each result names a provider. Use post_job to hire, or accept_job when one replies.'
            : 'No providers matched. Try a wider radius or a different word.',
        })
      },
    },

    {
      name: 'get_provider_reputation',
      description:
        'Look up a provider\'s trust record: whether a Concordium zero-knowledge proof of personhood is on ' +
        'file, how many jobs they completed, and their listings. A verified provider is a proven human; ' +
        'the flag never reveals who they are.',
      inputSchema: {
        type: 'object',
        properties: {
          provider_id: { type: 'string', description: 'Provider id from search_providers.' },
        },
        required: ['provider_id'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input: unknown) => {
        const args = (input ?? {}) as { provider_id?: string }
        if (!args.provider_id) return fail('provider_id is required, from search_providers.')
        try {
          const providers = await api.get<ProviderShape[]>('/users/providers/search', {
            q: args.provider_id,
          })
          const provider = providers.find((candidate) => candidate.id === args.provider_id)
          if (!provider) {
            return fail('That provider is not in the current results. Search again to refresh them.')
          }
          return ok({
            provider: {
              id: provider.id,
              display_name: provider.display_name,
              verified_human: provider.concordium_verified,
              completed_jobs: provider.completed_jobs,
              is_demo: provider.is_demo,
              services: provider.services.map((service) => ({
                id: service.id,
                title: service.title,
                price: service.price,
              })),
            },
            summary:
              `${provider.display_name}: ` +
              (provider.concordium_verified ? 'human-verified, ' : 'not human-verified, ') +
              `${provider.completed_jobs} job(s) completed.` +
              (provider.is_demo ? ' Demo data.' : ''),
          })
        } catch (error) {
          return fail(detailOf(error))
        }
      },
    },

    {
      name: 'post_job',
      description:
        'Post a job on the person\'s behalf. Only when they clearly asked to hire someone. Returns the job ' +
        'id, which get_job_status and initiate_x402_payment take.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title, for example "Fix the kitchen sink leak".' },
          description: { type: 'string', description: 'What needs doing, in a sentence or two.' },
          price: { type: 'number', description: 'Budget in NGN, above zero.' },
          latitude: { type: 'number', description: 'Optional job latitude.' },
          longitude: { type: 'number', description: 'Optional job longitude.' },
        },
        required: ['title', 'description', 'price'],
      },
      execute: async (input: unknown) => {
        const gate = requireUser(currentUser())
        if (!gate.ok) return gate
        const args = (input ?? {}) as {
          title?: string
          description?: string
          price?: number
          latitude?: number
          longitude?: number
        }
        if (!args.title || !args.description) return fail('A job needs a title and a description.')
        if (typeof args.price !== 'number' || args.price <= 0) {
          return fail('A job needs a budget above zero.')
        }
        try {
          const job = await api.post<JobShape>('/jobs', {
            title: args.title,
            description: args.description,
            price: args.price,
            ...(typeof args.latitude === 'number' ? { latitude: args.latitude } : {}),
            ...(typeof args.longitude === 'number' ? { longitude: args.longitude } : {}),
          })
          return ok({ job: jobCard(job), note: 'Posted. Providers nearby can see it now.' })
        } catch (error) {
          return fail(detailOf(error))
        }
      },
    },

    {
      name: 'accept_job',
      description:
        'Provider side: accept a job that was requested from this person. Only the job\'s provider can accept, ' +
        'and only while the job is "requested".',
      inputSchema: {
        type: 'object',
        properties: { job_id: { type: 'string', description: 'The job id to accept.' } },
        required: ['job_id'],
      },
      execute: async (input: unknown) => {
        const gate = requireUser(currentUser())
        if (!gate.ok) return gate
        const args = (input ?? {}) as { job_id?: string }
        if (!args.job_id) return fail('job_id is required.')
        try {
          const job = await api.get<JobShape>(`/jobs/${args.job_id}`)
          if (job.status !== 'requested') {
            return fail(`"${job.title}" is ${job.status}, not requested, so there is nothing to accept.`)
          }
          const accepted = await api.patch<JobShape>(`/jobs/${args.job_id}/status`, {
            status: 'assigned',
          })
          return ok({
            job: jobCard(accepted),
            note: 'Accepted. The client is notified and can now pay.',
          })
        } catch (error) {
          return fail(detailOf(error))
        }
      },
    },

    {
      name: 'send_message',
      description:
        'Post a message into a job room the person belongs to. Use it to confirm scope, send an update, or ' +
        'nudge the other side. The message is visible to both participants and is audited.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'The job whose room to post into.' },
          body: { type: 'string', description: 'Message text.' },
        },
        required: ['job_id', 'body'],
      },
      execute: async (input: unknown) => {
        const gate = requireUser(currentUser())
        if (!gate.ok) return gate
        const args = (input ?? {}) as { job_id?: string; body?: string }
        if (!args.job_id) return fail('job_id is required.')
        if (!args.body || !args.body.trim()) return fail('A message needs some text.')
        try {
          const message = await api.post<{ id: string }>(`/messages/job/${args.job_id}`, {
            body: args.body.trim(),
          })
          return ok({
            message_id: message.id,
            sent: true,
            note: 'Posted to the job room.',
          })
        } catch (error) {
          return fail(detailOf(error))
        }
      },
    },

    {
      name: 'get_job_status',
      description:
        'The current state of one job and what happens next, including whether a payment exists and whether ' +
        'anything has settled. Use it before saying anything about money.',
      inputSchema: {
        type: 'object',
        properties: { job_id: { type: 'string' } },
        required: ['job_id'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input: unknown) => {
        const args = (input ?? {}) as { job_id?: string }
        if (!args.job_id) return fail('job_id is required.')
        try {
          const job = await api.get<JobShape>(`/jobs/${args.job_id}`)
          return ok({
            job: jobCard(job),
            note:
              job.status === 'open'
                ? 'Open. It has no provider yet.'
                : job.status === 'assigned'
                  ? 'Assigned. The client can start a payment.'
                  : job.status === 'in_progress'
                    ? 'In progress. The client marks it complete.'
                    : `State is ${job.status}.`,
          })
        } catch (error) {
          return fail(detailOf(error))
        }
      },
    },

    {
      name: 'initiate_x402_payment',
      description:
        'Ask the x402 rail for a payment requirement on a job the person posted. The agent can never move ' +
        'money: this creates a record a human acts on. In this build the rail is not configured, so it ' +
        'answers not_configured. Never claim a payment happened.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'The job to pay for.' },
          idempotency_key: {
            type: 'string',
            description: 'Optional stable key, so a retry does not create a second payment.',
          },
        },
        required: ['job_id'],
      },
      execute: async (input: unknown) => {
        const gate = requireUser(currentUser())
        if (!gate.ok) return gate
        const args = (input ?? {}) as { job_id?: string; idempotency_key?: string }
        if (!args.job_id) return fail('job_id is required.')
        const user = currentUser()
        if (!user) return fail('Not signed in.')
        const key = args.idempotency_key ?? `agent-${user.id}-${args.job_id}`.slice(0, 120)
        try {
          const action = await api.post<{
            configured: boolean
            status: string
            message: string
            receipt: { id: string; x402_tx_hash: string | null; is_demo: boolean } | null
          }>('/payments/x402/initiate', { job_id: args.job_id, idempotency_key: key })
          return ok({
            configured: action.configured,
            status: action.status,
            message: action.message,
            receipt_id: action.receipt?.id ?? null,
            settlement_hash: action.receipt?.x402_tx_hash ?? null,
            is_demo: action.receipt?.is_demo ?? false,
            note:
              action.status === 'not_configured'
                ? 'Say plainly that the payment rail is not connected and no money moved.'
                : 'The human still has to sign the payment.',
          })
        } catch (error) {
          return fail(detailOf(error))
        }
      },
    },

    {
      name: 'settle_x402_payment',
      description:
        'Settle a payment record the person owns. In this build the rail is not configured, so it answers ' +
        'not_configured and no hash exists. Never claim a settlement.',
      inputSchema: {
        type: 'object',
        properties: {
          receipt_id: { type: 'string', description: 'Payment record id from initiate_x402_payment.' },
          idempotency_key: { type: 'string' },
        },
        required: ['receipt_id'],
      },
      execute: async (input: unknown) => {
        const gate = requireUser(currentUser())
        if (!gate.ok) return gate
        const args = (input ?? {}) as { receipt_id?: string; idempotency_key?: string }
        if (!args.receipt_id) return fail('receipt_id is required.')
        const user = currentUser()
        if (!user) return fail('Not signed in.')
        const key = args.idempotency_key ?? `agent-settle-${args.receipt_id}`.slice(0, 120)
        try {
          const action = await api.post<{
            configured: boolean
            status: string
            message: string
            receipt: { x402_tx_hash: string | null } | null
          }>('/payments/x402/settle', { receipt_id: args.receipt_id, idempotency_key: key })
          return ok({
            configured: action.configured,
            status: action.status,
            message: action.message,
            settlement_hash: action.receipt?.x402_tx_hash ?? null,
          })
        } catch (error) {
          return fail(detailOf(error))
        }
      },
    },

    {
      name: 'navigate_to',
      description: 'Take the person to a page in the app.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            enum: ['/jobs', '/providers', '/agent', '/profile', '/'],
          },
        },
        required: ['path'],
      },
      execute: (input: unknown) => {
        const args = (input ?? {}) as { path?: string }
        if (!args.path) return fail('path is required.')
        deps.navigate?.(args.path)
        return ok({ navigated_to: args.path })
      },
    },
  ]
}
