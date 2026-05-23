import { test, expect } from '@playwright/test'

/**
 * Browser-level verification that opening a story renders the stage with
 * locale-aware buttons. Exercises the dynamic templates that use t() inside
 * `innerHTML = `...${t('...')}...` ` so we catch any t() call sites that
 * the i18n parity unit test can't see (those run at the TS-string level,
 * not after the template literal is interpolated into the live DOM).
 */
test.describe('preview iframe — story stage render', () => {
  test('clicking a story shows the stage with default zh-CN buttons', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })

    // Click the first story (quiz-demo ships "Default — correct selection")
    await page.getByText('Default — correct selection').click()

    // Stage now shows the buttons + section labels. Default locale = zh-CN.
    await expect(page.getByRole('button', { name: '提交 / 检查' })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: '重置' })).toBeVisible()
    // Section labels (rendered from t()-interpolated innerHTML)
    await expect(page.getByText(/AnswerKey（学生可见的安全字段）/)).toBeVisible()
  })

  test('set-locale en re-renders the stage buttons + section labels', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Quiz Demo Bundle')).toBeVisible({ timeout: 10_000 })
    await page.getByText('Default — correct selection').click()
    await expect(page.getByRole('button', { name: '提交 / 检查' })).toBeVisible({ timeout: 5_000 })

    // Establish trust + switch locale
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

    // Dynamic stage re-renders through applyLocale().
    await expect(page.getByRole('button', { name: 'Submit / Check' })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible()
    await expect(page.getByText(/AnswerKey \(student-safe sanitized\)/)).toBeVisible()
  })
})
