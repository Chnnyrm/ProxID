/**
 * Text input and textarea. The label is part of the component, so a field can never be
 * rendered without one, and the error sits directly under the field it belongs to.
 */

import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

interface FieldProps {
  label: string
  hint?: string
  error?: string | null
}

const BASE =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted ' +
  'transition-colors duration-200 ease-house disabled:opacity-60'

export const TextField = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, hint, error, className, id, ...rest }, ref) {
    const generated = useId()
    const fieldId = id ?? generated
    const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
    return (
      <div className="min-w-0">
        <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-ink">
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(BASE, error && 'border-accent', className)}
          {...rest}
        />
        {hint && !error ? (
          <p id={`${fieldId}-hint`} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${fieldId}-error`} className="mt-1 text-xs font-medium text-ink">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)

export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextAreaField({ label, hint, error, className, id, ...rest }, ref) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className="min-w-0">
      <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(BASE, 'min-h-[96px] resize-y', error && 'border-accent', className)}
        {...rest}
      />
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-ink">{error}</p> : null}
    </div>
  )
})
