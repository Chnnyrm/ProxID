/**
 * Button. Three intents, one focus treatment (the global one), no gradient.
 *
 * The primary intent is a pink fill with dark ink on it: pink on Sand is 2.03:1, so
 * text on pink must be the dark ink (6.87:1) and never the mocha body colour.
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type Intent = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: Intent
  size?: 'sm' | 'md' | 'lg'
  /** Shows a skeleton bar in place of the label while the action is running. */
  loading?: boolean
}

const INTENTS: Record<Intent, string> = {
  primary:
    'bg-accent text-accent-ink border-structural hover:brightness-105 active:translate-y-px',
  secondary:
    'bg-surface text-ink border-line hover:bg-accent-wash active:translate-y-px',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-accent-wash',
  danger: 'bg-accent-wash text-ink border-accent hover:brightness-105 active:translate-y-px',
}

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { intent = 'primary', size = 'md', loading = false, className, children, disabled, ...rest },
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
        'inline-flex items-center justify-center rounded-full border font-medium',
        'transition-[transform,opacity,background-color] duration-200 ease-house',
        'disabled:pointer-events-none disabled:opacity-60',
        INTENTS[intent],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="skeleton h-3 w-16 rounded-full" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  )
})
