import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CompareSetting, Filters, SavedView } from '../data/types'
import { emptyFilters } from '../lib/constants'
import { periodPresets, validateCustom } from '../lib/periods'

export function normalizeCompare(value: CompareSetting | null | undefined): CompareSetting | null {
  if (!value) return null
  if (value.preset === 'custom') {
    const errors = validateCustom(value.custom)
    if (errors.a || errors.b) { console.warn('Saved comparison could not be restored'); return null }
  } else if (!periodPresets.some((preset) => preset.id === value.preset)) {
    console.warn('Unknown comparison preset; using month to date')
    return { on: value.on, preset: 'mtd', custom: null }
  }
  return value
}

export function migrateAppState(persisted: unknown) {
  return { ...(persisted as Pick<AppState, 'filters' | 'savedViews' | 'theme'>), compare: null }
}

type AppState = {
  filters: Filters
  compare: CompareSetting | null
  compareWarning: string | null
  savedViews: SavedView[]
  theme: 'light' | 'dark'
  setFilters: (filters: Filters) => void
  setCompare: (setting: CompareSetting) => void
  turnOffCompare: () => void
  clearCompareWarning: () => void
  patchFilters: (filters: Partial<Filters>) => void
  resetFilters: () => void
  clearFilter: (key: keyof Filters | 'amount') => void
  saveView: (name: string) => void
  loadView: (id: string) => void
  removeView: (id: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      filters: emptyFilters,
      compare: null,
      compareWarning: null,
      savedViews: [
        {
          id: 'view_saas_high',
          name: 'SaaS > $500',
          filters: { ...emptyFilters, categories: ['SaaS'], minAmount: '500' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'view_travel_90',
          name: 'Travel Q3',
          filters: { ...emptyFilters, categories: ['Travel'], datePreset: '90d' },
          createdAt: new Date().toISOString(),
        },
        {
          id: 'view_travel_qtd',
          name: 'Travel: quarter vs last',
          filters: { ...emptyFilters, categories: ['Travel'] },
          compare: { on: true, preset: 'qtd', custom: null },
          createdAt: new Date().toISOString(),
        },
      ],
      theme: 'light',
      setFilters: (filters) => set({ filters }),
      setCompare: (setting) => {
        if (setting.preset === 'custom') {
          const errors = validateCustom(setting.custom)
          if (errors.a || errors.b) return
        }
        set({ compare: normalizeCompare(setting) })
      },
      turnOffCompare: () => set((state) => ({ compare: { ...(state.compare ?? { preset: 'mtd', custom: null }), on: false } })),
      clearCompareWarning: () => set({ compareWarning: null }),
      patchFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
      resetFilters: () => set({ filters: emptyFilters }),
      clearFilter: (key) =>
        set((state) => {
          if (key === 'amount') {
            return { filters: { ...state.filters, minAmount: '', maxAmount: '' } }
          }
          return { filters: { ...state.filters, [key]: emptyFilters[key] } }
        }),
      saveView: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const view: SavedView = {
          id: `view_${Date.now()}`,
          name: trimmed,
          filters: get().filters,
          compare: get().compare?.on ? { ...get().compare! } : null,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ savedViews: [view, ...state.savedViews] }))
      },
      loadView: (id) => {
        const view = get().savedViews.find((candidate) => candidate.id === id)
        if (view) {
          const restored = normalizeCompare(view.compare)
          set({ filters: view.filters, compare: restored?.on ? restored : { ...(get().compare ?? { preset: 'mtd', custom: null }), on: false }, compareWarning: view.compare?.on && !restored ? "Saved comparison couldn't be restored" : null })
        }
      },
      removeView: (id) => set((state) => ({ savedViews: state.savedViews.filter((view) => view.id !== id) })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'spendboard-state',
      version: 2,
      migrate: migrateAppState,
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const restored = normalizeCompare(state.compare)
        if (state.compare?.on && !restored) {
          state.compare = null
          state.compareWarning = "Saved comparison couldn't be restored"
        } else state.compare = restored
      },
      partialize: (state) => ({
        filters: state.filters,
        compare: state.compare,
        savedViews: state.savedViews,
        theme: state.theme,
      }),
    },
  ),
)
