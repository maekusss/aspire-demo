import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { Transaction } from '../../src/data/types'

const transactions = JSON.parse(
  readFileSync(new URL('../../public/data/transactions.json', import.meta.url), 'utf8'),
) as Transaction[]

const latestTransaction = [...transactions].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
)[0]

if (!latestTransaction) {
  throw new Error('SpendBoard smoke tests require at least one generated transaction.')
}
const searchCount = transactions.filter((transaction) => {
  const haystack = `${transaction.merchant} ${transaction.description} ${transaction.owner}`.toLowerCase()
  return haystack.includes(latestTransaction.merchant.toLowerCase())
}).length
const flaggedCount = transactions.filter((transaction) => transaction.status === 'Flagged').length
const missingReceipts = transactions.filter((transaction) => transaction.receipt === false)
const missingFlaggedCount = missingReceipts.filter((transaction) => transaction.status === 'Flagged').length

const countLabel = (visible: number) => `${visible.toLocaleString('en-US')} of ${transactions.length.toLocaleString('en-US')} transactions`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('spendboard-app')).toBeVisible()
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(transactions.length), { timeout: 15_000 })
})

test('renders the high-volume dashboard without layout overflow', async ({ page }) => {
  await expect(page.getByText('SpendBoard')).toBeVisible()
  await expect(page.getByLabel('Summary metrics')).toBeVisible()
  await expect(page.getByLabel('Spend charts')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Transactions' })).toBeVisible()
  await expect(page.getByTestId('transaction-row').first()).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )

  expect(hasHorizontalOverflow).toBe(false)
})

test('filters transactions by search, status, and saved view', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Search transactions' }).fill(latestTransaction.merchant)

  await expect(page.getByTestId('table-meta')).toContainText(countLabel(searchCount))
  await expect(page.getByTestId('transaction-row').first()).toContainText(latestTransaction.merchant)

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(transactions.length))

  await page.getByLabel('Add status filter').selectOption('Flagged')
  await expect(page.getByRole('button', { name: 'Status: Flagged' })).toBeVisible()
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(flaggedCount))

  await page.getByRole('button', { name: 'SaaS > $500', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Category: SaaS' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Amount: 500-any' })).toBeVisible()
})

test('filters missing receipts, clears the chip, and restores a saved view after reload', async ({ page }) => {
  test.setTimeout(60_000)
  const receipt = page.getByRole('combobox', { name: 'Receipt' })
  await receipt.selectOption('missing')
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(missingReceipts.length))
  await expect(page.getByRole('button', { name: 'Receipt: Missing' })).toBeVisible()

  await page.getByLabel('Add status filter').selectOption('Flagged')
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(missingFlaggedCount))
  await page.getByRole('button', { name: 'Status: Flagged' }).click()
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(missingReceipts.length))

  page.once('dialog', (dialog) => dialog.accept('Friday missing receipts'))
  await page.getByRole('button', { name: 'New view' }).click()
  await expect(page.getByRole('button', { name: 'Friday missing receipts', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Receipt: Missing' }).click()
  await expect(receipt).toHaveValue('all')
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(transactions.length))

  await page.reload()
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(transactions.length))
  await page.getByRole('button', { name: 'Friday missing receipts', exact: true }).click()
  await expect(receipt).toHaveValue('missing')
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(missingReceipts.length))

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV' }).click()
  const download = await downloadPromise
  const csv = readFileSync(await download.path(), 'utf8')
  expect(csv.trimEnd().split('\n')).toHaveLength(missingReceipts.length + 1)
})

test('loads an older saved view without a receipt field as All', async ({ page }) => {
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('spendboard-state') ?? '{"state":{}}')
    const filters = {
      search: '', datePreset: 'all', categories: [], cards: [], statuses: [], minAmount: '', maxAmount: '',
    }
    stored.state.filters = { ...filters, receipt: 'missing' }
    stored.state.savedViews = [{ id: 'legacy', name: 'Legacy view', filters, createdAt: '2026-01-01T00:00:00.000Z' }]
    localStorage.setItem('spendboard-state', JSON.stringify(stored))
  })
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Receipt' })).toHaveValue('missing')
  await page.getByRole('button', { name: 'Legacy view', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Receipt' })).toHaveValue('all')
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(transactions.length))
})

test('keeps filter inputs named and preserves amount and search shortcuts', async ({ page }) => {
  const search = page.getByRole('textbox', { name: 'Search transactions' })
  const minimum = page.getByRole('textbox', { name: 'Minimum amount' })
  const maximum = page.getByRole('textbox', { name: 'Maximum amount' })

  await page.keyboard.press('/')
  await expect(search).toBeFocused()

  await minimum.fill('500')
  await maximum.fill('1000')

  const amountCount = transactions.filter((transaction) => transaction.amount >= 500 && transaction.amount <= 1000).length
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(amountCount))
  await expect(minimum).toHaveValue('500')
  await expect(maximum).toHaveValue('1000')

  await search.fill(latestTransaction.merchant)
  const combinedCount = transactions.filter((transaction) =>
    transaction.amount >= 500 &&
    transaction.amount <= 1000 &&
    `${transaction.merchant} ${transaction.description} ${transaction.owner}`
      .toLowerCase()
      .includes(latestTransaction.merchant.toLowerCase()),
  ).length
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(combinedCount))
  await expect(search).toHaveValue(latestTransaction.merchant)
})

test('opens transaction details, selection bulk actions, and command palette', async ({ page }) => {
  await page.getByTestId('transaction-row').first().click()

  await expect(page.getByTestId('detail-drawer')).toBeVisible()
  await expect(page.getByTestId('detail-drawer')).toContainText(latestTransaction.merchant)
  await expect(page.getByTestId('bulk-bar')).toContainText('1 selected')

  await page.getByRole('button', { name: 'Close drawer' }).click()
  await expect(page.getByTestId('detail-drawer')).toBeHidden()
  await page.getByTestId('bulk-bar').getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByTestId('bulk-bar')).toBeHidden()

  await page.keyboard.press('Control+K')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByPlaceholder('Search actions').fill('export')
  await expect(page.getByRole('button', { name: 'Export current view' })).toBeVisible()
})

test('exports the current transaction view as CSV', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download')

  await page.getByRole('button', { name: 'CSV' }).click()

  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('spendboard-transactions.csv')
})
