/**
 * The human proof, and the demo mark.
 *
 * Two badges that must never be mistaken for each other: one is a pink fill saying a
 * zero-knowledge proof is on file, the other is a dashed outline saying the row is
 * seeded data. A demo row shows both, because both are true.
 */

import { BadgeCheck, FlaskConical } from 'lucide-react'

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
    <Badge
      tone="verified"
      title="This account has a Concordium zero-knowledge proof of personhood on file"
    >
      <BadgeCheck size={12} aria-hidden="true" />
      Verified human
    </Badge>
  )
}

export function DemoBadge({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null
  return (
    <Badge
      tone="demo"
      title="Seeded demonstration data. Not a real account and not an on-chain record."
    >
      <FlaskConical size={12} aria-hidden="true" />
      Demo data
    </Badge>
  )
}
