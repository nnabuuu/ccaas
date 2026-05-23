import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import { createPreviewServer } from '../backend/preview-server';
import { defineStories } from '../core/define-stories';
import { extractBundleFromModule } from '../core/story-loader';
import type { Story } from '../core/types';

function buildBundleWithGrade() {
  const grade = ({
    answerKey,
    data,
  }: {
    answerKey: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => {
    const correct = answerKey.correct as number;
    const studentAnswers = (data.answers as number[]) ?? [];
    const ok = studentAnswers[0] === correct;
    return { total: ok ? 100 : 0, byDimension: { q0: ok } };
  };
  const plugin = { type: 'quiz', displayName: 'Quiz', grade };
  const defaultExport = defineStories({ plugin, meta: { title: 'Quiz Test' } });
  // Re-attach grade since defineStories doesn't include it in the args type
  (defaultExport.plugin as Record<string, unknown>).grade = grade;

  const Default: Story = {
    name: 'Default',
    answerKey: { type: 'quiz', correct: 1 },
    initialAns: { answers: [0] },
  };
  return extractBundleFromModule('/fake/quiz.stories.ts', { default: defaultExport, Default });
}

function request(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: 'localhost',
        port,
        method,
        path,
        headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data).toString() } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

describe('PreviewServer (smoke)', () => {
  // Pick a high-numbered ephemeral port unlikely to collide
  const port = 43217;
  let server: ReturnType<typeof createPreviewServer>;

  beforeAll(async () => {
    server = createPreviewServer({ port, bundles: [buildBundleWithGrade()] });
    await server.start();
  });
  afterAll(async () => {
    await server.stop();
  });

  it('GET /preview/health responds ok', async () => {
    const res = await request(port, 'GET', '/preview/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, bundles: 1 });
  });

  it('GET /preview/bundles lists the registered bundle', async () => {
    const res = await request(port, 'GET', '/preview/bundles');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const arr = res.body as Array<Record<string, unknown>>;
    expect(arr).toHaveLength(1);
    expect(arr[0].bundleId).toBe('quiz');
  });

  it('POST /preview/sessions creates a session', async () => {
    const res = await request(port, 'POST', '/preview/sessions', {
      bundleId: 'quiz',
      storyName: 'Default',
    });
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(typeof body.sessionId).toBe('string');
    expect(body.story).toBeDefined();
  });

  it('POST /preview/sessions/:id/check grades correctly', async () => {
    const create = await request(port, 'POST', '/preview/sessions', {
      bundleId: 'quiz',
      storyName: 'Default',
    });
    const sessionId = (create.body as { sessionId: string }).sessionId;

    const wrong = await request(port, 'POST', `/preview/sessions/${sessionId}/check`, {
      ans: { answers: [0] },
    });
    expect(wrong.status).toBe(200);
    expect((wrong.body as { ok: boolean; total?: number }).ok).toBe(true);
    expect((wrong.body as { total?: number }).total).toBe(0);

    const right = await request(port, 'POST', `/preview/sessions/${sessionId}/check`, {
      ans: { answers: [1] },
    });
    expect((right.body as { total?: number }).total).toBe(100);
  });

  it('GET /preview/sessions/:id/inspector returns grade history', async () => {
    const create = await request(port, 'POST', '/preview/sessions', {
      bundleId: 'quiz',
      storyName: 'Default',
    });
    const sessionId = (create.body as { sessionId: string }).sessionId;
    await request(port, 'POST', `/preview/sessions/${sessionId}/check`, { ans: { answers: [1] } });
    await request(port, 'POST', `/preview/sessions/${sessionId}/check`, { ans: { answers: [0] } });

    const insp = await request(port, 'GET', `/preview/sessions/${sessionId}/inspector`);
    expect(insp.status).toBe(200);
    const body = insp.body as { gradeHistory: unknown[] };
    expect(body.gradeHistory).toHaveLength(2);
  });

  it('POST /preview/sessions/:id/reset clears history', async () => {
    const create = await request(port, 'POST', '/preview/sessions', {
      bundleId: 'quiz',
      storyName: 'Default',
    });
    const sessionId = (create.body as { sessionId: string }).sessionId;
    await request(port, 'POST', `/preview/sessions/${sessionId}/check`, { ans: { answers: [1] } });

    const reset = await request(port, 'POST', `/preview/sessions/${sessionId}/reset`);
    expect(reset.status).toBe(200);

    const insp = await request(port, 'GET', `/preview/sessions/${sessionId}/inspector`);
    expect((insp.body as { gradeHistory: unknown[] }).gradeHistory).toHaveLength(0);
  });

  it('returns 404 for unknown bundle', async () => {
    const res = await request(port, 'GET', '/preview/bundles/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown route', async () => {
    const res = await request(port, 'GET', '/no/such/route');
    expect(res.status).toBe(404);
  });
});
