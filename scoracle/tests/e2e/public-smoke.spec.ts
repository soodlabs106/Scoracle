import { expect, test } from '@playwright/test'

test('public home and help are usable', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByText('General Chat')).toHaveCount(0)
  await expect(page.getByTestId('leader-stats-column')).toBeVisible()
  await expect(page.getByText('Pre-season').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Manchester United' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Wrexham' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'All' }).nth(1).click()
  await expect(page.getByRole('button', { name: 'PS', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'MW 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: /help/i })).toBeVisible()
  await page.getByRole('button', { name: /help/i }).click()
  await expect(page.getByRole('dialog', { name: /scoracle help/i })).toBeVisible()
  await expect(page.getByText('Exact score: 5 points.')).toBeVisible()
})
