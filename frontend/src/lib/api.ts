/**
 * The single HTTP client.
 *
 * Two behaviours are load-bearing:
 *
 * 1. `credentials: 'include'`, because the session rides in an HttpOnly cookie. The
 *    token in the response body exists for non-browser clients; the browser never
 *    reads it.
 * 2. The CSRF header. A state-changing request authenticated by cookie must echo the
 *    readable `proxid_csrf` cookie in `X-CSRF-Token`, or the server refuses it. That
 *    refusal is the protection, not an inconvenience.
 */

import { isErrorEnvelope, type ErrorBody } from './contracts'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'

/** A failure the interface can render: a sentence, a code, and a support reference. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly reference: string | null

  constructor(status: number, body: ErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.reference = body.reference
  }

  /** True when the page is stale rather than the request being wrong. */
  get isStalePage(): boolean {
    return this.status === 403 || this.status === 401
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

const CSRF_SAFE: Method[] = ['GET']

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'

  if (!CSRF_SAFE.includes(method)) {
    const csrf = readCookie('proxid_csrf')
    if (csrf) headers['X-CSRF-Token'] = csrf
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const parsed: unknown = text ? safeJson(text) : null

  if (!response.ok) {
    if (isErrorEnvelope(parsed)) {
      throw new ApiError(response.status, parsed.error)
    }
    // A gateway or proxy answered, not this API. Say something actionable anyway.
    throw new ApiError(response.status, {
      code: 'unexpected_response',
      message:
        'We could not reach ProxID just now. Nothing was saved. Check your connection and try again.',
      reference: response.headers.get('X-Request-ID'),
    })
  }

  return parsed as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

/** Build a query string, dropping null and undefined values. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const rendered = search.toString()
  return rendered ? `?${rendered}` : ''
}
