export type TransactionStatus = 'Cleared' | 'Pending' | 'Flagged' | 'Declined'

export type Transaction = {
  id: string
  date: string
  ts?: number
  merchant: string
  merchantId: string
  domain: string
  logoUrl: string
  category: string
  card: string
  cardLast4: string
  amount: number
  status: TransactionStatus
  description: string
  owner: string
  location: string
  receipt: boolean
}

export type PeriodPresetId = 'mtd' | '30d' | 'qtd' | '90d' | 'ytd' | 'custom'

export type CompareSetting = {
  on: boolean
  preset: PeriodPresetId
  custom: { aStart: string; aEnd: string; bStart: string; bEnd: string } | null
}

export type ResolvedPeriods = {
  a: { start: number; endExclusive: number }
  b: { start: number; endExclusive: number }
  aLabel: string
  bLabel: string
  aDays: number
  bDays: number
  lengthsDiffer: boolean
}

export type PeriodAggregate = {
  total: number
  count: number
  byCategory: Map<string, number>
  buckets: number[]
}

export type ComparisonResult = {
  a: PeriodAggregate
  b: PeriodAggregate
  rowsA: Transaction[]
  bucketUnit: 'day' | 'week' | 'month'
  categories: string[]
}

export type Filters = {
  search: string
  datePreset: 'all' | '30d' | '90d' | 'ytd'
  categories: string[]
  cards: string[]
  statuses: TransactionStatus[]
  minAmount: string
  maxAmount: string
}

export type SavedView = {
  id: string
  name: string
  filters: Filters
  compare?: CompareSetting | null
  createdAt: string
}
