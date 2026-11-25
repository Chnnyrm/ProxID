/**
 * Job transport: browse, search nearby, post, read a room, change state, message.
 */

import { api, query } from '@/lib/api'
import type {
  Coordinates,
  JobCreateBody,
  JobResponse,
  JobsResponse,
  MessageCreateBody,
  MessagesResponse,
  RoomResponse,
} from '@/lib/contracts'
import type { Application, JobMessage } from '@/types/api'

export const jobService = {
  /** The open-jobs list, ranked by freshness blended with activity. */
  browse: (limit = 20, offset = 0) => api.get<JobsResponse>(`/jobs${query({ limit, offset })}`),

  /** Job IDs the current user has applied to. */
  appliedIds: () => api.get<string[]>('/jobs/applied-ids'),

  /** Apply to an open job. */
  apply: (jobId: string, message?: string, proposedPrice?: number) =>
    api.post<Application>(`/jobs/${jobId}/apply`, {
      message: message || undefined,
      proposed_price: proposedPrice || undefined,
    }),

  /** Open jobs around a point, nearest first. Radius zero means no limit. */
  nearby: (coords: Coordinates, radiusKm: number, limit = 30) =>
    api.get<JobsResponse>(
      `/jobs/search/nearby${query({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius_km: radiusKm,
        limit,
      })}`,
    ),

  /** Filtered search. */
  search: (params: {
    q?: string
    status?: string
    categoryId?: string
    minPrice?: number
    maxPrice?: number
    sort?: string
  }) =>
    api.get<JobsResponse>(
      `/jobs/search${query({
        q: params.q,
        status: params.status,
        category_id: params.categoryId,
        min_price: params.minPrice,
        max_price: params.maxPrice,
        sort: params.sort,
      })}`,
    ),

  /** Jobs the caller posted and jobs they were hired for. */
  mine: () => api.get<JobsResponse>('/jobs/mine'),

  /** One job. */
  get: (id: string) => api.get<JobResponse>(`/jobs/${id}`),

  /** The job room: job, both people, the thread, and the payment state. */
  room: (id: string) => api.get<RoomResponse>(`/jobs/${id}/room`),

  /** Post a job. */
  post: (body: JobCreateBody) => api.post<JobResponse>('/jobs', body),

  /** Ask for a legal state transition. The server decides. */
  changeStatus: (id: string, status: string, providerId?: string) =>
    api.patch<JobResponse>(`/jobs/${id}/status`, {
      status,
      ...(providerId ? { provider_id: providerId } : {}),
    }),

  /** Post into the room. */
  sendMessage: (jobId: string, body: MessageCreateBody) =>
    api.post<JobMessage>(`/messages/job/${jobId}`, body),

  /** The room's thread. */
  messages: (jobId: string) => api.get<MessagesResponse>(`/messages/job/${jobId}`),
}
