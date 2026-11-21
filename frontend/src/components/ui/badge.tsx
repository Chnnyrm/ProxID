/**
 * Badge. The verified badge and the demo badge are the two that must never be confused,
 * so they are different shapes as well as different words.
 */

import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

type Tone = 'verified' | 'demo' | 'neutral' | 'quiet'

const TONES: Record<Tone, string> = {
  // Pink fill, dark ink: 6.87:1 in both themes.
  verified: 'bg-accent text-accent-ink border-structural',
  // A dashed border reads as provisional without needing a fourth colour.
  demo: 'border-dashed border-structural text-ink bg-transparent',
  neutral: 'bg-sunken text-ink border-line',
  quiet: 'bg-transparent text-muted border-line',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
