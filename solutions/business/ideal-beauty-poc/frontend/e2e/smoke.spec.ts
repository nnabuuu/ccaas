import { test, expect } from '@playwright/test';
import { createTestSession, joinAsStudent } from './helpers';

let session: { sessionId: string; sessionCode: string };

test.beforeAll(async () => {
  try {
    session = await createTestSession();
  } catch (err) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3012';
    throw new Error(
      `Could not create test session. Is the backend running on ${backendUrl}?\n` +
        `Original error: ${err}`,
    );
  }
});

test.describe.serial('HelpCenter smoke tests', () => {
  test('1 — enter session code shows roster', async ({ page }) => {
    await page.goto('/');
    await page.locator('#session-code').fill(session.sessionCode);
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(
      page.getByRole('heading', { name: 'Choose your name' }),
    ).toBeVisible();
  });

  test('2 — select student enters L1', async ({ page }) => {
    await joinAsStudent(page, session);
    // Verify we're on L1 (Reading is the active scene)
    await expect(
      page.getByRole('button', { name: 'Reading' }),
    ).toBeVisible();
  });

  test('3 — navigate to T1: inline bar visible', async ({ page }) => {
    await joinAsStudent(page, session);
    await page
      .getByRole('button', { name: 'Highlight P-E-E' })
      .click();
    await expect(page.getByText('Ask AI 问一问')).toBeVisible();
    await expect(page.locator('.help-panel')).toHaveCount(0);
  });

  test('4 — click bar expands: welcome + pills', async ({ page }) => {
    await joinAsStudent(page, session);
    await page
      .getByRole('button', { name: 'Highlight P-E-E' })
      .click();
    await page.getByText('Ask AI 问一问').click();
    await expect(page.locator('.help-panel-inline')).toBeVisible();
    await expect(
      page.getByText("Hi! I'm your AI tutor."),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'What is a topic sentence?' }),
    ).toBeVisible();
  });

  test('5 — collapse inline', async ({ page }) => {
    await joinAsStudent(page, session);
    await page
      .getByRole('button', { name: 'Highlight P-E-E' })
      .click();
    await page.getByText('Ask AI 问一问').click();
    await expect(page.locator('.help-panel-inline')).toBeVisible();
    await page
      .getByRole('button', { name: 'Collapse help center' })
      .click();
    await expect(page.locator('.help-panel-inline')).toHaveCount(0);
  });

  test('6 — L1 has FAB visible', async ({ page }) => {
    await joinAsStudent(page, session);
    // L1 is the default scene after join
    const fab = page.getByRole('button', { name: 'Open help center' });
    await expect(fab).toBeVisible();
    await expect(fab).toContainText('Ask AI');
  });

  test('7 — click FAB opens floating panel', async ({ page }) => {
    await joinAsStudent(page, session);
    await page
      .getByRole('button', { name: 'Open help center' })
      .click();
    await expect(page.locator('.help-panel')).toBeVisible();
    await expect(page.getByText('Ask a question')).toBeVisible();
  });

  test('8 — task view has no floating panel', async ({ page }) => {
    await joinAsStudent(page, session);
    await page
      .getByRole('button', { name: 'Highlight P-E-E' })
      .click();
    await expect(page.getByText('Ask AI 问一问')).toBeVisible();
    await expect(page.locator('.help-panel')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Open help center' }),
    ).toHaveCount(0);
  });

  test('9 — lecture view has no inline panel', async ({ page }) => {
    await joinAsStudent(page, session);
    // L1 is the default scene — should have FAB, not inline
    await expect(page.locator('.help-panel-inline')).toHaveCount(0);
    await expect(page.getByText('Ask AI 问一问')).toHaveCount(0);
  });
});
