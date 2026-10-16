import { describe, expect, it } from 'vitest'
import { formatCompactCurrency, formatCurrency, formatRange, initials } from './format'

describe('formatCurrency', () => {
  it('formats exact and compact currency values', () => {
    expect(formatCurrency(1284.5)).toBe('$1,284.50')
    expect(formatCompactCurrency(1250000)).toBe('$1.3M')
  })
})

describe('initials', () => {
  it('builds stable two-letter initials from display names', () => {
    expect(initials('Maya Chen')).toBe('MC')
    expect(initials('Jordan')).toBe('J')
    expect(initials('Avery Lynn Kim')).toBe('AL')
  })
})

describe('formatRange', () => {
  it('uses compact same-month dates and shows another year', () => {
    const today = new Date(2026, 9, 16)
    expect(formatRange(new Date(2026, 9, 1).getTime(), new Date(2026, 9, 16).getTime(), today)).toBe('Oct 1–16')
    expect(formatRange(new Date(2025, 6, 1).getTime(), new Date(2025, 8, 30).getTime(), today)).toBe('Jul 1 – Sep 30, 2025')
  })
})
