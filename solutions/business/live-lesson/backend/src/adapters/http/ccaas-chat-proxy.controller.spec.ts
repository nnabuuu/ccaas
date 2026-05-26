/**
 * CcaasChatProxyController tests.
 *
 * Mocks global fetch + the express Response. Coverage:
 *   - GET messages history: passthrough + 404 → empty
 *   - POST bind-project: solutionId injected from auth/me, upstream 4xx → 502
 *   - POST messages SSE: upstream chunks piped, client abort tears down,
 *     upstream !ok → SSE 'error' event written
 *   - resolveTenantId caching: second proxy call doesn't re-fetch /auth/me
 *   - resolveTenantId failure → 503
 */

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
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

  // ── POST /sessions/:sid/bind-project (proxy → ccaas attach-workspace-source) ──
  //
  // β-1 wire change: the browser still sends `{ projectId }` (live-lesson's
  // domain word), but the proxy now calls ccaas's canonical
  // `attach-workspace-source` route with the translated body
  // `{ sourceUrl, sourceIdentity, solutionId }`. The legacy upstream route
  // `bind-project` is still available as an alias on ccaas but we
  // deliberately don't use it — solutions migrate first, the alias is for
  // anyone we haven't migrated yet.

  describe('bindProject', () => {
    it('translates {projectId} → {sourceUrl, sourceIdentity, solutionId} and POSTs to attach-workspace-source', async () => {
      // 1st fetch: auth/me. 2nd: attach-workspace-source.
      const calls: Array<{ url: string; body?: any }> = [];
      mockFetch(async (url, init) => {
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        calls.push({ url, body });
        if (url.endsWith('/api/v1/auth/me')) {
          return jsonResponse({ solutionId: 't-uuid-7' });
        }
        return jsonResponse(
          {
            success: true,
            sessionId: 'sid-1',
            workspaceSource: { sourceUrl: 'http://example/api/projects', sourceIdentity: 'proj-9' },
          },
          201,
        );
      });

      const out = await controller.bindProject('sid-1', { projectId: 'proj-9' });

      expect(calls).toHaveLength(2);
      expect(calls[0].url).toBe('http://ccaas.local/api/v1/auth/me');
      // The wire change: route name + body shape.
      expect(calls[1].url).toBe('http://ccaas.local/api/v1/sessions/sid-1/attach-workspace-source');
      expect(calls[1].body).toEqual({
        // sourceIdentity = the browser's projectId (live-lesson translates).
        sourceIdentity: 'proj-9',
        // sourceUrl derived from env (default localhost:3007 in tests).
        sourceUrl: expect.stringContaining('/api/projects'),
        // solutionId resolved server-side from CcaasUpstream.resolveTenantId.
        solutionId: 't-uuid-7',
      });
      expect(out).toMatchObject({ success: true });
    });

    it('uses LIVE_LESSON_PUBLIC_URL when set, falling back to BACKEND_URL, then localhost', async () => {
      const seen: string[] = [];
      mockFetch(async (url, init) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ solutionId: 't' });
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        if (body?.sourceUrl) seen.push(body.sourceUrl);
        return jsonResponse({ success: true }, 200);
      });

      // 1) LIVE_LESSON_PUBLIC_URL wins
      setEnv({
        CCAAS_API_KEY: 'k',
        CCAAS_URL: 'http://ccaas.local',
        LIVE_LESSON_PUBLIC_URL: 'http://public.example',
        BACKEND_URL: 'http://shouldnotwin',
      });
      // Re-instantiate controller to pick up new env if it caches anything;
      // since resolveArtifactBaseUrl reads env at call time it does not, but
      // be explicit about the env-was-set step for the next assertion.
      await controller.bindProject('s', { projectId: 'p' });

      // 2) BACKEND_URL fallback when LIVE_LESSON_PUBLIC_URL absent
      setEnv({
        CCAAS_API_KEY: 'k',
        CCAAS_URL: 'http://ccaas.local',
        LIVE_LESSON_PUBLIC_URL: undefined,
        BACKEND_URL: 'http://backend.example',
      });
      await controller.bindProject('s', { projectId: 'p' });

      // 3) Bare default when neither is set
      setEnv({
        CCAAS_API_KEY: 'k',
        CCAAS_URL: 'http://ccaas.local',
        LIVE_LESSON_PUBLIC_URL: undefined,
        BACKEND_URL: undefined,
      });
      await controller.bindProject('s', { projectId: 'p' });

      expect(seen).toEqual([
        'http://public.example/api/projects',
        'http://backend.example/api/projects',
        'http://localhost:3007/api/projects',
      ]);
    });

    it('rejects with 400 BadRequest when body lacks projectId (not 502 — browser fault, not gateway)', async () => {
      await expect(controller.bindProject('sid-1', {} as any)).rejects.toThrow(BadRequestException);
    });

    it('passes through upstream 404 as NotFoundException (browser can choose to recreate the session)', async () => {
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ solutionId: 't' });
        return new Response('session not found', { status: 404 });
      });

      await expect(
        controller.bindProject('ghost', { projectId: 'p' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes through upstream 409 as ConflictException (already bound to a different project)', async () => {
      // ccaas returns 409 when the session is already bound to a project
      // different from the one the browser is asking for. This is a real
      // browser-actionable case ("start a new conversation") — collapsing
      // it to 502 would lose that signal, so we surface it verbatim.
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ solutionId: 't' });
        return new Response('session already bound to project p-other', { status: 409 });
      });

      await expect(
        controller.bindProject('sid-rebind', { projectId: 'p-new' }),
      ).rejects.toThrow(ConflictException);
    });

    it('passes through upstream 403 as ForbiddenException (tenant mismatch — surfaces env misconfig honestly)', async () => {
      // 403 from ccaas means the bearer token resolves to a different
      // tenant than the one in the request body. Under the proxy this
      // is impossible by construction (we inject the resolved solutionId
      // ourselves), but if a misconfig ever produces it, we want the
      // operator to see "tenant mismatch" not "ccaas upstream 403".
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ solutionId: 't' });
        return new Response('cross-tenant access denied', { status: 403 });
      });

      await expect(
        controller.bindProject('sid-x', { projectId: 'p-x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('falls back to 502 BadGateway for other 4xx (e.g. unexpected 422) and any 5xx', async () => {
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ solutionId: 't' });
        return new Response('upstream is feeling unwell', { status: 503 });
      });

      await expect(
        controller.bindProject('sid-q', { projectId: 'p' }),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  // ── POST /sessions/:sid/messages (SSE) ─────────────────────────────

  describe('sendMessage (SSE)', () => {
    it('pipes upstream SSE chunks verbatim to the browser', async () => {
      mockFetch(async (url) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ solutionId: 't' });
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
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ solutionId: 't' });
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
          return jsonResponse({ solutionId: 't' });
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

    it('injects solutionId into the upstream request body', async () => {
      let upstreamBody: any;
      mockFetch(async (url, init) => {
        if (url.endsWith('/api/v1/auth/me')) return jsonResponse({ solutionId: 'tnt-X' });
        upstreamBody = JSON.parse(init?.body as string);
        return sseResponse(['data: {}\n\n']);
      });

      const f = fakeRes();
      await controller.sendMessage(
        'sid-1',
        { message: 'm', projectId: 'p', enabledSkills: ['s'], templateName: 'edit-lesson' },
        f.res,
      );

      expect(upstreamBody.solutionId).toBe('tnt-X');
      // Browser sends `projectId`; proxy translates to ccaas's
      // generic `sourceIdentity` and strips the domain word.
      expect(upstreamBody.sourceIdentity).toBe('p');
      expect(upstreamBody.projectId).toBeUndefined();
      expect(upstreamBody.message).toBe('m');
      expect(upstreamBody.enabledSkills).toEqual(['s']);
      expect(upstreamBody.templateName).toBe('edit-lesson');
    });

    it('throws 503 when solutionId resolution fails (BEFORE writing headers)', async () => {
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
          return jsonResponse({ solutionId: 't1' });
        }
        if (url.endsWith('/attach-workspace-source')) {
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
