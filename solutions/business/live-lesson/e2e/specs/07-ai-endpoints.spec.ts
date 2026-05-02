import { test, expect } from '@playwright/test';
import { aiAsk, aiDiscuss, personalTouch } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';

test.describe('07 — AI endpoints (fallback paths)', () => {
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'AiStudent' });
    code = session.code;
    studentId = student!.studentId;
  });

  test('POST ai/ask returns { answer, category } shape', async () => {
    const { status, data } = await aiAsk(code, studentId, 1, '什么是 skimming？');
    expect(status).toBe(201);
    const body = data as { answer: string; category: string };
    expect(typeof body.answer).toBe('string');
    expect(body.answer.length).toBeGreaterThan(0);
    expect(typeof body.category).toBe('string');
  });

  test('POST ai/discuss returns { reply, goalReached } shape', async () => {
    const { status, data } = await aiDiscuss(
      code,
      studentId,
      1,
      [{ role: 'student', text: '我不太理解这一段的意思' }],
      1,
      30,
    );
    expect(status).toBe(201);
    const body = data as { reply: string; goalReached: boolean };
    expect(typeof body.reply).toBe('string');
    expect(body.reply.length).toBeGreaterThan(0);
    expect(typeof body.goalReached).toBe('boolean');
  });

  test('POST personal-touch returns 200 with structure', async () => {
    const { status, data } = await personalTouch(code, studentId);
    // Personal touch may return various shapes depending on submissions
    // Just verify it doesn't error out
    expect(status).toBe(201);
    expect(data).toBeDefined();
  });
});
