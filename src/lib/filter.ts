import type { Filters, Transaction } from '../data/types'

export function getDateFloor(preset: Filters['datePreset']) {
  const now = new Date()
  if (preset === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
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
  const query = filters.search.trim().toLowerCase()
  const dateFloor = getDateFloor(filters.datePreset)
  const minAmount = filters.minAmount === '' ? null : Number(filters.minAmount)
  const maxAmount = filters.maxAmount === '' ? null : Number(filters.maxAmount)
  const categorySet = new Set(filters.categories)
  const cardSet = new Set(filters.cards)
  const statusSet = new Set(filters.statuses)

  return transactions.filter((transaction) => {
    if (query) {
      const haystack = `${transaction.merchant} ${transaction.description} ${transaction.owner}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    if (dateFloor && new Date(transaction.date) < dateFloor) return false
    if (categorySet.size > 0 && !categorySet.has(transaction.category)) return false
    if (cardSet.size > 0 && !cardSet.has(transaction.card)) return false
    if (statusSet.size > 0 && !statusSet.has(transaction.status)) return false
    if (minAmount !== null && transaction.amount < minAmount) return false
    if (maxAmount !== null && transaction.amount > maxAmount) return false
    return true
  })
}

export function describeFilters(filters: Filters) {
  const chips: Array<{ key: keyof Filters | 'amount'; label: string }> = []

  if (filters.datePreset !== 'all') {
    const labels = { month: 'This month', '30d': 'Last 30 days', '90d': 'Last 90 days', ytd: 'Year to date', all: 'All time' }
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
