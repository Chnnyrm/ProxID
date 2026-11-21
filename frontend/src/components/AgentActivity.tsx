/**
 * The agent's tool log, as the person sees it.
 *
 * Each line is what the agent did, not what it said it did: the summary comes from the
 * tool result the server recorded.
 */

import { CheckCircle2, XCircle } from 'lucide-react'

import { TextSkeleton } from '@/components/ui/skeleton'
import { clockTime } from '@/lib/format'
import type { AgentStep } from '@/types/api'

export function AgentActivity({
  steps,
  loading,
  emptyHint,
}: {
  steps: AgentStep[] | undefined
  loading: boolean
  emptyHint: string
}) {
  if (loading) return <TextSkeleton lines={3} />

  if (!steps || steps.length === 0) {
    return <p className="text-sm text-muted">{emptyHint}</p>
  }

  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={`${step.tool}-${index}`} className="flex items-start gap-2 text-sm">
          {step.succeeded ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
          ) : (
            <XCircle size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <span className="font-medium text-ink">{step.tool}</span>{' '}
            <span className="text-muted">{step.summary}</span>
          </span>
          {step.created_at ? (
            <span className="shrink-0 text-xs text-muted">{clockTime(step.created_at)}</span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
