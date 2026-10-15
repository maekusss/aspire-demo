import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Filters, Transaction } from '../data/types'
import { describeFilters, filterTransactions, getDateFloor } from './filter'

const baseFilters: Filters = {
  search: '',
  datePreset: 'all',
  categories: [],
  cards: [],
  statuses: [],
  minAmount: '',
  maxAmount: '',
}

const transactions: Transaction[] = [
  {
    id: 'txn_1',
    date: '2026-05-01T12:00:00.000Z',
    merchant: 'Linear',
    merchantId: 'merch_linear',
    domain: 'linear.app',
    logoUrl: '',
    category: 'Software',
    card: 'Engineering',
    cardLast4: '4242',
    amount: 120,
    status: 'Cleared',
    description: 'Issue tracker subscription',
    owner: 'Maya Chen',
    location: 'San Francisco, CA',
    receipt: true,
  },
  {
    id: 'txn_2',
    date: '2026-02-01T12:00:00.000Z',
    merchant: 'United',
    merchantId: 'merch_united',
    domain: 'united.com',
    logoUrl: '',
    category: 'Travel',
    card: 'Operations',
    cardLast4: '8841',
    amount: 860,
    status: 'Pending',
    description: 'Client onsite flight',
    owner: 'Jordan Lee',
    location: 'Chicago, IL',
    receipt: false,
  },
  {
    id: 'txn_3',
    date: '2025-12-15T12:00:00.000Z',
    merchant: 'Figma',
    merchantId: 'merch_figma',
    domain: 'figma.com',
    logoUrl: '',
    category: 'Design',
    card: 'Design',
    cardLast4: '1010',
    amount: 45,
    status: 'Flagged',
    description: 'Design seats',
    owner: 'Avery Kim',
    location: 'New York, NY',
    receipt: true,
  },
]

describe('getDateFloor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the correct lower date bound for relative presets', () => {
    expect(getDateFloor('30d')?.toISOString()).toBe('2026-04-14T12:00:00.000Z')
    expect(getDateFloor('90d')?.toISOString()).toBe('2026-02-13T12:00:00.000Z')
    expect(getDateFloor('ytd')?.toISOString()).toBe(new Date(2026, 0, 1).toISOString())
    expect(getDateFloor('all')).toBeNull()
  })
})

describe('filterTransactions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('filters by text across merchant, description, and owner', () => {
    expect(filterTransactions(transactions, { ...baseFilters, search: 'maya' }).map((txn) => txn.id)).toEqual(['txn_1'])
    expect(filterTransactions(transactions, { ...baseFilters, search: 'flight' }).map((txn) => txn.id)).toEqual(['txn_2'])
  })

  it('combines categorical, status, and amount filters', () => {
    const result = filterTransactions(transactions, {
      ...baseFilters,
      categories: ['Travel'],
      cards: ['Operations'],
      statuses: ['Pending'],
      minAmount: '500',
      maxAmount: '900',
    })

    expect(result.map((txn) => txn.id)).toEqual(['txn_2'])
  })

  it('applies relative date presets', () => {
    expect(filterTransactions(transactions, { ...baseFilters, datePreset: '30d' }).map((txn) => txn.id)).toEqual(['txn_1'])
    expect(filterTransactions(transactions, { ...baseFilters, datePreset: 'ytd' }).map((txn) => txn.id)).toEqual(['txn_1', 'txn_2'])
  })
})

describe('describeFilters', () => {
  it('returns active filter chips in display order', () => {
    expect(
      describeFilters({
        ...baseFilters,
        search: '  United  ',
        datePreset: '90d',
        categories: ['Travel', 'Software'],
        cards: ['Operations'],
        statuses: ['Pending'],
        minAmount: '100',
        maxAmount: '1000',
      }),
    ).toEqual([
      { key: 'search', label: 'Search: United' },
      { key: 'datePreset', label: 'Date: Last 90 days' },
      { key: 'categories', label: 'Category: Travel, Software' },
      { key: 'cards', label: 'Card: Operations' },
      { key: 'statuses', label: 'Status: Pending' },
      { key: 'amount', label: 'Amount: 100-1000' },
    ])
  })

  it('does not describe an empty or whitespace-only search', () => {
    expect(describeFilters(baseFilters)).toEqual([])
    expect(describeFilters({ ...baseFilters, search: ' \t\n ' })).toEqual([])
  })
})
