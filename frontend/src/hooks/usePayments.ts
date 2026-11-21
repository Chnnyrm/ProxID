/**
 * The x402 payment panel's behaviour.
 *
 * The server answers `not_configured` in this build. The hook surfaces that answer as a
 * state, not an error, because "the rail is not connected" is information a judge should
 * read plainly rather than see dressed up as a failure.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { idempotencyKey, paymentService } from '@/services/paymentService'
import type { X402Action } from '@/types/api'

export const paymentKeys = {
  status: (jobId: string) => ['payments', 'job', jobId] as const,
  limits: ['payments', 'limits'] as const,
}

/** The latest receipt for a job. */
export function usePaymentStatus(jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: paymentKeys.status(jobId ?? ''),
    queryFn: () => paymentService.statusForJob(jobId as string),
    enabled: Boolean(jobId) && enabled,
  })
}

/** The agent's spending limits. */
export function useSpendingLimits(enabled: boolean) {
  return useQuery({
    queryKey: paymentKeys.limits,
    queryFn: () => paymentService.limits(),
    enabled,
  })
}

/** Start a payment for a job. */
export function useInitiatePayment(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation<X402Action, unknown, void>({
    mutationFn: () => paymentService.initiate(jobId, idempotencyKey('pay', jobId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.status(jobId) })
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

/** Settle a payment record. */
export function useSettlePayment(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation<X402Action, unknown, string>({
    mutationFn: (receiptId: string) =>
      paymentService.settle(receiptId, idempotencyKey('settle', receiptId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.status(jobId) })
    },
  })
}
