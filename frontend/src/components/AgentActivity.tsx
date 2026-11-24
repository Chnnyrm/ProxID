/**
 * The agent's tool log, as the person sees it.
 *
 * Each line is what the agent did, not what it said it did: the summary comes from the
 * tool result the server recorded, with explicit tool arguments and results.
 */

import { CheckCircle2, ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import { useState } from 'react'

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
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({})

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  if (loading) return <TextSkeleton lines={3} />

  if (!steps || steps.length === 0) {
    return <p className="text-sm text-muted">{emptyHint}</p>
  }

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const hasArgs = step.arguments && Object.keys(step.arguments).length > 0
        const hasResult = step.result && Object.keys(step.result).length > 0
        const isExpanded = expandedIndices[index] ?? (index === 0 && (hasArgs || hasResult))

        return (
          <li
            key={`${step.tool}-${index}`}
            className="rounded-xl border border-line bg-surface p-3 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 text-sm">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {step.succeeded ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
                ) : (
                  <XCircle size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink bg-sunken px-2 py-0.5 rounded-md border border-line">
                      {step.tool}
                    </span>
                    <span className="text-xs text-muted leading-tight">{step.summary}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {step.created_at ? (
                  <span className="text-[11px] font-mono text-muted">{clockTime(step.created_at)}</span>
                ) : null}
                {(hasArgs || hasResult) && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(index)}
                    className="p-1 rounded text-muted hover:text-ink hover:bg-sunken transition-colors"
                    aria-label="Toggle details"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
              </div>
            </div>

            {/* Arguments & Result display */}
            {(hasArgs || hasResult) && isExpanded && (
              <div className="mt-2.5 pt-2 border-t border-line space-y-2 text-xs">
                {hasArgs && (
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Tool Arguments:
                    </div>
                    <pre className="rounded-lg border border-line bg-sunken/60 p-2 font-mono text-[11px] text-ink overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(step.arguments, null, 2)}
                    </pre>
                  </div>
                )}
                {hasResult && (
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Tool Result:
                    </div>
                    <pre className="rounded-lg border border-line bg-sunken/60 p-2 font-mono text-[11px] text-ink overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {JSON.stringify(step.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
