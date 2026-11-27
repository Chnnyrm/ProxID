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
  approve: (
    payload:
      | string
      | {
          nonce: string
          status?: 'approved' | 'refused' | 'cancelled'
          reason?: string
          proof_reference?: string
        },
  ) => {
    const body = typeof payload === 'string' ? { nonce: payload, status: 'approved' } : payload
    return api.post<Approval>('/verification/approve', body)
  },

  /** The latest attempt on this account, or nothing. */
  mine: () => api.get<Verification | null>('/verification/me'),
}
