/**
 * Button. Three intents, one focus treatment (the global one), no gradient.
 *
 * Primary intent is ink on sand (bg-ink text-page border-structural).
 * Pink is NEVER a button colour per owner rule (PREMIUM-BAR.md).
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type Intent = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: Intent
  size?: 'sm' | 'md' | 'lg'
  /** Shows a spinner and progress state while the action is running. */
  loading?: boolean
  loadingText?: string
}

const INTENTS: Record<Intent, string> = {
  primary:
    'bg-ink text-page border-structural hover:opacity-90 active:translate-y-px',
  secondary:
    'bg-surface text-ink border-line hover:bg-sunken active:translate-y-px',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-sunken',
  danger: 'bg-surface text-ink border-structural hover:bg-sunken active:translate-y-px',
}

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    intent = 'primary',
    size = 'md',
    loading = false,
    loadingText,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      // A loading button is disabled for interaction but keeps its label's height, so
      // the page does not jump when a request starts.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border font-medium',
        'transition-[transform,opacity,background-color] duration-200 ease-house',
        'disabled:pointer-events-none disabled:opacity-60',
        INTENTS[intent],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="h-4 w-4 shrink-0 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{loadingText || children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
})
