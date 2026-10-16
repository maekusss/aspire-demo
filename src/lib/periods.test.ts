import { describe, expect, it } from 'vitest'
import type { CompareSetting } from '../data/types'
import { localDate, resolvePeriods, validateCustom } from './periods'

const setting = (preset: CompareSetting['preset'], custom: CompareSetting['custom'] = null): CompareSetting => ({ on: true, preset, custom })
const key = (time: number) => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const range = (preset: CompareSetting['preset'], today: Date) => {
  const p = resolvePeriods(setting(preset), today)
  return [key(p.a.start), key(p.a.endExclusive - 1), key(p.b.start), key(p.b.endExclusive - 1)]
}

describe('resolvePeriods', () => {
  it('resolves all aligned presets on October 16', () => {
    const today = new Date(2026, 9, 16)
    expect(range('mtd', today)).toEqual(['2026-10-01', '2026-10-16', '2026-09-01', '2026-09-16'])
    expect(range('30d', today)).toEqual(['2026-09-17', '2026-10-16', '2026-08-18', '2026-09-16'])
    expect(range('qtd', today)).toEqual(['2026-10-01', '2026-10-16', '2026-07-01', '2026-07-16'])
    expect(range('90d', today)).toEqual(['2026-07-19', '2026-10-16', '2026-04-20', '2026-07-18'])
    expect(range('ytd', today)).toEqual(['2026-01-01', '2026-10-16', '2025-01-01', '2025-10-16'])
  })
  it('clamps month and year comparisons and crosses the year at quarter start', () => {
    expect(range('mtd', new Date(2026, 2, 31))[3]).toBe('2026-02-28')
    expect(range('mtd', new Date(2024, 2, 31))[3]).toBe('2024-02-29')
    expect(range('qtd', new Date(2026, 0, 1)).slice(2)).toEqual(['2025-10-01', '2025-10-01'])
    expect(range('ytd', new Date(2024, 1, 29))[3]).toBe('2023-02-28')
  })
  it('preserves custom local days and flags different lengths', () => {
    const p = resolvePeriods(setting('custom', { aStart: '2026-10-01', aEnd: '2026-10-07', bStart: '2026-09-01', bEnd: '2026-09-03' }), new Date(2026, 9, 16))
    expect([p.aDays, p.bDays, p.lengthsDiffer]).toEqual([7, 3, true])
    expect(key(p.a.start)).toBe('2026-10-01')
  })
  it('uses local midnight through daylight saving transitions', () => {
    const p = resolvePeriods(setting('custom', { aStart: '2026-03-07', aEnd: '2026-03-09', bStart: '2026-02-01', bEnd: '2026-02-03' }), new Date(2026, 9, 16))
    expect(p.aDays).toBe(3)
    expect(new Date(p.a.start).getHours()).toBe(0)
    expect(new Date(p.a.endExclusive).getDate()).toBe(10)
  })
  it('rejects impossible and future dates', () => {
    expect(localDate('2026-02-30')).toBeNull()
    expect(validateCustom({ aStart: '2026-10-17', aEnd: '2026-10-16', bStart: '', bEnd: '' }, new Date(2026, 9, 16))).toEqual({ a: 'Start date must be on or before the end date.', b: 'Pick a start and end date.' })
  })
})
