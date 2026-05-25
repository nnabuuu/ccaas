import { test, expect } from '@playwright/test'

/**
 * Browser-level verification that opening a story mounts an iframe pointing
 * at the production frontend's /exercise-demo route. Pre-P3 this spec
 * tested the chrome's hand-rendered student stage (a JSON dump + score
 * table); P3 replaced that with an iframe so the chrome shows the real
 * production React component instead.
 *
 * These tests only assert on the chrome's own DOM (iframe element src
 * attribute) — they do NOT require the frontend dev server to be running.
 * The iframe would fail to load against the test environment, but the
 * chrome's URL generation is what we're testing here. Asserting on src via
 * toHaveAttribute (not toBeVisible) makes that contract explicit.
 */
test.describe('preview chrome — iframe stage', () => {
  test('clicking a story mounts an iframe with the right URL params', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })
    await page.getByText('Default — correct selection').click()

    const iframe = page.locator('#preview-iframe')
    await expect(iframe).toHaveAttribute('src', /\/exercise-demo\?/, { timeout: 5_000 })

    const src = (await iframe.getAttribute('src')) ?? ''
    expect(src).toContain('bundle=quiz')
    expect(src).toContain('story=Default')
    expect(src).toContain('role=student')
    // embed=1 hides the iframe's own chrome bar (P3 contract with frontend)
    expect(src).toContain('embed=1')
  })

  test('role toggle reloads iframe with the new role param', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })
    await page.getByText('Default — correct selection').click()
    await expect(page.locator('#preview-iframe')).toHaveAttribute(
      'src',
      /role=student/,
      { timeout: 5_000 },
    )

    await page.getByRole('button', { name: '教师视角' }).click()

    // Single assertion waits for the src to flip from student → teacher.
    await expect(page.locator('#preview-iframe')).toHaveAttribute('src', /role=teacher/)
    const src = (await page.locator('#preview-iframe').getAttribute('src')) ?? ''
    expect(src).not.toContain('role=student')
  })

  test('?frontend= URL override flows through to iframe src', async ({ page }) => {
    // Override the default localhost:5283 default with a fake host. The
    // chrome must honour the override (sessionStorage + URL param path) and
    // emit iframe src pointing at the new host.
    await page.goto('/?frontend=http://example.test:9999')
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })
    await page.getByText('Default — correct selection').click()

    await expect(page.locator('#preview-iframe')).toHaveAttribute(
      'src',
      /^http:\/\/example\.test:9999\/exercise-demo/,
      { timeout: 5_000 },
    )
  })

  test('javascript: scheme in ?frontend= is rejected, falls back to default', async ({ page }) => {
    // Open-redirect / XSS guard: scheme is locked to http: / https:.
    await page.goto('/?frontend=javascript:alert(1)')
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })
    await page.getByText('Default — correct selection').click()

    await expect(page.locator('#preview-iframe')).toHaveAttribute(
      'src',
      /^http:\/\/localhost:5283\/exercise-demo/,
      { timeout: 5_000 },
    )
  })
})
