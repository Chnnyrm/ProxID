/**
 * x402 payments, as the browser sees them.
 *
 * Every call can answer `not_configured`. That is a state the interface renders, not an
 * error it hides: the rail is built and waiting for credentials.
 */

import { api } from '@/lib/api'
import type { X402Action, X402Receipt } from '@/types/api'
import type { PaymentActionResponse } from '@/lib/contracts'

export const paymentService = {
  /** Ask the rail for a payment requirement for a job. Creates the receipt. */
  initiate: (jobId: string, idempotencyKey: string): Promise<X402Action> =>
    api.post<PaymentActionResponse>('/payments/x402/initiate', {
      job_id: jobId,
      idempotency_key: idempotencyKey,
    }),

  /** Settle a payment record. Without a signed payload the server says so. */
  settle: (receiptId: string, idempotencyKey: string): Promise<X402Action> =>
    api.post<PaymentActionResponse>('/payments/x402/settle', {
      receipt_id: receiptId,
      idempotency_key: idempotencyKey,
    }),

  /** The latest payment record for a job, or nothing when none exists. */
  statusForJob: (jobId: string) => api.get<X402Receipt | null>(`/payments/x402/job/${jobId}`),

  /** The agent's spending limits, and the honest note that they are client-side. */
  limits: () =>
    api.get<{
      per_payment_cap: number
      daily_cap: number
      recipient_allowlist: string[]
      requires_human_approval: boolean
      enforced_by: string
    }>('/payments/x402/limits'),
}

/** A stable idempotency key for one user action, so a double-click pays once. */
export function idempotencyKey(prefix: string, id: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? String(Date.now())
  return `${prefix}-${id}-${random}`.slice(0, 120)
}
