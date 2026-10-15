import type { Transaction } from '../data/types'

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`
}

export function buildSpendOverTime(data: Transaction[]) {
  const buckets = new Map<string, { month: string; spend: number }>()
  const now = new Date()

  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    buckets.set(monthKey(date), {
      month: date.toLocaleString('en-US', { month: 'short' }),
      spend: 0,
    })
  }

  for (const transaction of data) {
    const bucket = buckets.get(monthKey(new Date(transaction.date)))
    if (bucket) bucket.spend += transaction.amount
  }

  return Array.from(buckets.values())
}
