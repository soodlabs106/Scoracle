import { expect, test } from '@playwright/test'

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-wide', width: 1024, height: 1366 },
]) {
  test(`public home has no horizontal overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            element: element.tagName.toLowerCase(),
            className: element.className,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          }
        })
        .filter((item) => item.left < -1 || item.right > window.innerWidth + 1)
        .slice(0, 12),
    }))

    expect(
      layout.documentWidth,
      JSON.stringify(layout, null, 2),
    ).toBeLessThanOrEqual(layout.viewportWidth)

    if (viewport.width === 1024) {
      await expect(page.locator('main > section').first()).toHaveCSS(
        'grid-template-columns',
        /\S+px \S+px \S+px/,
      )
    }
  })
}
