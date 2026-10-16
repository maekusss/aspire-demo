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

const countLabel = (visible: number) => `${visible.toLocaleString('en-US')} of ${transactions.length.toLocaleString('en-US')} transactions`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('spendboard-app')).toBeVisible()
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(transactions.length))
})

test('renders the high-volume dashboard without layout overflow', async ({ page }) => {
  await expect(page.getByText('SpendBoard')).toBeVisible()
  await expect(page.getByLabel('Summary metrics')).toBeVisible()
  await expect(page.getByLabel('Spend charts')).toBeVisible()
  await expect(page.getByLabel('Transactions')).toBeVisible()
  await expect(page.getByTestId('transaction-row').first()).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )

  expect(hasHorizontalOverflow).toBe(false)
})

test('filters transactions by search, status, and saved view', async ({ page }) => {
  await page.getByPlaceholder('Search merchants or descriptions').fill(latestTransaction.merchant)

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

test('compares periods, validates custom dates, and restores a saved comparison', async ({ page }) => {
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await page.getByRole('button', { name: /Quarter to date vs same point last quarter/ }).click()
  await expect(page.getByTestId('compare-total')).toContainText('vs')
  await expect(page.getByTestId('compare-total').locator('.change-pill')).toBeVisible()
  await expect(page.getByTestId('table-meta')).toContainText('only')
  await expect(page.getByLabel('Date range')).toHaveCount(0)

  await page.getByRole('button', { name: 'Choose comparison periods' }).click()
  await page.getByRole('button', { name: /Year to date vs same dates last year/ }).click()
  const before = await page.getByTestId('compare-total').textContent()
  await page.getByLabel('Add category filter').selectOption('SaaS')
  await expect(page.getByTestId('compare-total')).not.toHaveText(before ?? '')

  await page.getByRole('button', { name: 'Choose comparison periods' }).click()
  await page.getByRole('button', { name: /Custom ranges/ }).click()
  await page.getByLabel('Period A start').fill('2026-10-16')
  await page.getByLabel('Period A end').fill('2026-10-01')
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByLabel('View name').fill('SaaS YTD comparison')
  await page.getByRole('button', { name: 'Save view' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'SaaS YTD comparison ⇄', exact: true }).click()
  await expect(page.getByTestId('compare-total')).toBeVisible()
  await expect(page.getByTestId('table-meta')).toContainText('Year to date')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false)
  await page.getByRole('button', { name: 'Turn off compare' }).click()
  await expect(page.getByLabel('Date range')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Category: SaaS' })).toBeVisible()
})

test('keeps the dashboard recoverable after a data load failure', async ({ page }) => {
  await page.route('**/data/transactions.json', (route) => route.fulfill({ status: 500, body: 'unavailable' }))
  await page.reload()
  await expect(page.getByText('Transactions failed to load')).toBeVisible()
  await page.unroute('**/data/transactions.json')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByTestId('table-meta')).toContainText(countLabel(transactions.length))
})
