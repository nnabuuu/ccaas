import { test, expect } from '@playwright/test';
import {
  createSession, getSession, startSession, endSession,
  joinStudent, submitAnswer, getState, listSessions,
} from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { LESSON_ID, QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

test.describe('12 — REST polling flow', () => {
  let code: string;
  let sessionId: string;
  let studentId: string;

  // ── API-level tests ──

  test('create session + poll status=waiting', async () => {
    const { status, data } = await createSession(LESSON_ID);
    expect(status).toBe(201);
    const body = data as { sessionId: string; code: string; status: string };
    expect(body.code).toHaveLength(6);
    expect(body.status).toBe('waiting');
    code = body.code;
    sessionId = body.sessionId;

    // Poll back via GET — verify roundtrip identity
    const poll = await getSession(code);
    expect(poll.status).toBe(200);
    const pollBody = poll.data as { sessionId: string; status: string };
    expect(pollBody.sessionId).toBe(sessionId);
    expect(pollBody.status).toBe('waiting');
  });

  test('start session + poll status=active', async () => {
    const { status, data } = await startSession(code);
    expect(status).toBe(201);
    expect((data as { status: string }).status).toBe('active');

    const poll = await getSession(code);
    expect(poll.status).toBe(200);
    const pollBody = poll.data as { sessionId: string; status: string };
    expect(pollBody.sessionId).toBe(sessionId);
    expect(pollBody.status).toBe('active');
  });

  test('student join + teacher getState reflects student', async () => {
    const joinRes = await joinStudent(code, 'PollingStudent');
    expect(joinRes.status).toBe(201);
    studentId = (joinRes.data as { studentId: string }).studentId;

    const { status, data } = await getState(code);
    expect(status).toBe(200);
    const body = data as { students: Array<{ id: string; name: string }> };
    expect(body.students).toHaveLength(1);
    expect(body.students[0].name).toBe('PollingStudent');
  });

  test('submit answer + teacher getState reflects submission', async () => {
    const sub = await submitAnswer(code, studentId, 1, { answers: QUIZ_CORRECT_ANSWERS });
    expect(sub.status).toBe(201);

    const { data } = await getState(code);
    const body = data as {
      stepMetrics: Record<string, { completedCount: number }>;
      students: Array<{ submissions: Record<string, { step: number }> }>;
    };
    expect(body.stepMetrics['1']).toBeDefined();
    expect(body.stepMetrics['1'].completedCount).toBeGreaterThanOrEqual(1);

    const student = body.students[0];
    expect(student.submissions['1']).toBeDefined();
    expect(student.submissions['1'].step).toBe(1);
  });

  test('end session + poll status=ended', async () => {
    const { status, data } = await endSession(code);
    expect(status).toBe(201);
    expect((data as { status: string }).status).toBe('ended');

    const poll = await getSession(code);
    expect(poll.status).toBe(200);
    expect((poll.data as { status: string }).status).toBe('ended');
  });

  test('session list endpoint returns ended session', async () => {
    const { status, data } = await listSessions('ended');
    expect(status).toBe(200);
    const body = data as {
      items: Array<{
        code: string; status: string; studentCount: number; lessonTitle: string;
      }>;
      total: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(1);

    const found = body.items.find(s => s.code === code);
    expect(found).toBeDefined();
    expect(found!.status).toBe('ended');
    expect(found!.studentCount).toBe(1);
    expect(found!.lessonTitle).toBeTruthy();
  });

  // ── UI-level tests ──

  test('teacher page renders student via polling', async ({ page }) => {
    // Create a fresh active session with a student for UI tests
    const { session } = await createTestSession({ studentName: 'UIStudent' });

    await page.goto(`/session/${session.sessionId}/watch`);
    // Wait for "1 人" in the top bar — proves polling populated the student count
    await expect(page.locator('body')).toContainText('1 人', { timeout: 15_000 });
  });

  test('end-session button flow navigates to /sessions', async ({ page }) => {
    const { session } = await createTestSession({ studentName: 'EndFlowStudent' });

    await page.goto(`/session/${session.sessionId}/watch`);
    await page.waitForSelector('.teacher-root', { timeout: 10_000 });
    await page.waitForSelector('.band-end-btn', { timeout: 5_000 });

    // First click → confirmation text
    const endBtn = page.locator('.band-end-btn');
    await expect(endBtn).toHaveText('结束课堂');
    await endBtn.click();
    await expect(endBtn).toHaveText('确认结束？');

    // Second click → ends session and navigates
    await endBtn.click();
    await page.waitForURL('**/sessions', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('课堂记录');
  });

  test('session list page renders ended sessions', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.locator('h1')).toContainText('课堂记录', { timeout: 10_000 });

    // Click "已结束" tab to filter
    await page.locator('button', { hasText: '已结束' }).click();

    // Should show at least one ended session card
    const cards = page.locator('div[role="button"]');
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });

    // Verify the card has the expected structure
    const firstCard = cards.first();
    await expect(firstCard).toContainText('学生');
  });
});
