import { useEffect, useRef, useState } from 'react'
import type { CompareSetting, PeriodPresetId } from '../data/types'
import { formatRange } from '../lib/format'
import { localDateKey, periodPresets, resolvePeriods, validateCustom } from '../lib/periods'

type Props = {
  compare: CompareSetting | null
  today: Date
  onChoose: (setting: CompareSetting) => void
  onOff: () => void
  open: boolean
  onClose: () => void
}

export default function ComparePopover({ compare, today, onChoose, onOff, open, onClose }: Props) {
  const popover = useRef<HTMLDivElement>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [draft, setDraft] = useState<NonNullable<CompareSetting['custom']>>(() => {
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const date = (offset: number) => { const d = new Date(end); d.setDate(d.getDate() + offset); return localDateKey(d) }
    return { aStart: date(-6), aEnd: date(0), bStart: date(-13), bEnd: date(-7) }
  })
  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => { if (!popover.current?.parentElement?.contains(event.target as Node)) onClose() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape) }
  }, [open, onClose])
  if (!open) return null
  const errors = validateCustom(draft, today)
  const choose = (preset: PeriodPresetId) => { onChoose({ on: true, preset, custom: preset === 'custom' ? draft : null }); onClose() }
  return <div className="compare-popover" ref={popover} role="dialog" aria-label="Compare periods">
    {customOpen ? <>
      <div className="compare-pop-head"><button type="button" onClick={() => setCustomOpen(false)}>‹ Presets</button><strong>Custom ranges</strong></div>
      {(['a', 'b'] as const).map((period) => <fieldset className="compare-custom" key={period}>
        <legend>Period {period.toUpperCase()} · {period === 'a' ? 'the one you care about' : 'compare against'}</legend>
        <div className="compare-date-row">
          {(['Start', 'End'] as const).map((part) => {
            const key = `${period}${part}` as keyof typeof draft
            return <input key={key} aria-label={`Period ${period.toUpperCase()} ${part.toLowerCase()}`} className={errors[period] ? 'bad' : ''} type="date" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
          })}
        </div>
        {errors[period] && <p className="compare-error">{errors[period]}</p>}
      </fieldset>)}
      <div className="compare-pop-actions"><button type="button" onClick={onClose}>Cancel</button><button className="compare-apply" type="button" disabled={!!(errors.a || errors.b)} onClick={() => choose('custom')}>Compare</button></div>
    </> : <>
      <div className="compare-pop-head"><strong>Compare periods</strong>{compare?.on ? <button type="button" className="danger-link" onClick={() => { onOff(); onClose() }}>Turn off</button> : <span>Pick two periods</span>}</div>
      {periodPresets.map((preset) => {
        const selected = compare?.on && compare.preset === preset.id
        const resolved = resolvePeriods({ on: true, preset: preset.id, custom: null }, today)
        return <button className={`compare-preset${selected ? ' selected' : ''}`} type="button" key={preset.id} onClick={() => choose(preset.id)}>
          <span>{selected && '✓ '}{preset.label}</span>
          <small>{formatRange(resolved.a.start, resolved.a.endExclusive - 1, today)} vs {formatRange(resolved.b.start, resolved.b.endExclusive - 1, today)}</small>
        </button>
      })}
      <div className="compare-pop-foot"><button type="button" onClick={() => { if (compare?.custom) setDraft(compare.custom); setCustomOpen(true) }}>{compare?.on && compare.preset === 'custom' ? '✓ Custom ranges — edit…' : 'Custom ranges…'}</button></div>
    </>}
  </div>
}
