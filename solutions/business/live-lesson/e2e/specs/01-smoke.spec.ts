import { test, expect } from '@playwright/test';
import { getLessons, getManifest } from '../helpers/api-client';
import { LESSON_ID } from '../helpers/constants';

test.describe('01 — Smoke tests', () => {
  test('GET /api/lessons returns 200 with lessons array', async () => {
    const { status, data } = await getLessons();
    expect(status).toBe(200);
    const body = data as { lessons: unknown[] };
    expect(Array.isArray(body.lessons)).toBe(true);
    expect(body.lessons.length).toBeGreaterThan(0);
  });

  test('GET /api/lessons/:id/manifest returns 200', async () => {
    const { status, data } = await getManifest(LESSON_ID);
    expect(status).toBe(200);
    const body = data as { id: string; title: string; readingSteps: unknown[] };
    expect(body.id).toBe(LESSON_ID);
    expect(body.title).toBeTruthy();
    expect(Array.isArray(body.readingSteps)).toBe(true);
  });

  test('CourseSelectionPage renders lesson cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('选择课程')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('创建课堂').first()).toBeVisible();
  });

  test('JoinPage renders code input', async ({ page }) => {
    await page.goto('/join');
    await expect(page.getByText('加入课堂')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('课堂码...')).toBeVisible();
  });
});
