import { Page, expect } from '@playwright/test';

const BACKEND_URL =
  process.env.BACKEND_URL || 'http://localhost:3012';

/** Create a session via the backend API, returns { sessionId, sessionCode } */
export async function createTestSession(): Promise<{
  sessionId: string;
  sessionCode: string;
}> {
  const res = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId: 'e2e-teacher' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(`Failed to create session: ${res.status} - ${body}`);
  }
  const data = await res.json();
  return {
    sessionId: data.id,
    sessionCode: data.session_code,
  };
}

/**
 * Full join flow: navigate to /, enter session code, click Join,
 * select 张雨桐 (s01), wait for "Ideal Beauty" heading.
 */
export async function joinAsStudent(
  page: Page,
  session: { sessionCode: string },
): Promise<void> {
  await page.goto('/');
  await page.locator('#session-code').fill(session.sessionCode);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(
    page.getByRole('heading', { name: 'Choose your name' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '张雨桐' }).click();
  // Wait for the lesson view to load (SceneNav shows "Ideal Beauty" + scene buttons)
  await expect(
    page.getByRole('button', { name: 'Reading' }),
  ).toBeVisible();
  // Navigate to L1 (Reading) to ensure consistent starting state
  await page.getByRole('button', { name: 'Reading' }).click();
}
