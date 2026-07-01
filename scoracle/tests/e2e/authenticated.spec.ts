import { expect, test, type Page } from '@playwright/test'

const password = 'Scoracle!123'

async function login(page: Page, email: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport)
}

test('normal user can open profile and is denied admin access', async ({ page }) => {
  await login(page, 'e2e.user@scoracle.local')
  await expect(page.getByText('E2EUser', { exact: true })).toBeVisible()
  await expect(page.getByTestId('authenticated-chat-column')).toBeVisible()
  await expect(page.getByTestId('leader-stats-column')).toHaveCount(0)

  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await expect(page.getByText('e2e.user@scoracle.local').first()).toBeVisible()

  await page.goto('/admin-soodlabs')
  await expect(page.getByText('Access denied.')).toBeVisible()
})

test('mobile chat is collapsed above predictions and can be opened', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, 'e2e.user@scoracle.local')

  const chat = page.getByTestId('authenticated-chat-column')
  const predictions = page.getByText('Predictions', { exact: true })
  await expect(chat).toBeVisible()
  await expect(chat.getByLabel('Chat messages')).toBeHidden()
  const chatBox = await chat.boundingBox()
  const predictionsBox = await predictions.boundingBox()
  expect(chatBox?.y).toBeLessThan(predictionsBox?.y ?? 0)

  await chat.getByRole('button', { name: /general chat/i }).click()
  await expect(chat.getByLabel('Chat messages')).toBeVisible()
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

  await page.getByRole('tab', { name: 'System Maintenance' }).click()
  await expect(
    page.getByRole('heading', { name: 'Supabase Maintenance Logs' }),
  ).toBeVisible()
  await expect(page.getByText('github-daily-maintenance').first()).toBeVisible()
})

test('signed-in pages do not overflow mobile or tablet viewports', async ({ page }) => {
  await login(page, 'e2e.user@scoracle.local')
  await expect(page.getByText('E2EUser', { exact: true })).toBeVisible()

  for (const width of [360, 390, 414, 430, 768, 1024]) {
    await page.setViewportSize({ width, height: 1024 })

    for (const route of ['/profile', '/leaderboard']) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      await expectNoPageOverflow(page)
    }
  }
})

test('mobile header uses avatar-only profile access', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await login(page, 'e2e.user@scoracle.local')

  const profileLink = page.getByTitle('Open profile')
  await expect(profileLink).toBeVisible()
  await expect(profileLink.getByText('E2EUser', { exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  await expectNoPageOverflow(page)
})
