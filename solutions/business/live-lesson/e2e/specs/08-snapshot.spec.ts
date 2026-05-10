import { test, expect } from '@playwright/test';
import { submitAnswer, getStudentProgress } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

test.describe('08 — Student progress with submissions', () => {
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'SnapshotStudent' });
    code = session.code;
    studentId = student!.studentId;
  });

  test('progress?include=submissions for fresh student returns flat response with empty submissions', async () => {
    const { status, data } = await getStudentProgress(code, studentId, 'submissions');
    expect(status).toBe(200);
    const body = data as { currentTask: number; currentPhase: string; submissions: Record<string, unknown> };
    expect(body.currentTask).toBe(1);
    expect(body.currentPhase).toBe('listen');
    expect(body.submissions).toEqual({});
  });

  test('progress without include matches flat progress fields', async () => {
    const [withSubs, without] = await Promise.all([
      getStudentProgress(code, studentId, 'submissions'),
      getStudentProgress(code, studentId),
    ]);
    expect(withSubs.status).toBe(200);
    expect(without.status).toBe(200);
    const full = withSubs.data as { currentTask: number; currentPhase: string; submissions: unknown };
    const prog = without.data as { currentTask: number; currentPhase: string };
    expect(prog.currentTask).toBe(full.currentTask);
    expect(prog.currentPhase).toBe(full.currentPhase);
  });

  test('after submission, includes submission data and score', async () => {
    await submitAnswer(code, studentId, 1, { answers: QUIZ_CORRECT_ANSWERS });

    const { status, data } = await getStudentProgress(code, studentId, 'submissions');
    expect(status).toBe(200);
    const body = data as {
      currentTask: number; currentPhase: string;
      submissions: Record<string, { data: unknown; score: unknown }>;
    };
    expect(body.submissions['1']).toBeDefined();
    expect(body.submissions['1'].data).toEqual({ answers: QUIZ_CORRECT_ANSWERS });
    expect(body.submissions['1'].score).toBeDefined();
    const score = body.submissions['1'].score as { total: number };
    expect(score.total).toBe(100);
  });

  test('returns empty body for nonexistent student', async () => {
    const { status, data } = await getStudentProgress(code, '00000000-0000-0000-0000-000000000000', 'submissions');
    expect(status).toBe(200);
    expect(data === null || data === '').toBe(true);
  });

  test('returns 400 for invalid studentId', async () => {
    const { status } = await getStudentProgress(code, 'not-a-uuid', 'submissions');
    expect(status).toBe(400);
  });

  test('re-submit updates submission data', async () => {
    const wrongAnswers = [0, 0, 0];
    await submitAnswer(code, studentId, 1, { answers: wrongAnswers });

    const { status, data } = await getStudentProgress(code, studentId, 'submissions');
    expect(status).toBe(200);
    const body = data as { submissions: Record<string, { data: { answers: number[] } }> };
    expect(body.submissions['1'].data.answers).toEqual(wrongAnswers);
  });
});
