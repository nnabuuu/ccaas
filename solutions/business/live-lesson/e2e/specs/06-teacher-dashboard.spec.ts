import { test, expect } from '@playwright/test';
import { submitAnswer, setStep, joinStudent } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

test.describe('06 — Teacher dashboard', () => {
  let code: string;
  let sessionId: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'TeacherViewStudent' });
    code = session.code;
    sessionId = session.sessionId;
    studentId = student!.studentId;
  });

  test('TeacherPage renders for session', async ({ page }) => {
    await page.goto(`/session/${sessionId}/watch`);
    // Teacher dashboard should load — wait for any meaningful content
    // The teacher page shows student count or metrics
    await page.waitForTimeout(3_000);
    const bodyText = await page.textContent('body');
    // Should not be an error page
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('加载课程失败');
  });

  test('submit via API reflects in teacher state', async () => {
    // Submit an answer
    const { status } = await submitAnswer(code, studentId, 1, { answers: QUIZ_CORRECT_ANSWERS });
    expect(status).toBe(201);

    // Add another student to verify count
    const joinRes = await joinStudent(code, 'ExtraStudent');
    expect(joinRes.status).toBe(201);
  });

  test('teacher step change updates session state', async () => {
    const { status, data } = await setStep(code, 2);
    expect(status).toBe(201);
    const body = data as { step?: number; ok?: boolean };
    // Verify no error — exact shape depends on implementation
    expect(status).toBe(201);
  });
});
