import { beforeEach, describe, expect, it } from 'vitest'
import { emptyFilters } from '../lib/constants'
import { useAppStore } from './useAppStore'

const initialViews = useAppStore.getState().savedViews

describe('sidebar view selection', () => {
  beforeEach(() => {
    useAppStore.setState({ filters: emptyFilters, activeViewId: 'all', savedViews: initialViews })
  })

  it('selects a complete preset and clears the previous view', () => {
    const store = useAppStore.getState()
    store.patchFilters({ search: 'test' })
    store.selectPreset('flagged')
    expect(useAppStore.getState()).toMatchObject({
      filters: { ...emptyFilters, statuses: ['Flagged'] },
      activeViewId: 'flagged',
    })

    store.selectPreset('month')
    expect(useAppStore.getState()).toMatchObject({
      filters: { ...emptyFilters, datePreset: '30d' },
      activeViewId: 'month',
    })
  })

  it('clears a saved-view highlight on manual changes and restores All when filters clear', () => {
    const store = useAppStore.getState()
    store.loadView('view_saas_high')
    expect(useAppStore.getState().activeViewId).toBe('view_saas_high')

    store.patchFilters({ search: 'invoice' })
    expect(useAppStore.getState().activeViewId).toBeNull()

    store.clearFilter('search')
    expect(useAppStore.getState().activeViewId).toBeNull()

    store.resetFilters()
    expect(useAppStore.getState().activeViewId).toBe('all')
  })

  it('returns to All when the last filter is removed', () => {
    const store = useAppStore.getState()
    store.selectPreset('flagged')
    store.clearFilter('statuses')
    expect(useAppStore.getState()).toMatchObject({ filters: emptyFilters, activeViewId: 'all' })
  })

  it('clears the highlight when an active saved view is deleted', () => {
    const store = useAppStore.getState()
    store.loadView('view_saas_high')
    store.removeView('view_saas_high')
    expect(useAppStore.getState().activeViewId).toBeNull()
  })
})
