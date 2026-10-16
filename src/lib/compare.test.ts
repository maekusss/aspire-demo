import { describe, expect, it } from 'vitest'
import type { Filters, Transaction } from '../data/types'
import { buildComparison, computeChange } from './compare'
import { filterTransactions } from './filter'
import { resolvePeriods } from './periods'

const filters: Filters = { search: '', datePreset: 'all', categories: [], cards: [], statuses: [], minAmount: '', maxAmount: '' }
const make = (date: string, category: string, amount: number, id: string): Transaction => ({ id, date: `${date}T12:00:00Z`, merchant: 'Acme', merchantId: '', domain: '', logoUrl: '', category, card: 'Visa', cardLast4: '0000', amount, status: 'Cleared', description: 'Subscription', owner: 'Maya', location: '', receipt: false })
const periods = resolvePeriods({ on: true, preset: 'custom', custom: { aStart: '2026-10-01', aEnd: '2026-10-07', bStart: '2026-09-01', bEnd: '2026-09-07' } }, new Date(2026, 9, 16))

describe('buildComparison', () => {
  it('matches two independently filtered ranges and preserves period A row order', () => {
    const rows = [make('2026-10-03', 'SaaS', 20, 'a'), make('2026-09-02', 'SaaS', 10, 'b'), make('2026-10-01', 'Travel', 50, 'c'), make('2026-08-01', 'Travel', 90, 'd')]
    const result = buildComparison(rows, { ...filters, categories: ['SaaS'], datePreset: '30d' }, periods)
    expect(result.rowsA.map((row) => row.id)).toEqual(['a'])
    expect([result.a.total, result.b.total]).toEqual([20, 10])
    const rangeFilter = (start: number, end: number) => rows.filter((row) => { const ts = Date.parse(row.date); return ts >= start && ts < end })
    expect(result.a.total).toBe(filterTransactions(rangeFilter(periods.a.start, periods.a.endExclusive), { ...filters, categories: ['SaaS'] }).reduce((sum, row) => sum + row.amount, 0))
    expect(result.b.total).toBe(filterTransactions(rangeFilter(periods.b.start, periods.b.endExclusive), { ...filters, categories: ['SaaS'] }).reduce((sum, row) => sum + row.amount, 0))
  })
  it('counts overlapping custom ranges in both periods', () => {
    const overlap = { ...periods, b: periods.a }
    const result = buildComparison([make('2026-10-03', 'SaaS', 25, 'a')], filters, overlap)
    expect([result.a.total, result.b.total, result.rowsA.length]).toEqual([25, 25, 1])
  })
  it('handles empty, A-only and B-only cases', () => {
    expect(buildComparison([], filters, periods).a.count).toBe(0)
    expect(buildComparison([make('2026-10-03', 'SaaS', 20, 'a')], filters, periods).b.count).toBe(0)
    expect(buildComparison([make('2026-09-03', 'SaaS', 20, 'b')], filters, periods).rowsA).toEqual([])
  })
  it('selects day, week, and month buckets by the longer range', () => {
    expect(buildComparison([], filters, periods).bucketUnit).toBe('day')
    expect(buildComparison([], filters, { ...periods, aDays: 60 }).bucketUnit).toBe('week')
    expect(buildComparison([], filters, { ...periods, bDays: 130 }).bucketUnit).toBe('month')
  })
  it('keeps a cached 50k-row comparison within the interaction budget', () => {
    const rows = Array.from({ length: 50_000 }, (_, index) => ({ ...make(index % 2 ? '2026-09-03' : '2026-10-03', index % 3 ? 'SaaS' : 'Travel', 20, String(index)), ts: Date.parse(index % 2 ? '2026-09-03T12:00:00Z' : '2026-10-03T12:00:00Z') }))
    buildComparison(rows, filters, periods)
    const durations = Array.from({ length: 5 }, () => { const start = performance.now(); buildComparison(rows, filters, periods); return performance.now() - start })
    expect(Math.min(...durations)).toBeLessThan(16)
  })
})

describe('computeChange', () => {
  it('shows the zero baseline, flat, directions, and large percent cap', () => {
    expect(computeChange(0, 0).kind).toBe('none')
    expect(computeChange(100, 0)).toMatchObject({ kind: 'new', amount: 100, percent: null })
    expect(computeChange(10, 10).kind).toBe('flat')
    expect(computeChange(120, 100)).toMatchObject({ kind: 'up', amount: 20, percent: 20 })
    expect(computeChange(80, 100)).toMatchObject({ kind: 'down', amount: -20, percent: -20 })
    expect(computeChange(1000, 1).percent).toBeGreaterThanOrEqual(999)
    expect(computeChange(0, 10).percent).toBe(-100)
    expect(computeChange(0.004, 0).kind).toBe('none')
    expect(computeChange(10.004, 10).kind).toBe('flat')
    expect(computeChange(1, 0, true).kind).toBe('new')
  })
})
