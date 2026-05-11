import { test, expect } from '@playwright/test';
import { translate } from '../helpers/api-client';
import { createTestSession } from '../helpers/session-factory';

test.describe('13 — Translate endpoint', () => {
  let code: string;
  let studentId: string;

  test.beforeAll(async () => {
    const { session, student } = await createTestSession({ studentName: 'TranslateStudent' });
    code = session.code;
    studentId = student!.studentId;
  });

  test('POST translate returns { translation } for English text', async () => {
    const { status, data } = await translate(code, studentId, 'Reading is fundamental.', 1, 'text-panel');
    expect(status).toBe(201);
    const body = data as { translation: string };
    expect(typeof body.translation).toBe('string');
    expect(body.translation.length).toBeGreaterThan(0);
  });

  test('translate returns same result for identical text (cache hit)', async () => {
    const text = 'The beauty of symmetry';
    const r1 = await translate(code, studentId, text, 1, 'text-panel');
    const r2 = await translate(code, studentId, text, 1, 'text-panel');
    expect((r1.data as { translation: string }).translation)
      .toBe((r2.data as { translation: string }).translation);
  });

  test('translate rejects invalid studentId with 404', async () => {
    const { status } = await translate(code, '00000000-0000-0000-0000-000000000000', 'hello', 1, 'text-panel');
    expect(status).toBe(404);
  });

  test('translate accepts optional phase parameter', async () => {
    const { status, data } = await translate(code, studentId, 'Ideal beauty', 1, 'text-panel', 'exercise');
    expect(status).toBe(201);
    const body = data as { translation: string };
    expect(typeof body.translation).toBe('string');
  });
});
