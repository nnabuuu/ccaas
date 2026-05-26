/**
 * CcaasUpstream — focused unit tests.
 *
 * Both proxy controllers (CcaasProxyController + CcaasChatProxyController)
 * exercise this service transitively, but a dedicated spec pins the
 * contracts that matter most for correctness:
 *   - resolveTenantId caches forever per process (no re-fetch on the
 *     second call)
 *   - resolveTenantId is single-flight (N concurrent first-time
 *     callers issue exactly 1 /auth/me, not N — the thundering-herd
 *     fix added per code-review concern #2)
 *   - scrubToken redacts both ?token=... query strings AND
 *     Authorization: Bearer ... header forms (defence-in-depth for
 *     the chat proxy which uses Bearer rather than query token)
 */

import { ServiceUnavailableException } from '@nestjs/common';
import { CcaasUpstream } from './ccaas-upstream.service';
import { scrubToken } from './scrub-token';

const ORIG_ENV = { ...process.env };

function setEnv(over: Record<string, string | undefined>) {
  process.env = { ...ORIG_ENV, ...over };
}

function mockFetch(handler: (url: string) => Promise<Response> | Response) {
  (globalThis as any).fetch = jest.fn(handler);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CcaasUpstream', () => {
  let upstream: CcaasUpstream;

  beforeEach(() => {
    setEnv({ CCAAS_URL: 'http://ccaas.local', CCAAS_API_KEY: 'sk-test' });
    upstream = new CcaasUpstream();
  });

  afterEach(() => {
    process.env = ORIG_ENV;
    delete (globalThis as any).fetch;
  });

  describe('resolveCcaas', () => {
    it('throws 503 when CCAAS_API_KEY is unset (operator-friendly fail-loud)', () => {
      setEnv({ CCAAS_API_KEY: undefined });
      expect(() => upstream.resolveCcaas()).toThrow(ServiceUnavailableException);
    });

    it('falls back to localhost default when CCAAS_URL is unset', () => {
      setEnv({ CCAAS_API_KEY: 'sk-x', CCAAS_URL: undefined });
      expect(upstream.resolveCcaas().url).toBe('http://localhost:3001');
    });

    it('strips trailing slashes from CCAAS_URL', () => {
      setEnv({ CCAAS_API_KEY: 'sk-x', CCAAS_URL: 'http://ccaas.example.com////' });
      expect(upstream.resolveCcaas().url).toBe('http://ccaas.example.com');
    });
  });

  describe('resolveTenantId (caching)', () => {
    it('returns the cached tenantId on subsequent calls without re-fetching', async () => {
      let calls = 0;
      mockFetch(async () => {
        calls++;
        return jsonResponse({ tenantId: 'tnt-cached' });
      });

      const a = await upstream.resolveTenantId();
      const b = await upstream.resolveTenantId();
      const c = await upstream.resolveTenantId();

      expect(a).toBe('tnt-cached');
      expect(b).toBe('tnt-cached');
      expect(c).toBe('tnt-cached');
      expect(calls).toBe(1);
    });

    it('single-flight: N concurrent first-time callers issue exactly 1 upstream fetch', async () => {
      // Without the single-flight guard, all 5 of these would race to
      // populate the cache, firing 5 /auth/me requests in parallel.
      // With it, the first call's promise is reused by every waiter.
      let calls = 0;
      mockFetch(async () => {
        calls++;
        // Slight delay so the parallel calls definitely overlap.
        await new Promise((r) => setTimeout(r, 10));
        return jsonResponse({ tenantId: 'tnt-concurrent' });
      });

      const results = await Promise.all([
        upstream.resolveTenantId(),
        upstream.resolveTenantId(),
        upstream.resolveTenantId(),
        upstream.resolveTenantId(),
        upstream.resolveTenantId(),
      ]);

      expect(results).toEqual([
        'tnt-concurrent',
        'tnt-concurrent',
        'tnt-concurrent',
        'tnt-concurrent',
        'tnt-concurrent',
      ]);
      expect(calls).toBe(1);
    });

    it('clears the in-flight promise on failure so a retry can run cleanly', async () => {
      let calls = 0;
      mockFetch(async () => {
        calls++;
        if (calls === 1) return new Response('forbidden', { status: 403 });
        return jsonResponse({ tenantId: 'tnt-retry-ok' });
      });

      await expect(upstream.resolveTenantId()).rejects.toThrow(ServiceUnavailableException);
      // Without proper cleanup, the failed in-flight promise would
      // be returned forever; the retry would never refetch.
      const out = await upstream.resolveTenantId();
      expect(out).toBe('tnt-retry-ok');
      expect(calls).toBe(2);
    });

    it('throws 503 when upstream returns non-2xx', async () => {
      mockFetch(async () => new Response('forbidden', { status: 403 }));
      await expect(upstream.resolveTenantId()).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws 503 when upstream returns no tenantId field', async () => {
      mockFetch(async () => jsonResponse({ tenantSlug: 'x' })); // missing tenantId
      await expect(upstream.resolveTenantId()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('scrubToken (key leak defence)', () => {
    it('redacts ?token=<value> from query strings', () => {
      const input = 'fetch failed for http://ccaas/projects/p1/changes?token=sk-cc6ce653-abc123';
      expect(scrubToken(input)).toBe(
        'fetch failed for http://ccaas/projects/p1/changes?token=***',
      );
    });

    it('redacts Authorization: Bearer <value> from headers/error bodies', () => {
      // Defence in depth for the chat proxy which uses Bearer header
      // instead of ?token=. If Node's fetch error ever surfaces the
      // request headers (some runtimes do), the key would leak.
      // Regex preserves original "Bearer " casing via the $1 capture.
      const input = 'TypeError: fetch failed (Authorization: Bearer sk-cc6ce653-secret)';
      expect(scrubToken(input)).toBe(
        'TypeError: fetch failed (Authorization: Bearer ***)',
      );
    });

    it('redacts a bare Bearer token without the Authorization prefix', () => {
      const input = '{"error":"unauthorized","received":"Bearer sk-cc6ce653-secret"}';
      expect(scrubToken(input)).toBe(
        '{"error":"unauthorized","received":"Bearer ***"}',
      );
    });

    it('handles lowercase bearer (some HTTP clients normalize to lowercase)', () => {
      const input = 'authorization: bearer sk-secret';
      expect(scrubToken(input)).toBe('authorization: bearer ***');
    });

    it('preserves text that does not contain the patterns', () => {
      const input = 'normal error message with no secrets';
      expect(scrubToken(input)).toBe(input);
    });

    it('handles multiple occurrences in one string', () => {
      const input =
        'first ?token=sk-A1 second ?token=sk-B2 and Bearer sk-C3 plus Bearer sk-D4';
      const out = scrubToken(input);
      expect(out).not.toContain('sk-A1');
      expect(out).not.toContain('sk-B2');
      expect(out).not.toContain('sk-C3');
      expect(out).not.toContain('sk-D4');
      expect(out.match(/\*\*\*/g)?.length).toBe(4);
    });
  });

  describe('wrapUpstreamError', () => {
    it('tags the error with the phase and scrubs token', () => {
      const err = new Error('boom at ?token=sk-secret');
      const wrapped = upstream.wrapUpstreamError('connect', err);
      expect(wrapped.message).toBe('ccaas upstream connect failed: boom at ?token=***');
    });

    it('handles non-Error throwables via String() coercion', () => {
      const wrapped = upstream.wrapUpstreamError('stream', { weird: 'object' });
      expect(wrapped.message).toContain('ccaas upstream stream failed:');
    });
  });
});
