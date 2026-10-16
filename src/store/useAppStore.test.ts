import { beforeEach, describe, expect, it } from 'vitest'
import type { CompareSetting } from '../data/types'
import { emptyFilters } from '../lib/constants'
import { migrateAppState, normalizeCompare, useAppStore } from './useAppStore'

const qtd: CompareSetting = { on: true, preset: 'qtd', custom: null }

beforeEach(() => useAppStore.setState({ filters: emptyFilters, compare: null, savedViews: [] }))

describe('comparison persistence', () => {
  it('migrates v1 data while preserving filters and views', async () => {
    const old = { filters: { ...emptyFilters, categories: ['Travel'] }, savedViews: [], theme: 'dark' as const }
    expect(migrateAppState(old)).toEqual({ ...old, compare: null })
  })
  it('saves and reloads the filters and relative comparison', () => {
    useAppStore.getState().patchFilters({ categories: ['SaaS'] })
    useAppStore.getState().setCompare(qtd)
    useAppStore.getState().saveView('SaaS QTD')
    const id = useAppStore.getState().savedViews[0].id
    useAppStore.getState().turnOffCompare()
    useAppStore.getState().resetFilters()
    useAppStore.getState().loadView(id)
    expect(useAppStore.getState().filters.categories).toEqual(['SaaS'])
    expect(useAppStore.getState().compare).toEqual(qtd)
  })
  it('turns compare off for legacy views', () => {
    useAppStore.setState({ compare: qtd, savedViews: [{ id: 'old', name: 'Old', filters: { ...emptyFilters, categories: ['Travel'] }, createdAt: '' }] })
    useAppStore.getState().loadView('old')
    expect(useAppStore.getState().filters.categories).toEqual(['Travel'])
    expect(useAppStore.getState().compare?.on).toBe(false)
  })
  it('rejects invalid custom ranges without replacing the prior state', () => {
    useAppStore.getState().setCompare(qtd)
    useAppStore.getState().setCompare({ on: true, preset: 'custom', custom: { aStart: '2026-10-20', aEnd: '2026-10-10', bStart: '', bEnd: '' } })
    expect(useAppStore.getState().compare).toEqual(qtd)
  })
  it('rejects corrupt saved custom ranges and falls back for removed presets', () => {
    expect(normalizeCompare({ on: true, preset: 'custom', custom: { aStart: 'bad', aEnd: '', bStart: '', bEnd: '' } })).toBeNull()
    expect(normalizeCompare({ on: true, preset: 'removed' as CompareSetting['preset'], custom: null })?.preset).toBe('mtd')
  })
})
