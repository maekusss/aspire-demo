import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, animate, motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  Command,
  Download,
  Flag,
  Moon,
  PanelRight,
  Search,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import type { Filters, Transaction } from './data/types'
import ChangePill from './components/ChangePill'
import ComparePopover from './components/ComparePopover'
import { buildComparison, computeChange } from './lib/compare'
import { statuses, statusTone } from './lib/constants'
import { exportTransactionsCsv } from './lib/exportCsv'
import { describeFilters, filterTransactions } from './lib/filter'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatLongDate,
  formatRoundedCurrency,
  formatRange,
  initials,
  numberFormatter,
} from './lib/format'
import { localDateKey, resolvePeriods } from './lib/periods'
import { useAppStore } from './store/useAppStore'

const SpendCharts = lazy(() => import('./components/SpendCharts'))

type Metric = {
  label: string
  value: number | string
  delta: ReactNode
  tone?: 'positive' | 'negative' | 'neutral'
  format?: (value: number) => string
}

const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'merchant',
    header: 'Merchant',
  },
  {
    accessorKey: 'category',
    header: 'Category',
  },
  {
    accessorKey: 'card',
    header: 'Card',
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
]

function App() {
  const {
    filters,
    savedViews,
    compare,
    compareWarning,
    theme,
    setCompare,
    turnOffCompare,
    clearCompareWarning,
    patchFilters,
    resetFilters,
    clearFilter,
    saveView,
    loadView,
    removeView,
    setTheme,
    toggleTheme,
  } = useAppStore()

  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [commandOpen, setCommandOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [, setDayTick] = useState(0)
  const todayKey = localDateKey(new Date())
  const today = useMemo(() => { const [year, month, day] = todayKey.split('-').map(Number); return new Date(year, month - 1, day) }, [todayKey])
  const [detail, setDetail] = useState<Transaction | null>(null)
  const [activeRowIndex, setActiveRowIndex] = useState(0)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const searchRef = useRef<HTMLInputElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setDayTick((tick) => tick + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (compareWarning) {
      queueMicrotask(() => { setToast(compareWarning); clearCompareWarning() })
    }
  }, [compareWarning, clearCompareWarning])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const requestedTheme = new URLSearchParams(window.location.search).get('theme')
    if (requestedTheme === 'dark' || requestedTheme === 'light') {
      queueMicrotask(() => setTheme(requestedTheme))
    }
  }, [setTheme])

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/transactions.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load transactions: ${response.status}`)
        return response.json() as Promise<Transaction[]>
      })
      .then((data) => {
        if (!cancelled) {
          setTransactions(data.map((transaction) => ({ ...transaction, ts: Date.parse(transaction.date) })))
          setLoadState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })

    return () => {
      cancelled = true
    }
  }, [loadAttempt])

  const categories = useMemo(
    () => Array.from(new Set(transactions.map((transaction) => transaction.category))).sort(),
    [transactions],
  )
  const cards = useMemo(
    () => Array.from(new Set(transactions.map((transaction) => transaction.card))).sort(),
    [transactions],
  )

  const periods = useMemo(() => compare?.on ? resolvePeriods(compare, today) : null, [compare, today])
  const comparison = useMemo(
    () => loadState === 'ready' && periods ? buildComparison(transactions, filters, periods) : null,
    [transactions, filters, periods, loadState],
  )
  const filteredTransactions = useMemo(
    () => loadState !== 'ready' ? [] : comparison ? comparison.rowsA : filterTransactions(transactions, filters),
    [filters, loadState, transactions, comparison],
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredTransactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    isMultiSortEvent: (event) => (event as globalThis.MouseEvent).shiftKey,
  })

  const rows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 44,
    overscan: 16,
  })

  const selectedTransactions = useMemo(
    () => rows.map((row) => row.original).filter((transaction) => selectedIds.has(transaction.id)),
    [rows, selectedIds],
  )

  const selectedTotal = useMemo(
    () => selectedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [selectedTransactions],
  )

  const metrics = useMemo(() => comparison ? [] : buildMetrics(filteredTransactions), [filteredTransactions, comparison])
  const spendOverTime = useMemo(() => comparison ? Array.from({ length: Math.max(comparison.a.buckets.length, comparison.b.buckets.length) }, (_, index) => ({ month: `${comparison.bucketUnit === 'day' ? 'Day' : comparison.bucketUnit === 'week' ? 'Wk' : 'Mo'} ${index + 1}`, spend: comparison.a.buckets[index] ?? null, previousSpend: comparison.b.buckets[index] ?? null })) : buildSpendOverTime(filteredTransactions), [filteredTransactions, comparison])
  const spendByCategory = useMemo(() => comparison ? comparison.categories.map((category) => ({ category, spend: comparison.a.byCategory.get(category) ?? 0, previousSpend: comparison.b.byCategory.get(category) ?? 0 })) : buildSpendByCategory(filteredTransactions), [filteredTransactions, comparison])
  const activeChips = describeFilters(filters, periods, today)

  useEffect(() => { queueMicrotask(() => setSelectedIds(new Set())) }, [filteredTransactions])

  useEffect(() => {
    const shouldOpenDrawer = new URLSearchParams(window.location.search).get('drawer') === '1'
    if (loadState === 'ready' && shouldOpenDrawer && !detail) {
      queueMicrotask(() => setDetail(rows[0]?.original ?? null))
    }
  }, [detail, loadState, rows])

  useEffect(() => {
    setActiveRowIndex((current) => Math.min(current, Math.max(rows.length - 1, 0)))
  }, [rows.length])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT'

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
        return
      }

      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }

      if (commandOpen || isTyping) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveRowIndex((current) => {
          const next =
            event.key === 'ArrowDown'
              ? Math.min(rows.length - 1, current + 1)
              : Math.max(0, current - 1)
          rowVirtualizer.scrollToIndex(next, { align: 'auto' })
          return next
        })
      }

      if (event.key === 'Enter' && rows[activeRowIndex]) {
        setDetail(rows[activeRowIndex].original)
      }

      if (event.key === 'Escape') {
        setDetail(null)
        setCommandOpen(false)
        setSelectedIds(new Set())
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeRowIndex, commandOpen, rowVirtualizer, rows])

  const addListFilter = (key: 'categories' | 'cards' | 'statuses', value: string) => {
    if (!value) return
    const current = filters[key] as string[]
    patchFilters({ [key]: Array.from(new Set([...current, value])) } as Partial<Filters>)
  }

  const handleSaveView = () => {
    setViewName(`${filters.categories[0] ?? 'All spend'}${periods ? `: ${periods.aLabel.toLowerCase()} vs ${periods.bLabel.toLowerCase()}` : ''}`)
    setSaveOpen(true)
  }

  const toggleSelected = (index: number, transaction: Transaction, mode: 'single' | 'range' | 'toggle') => {
    setSelectedIds((current) => {
      const next = new Set(mode === 'single' ? [] : current)

      if (mode === 'range' && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (let cursor = start; cursor <= end; cursor += 1) {
          const row = rows[cursor]
          if (row) next.add(row.original.id)
        }
        return next
      }

      if (mode === 'toggle') {
        if (next.has(transaction.id)) next.delete(transaction.id)
        else next.add(transaction.id)
        return next
      }

      next.add(transaction.id)
      return next
    })
    setLastSelectedIndex(index)
  }

  const handleRowClick = (event: ReactMouseEvent, index: number, transaction: Transaction) => {
    const interactive = (event.target as HTMLElement).closest('button, a, input, select')
    if (interactive) return

    setActiveRowIndex(index)
    if (event.shiftKey) toggleSelected(index, transaction, 'range')
    else if (event.metaKey || event.ctrlKey) toggleSelected(index, transaction, 'toggle')
    else toggleSelected(index, transaction, 'single')
    setDetail(transaction)
  }

  return (
    <div className="app-shell" data-testid="spendboard-app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <WalletCards size={16} />
          </span>
          <span>SpendBoard</span>
        </div>

        <div className="topbar-actions">
          <button className="kbd-button" type="button" onClick={() => setCommandOpen(true)}>
            <Command size={13} /> K
          </button>
          <button className="icon-button" type="button" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <span className="avatar">ZC</span>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar" aria-label="Saved views">
          <div className="side-section">Views</div>
          <button className="side-item active" type="button" onClick={resetFilters}>
            <PanelRight size={14} /> All transactions
          </button>
          <button className="side-item" type="button" onClick={() => patchFilters({ statuses: ['Flagged'] })}>
            <Flag size={14} /> Flagged
          </button>
          <button className="side-item" type="button" onClick={() => patchFilters({ datePreset: '30d' })}>
            <Sparkles size={14} /> This month
          </button>

          <div className="side-section">Saved</div>
          {savedViews.map((view) => (
            <div className="saved-view" key={view.id}>
              <button className="side-item" type="button" onClick={() => loadView(view.id)}>
                <Bookmark size={14} /> {view.name}{view.compare?.on && <span className="saved-compare-tag">⇄</span>}
              </button>
              <button
                className="small-ghost"
                type="button"
                onClick={() => removeView(view.id)}
                aria-label={`Delete ${view.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button className="side-item" type="button" onClick={handleSaveView}>
            <Bookmark size={14} /> New view
          </button>
        </aside>

        <main className="dashboard">
          {loadState === 'error' ? <ErrorState onRetry={() => { setLoadState('loading'); setLoadAttempt((attempt) => attempt + 1) }} /> : <>
          <section className={`metrics-grid${comparison ? ' comparing' : ''}`} aria-label="Summary metrics">
            {loadState === 'loading' ? Array.from({ length: periods ? 3 : 4 }, (_, index) => <div className="metric-card metric-skeleton" key={index}><div className="skeleton-row"><span /><span /></div></div>) : comparison && periods ? <>
              <div className="metric-card compare-card" data-testid="compare-total">
                <div className="metric-label">Total spend · {periods.aLabel}</div>
                <div className="metric-value"><AnimatedNumber value={comparison.a.total} format={formatRoundedCurrency} /></div>
                <ChangePill change={computeChange(comparison.a.total, comparison.b.total)} />
                <div className="compare-vs">vs {formatRoundedCurrency(comparison.b.total)} · {periods.bLabel.toLowerCase()} ({formatRange(periods.b.start, periods.b.endExclusive - 1, today)})</div>
              </div>
              <div className="metric-card compare-card" data-testid="compare-count">
                <div className="metric-label">Transactions · {periods.aLabel}</div>
                <div className="metric-value"><AnimatedNumber value={comparison.a.count} format={numberFormatter.format} /></div>
                <ChangePill count change={computeChange(comparison.a.count, comparison.b.count, true)} />
                <div className="compare-vs">vs {numberFormatter.format(comparison.b.count)} · {periods.bLabel.toLowerCase()} ({formatRange(periods.b.start, periods.b.endExclusive - 1, today)})</div>
              </div>
              <div className="metric-card compare-card compare-categories" data-testid="compare-categories">
                <div className="metric-label compare-cat-header"><span>Top categories · {periods.aLabel}</span><span>change vs {periods.bLabel.toLowerCase()}</span></div>
                {comparison.categories.length ? comparison.categories.slice(0, 5).map((category) => <button className="compare-cat-row" type="button" key={category} onClick={() => addListFilter('categories', category)}>
                  <strong>{category}</strong><span className="compare-cat-values">{formatCompactCurrency(comparison.a.byCategory.get(category) ?? 0)} <small>vs {formatCompactCurrency(comparison.b.byCategory.get(category) ?? 0)}</small></span>
                  <ChangePill small change={computeChange(comparison.a.byCategory.get(category) ?? 0, comparison.b.byCategory.get(category) ?? 0)} />
                </button>) : <div className="compare-vs">No spend in either period</div>}
              </div>
            </> : metrics.map((metric) => <MetricCard metric={metric} key={metric.label} />)}
          </section>

          {loadState === 'loading' ? <ChartFallback /> : comparison && !comparison.a.count && !comparison.b.count ? <section className="chart-row" aria-label="Spend charts"><div className="chart-panel compare-empty">No spend in either period · Remove a filter or pick different periods.</div></section> : <ChartErrorBoundary><Suspense fallback={<ChartFallback />}>
            <SpendCharts spendOverTime={spendOverTime} spendByCategory={spendByCategory} previous={periods ? { aLabel: periods.aLabel, bLabel: periods.bLabel } : undefined} onCategorySelect={(category) => addListFilter('categories', category)} />
          </Suspense></ChartErrorBoundary>}

          <section className="table-panel" aria-label="Transactions">
            <div className="filterbar" data-testid="filterbar">
              <label className="search-field">
                <Search size={14} />
                <input
                  ref={searchRef}
                  value={filters.search}
                  onChange={(event) => patchFilters({ search: event.target.value })}
                  placeholder="Search merchants or descriptions"
                />
                <span>/</span>
              </label>

              {activeChips.map((chip) => (
                <button className="filter-chip active" key={chip.key} type="button" onClick={() => chip.key === 'compare' ? turnOffCompare() : clearFilter(chip.key)}>
                  {chip.label}
                  <X size={12} />
                </button>
              ))}

              {!periods && <select
                className="filter-chip select-chip"
                value={filters.datePreset}
                onChange={(event) => patchFilters({ datePreset: event.target.value as Filters['datePreset'] })}
                aria-label="Date range"
              >
                <option value="all">+ Date</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="ytd">Year to date</option>
              </select>}

              <div className="compare-control">
                <button className={`filter-chip chip-compare${periods ? ' active' : ''}`} type="button" aria-label={periods ? 'Choose comparison periods' : 'Compare'} aria-expanded={compareOpen} onClick={() => setCompareOpen(!compareOpen)}>
                  ⇄ {periods ? `${periods.aLabel} vs ${periods.bLabel}` : 'Compare'} <ChevronDown size={12} />
                </button>
                {periods && <button className="compare-off" type="button" aria-label="Turn off compare" onClick={turnOffCompare}>×</button>}
                <ComparePopover compare={compare} today={today} open={compareOpen} onClose={() => setCompareOpen(false)} onOff={turnOffCompare} onChoose={setCompare} />
              </div>

              <select
                className="filter-chip select-chip"
                value=""
                onChange={(event) => addListFilter('categories', event.target.value)}
                aria-label="Add category filter"
              >
                <option value="">+ Category</option>
                {categories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                className="filter-chip select-chip"
                value=""
                onChange={(event) => addListFilter('cards', event.target.value)}
                aria-label="Add card filter"
              >
                <option value="">+ Card</option>
                {cards.map((card) => (
                  <option value={card} key={card}>
                    {card}
                  </option>
                ))}
              </select>

              <select
                className="filter-chip select-chip"
                value=""
                onChange={(event) => addListFilter('statuses', event.target.value)}
                aria-label="Add status filter"
              >
                <option value="">+ Status</option>
                {statuses.map((status) => (
                  <option value={status} key={status}>
                    {status}
                  </option>
                ))}
              </select>

              <label className="amount-filter">
                <input
                  value={filters.minAmount}
                  onChange={(event) => patchFilters({ minAmount: event.target.value })}
                  inputMode="numeric"
                  placeholder="Min"
                />
                <span>-</span>
                <input
                  value={filters.maxAmount}
                  onChange={(event) => patchFilters({ maxAmount: event.target.value })}
                  inputMode="numeric"
                  placeholder="Max"
                />
              </label>

              <button className="ghost-button" type="button" onClick={resetFilters}>
                Clear
              </button>
              <button className="ghost-button" type="button" onClick={() => exportTransactionsCsv(filteredTransactions)}>
                <Download size={14} /> CSV
              </button>
            </div>

            {periods && <div className="compare-note">Comparing <strong>{formatRange(periods.a.start, periods.a.endExclusive - 1, today)}</strong> ({periods.aDays} days) with <strong>{formatRange(periods.b.start, periods.b.endExclusive - 1, today)}</strong> ({periods.bDays} days). Other filters apply to both. {compare?.preset === 'custom' && periods.lengthsDiffer && <span className="compare-warn">Periods are different lengths</span>}</div>}

            <div className="table-meta" data-testid="table-meta">
              <span>{numberFormatter.format(rows.length)} of {numberFormatter.format(transactions.length)} transactions</span>
              {periods && <span className="compare-scope">Showing {periods.aLabel} · {formatRange(periods.a.start, periods.a.endExclusive - 1, today)} only</span>}
              <span>{formatCompactCurrency(comparison?.a.total ?? (metrics[0]?.value as number ?? 0))} in visible spend</span>
            </div>

            <div className="data-table">
              <div className="table-head">
                <div className="head-cell check-cell">
                  <span className="checkbox-shell" aria-hidden="true" />
                </div>
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    const sortPosition = sorting.findIndex((sort) => sort.id === header.column.id)
                    return (
                      <button
                        className="head-cell"
                        key={header.id}
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' && <ArrowUp size={12} />}
                        {sorted === 'desc' && <ArrowDown size={12} />}
                        {sortPosition > 0 && <span className="sort-rank">{sortPosition + 1}</span>}
                      </button>
                    )
                  }),
                )}
              </div>

              <div className="table-scroll" ref={tableScrollRef}>
                {loadState === 'loading' && <LoadingRows />}
                {loadState === 'ready' && rows.length === 0 && <EmptyState resetFilters={resetFilters} />}
                {loadState === 'ready' && rows.length > 0 && (
                  <div className="virtual-canvas" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = rows[virtualRow.index]
                      const transaction = row.original
                      const selected = selectedIds.has(transaction.id)
                      const focused = virtualRow.index === activeRowIndex

                      return (
                        <div
                          className={`table-row ${selected ? 'selected' : ''} ${focused ? 'focused' : ''}`}
                          data-testid="transaction-row"
                          key={transaction.id}
                          onClick={(event) => handleRowClick(event, virtualRow.index, transaction)}
                          style={{ transform: `translateY(${virtualRow.start}px)` }}
                        >
                          <button
                            className={`checkbox-shell ${selected ? 'checked' : ''}`}
                            type="button"
                            onClick={() => toggleSelected(virtualRow.index, transaction, 'toggle')}
                            aria-label={`Select ${transaction.merchant}`}
                          >
                            {selected && <Check size={11} />}
                          </button>
                          <span className="muted">{formatDate(transaction.date)}</span>
                          <span className="merchant-cell">
                            <span className="merchant-logo">
                              <span>{initials(transaction.merchant)}</span>
                              <img
                                src={transaction.logoUrl}
                                alt=""
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none'
                                }}
                              />
                            </span>
                            <span>
                              <strong>{transaction.merchant}</strong>
                              <small>{transaction.description}</small>
                            </span>
                          </span>
                          <span>
                            <span className="pill info">{transaction.category}</span>
                          </span>
                          <span className="muted">•• {transaction.cardLast4}</span>
                          <span className="amount">{formatCurrency(transaction.amount)}</span>
                          <span>
                            <span className={`pill ${statusTone[transaction.status]}`}>{transaction.status}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
          </>}
        </main>
      </div>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            className="bulk-bar"
            data-testid="bulk-bar"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
          >
            <span>
              <strong>{selectedIds.size} selected</strong> · {formatCurrency(selectedTotal)} total
            </span>
            <div>
              <button type="button">
                <Tag size={14} /> Recategorize
              </button>
              <button type="button">
                <Flag size={14} /> Flag
              </button>
              <button type="button" onClick={() => exportTransactionsCsv(selectedTransactions)}>
                <Download size={14} /> Export
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())}>
                <Trash2 size={14} /> Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DetailDrawer transaction={detail} onClose={() => setDetail(null)} />
      {saveOpen && <div className="save-overlay" onClick={(event) => { if (event.target === event.currentTarget) setSaveOpen(false) }}><div className="save-modal" role="dialog" aria-label="Save view">
        <h2>Save this view</h2><p>It appears under Saved in the sidebar.</p>
        <input autoFocus aria-label="View name" value={viewName} onChange={(event) => setViewName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && viewName.trim()) { saveView(viewName); setSaveOpen(false) } }} />
        <div className="save-summary"><strong>Filters:</strong> {activeChips.filter((chip) => chip.key !== 'compare').map((chip) => chip.label).join(' · ') || 'None'}<br />{periods ? <strong>⇄ Comparing {compare?.preset === 'custom' ? 'fixed dates' : `${periods.aLabel.toLowerCase()} vs ${periods.bLabel.toLowerCase()} — rolls forward automatically`}</strong> : 'No comparison — opens as a single period.'}</div>
        <div className="save-actions"><button type="button" onClick={() => setSaveOpen(false)}>Cancel</button><button type="button" disabled={!viewName.trim()} onClick={() => { saveView(viewName); setSaveOpen(false) }}>Save view</button></div>
      </div></div>}
      {toast && <div className="compare-toast" role="status">{toast}</div>}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        actions={[
          {
            label: 'Compare periods',
            run: () => setCompareOpen(true),
          },
          ...(periods ? [{ label: 'Turn off compare', run: turnOffCompare }] : []),
          {
            label: 'Focus search',
            run: () => searchRef.current?.focus(),
          },
          {
            label: 'Save current view',
            run: handleSaveView,
          },
          {
            label: 'Clear all filters',
            run: resetFilters,
          },
          {
            label: 'Export current view',
            run: () => exportTransactionsCsv(filteredTransactions),
          },
          {
            label: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
            run: toggleTheme,
          },
        ]}
      />
    </div>
  )
}

