import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Filters, SavedView } from '../data/types'
import { emptyFilters } from '../lib/constants'

type AppState = {
  filters: Filters
  savedViews: SavedView[]
  theme: 'light' | 'dark'
  setFilters: (filters: Filters) => void
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
      setFilters: (filters) => set({ filters: { ...emptyFilters, ...filters } }),
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
          filters: { ...get().filters },
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ savedViews: [view, ...state.savedViews] }))
      },
      loadView: (id) => {
        const view = get().savedViews.find((candidate) => candidate.id === id)
        if (view) set({ filters: { ...emptyFilters, ...view.filters } })
      },
      removeView: (id) => set((state) => ({ savedViews: state.savedViews.filter((view) => view.id !== id) })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'spendboard-state',
      partialize: (state) => ({
        filters: state.filters,
        savedViews: state.savedViews,
        theme: state.theme,
      }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<AppState>
        return {
          ...current,
          ...stored,
          filters: { ...emptyFilters, ...stored.filters },
          savedViews: stored.savedViews ?? current.savedViews,
        }
      },
    },
  ),
)
