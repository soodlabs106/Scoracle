import { expect, test } from '@playwright/test'

const password = 'Scoracle!123'

async function login(page, email: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('normal user can open profile and is denied admin access', async ({ page }) => {
  await login(page, 'e2e.user@scoracle.local')
  await expect(page.getByText('E2EUser', { exact: true })).toBeVisible()

  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await expect(page.getByText('e2e.user@scoracle.local').first()).toBeVisible()

  await page.goto('/admin-soodlabs')
  await expect(page.getByText('Access denied.')).toBeVisible()
})

test('disabled user is immediately signed out', async ({ page }) => {
  await login(page, 'e2e.disabled@scoracle.local')
  await expect(
    page.getByText('Your account has been disabled. Contact the Scoracle admin.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})

test('database admin can open the protected admin page', async ({ page }) => {
  await login(page, 'e2e.admin@scoracle.local')
  await expect(page.getByText('E2EAdmin', { exact: true })).toBeVisible()
  await page.goto('/admin-soodlabs')
  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
  await expect(page.getByText('E2EUser', { exact: true })).toBeVisible()
})
