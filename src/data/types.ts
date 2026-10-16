export type TransactionStatus = 'Cleared' | 'Pending' | 'Flagged' | 'Declined'

export type Transaction = {
  id: string
  date: string
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

export type Filters = {
  search: string
  datePreset: 'all' | 'month' | '30d' | '90d' | 'ytd'
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
  createdAt: string
}
