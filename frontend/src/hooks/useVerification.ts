/**
 * Proof of personhood: request a QR, then check whether consent came back.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { verificationService } from '@/services/verificationService'

export const verificationKeys = {
  mine: ['verification', 'mine'] as const,
}

/** The latest verification attempt on this account. */
export function useMyVerification(enabled: boolean) {
  return useQuery({
    queryKey: verificationKeys.mine,
    queryFn: () => verificationService.mine(),
    enabled,
  })
}

/** Create a request and get its QR. */
export function useRequestVerification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (purpose: 'personhood' | 'age_over_18') => verificationService.request(purpose),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: verificationKeys.mine })
    },
  })
}

/** Check whether the person approved, and pick up the badge if they did. */
export function useApproveVerification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nonce: string) => verificationService.approve(nonce),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: verificationKeys.mine })
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}
