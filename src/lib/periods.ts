import type { CompareSetting, PeriodPresetId, ResolvedPeriods } from '../data/types'

export const periodPresets: Array<{ id: Exclude<PeriodPresetId, 'custom'>; label: string }> = [
  { id: 'mtd', label: 'Month to date vs same point last month' },
  { id: '30d', label: 'Last 30 days vs prior 30 days' },
  { id: 'qtd', label: 'Quarter to date vs same point last quarter' },
  { id: '90d', label: 'Last 90 days vs prior 90 days' },
  { id: 'ytd', label: 'Year to date vs same dates last year' },
]

export function localDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function calendarDays(start: Date, end: Date) {
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  return day(end) - day(start) + 1
}

function range(start: Date, end: Date) {
  return { start: start.getTime(), endExclusive: addDays(end, 1).getTime() }
}

export function validateCustom(custom: CompareSetting['custom'], today = new Date()) {
  const check = (startValue: string | undefined, endValue: string | undefined) => {
    const start = localDate(startValue ?? '')
    const end = localDate(endValue ?? '')
    if (!start || !end) return 'Pick a start and end date.'
    if (start > end) return 'Start date must be on or before the end date.'
    if (end > new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return `Data only goes up to ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
    }
    return null
  }
  return { a: check(custom?.aStart, custom?.aEnd), b: check(custom?.bStart, custom?.bEnd) }
}

export function resolvePeriods(setting: CompareSetting, today: Date): ResolvedPeriods {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const year = day.getFullYear()
  const month = day.getMonth()
  let aStart: Date
  let aEnd = day
  let bStart: Date
  let bEnd: Date
  let aLabel: string
  let bLabel: string
  switch (setting.preset) {
    case 'mtd':
      aStart = new Date(year, month, 1)
      bStart = new Date(year, month - 1, 1)
      bEnd = new Date(year, month - 1, Math.min(day.getDate(), new Date(year, month, 0).getDate()))
      aLabel = 'Month to date'; bLabel = 'Same point last month'
      break
    case '30d':
    case '90d': {
      const count = setting.preset === '30d' ? 30 : 90
      aStart = addDays(day, 1 - count)
      bStart = addDays(aStart, -count)
      bEnd = addDays(aStart, -1)
      aLabel = `Last ${count} days`; bLabel = `Prior ${count} days`
      break
    }
    case 'qtd': {
      const quarterMonth = Math.floor(month / 3) * 3
      aStart = new Date(year, quarterMonth, 1)
      bStart = new Date(year, quarterMonth - 3, 1)
      const previousQuarterEnd = new Date(year, quarterMonth, 0)
      const alignedEnd = addDays(bStart, calendarDays(aStart, day) - 1)
      bEnd = alignedEnd > previousQuarterEnd ? previousQuarterEnd : alignedEnd
      aLabel = 'Quarter to date'; bLabel = 'Same point last quarter'
      break
    }
    case 'ytd':
      aStart = new Date(year, 0, 1)
      bStart = new Date(year - 1, 0, 1)
      bEnd = new Date(year - 1, month, Math.min(day.getDate(), new Date(year - 1, month + 1, 0).getDate()))
      aLabel = 'Year to date'; bLabel = 'Same dates last year'
      break
    case 'custom': {
      const errors = validateCustom(setting.custom, day)
      if (errors.a || errors.b || !setting.custom) throw new Error('Invalid custom comparison')
      aStart = localDate(setting.custom.aStart)!
      aEnd = localDate(setting.custom.aEnd)!
      bStart = localDate(setting.custom.bStart)!
      bEnd = localDate(setting.custom.bEnd)!
      aLabel = 'Period A'; bLabel = 'Period B'
      break
    }
    default:
      throw new Error('Unknown comparison preset')
  }
  const aDays = calendarDays(aStart, aEnd)
  const bDays = calendarDays(bStart, bEnd)
  return { a: range(aStart, aEnd), b: range(bStart, bEnd), aLabel, bLabel, aDays, bDays, lengthsDiffer: aDays !== bDays }
}
