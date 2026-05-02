import { test, expect } from '@playwright/test';
import { submitAnswer, getState } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

test.describe('05 — Submit & progression', () => {
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'SubmitStudent' });
    code = session.code;
    studentId = student!.studentId;
  });

  test('submit correct quiz answers → returns ok', async () => {
    const { status, data } = await submitAnswer(code, studentId, 1, { answers: QUIZ_CORRECT_ANSWERS });
    expect(status).toBe(201);
    const body = data as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test('student currentTask advances after submission', async () => {
    const { status, data } = await getState(code);
    expect(status).toBe(200);
    const body = data as { students: Array<{ id: string; currentTask: number }> };
    const student = body.students.find(s => s.id === studentId);
    expect(student).toBeDefined();
    // After submitting step 1, currentTask should have advanced beyond task 1
    expect(student!.currentTask).toBeGreaterThan(1);
  });

  test('re-submit for same step is idempotent', async () => {
    const { status, data } = await submitAnswer(code, studentId, 1, { answers: QUIZ_CORRECT_ANSWERS });
    // Should still succeed (not error out)
    expect(status).toBe(201);
    const body = data as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
