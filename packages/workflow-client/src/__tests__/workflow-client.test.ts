/**
 * WorkflowClient tests — uses a fake fetch implementation for full
 * control over response shape + status code without booting the
 * platform backend.
 */

import { describe, it, expect } from 'vitest';
import { WorkflowClient, type WorkflowPushOutcome } from '../index.js';

function fakeFetch(
  response: { status: number; body: unknown },
): { fetch: typeof fetch; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const f = async (input: any, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return {
      status: response.status,
      json: async () => response.body,
    } as Response;
  };
  return { fetch: f as typeof fetch, calls };
}

describe('WorkflowClient', () => {
  it('constructs with required baseUrl + apiKey; throws otherwise', () => {
    expect(
      () => new WorkflowClient({ baseUrl: '', apiKey: 'k' }),
    ).toThrow(/requires baseUrl/);
    expect(
      () => new WorkflowClient({ baseUrl: 'http://x', apiKey: '' }),
    ).toThrow(/requires/);
    expect(
      () => new WorkflowClient({ baseUrl: 'http://x', apiKey: 'k', fetchImpl: globalThis.fetch }),
    ).not.toThrow();
  });

  it('POSTs to the right URL with Authorization + Content-Type headers', async () => {
    const f = fakeFetch({ status: 202, body: { accepted: true, eventId: 'evt-1' } });
    const client = new WorkflowClient({
      baseUrl: 'http://localhost:3001/', // trailing slash should be stripped
      apiKey: 'sk-test',
      fetchImpl: f.fetch,
    });
    const result = await client.pushEvent('s1', {
      eventId: 'evt-1',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'student-1',
      payload: { type: 'student_joined' },
    });
    expect(result).toEqual({ status: 'accepted', eventId: 'evt-1' });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(
      'http://localhost:3001/api/v1/workflow/sessions/s1/events',
    );
    const headers = f.calls[0].init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('includes X-Ccaas-On-Behalf-Of when onBehalfOfSolutionId is set', async () => {
    const f = fakeFetch({ status: 202, body: { accepted: true, eventId: 'evt-2' } });
    const client = new WorkflowClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      onBehalfOfSolutionId: 'tenant-uuid-123',
      fetchImpl: f.fetch,
    });
    await client.pushEvent('s1', {
      eventId: 'evt-2',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'e',
      payload: {},
    });
    const headers = f.calls[0].init?.headers as Record<string, string>;
    expect(headers['X-Ccaas-On-Behalf-Of']).toBe('tenant-uuid-123');
  });

  it('maps 200 with dropped:duplicate to {status:duplicate}', async () => {
    const f = fakeFetch({
      status: 200,
      body: { accepted: false, dropped: 'duplicate', eventId: 'evt-3' },
    });
    const client = new WorkflowClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetchImpl: f.fetch,
    });
    const result = await client.pushEvent('s1', {
      eventId: 'evt-3',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'e',
      payload: {},
    });
    expect(result).toEqual({ status: 'duplicate', eventId: 'evt-3' });
  });

  it('maps 202 with dropped:disabled to {status:disabled}', async () => {
    const f = fakeFetch({
      status: 202,
      body: { accepted: false, dropped: 'disabled', eventId: 'evt-4' },
    });
    const client = new WorkflowClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetchImpl: f.fetch,
    });
    const result = await client.pushEvent('s1', {
      eventId: 'evt-4',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'e',
      payload: {},
    });
    expect(result).toEqual({ status: 'disabled', eventId: 'evt-4' });
  });

  it('returns failed with retryable=false on 4xx (caller must NOT retry)', async () => {
    const f = fakeFetch({
      status: 400,
      body: { message: 'validation error' },
    });
    const client = new WorkflowClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetchImpl: f.fetch,
    });
    const result = (await client.pushEvent('s1', {
      eventId: 'evt-5',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'e',
      payload: {},
    })) as Extract<WorkflowPushOutcome, { status: 'failed' }>;
    expect(result.status).toBe('failed');
    expect(result.retryable).toBe(false);
    expect(result.httpStatus).toBe(400);
    expect(result.error).toBe('validation error');
  });

  it('returns failed with retryable=true on 5xx (caller should backoff + retry)', async () => {
    const f = fakeFetch({
      status: 503,
      body: { message: 'service unavailable' },
    });
    const client = new WorkflowClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetchImpl: f.fetch,
    });
    const result = (await client.pushEvent('s1', {
      eventId: 'evt-6',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'e',
      payload: {},
    })) as Extract<WorkflowPushOutcome, { status: 'failed' }>;
    expect(result.status).toBe('failed');
    expect(result.retryable).toBe(true);
    expect(result.httpStatus).toBe(503);
  });

  it('returns failed with retryable=true on network error (fetch throws)', async () => {
    const client = new WorkflowClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    const result = (await client.pushEvent('s1', {
      eventId: 'evt-7',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'e',
      payload: {},
    })) as Extract<WorkflowPushOutcome, { status: 'failed' }>;
    expect(result.status).toBe('failed');
    expect(result.retryable).toBe(true);
    expect(result.error).toBe('ECONNREFUSED');
  });

  it('returns failed retryable=false on empty sessionId (caller bug)', async () => {
    const f = fakeFetch({ status: 202, body: { accepted: true, eventId: 'x' } });
    const client = new WorkflowClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetchImpl: f.fetch,
    });
    const result = (await client.pushEvent('', {
      eventId: 'evt-8',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'e',
      payload: {},
    })) as Extract<WorkflowPushOutcome, { status: 'failed' }>;
    expect(result.status).toBe('failed');
    expect(result.retryable).toBe(false);
    expect(f.calls).toHaveLength(0); // no fetch attempted
  });

  it('S-6: 408/425/429 are retryable; 501/505 are terminal', async () => {
    for (const [status, expected] of [
      [408, true],
      [425, true],
      [429, true],
      [501, false],
      [505, false],
    ] as const) {
      const f = fakeFetch({ status, body: { message: 'x' } });
      const client = new WorkflowClient({
        baseUrl: 'http://x',
        apiKey: 'k',
        fetchImpl: f.fetch,
      });
      const result = (await client.pushEvent('s1', {
        eventId: 'e',
        manifestName: 'M',
        streamApiName: 'e',
        entityId: 'e',
        payload: {},
      })) as Extract<WorkflowPushOutcome, { status: 'failed' }>;
      expect(result.retryable).toBe(expected);
      expect(result.httpStatus).toBe(status);
    }
  });

  it('encodes sessionId in URL (safe against path-injection)', async () => {
    const f = fakeFetch({ status: 202, body: { accepted: true, eventId: 'x' } });
    const client = new WorkflowClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetchImpl: f.fetch,
    });
    await client.pushEvent('weird/session id', {
      eventId: 'evt-9',
      manifestName: 'M',
      streamApiName: 'e',
      entityId: 'e',
      payload: {},
    });
    expect(f.calls[0].url).toBe(
      'http://x/api/v1/workflow/sessions/weird%2Fsession%20id/events',
    );
  });
});
