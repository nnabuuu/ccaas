import { test, expect } from '@playwright/test';
import { translate, translateChat } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';

interface TranslateResponse {
  definition: string;
  contextAnalysis: string;
  suggestedQuestions: string[];
}

test.describe('13 — Translate endpoint', () => {
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'TranslateStudent' });
    code = session.code;
    studentId = student!.studentId;
  });

  test('POST translate returns structured response', async () => {
    const { status, data } = await translate(code, studentId, 'Reading is fundamental.', 1, 'text-panel');
    expect(status).toBe(201);
    const body = data as TranslateResponse;
    expect(typeof body.definition).toBe('string');
    expect(body.definition.length).toBeGreaterThan(0);
    expect(typeof body.contextAnalysis).toBe('string');
    expect(Array.isArray(body.suggestedQuestions)).toBe(true);
  });

  test('translate returns same result for identical text (cache hit)', async () => {
    const text = 'The beauty of symmetry';
    const r1 = await translate(code, studentId, text, 1, 'text-panel');
    const r2 = await translate(code, studentId, text, 1, 'text-panel');
    const body1 = r1.data as TranslateResponse;
    const body2 = r2.data as TranslateResponse;
    expect(body1.definition).toBe(body2.definition);
    expect(body1.contextAnalysis).toBe(body2.contextAnalysis);
  });

  test('translate rejects invalid studentId with 404', async () => {
    const { status } = await translate(code, '00000000-0000-0000-0000-000000000000', 'hello', 1, 'text-panel');
    expect(status).toBe(404);
  });

  test('translate accepts optional phase parameter', async () => {
    const { status, data } = await translate(code, studentId, 'Ideal beauty', 1, 'text-panel', 'exercise');
    expect(status).toBe(201);
    const body = data as TranslateResponse;
    expect(typeof body.definition).toBe('string');
  });

  test('POST translate/chat returns { reply }', async () => {
    // First translate to populate cache
    await translate(code, studentId, 'symmetry', 1, 'text-panel');

    const { status, data } = await translateChat(
      code, studentId, 1, 'symmetry', '这个词在这篇文章中有什么特殊含义？', 'text-panel',
    );
    expect(status).toBe(201);
    const body = data as { reply: string };
    expect(typeof body.reply).toBe('string');
    expect(body.reply.length).toBeGreaterThan(0);
  });

  test('translate/chat rejects invalid studentId with 404', async () => {
    const { status } = await translateChat(
      code, '00000000-0000-0000-0000-000000000000', 1, 'hello', '什么意思？', 'text-panel',
    );
    expect(status).toBe(404);
  });
});
