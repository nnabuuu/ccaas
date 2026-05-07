import { test, expect } from '@playwright/test';
import { submitAnswer, getStudentSnapshot, getStudentProgress } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

test.describe('08 — Student snapshot endpoint', () => {
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'SnapshotStudent' });
    code = session.code;
    studentId = student!.studentId;
  });

  test('snapshot for fresh student returns progress and empty submissions', async () => {
    const { status, data } = await getStudentSnapshot(code, studentId);
    expect(status).toBe(200);
    const body = data as { progress: { currentTask: number; currentPhase: string }; submissions: Record<string, unknown> };
    expect(body.progress).toBeDefined();
    expect(body.progress.currentTask).toBe(1);
    expect(body.progress.currentPhase).toBe('listen');
    expect(body.submissions).toEqual({});
  });

  test('snapshot progress matches standalone progress endpoint', async () => {
    const [snapRes, progRes] = await Promise.all([
      getStudentSnapshot(code, studentId),
      getStudentProgress(code, studentId),
    ]);
    expect(snapRes.status).toBe(200);
    expect(progRes.status).toBe(200);
    const snap = snapRes.data as { progress: { currentTask: number; currentPhase: string } };
    const prog = progRes.data as { currentTask: number; currentPhase: string };
    expect(snap.progress).toEqual(prog);
  });

  test('after submission, snapshot includes submission data and score', async () => {
    await submitAnswer(code, studentId, 1, { answers: QUIZ_CORRECT_ANSWERS });

    const { status, data } = await getStudentSnapshot(code, studentId);
    expect(status).toBe(200);
    const body = data as {
      progress: { currentTask: number; currentPhase: string };
      submissions: Record<string, { data: unknown; score: unknown }>;
    };
    expect(body.submissions['1']).toBeDefined();
    expect(body.submissions['1'].data).toEqual({ answers: QUIZ_CORRECT_ANSWERS });
    expect(body.submissions['1'].score).toBeDefined();
    const score = body.submissions['1'].score as { total: number };
    expect(score.total).toBe(100);
  });

  test('snapshot returns empty body for nonexistent student', async () => {
    const { status, data } = await getStudentSnapshot(code, '00000000-0000-0000-0000-000000000000');
    expect(status).toBe(200);
    // NestJS serializes null as empty body; api-client falls back to empty string
    expect(data === null || data === '').toBe(true);
  });

  test('snapshot returns 400 for invalid studentId', async () => {
    const { status } = await getStudentSnapshot(code, 'not-a-uuid');
    expect(status).toBe(400);
  });

  test('re-submit updates snapshot submission data', async () => {
    const wrongAnswers = [0, 0, 0];
    await submitAnswer(code, studentId, 1, { answers: wrongAnswers });

    const { status, data } = await getStudentSnapshot(code, studentId);
    expect(status).toBe(200);
    const body = data as { submissions: Record<string, { data: { answers: number[] } }> };
    expect(body.submissions['1'].data.answers).toEqual(wrongAnswers);
  });
});
