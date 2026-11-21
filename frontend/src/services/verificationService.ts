/**
 * Proof of personhood: request the QR, then check whether consent came back.
 */

import { api } from '@/lib/api'
import type { Approval, Verification } from '@/types/api'

export const verificationService = {
  /** Create a single-use, domain-bound request and get its QR. */
  request: (purpose: 'personhood' | 'age_over_18') =>
    api.post<Verification>('/verification/request', { purpose }),

  /** Check whether the person approved in the ID app. */
  approve: (nonce: string) => api.post<Approval>('/verification/approve', { nonce }),

  /** The latest attempt on this account, or nothing. */
  mine: () => api.get<Verification | null>('/verification/me'),
}
