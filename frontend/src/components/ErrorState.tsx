/**
 * ErrorState.tsx
 *
 * Dedicated error state component for query and network failures.
 * Clearly states what failed and offers a retry action.
 *
 * Strictly ASCII, palette tokens only.
 */

import { AlertCircle, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void | Promise<unknown>
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this information. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
}: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    if (!onRetry) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      role="alert"
      className={`flex flex-col items-center justify-center rounded-2xl border border-line bg-accent-wash/60 p-8 text-center ${className}`}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-accent shadow-sm">
        <AlertCircle size={22} aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
        {message}
      </p>

      {onRetry ? (
        <div className="mt-4 flex justify-center">
          <Button
            size="sm"
            intent="secondary"
            loading={retrying}
            loadingText="Retrying..."
            onClick={() => void handleRetry()}
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>{retryLabel}</span>
          </Button>
        </div>
      ) : null}
    </motion.div>
  )
}
