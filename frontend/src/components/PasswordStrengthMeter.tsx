/**
 * PasswordStrengthMeter.tsx - Real-time password strength indicator and requirement checklist.
 *
 * Checks:
 *  - Length (12+ characters, matching ProxID house standard)
 *  - Mixed case (uppercase and lowercase)
 *  - Numbers (0-9)
 *  - Special characters (!@#$%...)
 *
 * Strict house standards: typography only, no emojis, 100% ASCII.
 */

import { Check, X } from 'lucide-react'
import { useMemo } from 'react'

interface PasswordStrengthMeterProps {
  password: string
  confirmPassword?: string
  showConfirmMatch?: boolean
}

interface StrengthCriteria {
  label: string
  met: boolean
}

export function computePasswordScore(password: string): {
  score: number
  label: string
  color: string
  barColor: string
  criteria: StrengthCriteria[]
} {
  const criteria: StrengthCriteria[] = [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'Upper and lowercase letters', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'At least one number', met: /\d/.test(password) },
    { label: 'Special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
  ]

  const passedCount = criteria.filter((c) => c.met).length

  if (!password) {
    return { score: 0, label: '', color: 'text-muted', barColor: 'bg-line/30', criteria }
  }

  if (password.length < 12) {
    return { score: 1, label: 'Too short', color: 'text-red-500', barColor: 'bg-red-500', criteria }
  }

  if (passedCount <= 1) {
    return { score: 1, label: 'Weak', color: 'text-red-500', barColor: 'bg-red-500', criteria }
  }
  if (passedCount === 2) {
    return { score: 2, label: 'Fair', color: 'text-amber-500', barColor: 'bg-amber-500', criteria }
  }
  if (passedCount === 3) {
    return { score: 3, label: 'Good', color: 'text-blue-500', barColor: 'bg-blue-500', criteria }
  }
  return { score: 4, label: 'Strong', color: 'text-emerald-600', barColor: 'bg-emerald-500', criteria }
}

export default function PasswordStrengthMeter({
  password,
  confirmPassword,
  showConfirmMatch = true,
}: PasswordStrengthMeterProps) {
  const { score, label, color, barColor, criteria } = useMemo(
    () => computePasswordScore(password),
    [password],
  )

  const isMatching = confirmPassword !== undefined && confirmPassword.length > 0 && password === confirmPassword
  const isMismatch = confirmPassword !== undefined && confirmPassword.length > 0 && password !== confirmPassword

  if (!password && !confirmPassword) {
    return null
  }

  return (
    <div className="space-y-2 pt-1 text-xs">
      {password ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted font-medium">Password strength</span>
            <span className={`font-semibold ${color}`}>{label}</span>
          </div>

          {/* 4-segment strength bar */}
          <div className="grid grid-cols-4 gap-1.5 h-1.5">
            {[1, 2, 3, 4].map((step) => {
              const active = score >= step
              return (
                <div
                  key={step}
                  className={`h-full rounded-full transition-colors duration-200 ${
                    active ? barColor : 'bg-line/30'
                  }`}
                />
              )
            })}
          </div>

          {/* Requirement checklist */}
          <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] text-muted">
            {criteria.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                {item.met ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                ) : (
                  <X className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
                )}
                <span className={item.met ? 'text-ink font-medium' : 'text-muted'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* Password match indicator */}
      {showConfirmMatch && confirmPassword !== undefined && confirmPassword.length > 0 ? (
        <div className="pt-1">
          {isMatching ? (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Passwords match</span>
            </p>
          ) : null}
          {isMismatch ? (
            <p className="flex items-center gap-1.5 text-[11px] text-red-500 font-medium">
              <X className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
              <span>Passwords do not match</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
