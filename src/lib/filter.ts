import type { Filters, ResolvedPeriods, Transaction } from '../data/types'
import { formatRange } from './format'

export function compileFilters(filters: Filters) {
  return {
    query: filters.search.trim().toLowerCase(),
    minAmount: filters.minAmount === '' ? null : Number(filters.minAmount),
    maxAmount: filters.maxAmount === '' ? null : Number(filters.maxAmount),
    categories: new Set(filters.categories),
    cards: new Set(filters.cards),
    statuses: new Set(filters.statuses),
  }
}

export function matchesNonDateFilters(transaction: Transaction, compiled: ReturnType<typeof compileFilters>) {
  if (compiled.query) {
    const haystack = `${transaction.merchant} ${transaction.description} ${transaction.owner}`.toLowerCase()
    if (!haystack.includes(compiled.query)) return false
  }
  if (compiled.categories.size && !compiled.categories.has(transaction.category)) return false
  if (compiled.cards.size && !compiled.cards.has(transaction.card)) return false
  if (compiled.statuses.size && !compiled.statuses.has(transaction.status)) return false
  if (compiled.minAmount !== null && transaction.amount < compiled.minAmount) return false
  if (compiled.maxAmount !== null && transaction.amount > compiled.maxAmount) return false
  return true
}

export function getDateFloor(preset: Filters['datePreset']) {
  const now = new Date()
  if (preset === '30d') {
    const date = new Date(now)
    date.setDate(date.getDate() - 30)
    return date
  }
  if (preset === '90d') {
    const date = new Date(now)
    date.setDate(date.getDate() - 90)
    return date
  }
  if (preset === 'ytd') {
    return new Date(now.getFullYear(), 0, 1)
  }
  return null
}

export function filterTransactions(transactions: Transaction[], filters: Filters) {
  const compiled = compileFilters(filters)
  const dateFloor = getDateFloor(filters.datePreset)

  return transactions.filter((transaction) => {
    if (!matchesNonDateFilters(transaction, compiled)) return false
    if (dateFloor && new Date(transaction.date) < dateFloor) return false
    return true
  })
}

export function describeFilters(filters: Filters, compare?: ResolvedPeriods | null, today = new Date()) {
  const chips: Array<{ key: keyof Filters | 'amount' | 'compare'; label: string }> = []

  if (compare) {
    chips.push({ key: 'compare', label: `Comparing: ${formatRange(compare.a.start, compare.a.endExclusive - 1, today)} vs ${formatRange(compare.b.start, compare.b.endExclusive - 1, today)}` })
  } else if (filters.datePreset !== 'all') {
    const labels = { '30d': 'Last 30 days', '90d': 'Last 90 days', ytd: 'Year to date', all: 'All time' }
    chips.push({ key: 'datePreset', label: `Date: ${labels[filters.datePreset]}` })
  }
  if (filters.categories.length > 0) chips.push({ key: 'categories', label: `Category: ${filters.categories.join(', ')}` })
  if (filters.cards.length > 0) chips.push({ key: 'cards', label: `Card: ${filters.cards.join(', ')}` })
  if (filters.statuses.length > 0) chips.push({ key: 'statuses', label: `Status: ${filters.statuses.join(', ')}` })
  if (filters.minAmount || filters.maxAmount) {
    chips.push({
      key: 'amount',
      label: `Amount: ${filters.minAmount || '0'}-${filters.maxAmount || 'any'}`,
    })
  }

  return chips
}
