/**
 * Jobs: the browse list, the nearby list, one job, its room, and the mutations.
 *
 * Query keys are namespaced by shape, because React Query keys are global: two screens
 * asking for different shapes under one key is how a list renders an object.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Coordinates, JobCreateBody } from '@/lib/contracts'
import { jobService } from '@/services/jobService'
import { useLocationStore } from '@/store/locationStore'
import type { Job } from '@/types/api'

export const jobKeys = {
  browse: ['jobs', 'browse'] as const,
  appliedIds: ['jobs', 'appliedIds'] as const,
  nearby: (coords: Coordinates, radiusKm: number) =>
    ['jobs', 'nearby', coords.latitude, coords.longitude, radiusKm] as const,
  mine: ['jobs', 'mine'] as const,
  detail: (id: string) => ['jobs', 'detail', id] as const,
  room: (id: string) => ['jobs', 'room', id] as const,
  search: (params: Record<string, unknown>) => ['jobs', 'search', params] as const,
}

/** The set of job IDs the current user has applied to. */
export function useAppliedJobIds(enabled = true) {
  return useQuery({
    queryKey: jobKeys.appliedIds,
    queryFn: () => jobService.appliedIds(),
    enabled,
    staleTime: 30_000,
  })
}

/** Apply to a job. */
export function useApplyJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      jobId,
      message,
      proposedPrice,
    }: {
      jobId: string
      message?: string
      proposedPrice?: number
    }) => jobService.apply(jobId, message, proposedPrice),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(vars.jobId) })
      void queryClient.invalidateQueries({ queryKey: jobKeys.appliedIds })
    },
  })
}

/** Filtered job search. */
export function useSearchJobs(params: {
  q?: string
  status?: string
  categoryId?: string
  sort?: string
}) {
  return useQuery({
    queryKey: jobKeys.search(params),
    queryFn: () => jobService.search(params),
  })
}

/** The open-jobs list. */
export function useBrowseJobs() {
  return useQuery({
    queryKey: jobKeys.browse,
    queryFn: () => jobService.browse(30, 0),
    placeholderData: keepPreviousData,
  })
}

/** Open jobs around the current coordinate. */
export function useNearbyJobs() {
  const coordinates = useLocationStore((state) => state.coordinates)
  const radiusKm = useLocationStore((state) => state.radiusKm)
  return useQuery({
    queryKey: jobKeys.nearby(coordinates, radiusKm),
    queryFn: () => jobService.nearby(coordinates, radiusKm, 40),
    placeholderData: keepPreviousData,
  })
}

/** All open jobs across the platform for map transparency without radius filtering. */
export function useMapAllJobs() {
  const coordinates = useLocationStore((state) => state.coordinates)
  return useQuery({
    queryKey: ['jobs', 'map-all', coordinates.latitude, coordinates.longitude],
    queryFn: () => jobService.nearby(coordinates, 0, 100),
    placeholderData: keepPreviousData,
  })
}

/** The caller's own jobs. Disabled while signed out, so no request 401s. */
export function useMyJobs(enabled: boolean) {
  return useQuery({
    queryKey: jobKeys.mine,
    queryFn: () => jobService.mine(),
    enabled,
    placeholderData: keepPreviousData,
  })
}

/** One job. */
export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: jobKeys.detail(id ?? ''),
    queryFn: () => jobService.get(id as string),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  })
}

/** One job room, polling while the person is looking at it. */
export function useJobRoom(id: string | undefined) {
  return useQuery({
    queryKey: jobKeys.room(id ?? ''),
    queryFn: () => jobService.room(id as string),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  })
}

/** Post a job. */
export function usePostJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: JobCreateBody) => jobService.post(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

/** Ask for a state transition, then refresh the job and its room. */
export function useChangeJobStatus(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { status: string; providerId?: string }) =>
      jobService.changeStatus(jobId, input.status, input.providerId),
    onSuccess: (job: Job) => {
      queryClient.setQueryData(jobKeys.detail(job.id), job)
      void queryClient.invalidateQueries({ queryKey: jobKeys.room(job.id) })
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

/** Post into a job room. */
export function useSendMessage(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => jobService.sendMessage(jobId, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.room(jobId) })
    },
  })
}

/** Prefetch a single job by id. */
export function usePrefetchJob() {
  const queryClient = useQueryClient()
  return (id: string) => {
    void queryClient.prefetchQuery({
      queryKey: jobKeys.detail(id),
      queryFn: () => jobService.get(id),
      staleTime: 45_000,
    })
  }
}

/** Prefetch the browse jobs list. */
export function usePrefetchJobs() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.prefetchQuery({
      queryKey: jobKeys.browse,
      queryFn: () => jobService.browse(),
      staleTime: 45_000,
    })
  }
}
