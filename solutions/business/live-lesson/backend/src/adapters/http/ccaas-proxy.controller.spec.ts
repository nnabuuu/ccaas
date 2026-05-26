/**
 * CcaasProxyController tests.
 *
 * Mocks global `fetch`. Coverage:
 *   - 503 when CCAAS_API_KEY is unset (the operator-friendly fail-loud)
 *   - SSE proxy:
 *     - upstream URL includes token from env (no key in browser request)
 *     - SSE response body is parsed and emitted as MessageEvents (JSON
 *       and raw-string data both round-trip)
 *     - upstream !ok status surfaces as Observable error
 *     - client teardown aborts upstream via AbortController
 *   - invalidate:
 *     - upstream POST issued with token
 *     - 2xx upstream → `{ accepted: true }` + 202 ack
 *     - non-2xx upstream → `{ accepted: false }` (no throw — invalidate
 *       is "optional optimization")
 */

import { firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';

import { CcaasProxyController } from './ccaas-proxy.controller';
import { CcaasUpstream } from './ccaas-upstream.service';

const ORIG_ENV = process.env;

function setEnv(over: Record<string, string | undefined>) {
  process.env = { ...ORIG_ENV, ...over };
}

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  (globalThis as any).fetch = jest.fn(handler);
}

/**
 * Synthesize an SSE response from a list of frames. Each frame is a
 * pre-formatted SSE event block ending in `\n\n`. Caller controls
 * boundary positions so we can also exercise chunk splitting.
 */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream as any, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('CcaasProxyController', () => {
  let controller: CcaasProxyController;

  beforeEach(() => {
    setEnv({ CCAAS_URL: 'http://ccaas.local', CCAAS_API_KEY: 'sk-test' });
    // CcaasUpstream is a tiny env+fetch helper — instantiate directly
    // (no DB / no remote deps) instead of mocking.
    controller = new CcaasProxyController(new CcaasUpstream());
  });

  afterEach(() => {
    process.env = ORIG_ENV;
    delete (globalThis as any).fetch;
  });

  describe('env preconditions', () => {
    it('throws 503 ServiceUnavailable when CCAAS_API_KEY is unset (fail-loud)', () => {
      setEnv({ CCAAS_URL: 'http://ccaas.local', CCAAS_API_KEY: undefined });
      mockFetch(() => {
        throw new Error('should not be called');
      });
      // The exception is raised inside resolveCcaas, which both endpoints
      // call. SSE endpoint propagates synchronously via Observable error.
      expect(() => controller.changes$('p1').subscribe()).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('GET /projects/:projectId/changes (SSE proxy)', () => {
    it('opens upstream with the env CCAAS_API_KEY in ?token=', async () => {
      let observedUrl = '';
      mockFetch((url) => {
        observedUrl = url;
        return sseResponse([
          'id: 1\ndata: {"kind":"subscribed","projectId":"p1"}\n\n',
        ]);
      });
      const first = await firstValueFrom(controller.changes$('p1').pipe(take(1)));
      // β-3: proxy calls ccaas's canonical /workspaces/ route (the
      // old /projects/ route still works as alias on ccaas, but we
      // pin the canonical URL here so future renames stay honest).
      expect(observedUrl).toBe(
        'http://ccaas.local/workspaces/p1/changes?token=sk-test',
      );
      expect((first.data as any).kind).toBe('subscribed');
      expect((first.data as any).projectId).toBe('p1');
    });

    it('URL-encodes projectId so funky chars do not bleed into the upstream URL', async () => {
      let observedUrl = '';
      mockFetch((url) => {
        observedUrl = url;
        return sseResponse(['data: {"kind":"subscribed"}\n\n']);
      });
      await firstValueFrom(controller.changes$('p/1?evil=true').pipe(take(1)));
      expect(observedUrl).toBe(
        'http://ccaas.local/workspaces/p%2F1%3Fevil%3Dtrue/changes?token=sk-test',
      );
    });

    it('parses multiple SSE events from one chunk and emits them in order', async () => {
      mockFetch(() =>
        sseResponse([
          'id: 1\ndata: {"kind":"subscribed","projectId":"p1"}\n\n' +
            'id: 2\ndata: {"path":"lesson.md","kind":"updated"}\n\n',
        ]),
      );
      const events = await firstValueFrom(
        controller.changes$('p1').pipe(take(2), toArray()),
      );
      expect(events).toHaveLength(2);
      expect((events[0].data as any).kind).toBe('subscribed');
      expect((events[1].data as any).path).toBe('lesson.md');
    });

    it('handles SSE events that arrive split across chunk boundaries', async () => {
      // First chunk has half the event; second chunk completes it.
      mockFetch(() =>
        sseResponse([
          'data: {"kind":"sub',
          'scribed","projectId":"p1"}\n\n',
        ]),
      );
      const first = await firstValueFrom(controller.changes$('p1').pipe(take(1)));
      expect((first.data as any).kind).toBe('subscribed');
    });

    it('forwards raw-string data verbatim when upstream sends non-JSON', async () => {
      mockFetch(() => sseResponse(['data: not-json-just-text\n\n']));
      const first = await firstValueFrom(controller.changes$('p1').pipe(take(1)));
      expect(first.data).toBe('not-json-just-text');
    });

    it('errors the Observable when upstream returns non-2xx', async () => {
      mockFetch(() => new Response('forbidden', { status: 403 }));
      await expect(
        firstValueFrom(controller.changes$('p1').pipe(take(1))),
      ).rejects.toThrow(/upstream 403/);
    });

    it('scrubs any token=… echoed in the upstream error body before throwing', async () => {
      // A misconfigured intermediary (nginx default 404, Express
      // notFound, etc.) might echo `req.url` into the response body,
      // which would otherwise leak the master CCAAS_API_KEY into the
      // thrown Error message → exception filter logs → key in stderr.
      mockFetch(
        () =>
          new Response(
            'Cannot GET /projects/p1/changes?token=sk-leaked-master-key',
            { status: 404 },
          ),
      );
      await expect(
        firstValueFrom(controller.changes$('p1').pipe(take(1))),
      ).rejects.toThrow(/token=\*\*\*/);
      await expect(
        firstValueFrom(controller.changes$('p1').pipe(take(1))),
      ).rejects.not.toThrow(/sk-leaked-master-key/);
    });

    it('errors when upstream returns 200 but non-SSE content-type (CDN intercept / HTML)', async () => {
      mockFetch(
        () =>
          new Response('<html><body>captive portal</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }),
      );
      await expect(
        firstValueFrom(controller.changes$('p1').pipe(take(1))),
      ).rejects.toThrow(/non-SSE content-type.*text\/html/);
    });

    it('handles SSE frames terminated with CRLF (proxies that normalize line endings)', async () => {
      mockFetch(() =>
        sseResponse([
          'id: 1\r\ndata: {"kind":"subscribed","projectId":"p1"}\r\n\r\n',
        ]),
      );
      const first = await firstValueFrom(controller.changes$('p1').pipe(take(1)));
      expect((first.data as any).kind).toBe('subscribed');
    });

    it('errors the Observable when upstream connect throws (network error)', async () => {
      mockFetch(() => {
        throw new Error('ECONNREFUSED');
      });
      await expect(
        firstValueFrom(controller.changes$('p1').pipe(take(1))),
      ).rejects.toThrow(/connect failed.*ECONNREFUSED/);
    });

    it('aborts the upstream fetch when the subscriber unsubscribes', async () => {
      let observedSignal: AbortSignal | undefined;
      mockFetch((_url, init) => {
        observedSignal = init?.signal as AbortSignal;
        // Return a never-completing stream so teardown is the only exit.
        return sseResponse([]); // empty stream — will sit waiting
      });
      const sub = controller.changes$('p1').subscribe(() => undefined);
      // Microtask-flush to let the inner async fetch start.
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      expect(observedSignal?.aborted).toBe(false);
      sub.unsubscribe();
      expect(observedSignal?.aborted).toBe(true);
    });
  });

  describe('POST /projects/:projectId/invalidate', () => {
    it('issues a POST to upstream with the token and returns { accepted: true } on 2xx', async () => {
      let observedUrl = '';
      let observedMethod = '';
      mockFetch((url, init) => {
        observedUrl = url;
        observedMethod = init?.method ?? '';
        return new Response(null, { status: 202 });
      });
      const out = await controller.invalidate('p1');
      // β-3: canonical /workspaces/ route (alias /projects/ stays
      // working on ccaas, but the proxy calls canonical).
      expect(observedUrl).toBe(
        'http://ccaas.local/workspaces/p1/invalidate?token=sk-test',
      );
      expect(observedMethod).toBe('POST');
      expect(out).toEqual({ accepted: true });
    });

    it('returns { accepted: false } (no throw) on upstream 5xx — optional-optimization swallow', async () => {
      mockFetch(() => new Response('upstream busy', { status: 503 }));
      const out = await controller.invalidate('p1');
      expect(out).toEqual({ accepted: false });
    });

    it('returns { accepted: false } on upstream 404 — project not yet bound is also benign', async () => {
      mockFetch(() => new Response('not found', { status: 404 }));
      const out = await controller.invalidate('p1');
      expect(out).toEqual({ accepted: false });
    });

    it('throws 502 BadGateway on upstream 401 — auth misconfig is operator-actionable', async () => {
      // Wrong CCAAS_API_KEY would otherwise silently degrade: SSE keeps
      // working (cached / re-authed) but invalidate never re-syncs, and
      // the browser just sees calm 202s forever. Promote to 502 so the
      // misconfig surfaces.
      mockFetch(() => new Response('unauthorized', { status: 401 }));
      await expect(controller.invalidate('p1')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('throws 502 BadGateway on upstream 403 (same operator-actionable category)', async () => {
      mockFetch(() => new Response('forbidden', { status: 403 }));
      await expect(controller.invalidate('p1')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('throws on upstream connect error so the caller can decide retry policy', async () => {
      mockFetch(() => {
        throw new Error('ETIMEDOUT');
      });
      await expect(controller.invalidate('p1')).rejects.toThrow(
        /connect failed.*ETIMEDOUT/,
      );
    });

    it('throws 503 if CCAAS_API_KEY is unset', async () => {
      setEnv({ CCAAS_URL: 'http://ccaas.local', CCAAS_API_KEY: undefined });
      mockFetch(() => {
        throw new Error('should not be called');
      });
      await expect(controller.invalidate('p1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
