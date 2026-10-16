import type { ComparisonResult, Filters, PeriodAggregate, ResolvedPeriods, Transaction } from '../data/types'
import { compileFilters, matchesNonDateFilters } from './filter'

export type Change = { kind: 'none' | 'new' | 'flat' | 'up' | 'down'; amount: number; percent: number | null }

export function computeChange(cur: number, prev: number, isCount = false): Change {
  const zero = isCount ? 0 : 0.005
  if (Math.abs(prev) <= zero && Math.abs(cur) <= zero) return { kind: 'none', amount: 0, percent: null }
  if (Math.abs(prev) <= zero) return { kind: 'new', amount: cur, percent: null }
  const amount = cur - prev
  if (Math.abs(amount) <= zero) return { kind: 'flat', amount: 0, percent: 0 }
  return { kind: amount > 0 ? 'up' : 'down', amount, percent: amount / prev * 100 }
}

function dayNumber(time: number) {
  const date = new Date(time)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
}

export function buildComparison(transactions: Transaction[], filters: Filters, periods: ResolvedPeriods): ComparisonResult {
  const compiled = compileFilters(filters)
  const longest = Math.max(periods.aDays, periods.bDays)
  const bucketUnit = longest <= 31 ? 'day' : longest <= 120 ? 'week' : 'month'
  const bucketDays = bucketUnit === 'day' ? 1 : bucketUnit === 'week' ? 7 : 30
  const makeAggregate = (days: number): PeriodAggregate => ({
    total: 0, count: 0, byCategory: new Map(), buckets: Array(Math.ceil(days / bucketDays)).fill(0),
  })
  const a = makeAggregate(periods.aDays)
  const b = makeAggregate(periods.bDays)
  const rowsA: Transaction[] = []
  const aDay = dayNumber(periods.a.start)
  const bDay = dayNumber(periods.b.start)
  let invalidDates = 0

  const add = (aggregate: PeriodAggregate, transaction: Transaction, index: number) => {
    aggregate.total += transaction.amount
    aggregate.count += 1
    aggregate.byCategory.set(transaction.category, (aggregate.byCategory.get(transaction.category) ?? 0) + transaction.amount)
    aggregate.buckets[index] += transaction.amount
  }

  for (const transaction of transactions) {
    if (!matchesNonDateFilters(transaction, compiled)) continue
    const ts = transaction.ts ?? Date.parse(transaction.date)
    if (Number.isNaN(ts)) { invalidDates += 1; continue }
    const inA = ts >= periods.a.start && ts < periods.a.endExclusive
    const inB = ts >= periods.b.start && ts < periods.b.endExclusive
    if (!inA && !inB) continue
    const dateDay = dayNumber(ts)
    if (inA) {
      add(a, transaction, Math.floor((dateDay - aDay) / bucketDays))
      rowsA.push(transaction)
    }
    if (inB) add(b, transaction, Math.floor((dateDay - bDay) / bucketDays))
  }
  if (import.meta.env.DEV && invalidDates) console.warn(`Skipped ${invalidDates} transactions with invalid dates`)
  const categories = Array.from(new Set([...a.byCategory.keys(), ...b.byCategory.keys()]))
    .sort((left, right) => Math.max(b.byCategory.get(right) ?? 0, a.byCategory.get(right) ?? 0)
      - Math.max(b.byCategory.get(left) ?? 0, a.byCategory.get(left) ?? 0))
    .slice(0, 7)
  return { a, b, rowsA, bucketUnit, categories }
}
