/**
 * EmptyState.tsx
 *
 * Every empty state says what would appear here and offers the action that makes
 * something appear. A blank screen is never an empty state.
 *
 * Follows ProxID house standards: palette tokens only, 100% ASCII.
 */

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export interface EmptyStateProps {
  title: string
  body?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({
  title,
  body,
  description,
  icon,
  action,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const text = description ?? body ?? ''

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/70 px-6 py-12 text-center"
    >
      {icon ? (
        <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface shadow-sm text-ink">
          {icon}
        </div>
      ) : null}

      <h3 className="text-base font-semibold text-ink">{title}</h3>

      {text ? (
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
          {text}
        </p>
      ) : null}

      {action ? (
        <div className="mt-4 flex justify-center">{action}</div>
      ) : actionLabel && (actionHref || onAction) ? (
        <div className="mt-4 flex justify-center">
          {actionHref ? (
            <Link to={actionHref}>
              <Button size="sm">{actionLabel}</Button>
            </Link>
          ) : (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      ) : null}
    </motion.div>
  )
}
