/**
 * Hook to retrieve unauthenticated public user profiles at /u/:username.
 * Pure ASCII.
 */

import { useQuery } from '@tanstack/react-query'

import { authService } from '@/services/authService'
import type { PublicProfile } from '@/types/api'

export function usePublicProfile(username: string | undefined) {
  return useQuery<PublicProfile>({
    queryKey: ['public-profile', username],
    queryFn: () => authService.publicProfile(username as string),
    enabled: Boolean(username && username.trim().length > 0),
    staleTime: 60 * 1000,
  })
}
