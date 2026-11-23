/**
 * Tests for PasswordStrengthMeter score computation.
 */

import { describe, expect, it } from 'vitest'

import { computePasswordScore } from './PasswordStrengthMeter'

describe('computePasswordScore', () => {
  it('returns score 0 for empty password', () => {
    const result = computePasswordScore('')
    expect(result.score).toBe(0)
    expect(result.label).toBe('')
  })

  it('flags passwords shorter than 12 characters as too short', () => {
    const result = computePasswordScore('Short1!')
    expect(result.score).toBe(1)
    expect(result.label).toBe('Too short')
  })

  it('rates simple 12+ character single-class passwords as weak', () => {
    const result = computePasswordScore('alllowercaselongenough')
    expect(result.score).toBe(1)
    expect(result.label).toBe('Weak')
  })

  it('rates passwords meeting two criteria as fair', () => {
    const result = computePasswordScore('lowercaseandUPPERCASE')
    expect(result.score).toBe(2)
    expect(result.label).toBe('Fair')
  })

  it('rates passwords meeting three criteria as good', () => {
    const result = computePasswordScore('lowercaseUPPER1234')
    expect(result.score).toBe(3)
    expect(result.label).toBe('Good')
  })

  it('rates passwords meeting all four criteria as strong', () => {
    const result = computePasswordScore('CorrectHorseBatteryStaple!123')
    expect(result.score).toBe(4)
    expect(result.label).toBe('Strong')
  })
})
