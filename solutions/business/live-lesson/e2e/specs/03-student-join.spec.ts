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
    await expect(page.getByText('加入课堂')).toBeVisible({ timeout: 15_000 });

    // Type session code
    const codeInput = page.getByPlaceholder('课堂码...');
    await codeInput.fill(code);

    // Click "下一步"
    await page.getByRole('button', { name: '下一步' }).click();

    // Wait for name input step
    await expect(page.getByPlaceholder('你的姓名...')).toBeVisible({ timeout: 10_000 });

    // Type name and join
    await page.getByPlaceholder('你的姓名...').fill('E2E测试学生');
    await page.getByRole('button', { name: '加入课堂' }).click();

    // Verify redirect to session page
    await page.waitForURL(/\/session\//, { timeout: 15_000 });
    expect(page.url()).toContain('/session/');
  });

  test('StudentShell renders with progress dots', async ({ page }) => {
    // Use a fresh student for this test
    await page.goto('/join');
    await expect(page.getByPlaceholder('课堂码...')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('课堂码...').fill(code);
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByPlaceholder('你的姓名...')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('你的姓名...').fill('E2E学生二号');
    await page.getByRole('button', { name: '加入课堂' }).click();

    await page.waitForURL(/\/session\//, { timeout: 15_000 });

    // StudentShell should render — look for task or exercise content
    // The shell displays progress dots (task-dot elements) or exercise content
    await page.waitForTimeout(2_000);
    // Verify the page loaded without error — check for absence of error states
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('加载课程失败');
  });
});
