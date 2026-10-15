import type { Transaction } from '../data/types'

export function calculateMonthDelta(
  data: Pick<Transaction, 'date' | 'amount'>[],
  now = new Date(),
) {
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  let current = 0
  let previous = 0

  for (const transaction of data) {
    const date = new Date(transaction.date)
    if (date >= thisMonth && date < nextMonth) current += transaction.amount
    else if (date >= lastMonth && date < thisMonth) previous += transaction.amount
  }

  if (previous === 0) return { delta: 'No spend last month', tone: 'neutral' as const }

  const percent = ((current - previous) / previous) * 100
  return {
    delta: `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}% MoM`,
    tone: percent >= 0 ? 'positive' as const : 'negative' as const,
  }
}
