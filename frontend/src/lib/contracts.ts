/**
 * Wire contracts: the exact bodies the API sends and accepts, plus the one error
 * envelope every failure uses.
 *
 * Kept apart from `types/api.ts` on purpose. The entity is what a thing is; the
 * contract is what it looks like on the wire. When the API changes shape, this file
 * changes and the components usually do not.
 */

import type {
  AgentRun,
  AgentStep,
  Category,
  Job,
  JobMessage,
  JobRoom,
  MapConfig,
  Me,
  Provider,
  ServiceListing,
  Session,
  User,
  X402Action,
  X402Receipt,
} from '@/types/api'

export interface ErrorBody {
  code: string
  message: string
  reference: string | null
}

export interface ErrorEnvelope {
  error: ErrorBody
}

export interface Pagination {
  limit: number
  offset: number
}

export interface JobCreateBody {
  title: string
  description: string
  price: number
  category_id?: string | null
  latitude?: number | null
  longitude?: number | null
  image_url?: string | null
  image_urls?: string[]
}

export interface MessageCreateBody {
  body: string
}

export interface AgentRunBody {
  command: string
  job_id?: string | null
}

export interface PaymentInitiateBody {
  job_id: string
  idempotency_key: string
}

export interface PaymentSettleBody {
  receipt_id: string
  idempotency_key: string
  signed_transaction?: string
  sender?: string
}

export interface Coordinates {
  latitude: number
  longitude: number
}

/** Response types, named so a hook never writes the shape twice. */
export type SessionResponse = Session
export type MeResponse = Me
export type UsersResponse = User[]
export type ProvidersResponse = Provider[]
export type CategoriesResponse = Category[]
export type ListingsResponse = ServiceListing[]
export type JobsResponse = Job[]
export type JobResponse = Job
export type RoomResponse = JobRoom
export type MessagesResponse = JobMessage[]
export type AgentRunResponse = AgentRun
export type AgentActivityResponse = AgentStep[]
export type ReceiptResponse = X402Receipt | null
export type PaymentActionResponse = X402Action
export type MapConfigResponse = MapConfig

/**
 * Narrow an unknown JSON body to the error envelope.
 *
 * Every non-2xx response from this API has this shape, but a proxy or a load balancer
 * in front of it may not, so callers check rather than assume.
 */
export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const candidate = (value as { error?: unknown }).error
  if (typeof candidate !== 'object' || candidate === null) return false
  const body = candidate as Partial<ErrorBody>
  return typeof body.code === 'string' && typeof body.message === 'string'
}
