import { test, expect } from '@playwright/test';
import {
  submitAnswer,
  reportPhase,
  aiDiscuss,
  getStudentProgress,
  getChatHistory,
  discussComplete,
} from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';
import { QUIZ_CORRECT_ANSWERS } from '../helpers/constants';

/**
 * Tests discuss phase recovery: discussMeta persistence, chat history,
 * and lifecycle (startedAt → goalReached → clear on task change).
 *
 * NOTE: aiDiscuss calls the real LLM, so goalReached may be true even
 * on the first round. Tests are written to handle either outcome.
 */
test.describe('09 — Discuss recovery (discussMeta + chat persistence)', () => {
  let code: string;
  let studentId: string;
  let firstGoalReached = false;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'DiscRecoveryTest' });
    code = session.code;
    studentId = student!.studentId;

    // Progress student to discuss phase on task 1
    await submitAnswer(code, studentId, 1, { answers: QUIZ_CORRECT_ANSWERS });
    await reportPhase(code, studentId, 1, 'discuss');
  });

  test('aiDiscuss sets discussMeta.startedAt in progress', async () => {
    const res = await aiDiscuss(code, studentId, 1, [
      { role: 'student', text: 'I think the writer uses contrast to create tension.' },
    ], 1, 10);
    expect(res.status).toBe(201);
    const body = res.data as { reply: string; goalReached: boolean };
    firstGoalReached = body.goalReached;

    const { status, data } = await getStudentProgress(code, studentId);
    expect(status).toBe(200);
    const progress = data as { currentTask: number; currentPhase: string; discussMeta: { startedAt: string; goalReached?: boolean } | null };
    expect(progress.discussMeta).not.toBeNull();
    expect(typeof progress.discussMeta!.startedAt).toBe('string');
    // If LLM returned goalReached, it should be persisted
    if (firstGoalReached) {
      expect(progress.discussMeta!.goalReached).toBe(true);
    }
  });

  test('progress?include=submissions includes discussMeta', async () => {
    const { status, data } = await getStudentProgress(code, studentId, 'submissions');
    expect(status).toBe(200);
    const body = data as { currentTask: number; currentPhase: string; discussMeta: { startedAt: string; goalReached?: boolean } | null; submissions: Record<string, unknown> };
    expect(body.discussMeta).not.toBeNull();
    expect(body.discussMeta!.startedAt).toBeDefined();
  });

  test('chat history persists discuss thread after aiDiscuss', async () => {
    const { status, data } = await getChatHistory(code, studentId, 'discuss:1');
    expect(status).toBe(200);
    // Response format: { "discuss:1": [{ role, content, seq, createdAt }] }
    const threads = data as Record<string, Array<{ role: string; content: string; seq: number }>>;
    const thread = threads['discuss:1'];
    expect(Array.isArray(thread)).toBe(true);
    // Should contain at least the student message and AI reply
    expect(thread.length).toBeGreaterThanOrEqual(2);
    expect(thread.some(m => m.role === 'student')).toBe(true);
    expect(thread.some(m => m.role === 'ai')).toBe(true);
  });

  test('second aiDiscuss round preserves startedAt', async () => {
    const before = await getStudentProgress(code, studentId);
    const metaBefore = (before.data as any).discussMeta;
    // If goalReached was already true, startedAt is still present
    expect(metaBefore).not.toBeNull();
    const startedAtBefore = metaBefore.startedAt;

    // Second round (LLM call)
    await aiDiscuss(code, studentId, 1, [
      { role: 'student', text: 'I think the writer uses contrast to create tension.' },
      { role: 'ai', text: 'Interesting thought.' },
      { role: 'student', text: 'It shows two opposing standards of beauty.' },
    ], 2, 30);

    const after = await getStudentProgress(code, studentId);
    const metaAfter = (after.data as any).discussMeta;
    expect(metaAfter).not.toBeNull();
    expect(metaAfter.startedAt).toBe(startedAtBefore);
  });

  test('chat history grows after multiple rounds', async () => {
    const { status, data } = await getChatHistory(code, studentId, 'discuss:1');
    expect(status).toBe(200);
    const threads = data as Record<string, Array<{ role: string; content: string }>>;
    const thread = threads['discuss:1'];
    expect(Array.isArray(thread)).toBe(true);
    // After 2 aiDiscuss calls: at least 4 messages (2 student + 2 AI)
    expect(thread.length).toBeGreaterThanOrEqual(4);
  });

  test('discussComplete advances to takeaway and clears discussMeta on task change', async () => {
    const completeRes = await discussComplete(code, studentId, 1, 'goal_reached', 2, 40);
    expect(completeRes.status).toBe(201);

    // discussComplete auto-advances to takeaway
    const prog1 = await getStudentProgress(code, studentId);
    const p1 = prog1.data as { currentTask: number; currentPhase: string; discussMeta: any };
    expect(p1.currentPhase).toBe('takeaway');

    // Advance through takeaway → completed → task 2 listen
    await reportPhase(code, studentId, 1, 'completed');
    await reportPhase(code, studentId, 2, 'listen');

    // discussMeta should be cleared on new task
    const prog2 = await getStudentProgress(code, studentId);
    const p2 = prog2.data as { currentTask: number; currentPhase: string; discussMeta: any };
    expect(p2.currentTask).toBe(2);
    expect(p2.discussMeta).toBeNull();
  });
});
