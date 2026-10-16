export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const numberFormatter = new Intl.NumberFormat('en-US')
export const roundedCurrencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function formatRoundedCurrency(value: number) { return roundedCurrencyFormatter.format(value) }

export function formatCompactCurrency(value: number) {
  return compactCurrencyFormatter.format(value)
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function formatRange(start: number, end: number, today = new Date()) {
  const a = new Date(start)
  const b = new Date(end)
  const monthDay = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const year = b.getFullYear() !== today.getFullYear() || a.getFullYear() !== b.getFullYear() ? `, ${b.getFullYear()}` : ''
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return a.getDate() === b.getDate() ? `${monthDay(a)}${year}` : `${monthDay(a)}–${b.getDate()}${year}`
  }
  return `${monthDay(a)} – ${monthDay(b)}${year}`
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
