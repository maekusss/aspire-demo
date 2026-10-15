import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../data/types'
import { buildSpendOverTime } from './spend'

function transaction(year: number, month: number, amount: number): Transaction {
  return {
    id: `${year}-${month}-${amount}`,
    date: new Date(year, month, 15, 12).toISOString(),
    merchant: 'Test merchant',
    merchantId: 'test',
    domain: 'example.com',
    logoUrl: '',
    category: 'Software',
    card: 'Engineering',
    cardLast4: '4242',
    amount,
    status: 'Cleared',
    description: '',
    owner: 'Test owner',
    location: '',
    receipt: false,
  }
}

describe('buildSpendOverTime', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps same-named months in different years separate across December and January', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 12))

    const points = buildSpendOverTime([
      transaction(2025, 0, 900), // Outside the window: January 2025.
      transaction(2025, 1, 20),
      transaction(2024, 11, 800), // Outside the window: December 2024.
      transaction(2025, 11, 30),
      transaction(2026, 0, 40),
      transaction(2026, 1, 700), // Future February must not enter February 2025.
    ])

    expect(points.map((point) => point.month)).toEqual([
      'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
      'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan',
    ])
    expect(points.map((point) => point.spend)).toEqual([
      20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 30, 40,
    ])
  })
})
