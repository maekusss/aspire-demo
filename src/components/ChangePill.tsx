import type { Change } from '../lib/compare'
import { formatCompactCurrency, formatRoundedCurrency, numberFormatter } from '../lib/format'

export default function ChangePill({ change, count = false, small = false }: { change: Change; count?: boolean; small?: boolean }) {
  const format = (value: number) => count ? numberFormatter.format(value) : small ? formatCompactCurrency(value) : formatRoundedCurrency(value)
  const percent = change.percent === null ? '' : Math.abs(change.percent) >= 999 ? '>999%' : `${Math.abs(change.percent).toFixed(1)}%`
  let label = 'No spend in either period'
  if (change.kind === 'new') label = `+${format(change.amount)} · New`
  if (change.kind === 'flat') label = 'No change'
  if (change.kind === 'up') label = `▲ +${format(change.amount)} · +${percent}`
  if (change.kind === 'down') label = `▼ −${format(-change.amount)} · −${percent}`
  return <span className={`change-pill pill-${change.kind === 'none' ? 'flat' : change.kind}${small ? ' small' : ''}`}>{label}</span>
}
