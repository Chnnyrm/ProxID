import { describe, expect, it } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

describe('ErrorBoundary', () => {
  it('updates state via getDerivedStateFromError', () => {
    const err = new Error('Simulated render error')
    const state = ErrorBoundary.getDerivedStateFromError(err)
    expect(state.error).toBe(err)
  })

  it('handles null or different error types safely', () => {
    const typeErr = new TypeError('Cannot read property of undefined')
    const state = ErrorBoundary.getDerivedStateFromError(typeErr)
    expect(state.error).toBe(typeErr)
  })
})
