import { test, expect } from '@playwright/test';
import { translate, translateChat } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { LESSON_ID } from '../helpers/constants';

interface TranslateResponse {
  definition: string;
  contextAnalysis: string;
  suggestedQuestions: string[];
}

// ── Group A: API tests (no browser, pure HTTP) ───────────────────────

test.describe('13A — Translate API', () => {
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ lessonId: LESSON_ID, studentName: 'TranslateStudent' });
    code = session.code;
    studentId = student!.studentId;
  });

  test('POST translate returns structured response', async () => {
    const { status, data } = await translate(code, studentId, 'Reading is fundamental.', 1, 'text-panel');
    expect(status).toBe(201);
    const body = data as TranslateResponse;
    expect(typeof body.definition).toBe('string');
    expect(body.definition.length).toBeGreaterThan(0);
    expect(typeof body.contextAnalysis).toBe('string');
    expect(Array.isArray(body.suggestedQuestions)).toBe(true);
  });

  test('translate returns same result for identical text (cache hit)', async () => {
    const text = 'The beauty of symmetry';
    const r1 = await translate(code, studentId, text, 1, 'text-panel');
    const r2 = await translate(code, studentId, text, 1, 'text-panel');
    const body1 = r1.data as TranslateResponse;
    const body2 = r2.data as TranslateResponse;
    expect(body1.definition).toBe(body2.definition);
    expect(body1.contextAnalysis).toBe(body2.contextAnalysis);
  });

  test('translate rejects invalid studentId with 404', async () => {
    const { status } = await translate(code, '00000000-0000-0000-0000-000000000000', 'hello', 1, 'text-panel');
    expect(status).toBe(404);
  });

  test('translate rejects empty text with 400', async () => {
    const { status } = await translate(code, studentId, '', 1, 'text-panel');
    expect(status).toBe(400);
  });

  test('translate rejects text exceeding 500 chars with 400', async () => {
    const longText = 'a'.repeat(501);
    const { status } = await translate(code, studentId, longText, 1, 'text-panel');
    expect(status).toBe(400);
  });

  test('translate accepts optional phase parameter', async () => {
    const { status, data } = await translate(code, studentId, 'Ideal beauty', 1, 'text-panel', 'exercise');
    expect(status).toBe(201);
    const body = data as TranslateResponse;
    expect(typeof body.definition).toBe('string');
  });

  test('POST translate/chat returns { reply }', async () => {
    // First translate to populate cache
    await translate(code, studentId, 'symmetry', 1, 'text-panel');

    const { status, data } = await translateChat(
      code, studentId, 1, 'symmetry', '这个词在这篇文章中有什么特殊含义？', 'text-panel',
    );
    expect(status).toBe(201);
    const body = data as { reply: string };
    expect(typeof body.reply).toBe('string');
    expect(body.reply.length).toBeGreaterThan(0);
  });

  test('translate/chat rejects invalid studentId with 404', async () => {
    const { status } = await translateChat(
      code, '00000000-0000-0000-0000-000000000000', 1, 'hello', '什么意思？', 'text-panel',
    );
    expect(status).toBe(404);
  });
});

// ── Group B: UI tests (Playwright browser) ───────────────────────────

test.describe('13B — Translate UI', () => {
  test.describe.configure({ timeout: 60_000 });

  let code: string;

  test.beforeAll(async () => {
    const { session } = await createTestSession({ lessonId: LESSON_ID });
    code = session.code;
  });

  /** Join as a student via the browser JoinPage */
  async function joinAsStudent(page: import('@playwright/test').Page) {
    await page.goto('/join');
    await page.getByPlaceholder('课堂码...').fill(code);
    await expect(page.getByText('✓')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('你的姓名...').fill('TranslateUIStudent');
    await page.getByRole('button', { name: '加入课堂' }).click();
    await page.waitForURL(/\/session\//, { timeout: 15_000 });
  }

  test('FAB is visible on page load', async ({ page }) => {
    await joinAsStudent(page);
    await expect(page.locator('.stu-tr-fab')).toBeVisible({ timeout: 5_000 });
  });

  test('clicking FAB enters selecting mode with banner', async ({ page }) => {
    await joinAsStudent(page);

    const fab = page.locator('.stu-tr-fab');
    await fab.click();

    // Banner appears with selection hint
    await expect(page.locator('.stu-tr-banner')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.stu-tr-banner')).toContainText('选择');

    // FAB gets .active class
    await expect(fab).toHaveClass(/active/);
  });

  test('text selection shows popover with translation', async ({ page }) => {
    await joinAsStudent(page);

    const fab = page.locator('.stu-tr-fab');
    await fab.click();
    await expect(page.locator('.stu-tr-banner')).toBeVisible({ timeout: 3_000 });

    // Double-click on text in the text panel to select a word
    const textPanel = page.locator('[data-translate-ctx="text-panel"]');
    await expect(textPanel).toBeVisible({ timeout: 10_000 });
    await textPanel.locator('.stu-tp-detail').first().dblclick();

    // Popover appears (may take time due to LLM)
    const popover = page.locator('.stu-tr-popover');
    await expect(popover).toBeVisible({ timeout: 30_000 });

    // Popover body has definition text
    const body = popover.locator('.stu-tr-popover-body');
    await expect(body).not.toBeEmpty({ timeout: 15_000 });
  });

  test('Escape dismisses popover and deactivates FAB', async ({ page }) => {
    await joinAsStudent(page);

    const fab = page.locator('.stu-tr-fab');
    await fab.click();
    await expect(page.locator('.stu-tr-banner')).toBeVisible({ timeout: 3_000 });

    const textPanel = page.locator('[data-translate-ctx="text-panel"]');
    await expect(textPanel).toBeVisible({ timeout: 10_000 });
    await textPanel.locator('.stu-tp-detail').first().dblclick();

    const popover = page.locator('.stu-tr-popover');
    await expect(popover).toBeVisible({ timeout: 30_000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Popover hidden, FAB loses .active
    await expect(popover).toBeHidden({ timeout: 3_000 });
    await expect(fab).not.toHaveClass(/active/);
  });

  test('FAB is disabled briefly after translation (cooldown)', async ({ page }) => {
    await joinAsStudent(page);

    const fab = page.locator('.stu-tr-fab');
    await fab.click();

    const textPanel = page.locator('[data-translate-ctx="text-panel"]');
    await expect(textPanel).toBeVisible({ timeout: 10_000 });
    await textPanel.locator('.stu-tp-detail').first().dblclick();

    // Wait for definition to render — cooldown starts at the same moment as setResult
    const def = page.locator('.stu-tr-def');
    await expect(def).toBeVisible({ timeout: 30_000 });

    // Check disabled immediately — cooldown is 2s from when definition appeared
    await expect(fab).toBeDisabled({ timeout: 1_000 });

    // After cooldown it re-enables
    await expect(fab).toBeEnabled({ timeout: 5_000 });
  });
});
