/**
 * The banner shown on every screen while a demo session is active.
 *
 * It exists because the four beats of the demo involve things that look like chain data:
 * a verified badge, a receipt, an agent registration. The banner says, on the screen,
 * that none of it is on chain yet.
 */

import { FlaskConical } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'

export function DemoBanner() {
  const { isDemo } = useAuth()
  if (!isDemo) return null
  return (
    <div className="border-b border-line bg-accent-wash">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-xs text-ink sm:items-center">
        <FlaskConical size={14} className="mt-0.5 shrink-0 sm:mt-0" aria-hidden="true" />
        <p className="min-w-0">
          <span className="font-semibold">Judge demo.</span> Every provider, job, message,
          verification and receipt here is seeded data marked as demo in the database. Nothing
          is on chain: the identity, agent registry and x402 boundaries answer
          &quot;not configured&quot; because no credentials have been issued yet.
        </p>
      </div>
    </div>
  )
}
