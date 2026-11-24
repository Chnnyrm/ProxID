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
    <div className="border-b border-line bg-sunken text-ink">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-xs sm:items-center">
        <FlaskConical size={14} className="mt-0.5 shrink-0 sm:mt-0 text-muted" aria-hidden="true" />
        <p className="min-w-0 font-mono text-[11px] leading-tight">
          <span className="font-bold uppercase tracking-wider text-ink">Judge demo //</span> Every provider, job, message,
          verification and receipt here is seeded data marked as demo in the database. Nothing
          is on chain: identity, agent registry and x402 boundaries report
          &quot;not configured&quot; until live credentials are provided.
        </p>
      </div>
    </div>
  )
}
