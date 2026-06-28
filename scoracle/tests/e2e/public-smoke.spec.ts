import { expect, test } from '@playwright/test'

test('public home and help are usable', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('button', { name: /help/i })).toBeVisible()
  await page.getByRole('button', { name: /help/i }).click()
  await expect(page.getByRole('dialog', { name: /scoracle help/i })).toBeVisible()
  await expect(page.getByText('Exact score: 5 points.')).toBeVisible()
})