function ChartFallback() {
  return (
    <section className="chart-row" aria-label="Spend charts">
      <div className="chart-panel">
        <div className="panel-title">Spend over time</div>
        <div className="chart-skeleton" />
      </div>
      <div className="chart-panel">
        <div className="panel-title">Spend by category</div>
        <div className="chart-skeleton" />
      </div>
    </section>
  )
}

class ChartErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { console.warn('Spend charts could not load', error) }
  render() {
    return this.state.failed ? <section className="chart-row" aria-label="Spend charts"><div className="chart-panel compare-empty">Spend charts couldn't load. Cards and transactions are still available.</div></section> : this.props.children
  }
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{metric.label}</div>
      <div className="metric-value">
        {typeof metric.value === 'number' ? (
          <AnimatedNumber value={metric.value} format={metric.format ?? numberFormatter.format} />
        ) : (
          metric.value
        )}
      </div>
      <div className={`metric-delta ${metric.tone ?? 'neutral'}`}>{metric.delta}</div>
    </div>
  )
}

function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)

  useEffect(() => {
    if (previousValue.current === 0 && value !== 0) {
      previousValue.current = value
      setDisplayValue(value)
      return
    }

    const controls = animate(previousValue.current, value, {
      duration: 0.45,
      ease: 'easeOut',
      onUpdate: setDisplayValue,
    })
    previousValue.current = value
    return () => controls.stop()
  }, [value])

  return <>{format(displayValue)}</>
}

