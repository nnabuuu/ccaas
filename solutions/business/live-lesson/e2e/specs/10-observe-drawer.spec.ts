import { test, expect } from '@playwright/test';
import { submitAnswer, joinStudent, reportPhase } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

test.describe('10 — Observe drawer (overlay stacking)', () => {
  let code: string;
  let sessionId: string;
  const studentNames = ['Alice', 'Bob', 'Charlie'];
  const studentIds: string[] = [];

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: studentNames[0] });
    code = session.code;
    sessionId = session.sessionId;
    studentIds.push(student!.studentId);

    for (let i = 1; i < studentNames.length; i++) {
      const res = await joinStudent(code, studentNames[i]);
      studentIds.push((res.data as { studentId: string }).studentId);
    }

    // Report all students to practice phase on task 1 and submit answers
    for (const sid of studentIds) {
      await reportPhase(code, sid, 1, 'practice');
      await submitAnswer(code, sid, 1, { answers: QUIZ_CORRECT_ANSWERS });
    }
  });

  test('observe drawer opens with class view (Layer 0)', async ({ page }) => {
    await page.goto(`/session/${sessionId}/watch`);
    await page.waitForSelector('.step-card', { timeout: 10_000 });

    // Expand step 1 to reveal the observe button
    await page.locator('.step-card .sc-head').first().click();
    await page.waitForSelector('.sc-observe-btn', { timeout: 5_000 });

    // Click the observe button
    await page.locator('.sc-observe-btn').first().click();

    // Layer 0 panel should appear
    const layer0 = page.getByTestId('overlay-panel-0');
    await expect(layer0).toBeVisible({ timeout: 5_000 });

    // Band title should contain observe label
    const bandTitle = layer0.locator('.observe-band-title');
    await expect(bandTitle).toBeVisible();
    await expect(bandTitle).toContainText('观察');

    // Body should be visible
    await expect(layer0.locator('.observe-body').first()).toBeVisible();
  });

  test('clicking student opens Layer 1', async ({ page }) => {
    await page.goto(`/session/${sessionId}/watch?observe=mc&step=1`);

    const layer0 = page.getByTestId('overlay-panel-0');
    await expect(layer0).toBeVisible({ timeout: 5_000 });

    // Wait for data to load
    await page.waitForTimeout(2_000);

    // Click a student row in the class view table
    const studentEl = layer0.locator('.obs-table tbody tr').first();
    if (await studentEl.isVisible()) {
      await studentEl.click();

      // Layer 1 should appear
      const layer1 = page.getByTestId('overlay-panel-1');
      await expect(layer1).toBeVisible({ timeout: 3_000 });

      // Both layers visible simultaneously
      await expect(layer0).toBeVisible();
      await expect(layer1).toBeVisible();

      // Navigation buttons should be present
      await expect(layer1.locator('.observe-band-nav').first()).toBeVisible();
    }
  });

  test('prev/next navigation switches student without closing Layer 1', async ({ page }) => {
    await page.goto(`/session/${sessionId}/watch?observe=mc&step=1`);

    const layer0 = page.getByTestId('overlay-panel-0');
    await expect(layer0).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(2_000);

    const studentEl = layer0.locator('.obs-table tbody tr').first();
    if (await studentEl.isVisible()) {
      await studentEl.click();

      const layer1 = page.getByTestId('overlay-panel-1');
      await expect(layer1).toBeVisible({ timeout: 3_000 });

      const bandTitle = layer1.locator('.observe-band-title');
      const firstName = await bandTitle.textContent();

      // Click next button (second nav btn)
      const nextBtn = layer1.locator('.observe-band-nav').last();
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(500);

        const secondName = await bandTitle.textContent();
        expect(secondName).not.toBe(firstName);
        await expect(layer1).toBeVisible();
      }
    }
  });

  test('closing Layer 1 returns to Layer 0', async ({ page }) => {
    await page.goto(`/session/${sessionId}/watch?observe=mc&step=1`);

    const layer0 = page.getByTestId('overlay-panel-0');
    await expect(layer0).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(2_000);

    const studentEl = layer0.locator('.obs-table tbody tr').first();
    if (await studentEl.isVisible()) {
      await studentEl.click();

      const layer1 = page.getByTestId('overlay-panel-1');
      await expect(layer1).toBeVisible({ timeout: 3_000 });

      // Close Layer 1 via close button
      await layer1.locator('.observe-band-close').click();

      // Layer 1 should disappear after animation
      await expect(layer1).not.toBeVisible({ timeout: 2_000 });

      // Layer 0 should still be visible
      await expect(layer0).toBeVisible();
    }
  });

  test('closing Layer 0 returns to dashboard', async ({ page }) => {
    await page.goto(`/session/${sessionId}/watch?observe=mc&step=1`);

    const layer0 = page.getByTestId('overlay-panel-0');
    await expect(layer0).toBeVisible({ timeout: 5_000 });

    // Close Layer 0 via backdrop click (more reliable than close button which may be off-viewport)
    await page.getByTestId('overlay-backdrop-0').click({ position: { x: 10, y: 300 }, force: true });

    // URL should no longer have observe params
    await expect(page).not.toHaveURL(/observe=mc/, { timeout: 3_000 });

    // Dashboard should be visible
    await expect(page.locator('.teacher-root')).toBeVisible();
  });

  test('backdrop click closes Layer 1', async ({ page }) => {
    await page.goto(`/session/${sessionId}/watch?observe=mc&step=1`);

    const layer0 = page.getByTestId('overlay-panel-0');
    await expect(layer0).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(2_000);

    const studentEl = layer0.locator('.obs-table tbody tr').first();
    if (await studentEl.isVisible()) {
      await studentEl.click();

      const layer1 = page.getByTestId('overlay-panel-1');
      await expect(layer1).toBeVisible({ timeout: 3_000 });

      // Click the backdrop for Layer 1
      const backdrop = page.getByTestId('overlay-backdrop-1');
      await backdrop.click({ position: { x: 20, y: 300 }, force: true });

      await expect(layer1).not.toBeVisible({ timeout: 2_000 });
      await expect(layer0).toBeVisible();
    }
  });

  test('observe API returns fastestTime and slowestTime for MC', async () => {
    const res = await fetch(`http://localhost:3007/api/classroom/${code}/steps/1/observe/mc`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.stats).toHaveProperty('fastestTime');
    expect(data.stats).toHaveProperty('slowestTime');
    expect(data.stats).toHaveProperty('avgTime');
    expect(typeof data.stats.fastestTime).toBe('number');
    expect(typeof data.stats.slowestTime).toBe('number');
    expect(data.stats.fastestTime).toBeLessThanOrEqual(data.stats.slowestTime);
  });
});
