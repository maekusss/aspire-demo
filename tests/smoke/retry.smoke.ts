import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { Transaction } from '../../src/data/types'

const [transaction] = JSON.parse(
  readFileSync(new URL('../../public/data/transactions.json', import.meta.url), 'utf8'),
) as Transaction[]

if (!transaction) throw new Error('Retry smoke tests require a generated transaction.')

test('retries a failed first request and keeps active filters', async ({ page }) => {
  let requests = 0
  let retryStarted = false
  let releaseRetry: () => void = () => {}
  const retryResponse = new Promise<void>((resolve) => {
    releaseRetry = resolve
  })

  await page.route('**/data/transactions.json', async (route) => {
    requests += 1
    if (!retryStarted) {
      await route.fulfill({ status: 503, body: 'Unavailable' })
      return
    }
    await retryResponse
    await route.fulfill({ json: [transaction] })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Transactions failed to load' })).toBeVisible()

  await page.getByPlaceholder('Search merchants or descriptions').fill(transaction.merchant)
  await page.getByLabel('Add status filter').selectOption(transaction.status)
  await page.evaluate(() => {
    ;(window as Window & { retryMarker?: string }).retryMarker = 'kept'
  })

  const initialRequests = requests
  retryStarted = true
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByLabel('Loading transactions')).toBeVisible()
  releaseRetry()

  await expect(page.getByTestId('transaction-row')).toContainText(transaction.merchant)
  await expect(page.getByTestId('table-meta')).toContainText('1 of 1 transactions')
  await expect(page.getByPlaceholder('Search merchants or descriptions')).toHaveValue(transaction.merchant)
  await expect(page.getByRole('button', { name: `Status: ${transaction.status}` })).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { retryMarker?: string }).retryMarker)).toBe('kept')
  expect(requests).toBe(initialRequests + 1)
})

test('returns to the error state if retry also fails', async ({ page }) => {
  let requests = 0
  await page.route('**/data/transactions.json', async (route) => {
    requests += 1
    await route.fulfill({ status: 503, body: 'Unavailable' })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Transactions failed to load' })).toBeVisible()
  const initialRequests = requests
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('heading', { name: 'Transactions failed to load' })).toBeVisible()
  expect(requests).toBe(initialRequests + 1)
})