function DetailDrawer({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {transaction && (
        <>
          <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            className="detail-drawer"
            data-testid="detail-drawer"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', damping: 30, stiffness: 310 }}
            aria-label="Transaction detail"
          >
            <div className="drawer-head">
              <div>
                <div className="panel-title">Transaction detail</div>
                <h2>{transaction.merchant}</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose} aria-label="Close drawer">
                <X size={16} />
              </button>
            </div>

            <div className="drawer-amount">{formatCurrency(transaction.amount)}</div>
            <span className={`pill ${statusTone[transaction.status]}`}>{transaction.status}</span>

            <dl className="detail-list">
              <div>
                <dt>Date</dt>
                <dd>{formatLongDate(transaction.date)}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{transaction.category}</dd>
              </div>
              <div>
                <dt>Card</dt>
                <dd>{transaction.card} · •• {transaction.cardLast4}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{transaction.owner}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{transaction.location}</dd>
              </div>
              <div>
                <dt>Receipt</dt>
                <dd>{transaction.receipt ? 'Attached' : 'Missing'}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{transaction.description}</dd>
              </div>
            </dl>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function CommandPalette({
  open,
  onClose,
  actions,
}: {
  open: boolean
  onClose: () => void
  actions: Array<{ label: string; run: () => void }>
}) {
  const [query, setQuery] = useState('')
  const visibleActions = actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="command-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="command-scrim" type="button" onClick={onClose} aria-label="Close command palette" />
          <motion.div
            className="command-panel"
            data-testid="command-palette"
            initial={{ y: -16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -16, scale: 0.98 }}
          >
            <div className="command-input">
              <Search size={16} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search actions"
              />
            </div>
            <div className="command-list">
              {visibleActions.map((action) => (
                <button
                  type="button"
                  key={action.label}
                  onClick={() => {
                    action.run()
                    onClose()
                  }}
                >
                  <Command size={14} />
                  {action.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LoadingRows() {
  return (
    <div className="loading-state" aria-label="Loading transactions">
      {Array.from({ length: 12 }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ resetFilters }: { resetFilters: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Search size={20} />
      </div>
      <h2>No transactions match this view</h2>
      <p>Clear a chip or broaden the amount/date range to bring rows back.</p>
      <button className="ghost-button" type="button" onClick={resetFilters}>
        Clear filters
      </button>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon danger-icon">
        <X size={20} />
      </div>
      <h2>Transactions failed to load</h2>
      <p>We couldn't load your transactions. Your filters, saved views and comparison are kept.</p>
      <button className="ghost-button" type="button" onClick={onRetry}>Try again</button>
    </div>
  )
}

function buildMetrics(data: Transaction[]): Metric[] {
  const total = data.reduce((sum, transaction) => sum + transaction.amount, 0)
  const topCategory = topBy(data, (transaction) => transaction.category)
  const topMerchant = topBy(data, (transaction) => transaction.merchant)
  const flagged = data.filter((transaction) => transaction.status === 'Flagged').length
  const mom = calculateMonthDelta(data)

  return [
    {
      label: 'Total spend',
      value: total,
      delta: <><ChangePill change={mom} /><span className="compare-vs">this month vs last month</span></>,
      format: formatCompactCurrency,
    },
    {
      label: 'Transactions',
      value: data.length,
      delta: `${numberFormatter.format(flagged)} flagged`,
      tone: flagged > 0 ? 'negative' : 'neutral',
    },
    {
      label: 'Top category',
      value: topCategory?.label ?? 'None',
      delta: topCategory ? formatCompactCurrency(topCategory.total) : 'No spend',
    },
    {
      label: 'Top merchant',
      value: topMerchant?.label ?? 'None',
      delta: topMerchant ? formatCompactCurrency(topMerchant.total) : 'No spend',
    },
  ]
}

function topBy(data: Transaction[], getLabel: (transaction: Transaction) => string) {
  const totals = new Map<string, number>()
  for (const transaction of data) {
    const label = getLabel(transaction)
    totals.set(label, (totals.get(label) ?? 0) + transaction.amount)
  }
  return Array.from(totals.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)[0]
}

function calculateMonthDelta(data: Transaction[]) {
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  let current = 0
  let previous = 0

  for (const transaction of data) {
    const date = new Date(transaction.date)
    if (date >= thisMonth) current += transaction.amount
    else if (date >= lastMonth && date < thisMonth) previous += transaction.amount
  }

  return computeChange(current, previous)
}

function buildSpendOverTime(data: Transaction[]) {
  const buckets = new Map<string, number>()
  const now = new Date()
  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    buckets.set(date.toLocaleString('en-US', { month: 'short' }), 0)
  }

  for (const transaction of data) {
    const date = new Date(transaction.date)
    const key = date.toLocaleString('en-US', { month: 'short' })
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + transaction.amount)
  }

  return Array.from(buckets.entries()).map(([month, spend]) => ({ month, spend }))
}

function buildSpendByCategory(data: Transaction[]) {
  const totals = new Map<string, number>()
  for (const transaction of data) {
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount)
  }
  return Array.from(totals.entries())
    .map(([category, spend]) => ({ category, spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 7)
}

export default App
