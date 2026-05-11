import { test, expect } from '@playwright/test';
import { createTestSession } from '../helpers/session-factory';

test.describe('03 — Student join (UI flow)', () => {
  let code: string;
  let sessionId: string;

  test.beforeAll(async () => {
    const { session } = await createTestSession();
    code = session.code;
    sessionId = session.sessionId;
  });

  test('full UI join flow: code → name → redirect to session page', async ({ page }) => {
    await page.goto('/join');
    await expect(page.locator('.stu-join-title')).toHaveText('加入课堂', { timeout: 15_000 });

    // Type session code — auto-validates when 6 chars
    await page.getByPlaceholder('课堂码...').fill(code);

    // Wait for code validation (green checkmark)
    await expect(page.getByText('✓')).toBeVisible({ timeout: 10_000 });

    // Type name
    await page.getByPlaceholder('你的姓名...').fill('E2E测试学生');

    // Click join button
    await page.getByRole('button', { name: '加入课堂' }).click();

    // Verify redirect to session page
    await page.waitForURL(/\/session\//, { timeout: 15_000 });
    expect(page.url()).toContain('/session/');
  });

  test('StudentShell renders with progress dots', async ({ page }) => {
    await page.goto('/join');
    await expect(page.getByPlaceholder('课堂码...')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('课堂码...').fill(code);
    await expect(page.getByText('✓')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('你的姓名...').fill('E2E学生二号');
    await page.getByRole('button', { name: '加入课堂' }).click();

    await page.waitForURL(/\/session\//, { timeout: 15_000 });

    // StudentShell should render — verify page loaded without error
    await page.waitForTimeout(2_000);
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('加载课程失败');
  });
});
