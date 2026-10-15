import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Filters, SavedView } from '../data/types'
import { emptyFilters } from '../lib/constants'

type AppState = {
  filters: Filters
  activeViewId: string | null
  savedViews: SavedView[]
  theme: 'light' | 'dark'
  setFilters: (filters: Filters) => void
  selectPreset: (preset: 'flagged' | 'month') => void
  patchFilters: (filters: Partial<Filters>) => void
  resetFilters: () => void
  clearFilter: (key: keyof Filters | 'amount') => void
  saveView: (name: string) => void
  loadView: (id: string) => void
  removeView: (id: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
}

const filtersAreEmpty = (filters: Filters) =>
  filters.search === '' &&
  filters.datePreset === 'all' &&
  filters.categories.length === 0 &&
  filters.cards.length === 0 &&
  filters.statuses.length === 0 &&
  filters.minAmount === '' &&
  filters.maxAmount === ''

const manualViewId = (filters: Filters) => (filtersAreEmpty(filters) ? 'all' : null)

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      filters: emptyFilters,
      activeViewId: 'all',
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
      ],
      theme: 'light',
      setFilters: (filters) => set({ filters, activeViewId: manualViewId(filters) }),
      selectPreset: (preset) => {
        const filters: Filters = preset === 'flagged'
          ? { ...emptyFilters, statuses: ['Flagged'] }
          : { ...emptyFilters, datePreset: '30d' }
        set({ filters, activeViewId: preset })
      },
      patchFilters: (patch) =>
        set((state) => {
          const filters = { ...state.filters, ...patch }
          return { filters, activeViewId: manualViewId(filters) }
        }),
      resetFilters: () => set({ filters: emptyFilters, activeViewId: 'all' }),
      clearFilter: (key) =>
        set((state) => {
          if (key === 'amount') {
            const filters = { ...state.filters, minAmount: '', maxAmount: '' }
            return { filters, activeViewId: manualViewId(filters) }
          }
          const filters = { ...state.filters, [key]: emptyFilters[key] }
          return { filters, activeViewId: manualViewId(filters) }
        }),
      saveView: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const view: SavedView = {
          id: `view_${Date.now()}`,
          name: trimmed,
          filters: get().filters,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ savedViews: [view, ...state.savedViews] }))
      },
      loadView: (id) => {
        const view = get().savedViews.find((candidate) => candidate.id === id)
        if (view) set({ filters: view.filters, activeViewId: id })
      },
      removeView: (id) =>
        set((state) => ({
          savedViews: state.savedViews.filter((view) => view.id !== id),
          activeViewId: state.activeViewId === id ? manualViewId(state.filters) : state.activeViewId,
        })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'spendboard-state',
      partialize: (state) => ({
        filters: state.filters,
        activeViewId: state.activeViewId,
        savedViews: state.savedViews,
        theme: state.theme,
      }),
    },
  ),
)
