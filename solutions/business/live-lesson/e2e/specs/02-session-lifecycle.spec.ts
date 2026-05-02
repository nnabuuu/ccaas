import { test, expect } from '@playwright/test';
import { createSession, getSession, startSession, getState, endSession } from '../helpers/api-client';
import { LESSON_ID } from '../helpers/constants';

test.describe('02 — Session lifecycle', () => {
  let code: string;
  let sessionId: string;

  test('POST /api/classroom/sessions creates a session', async () => {
    const { status, data } = await createSession(LESSON_ID);
    expect(status).toBe(201);
    const body = data as { sessionId: string; code: string; lessonId: string; status: string };
    expect(body.code).toHaveLength(6);
    expect(body.lessonId).toBe(LESSON_ID);
    expect(body.status).toBe('waiting');
    code = body.code;
    sessionId = body.sessionId;
  });

  test('GET /api/classroom/sessions/:code returns session', async () => {
    const { status, data } = await getSession(code);
    expect(status).toBe(200);
    const body = data as { sessionId: string; code: string };
    expect(body.sessionId).toBe(sessionId);
    expect(body.code).toBe(code);
  });

  test('POST /api/classroom/sessions/:code/start activates session', async () => {
    const { status, data } = await startSession(code);
    expect(status).toBe(201);
    const body = data as { status: string };
    expect(body.status).toBe('active');
  });

  test('GET /api/classroom/:code/state returns valid shape', async () => {
    const { status, data } = await getState(code);
    expect(status).toBe(200);
    const body = data as {
      metrics: { total: number };
      students: unknown[];
      stepMetrics: Record<string, unknown>;
    };
    expect(body.metrics).toBeDefined();
    expect(typeof body.metrics.total).toBe('number');
    expect(Array.isArray(body.students)).toBe(true);
    expect(body.stepMetrics).toBeDefined();
  });

  test('POST /api/classroom/sessions/:code/end ends session', async () => {
    const { status, data } = await endSession(code);
    expect(status).toBe(201);
    const body = data as { status: string };
    expect(body.status).toBe('ended');
  });
});
