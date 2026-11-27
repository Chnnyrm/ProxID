/**
 * The human proof badge for Concordium Zero-Knowledge verification.
 */

import { BadgeCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

export function VerifiedBadge({ verified }: { verified: boolean }) {
  if (!verified) {
    return (
      <Badge tone="quiet" title="No Concordium proof on file for this account">
        Not verified
      </Badge>
    )
  }
  return (
    <span data-tour="tour-verified-badge" className="inline-flex">
      <Badge
        tone="verified"
        title="This account has a Concordium zero-knowledge proof of personhood on file"
      >
        <BadgeCheck size={12} aria-hidden="true" />
        Verified human
      </Badge>
    </span>
  )
}

/** Legacy placeholder: returns null. */
export function DemoBadge(_props: Record<string, unknown>) {
  return null
}
