/**
 * CcaasChatProxyController tests.
 *
 * Mocks global fetch + the express Response. Coverage:
 *   - GET messages history: passthrough + 404 → empty
 *   - POST bind-project: tenantId injected from auth/me, upstream 4xx → 502
 *   - POST messages SSE: upstream chunks piped, client abort tears down,
 *     upstream !ok → SSE 'error' event written
 *   - resolveTenantId caching: second proxy call doesn't re-fetch /auth/me
 *   - resolveTenantId failure → 503
 */

import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CcaasChatProxyController } from './ccaas-chat-proxy.controller';
import { CcaasUpstream } from './ccaas-upstream.service';

// ── Test scaffolding ─────────────────────────────────────────────────

const ORIG_ENV = { ...process.env };

function setEnv(over: Record<string, string | undefined>) {
  process.env = { ...ORIG_ENV, ...over };
}

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  (globalThis as any).fetch = jest.fn(handler);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(encoder.encode(ch));
      c.close();
    },
  });
  return new Response(stream as any, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

/**
 * Fake express Response capturing all writes. Captures headers + chunks
 * + close handler so we can fire 'close' to simulate browser disconnect.
 */
function fakeRes() {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  let ended = false;
  let closeHandler: (() => void) | null = null;
  const flushed = { headers: false };

  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    flushHeaders: () => {
      flushed.headers = true;
    },
    write: (s: string) => {
      chunks.push(s);
      return true;
    },
    end: () => {
      ended = true;
    },
    on: (event: string, cb: () => void) => {
      if (event === 'close') closeHandler = cb;
    },
    get writableEnded() {
      return ended;
    },
  };

  return {
    res: res as any,
    headers,
    chunks,
    isEnded: () => ended,
    flushed,
    fireClose: () => closeHandler?.(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('CcaasChatProxyController', () => {
  let controller: CcaasChatProxyController;
  let upstream: CcaasUpstream;

  beforeEach(() => {
    setEnv({ CCAAS_URL: 'http://ccaas.local', CCAAS_API_KEY: 'sk-test' });
    upstream = new CcaasUpstream();
    controller = new CcaasChatProxyController(upstream);
  });

  afterEach(() => {
    process.env = ORIG_ENV;
    delete (globalThis as any).fetch;
  });

  // ── GET /sessions/:sid/messages (history) ──────────────────────────

  describe('listMessages', () => {
    it('proxies history with Authorization header from env', async () => {
      let capturedAuth: string | undefined;
      let capturedUrl: string | undefined;
      mockFetch(async (url, init) => {
        capturedUrl = url;
        capturedAuth = (init?.headers as any)?.Authorization;
        return jsonResponse({ messages: [{ id: 'm1', role: 'user', content: 'hi' }] });
      });

      const out = await controller.listMessages('sid-1', '50');

      expect(capturedAuth).toBe('Bearer sk-test');
      expect(capturedUrl).toBe('http://ccaas.local/api/v1/sessions/sid-1/messages?limit=50');
      expect(out).toEqual({ messages: [{ id: 'm1', role: 'user', content: 'hi' }] });
    });

    it('maps upstream 404 to empty messages (fresh session has no rows)', async () => {
      mockFetch(async () => new Response('{}', { status: 404 }));

      const out = await controller.listMessages('sid-fresh');

      expect(out).toEqual({ messages: [] });
    });

    it('promotes other upstream errors to 502', async () => {
      mockFetch(async () => new Response('oops', { status: 500 }));

      await expect(controller.listMessages('sid-bad')).rejects.toThrow(BadGatewayException);
    });
  });

  // ── POST /sessions/:sid/bind-project ───────────────────────────────

  describe('bindProject', () => {
    it('injects tenantId from /auth/me and forwards projectId', async () => {
      // 1st fetch: auth/me. 2nd: bind-project.
      const calls: Array<{ url: string; body?: any }> = [];
      mockFetch(async (url, init) => {
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        calls.push({ url, body });
        if (url.endsWith('/api/v1/auth/me')) {
          return jsonResponse({ tenantId: 't-uuid-7' });
        }
        return jsonResponse({ success: true, sessionId: 'sid-1', projectId: 'proj-9' }, 201);
      });

      const out = await controller.bindProject('sid-1', { projectId: 'proj-9' });

      expect(calls).toHaveLength(2);
      expect(calls[0].url).toBe('http://ccaas.local/api/v1/auth/me');
      expect(calls[1].url).toBe('http://ccaas.local/api/v1/sessions/sid-1/bind-project');
      expect(calls[1].body).toEqual({ projectId: 'proj-9', tenantId: 't-uuid-7' });
      expect(out).toMatchObject({ success: true });
    });

    it('rejects with 400 BadRequest when body lacks projectId (not 502 — browser fault, not gateway)', async () => {
      await expect(controller.bindProject('sid-1', {} as any)).rejects.toThrow(BadRequestException);
    });

    it('promotes upstream 4xx to 502', async () => {
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ tenantId: 't' });
        return new Response('session not found', { status: 404 });
      });

      await expect(
        controller.bindProject('ghost', { projectId: 'p' }),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  // ── POST /sessions/:sid/messages (SSE) ─────────────────────────────

  describe('sendMessage (SSE)', () => {
    it('pipes upstream SSE chunks verbatim to the browser', async () => {
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ tenantId: 't' });
        return sseResponse([
          'data: {"event":"text_delta","delta":"hi"}\n\n',
          'data: {"event":"done"}\n\n',
        ]);
      });

      const f = fakeRes();
      await controller.sendMessage('sid-1', { message: 'hello' }, f.res);

      expect(f.headers['Content-Type']).toBe('text/event-stream');
      expect(f.flushed.headers).toBe(true);
      // Verbatim pipe — no re-formatting on our side.
      expect(f.chunks.join('')).toContain('text_delta');
      expect(f.chunks.join('')).toContain('done');
      expect(f.isEnded()).toBe(true);
    });

    it('writes a proper SseEnvelope error when upstream returns !ok (so useAgentChat parser surfaces it)', async () => {
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ tenantId: 't' });
        return new Response('unauthorized', { status: 401 });
      });

      const f = fakeRes();
      await controller.sendMessage('sid-1', { message: 'hi' }, f.res);

      // CRITICAL: the frontend (useAgentChat.ts) only inspects `data:`
      // lines and expects them to JSON-parse into the ccaas
      // StreamEventEnvelope shape `{ seq, sessionId, timestamp, event }`
      // with `event.type` set. A raw `event: error\ndata: {message}`
      // SSE frame would be silently dropped by the parser's catch.
      const joined = f.chunks.join('');
      expect(joined).toMatch(/^data: /);
      // Extract the JSON after `data: ` up to the `\n\n` terminator
      const match = joined.match(/^data: (.+?)\n\n/);
      expect(match).not.toBeNull();
      const envelope = JSON.parse(match![1]);
      expect(envelope.event.type).toBe('error');
      expect(envelope.event.code).toBe('401');
      expect(envelope.event.message).toContain('unauthorized');
      expect(envelope.sessionId).toBe('sid-1');
      expect(f.isEnded()).toBe(true);
    });

    it('writes a proper SseEnvelope error on connect failure (mid-stream-class errors too)', async () => {
      // Tenant resolution succeeds, then the messages fetch throws
      // (simulating ccaas down between auth/me and the POST).
      let meDone = false;
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) {
          meDone = true;
          return jsonResponse({ tenantId: 't' });
        }
        if (!meDone) return jsonResponse({});
        throw new TypeError('fetch failed: ECONNREFUSED');
      });

      const f = fakeRes();
      await controller.sendMessage('sid-2', { message: 'hi' }, f.res);

      const joined = f.chunks.join('');
      const match = joined.match(/^data: (.+?)\n\n/);
      expect(match).not.toBeNull();
      const envelope = JSON.parse(match![1]);
      expect(envelope.event.type).toBe('error');
      expect(envelope.event.code).toBe('UPSTREAM_CONNECT');
      expect(envelope.event.message).toContain('ECONNREFUSED');
      expect(f.isEnded()).toBe(true);
    });

    it('injects tenantId into the upstream request body', async () => {
      let upstreamBody: any;
      mockFetch(async (url, init) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ tenantId: 'tnt-X' });
        upstreamBody = JSON.parse(init?.body as string);
        return sseResponse(['data: {}\n\n']);
      });

      const f = fakeRes();
      await controller.sendMessage(
        'sid-1',
        { message: 'm', projectId: 'p', enabledSkills: ['s'], templateName: 'edit-lesson' },
        f.res,
      );

      expect(upstreamBody.tenantId).toBe('tnt-X');
      expect(upstreamBody.projectId).toBe('p');
      expect(upstreamBody.message).toBe('m');
      expect(upstreamBody.enabledSkills).toEqual(['s']);
      expect(upstreamBody.templateName).toBe('edit-lesson');
    });

    it('throws 503 when tenantId resolution fails (BEFORE writing headers)', async () => {
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return new Response('forbidden', { status: 403 });
        // Should never reach here.
        return jsonResponse({});
      });

      const f = fakeRes();
      await expect(
        controller.sendMessage('sid-1', { message: 'hi' }, f.res),
      ).rejects.toThrow(ServiceUnavailableException);
      // No SSE bytes written because failure happened before flush.
      expect(f.chunks).toHaveLength(0);
      // res.flushHeaders called BEFORE the await — that's intentional;
      // the SSE handshake commits to streaming the moment we know we
      // can. Failing AFTER flush would be a partial response (acceptable
      // for SSE — browsers handle it as an empty stream). Failing BEFORE
      // (the resolveTenantId case) is cleaner: 503 with full body.
    });
  });

  // ── Tenant cache behavior (shared via CcaasUpstream) ───────────────

  describe('resolveTenantId caching', () => {
    it('only fetches /auth/me once across multiple proxy calls', async () => {
      let meCallCount = 0;
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) {
          meCallCount++;
          return jsonResponse({ tenantId: 't1' });
        }
        if (url.endsWith('/bind-project')) {
          return jsonResponse({ success: true });
        }
        return sseResponse(['data: {}\n\n']);
      });

      await controller.bindProject('s1', { projectId: 'p1' });
      await controller.bindProject('s2', { projectId: 'p2' });
      const f = fakeRes();
      await controller.sendMessage('s3', { message: 'hi' }, f.res);

      // 3 proxy calls, only 1 /auth/me lookup.
      expect(meCallCount).toBe(1);
    });
  });
});
