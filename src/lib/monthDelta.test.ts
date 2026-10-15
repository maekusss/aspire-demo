import { describe, expect, it } from 'vitest'
import { calculateMonthDelta } from './monthDelta'

const spend = (date: string, amount: number) => ({ date, amount })

describe('calculateMonthDelta', () => {
  it('compares only the current and preceding calendar months', () => {
    expect(calculateMonthDelta([
      spend('2026-10-03T12:00:00Z', 150),
      spend('2026-09-29T12:00:00Z', 100),
      spend('2026-08-15T12:00:00Z', 500),
      spend('2026-11-01T12:00:00Z', 300),
    ], new Date('2026-10-15T12:00:00Z'))).toEqual({
      delta: '+50.0% MoM',
      tone: 'positive',
    })
  })

  it('shows a neutral label when last month has no spend, even if an older month does', () => {
    expect(calculateMonthDelta([
      spend('2026-10-03T12:00:00Z', 150),
      spend('2026-08-15T12:00:00Z', 100),
    ], new Date('2026-10-15T12:00:00Z'))).toEqual({
      delta: 'No spend last month',
      tone: 'neutral',
    })
  })

  it('compares January with the preceding December', () => {
    expect(calculateMonthDelta([
      spend('2026-01-03T12:00:00Z', 50),
      spend('2025-12-29T12:00:00Z', 100),
      spend('2025-11-15T12:00:00Z', 200),
    ], new Date('2026-01-15T12:00:00Z'))).toEqual({
      delta: '-50.0% MoM',
      tone: 'negative',
    })
  })
})
