import { test, expect } from '@playwright/test'

/**
 * Browser-level verification of the goal claim:
 *
 *   "preview iframe web/index.html renders all visible labels through
 *    i18n.ts t() so the admin locale toggle actually translates the UI"
 *
 * Strategy: load the preview UI in Chromium, snapshot a few visible labels
 * in default zh-CN, simulate the admin playground's `set-locale` postMessage
 * by patching `window.parent` (the iframe normally trusts a parent that has
 * already passed through `isAllowedParentOrigin`), and assert the labels
 * actually re-render in English.
 */
test.describe('preview iframe — i18n toggle', () => {
  test('default load renders zh-CN labels', async ({ page }) => {
    await page.goto('/')
    // Wait for the bundle list to populate (bundle.title / story names appear).
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })

    // Topbar role buttons in zh-CN
    await expect(page.getByRole('button', { name: '学生视角' })).toBeVisible()
    await expect(page.getByRole('button', { name: '教师视角' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Inspector' })).toBeVisible()
  })

  test('postMessage set-locale en → labels switch to English', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })

    // The iframe only accepts set-locale from a "trusted parent" (an origin
    // that has previously sent any valid message). To unblock the flow when
    // running standalone, first send a no-op message that establishes trust:
    await page.evaluate(() => {
      window.postMessage({ source: 'kedge-playground', type: 'noop' }, window.location.origin)
    })
    // Tiny delay so the iframe's message handler runs.
    await page.waitForTimeout(50)

    await page.evaluate(() => {
      window.postMessage(
        { source: 'kedge-playground', type: 'set-locale', payload: { locale: 'en' } },
        window.location.origin,
      )
    })

    // Now the same data-i18n elements should render English.
    await expect(page.getByRole('button', { name: 'Student' })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: 'Teacher' })).toBeVisible()
    // zh-CN labels should be gone (sanity check that the swap happened).
    await expect(page.getByRole('button', { name: '学生视角' })).toHaveCount(0)
  })

  test('switching back to zh-CN restores Chinese labels', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })

    // Establish trust + go en
    await page.evaluate(() => {
      window.postMessage({ source: 'kedge-playground', type: 'noop' }, window.location.origin)
    })
    await page.waitForTimeout(50)
    await page.evaluate(() => {
      window.postMessage(
        { source: 'kedge-playground', type: 'set-locale', payload: { locale: 'en' } },
        window.location.origin,
      )
    })
    await expect(page.getByRole('button', { name: 'Student' })).toBeVisible({ timeout: 5_000 })

    // Go back to zh-CN
    await page.evaluate(() => {
      window.postMessage(
        { source: 'kedge-playground', type: 'set-locale', payload: { locale: 'zh-CN' } },
        window.location.origin,
      )
    })
    await expect(page.getByRole('button', { name: '学生视角' })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: 'Student' })).toHaveCount(0)
  })
})
