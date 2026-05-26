/**
 * CcaasUpstream — shared bits for any controller that proxies the
 * browser to ccaas. Owns:
 *   - env resolution (CCAAS_URL + CCAAS_API_KEY) with operator-friendly
 *     fail-loud when the key is missing
 *   - tenantId resolution from the env key (lazy + cached)
 *   - SSE / fetch error wrapping with token scrubbing
 *   - small upstream-body helpers used by error paths
 *
 * Each proxy controller (CcaasProxyController for /projects/:id/*,
 * CcaasChatProxyController for /sessions/:sid/*) injects this so the
 * shared logic isn't duplicated across files. When a new family of
 * ccaas routes comes online, it adds its own controller and reuses
 * this service — no copy-paste of resolveCcaas / scrubToken.
 */

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const DEFAULT_CCAAS_URL = 'http://localhost:3001';

@Injectable()
export class CcaasUpstream {
  private readonly logger = new Logger(CcaasUpstream.name);
  /**
   * Once-per-process cache of the tenantId derived from `CCAAS_API_KEY`.
   * One solution backend = one ccaas tenant (by design), so this never
   * needs to change unless the operator rotates the key and restarts.
   *
   * Rotation procedure: change CCAAS_API_KEY in the env, restart the
   * process. There's no live-reload — a stale cache + new tenant
   * would silently route to the wrong tenant.
   */
  private cachedTenantId: string | null = null;

  /**
   * In-flight resolveTenantId promise. Without this, the first N
   * concurrent calls all miss the cache and all fire `/auth/me` in
   * parallel (thundering herd). With it, the first caller's promise
   * is reused by every concurrent waiter. Cleared on success or
   * failure so a retry can run cleanly.
   */
  private inFlightTenantId: Promise<string> | null = null;

  /**
   * Resolve env + assert the ccaas key is configured. We fail loud here
   * (503) rather than letting the upstream call reject with an opaque
   * "Invalid or expired token" — the operator gets a clear "set
   * CCAAS_API_KEY in your env" pointer on the first request instead
   * of a confusing 401 from the wrong layer.
   */
  resolveCcaas(): { url: string; key: string } {
    const key = process.env.CCAAS_API_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        'CCAAS_API_KEY env var is not set on the live-lesson backend; ' +
          'ccaas proxy endpoints cannot serve until it is configured.',
      );
    }
    const url = (process.env.CCAAS_URL ?? DEFAULT_CCAAS_URL).replace(/\/+$/, '');
    return { url, key };
  }

  /**
   * Resolve the ccaas tenantId for the env-held API key. ccaas exposes
   * `GET /api/v1/auth/me` which returns `{ tenantId, ... }` given an
   * Authorization header. We call that once on the first request that
   * needs it (typically the first POST /sessions/:sid/bind-project or
   * /messages) and cache forever.
   *
   * Why cache forever: the env key identifies the tenant; the env can't
   * change without a process restart; therefore the tenantId can't
   * change without a process restart.
   *
   * Throws 503 if ccaas is unreachable OR the key isn't valid — both
   * are operator-actionable misconfigurations.
   */
  async resolveTenantId(): Promise<string> {
    if (this.cachedTenantId) return this.cachedTenantId;
    // Single-flight: if a concurrent caller already started fetching
    // /auth/me, just wait for that one's promise. Without this every
    // request during the bootstrap window would issue its own /auth/me.
    if (this.inFlightTenantId) return this.inFlightTenantId;
    this.inFlightTenantId = this.doResolveTenantId().finally(() => {
      this.inFlightTenantId = null;
    });
    return this.inFlightTenantId;
  }

  private async doResolveTenantId(): Promise<string> {
    const { url, key } = this.resolveCcaas();
    let res: Response;
    try {
      res = await fetch(`${url}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${key}` },
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        `Cannot reach ccaas to resolve tenant id: ${scrubToken(
          err instanceof Error ? err.message : String(err),
        )}`,
      );
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Cannot resolve ccaas tenant id (auth/me returned ${res.status}); ` +
          'check CCAAS_API_KEY env var',
      );
    }
    let body: { tenantId?: string };
    try {
      body = (await res.json()) as { tenantId?: string };
    } catch (err) {
      throw new ServiceUnavailableException(
        `ccaas /auth/me returned non-JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!body?.tenantId) {
      throw new ServiceUnavailableException(
        'ccaas /auth/me returned no tenantId; check CCAAS_API_KEY env var',
      );
    }
    this.cachedTenantId = body.tenantId;
    this.logger.log(`Resolved ccaas tenantId: ${body.tenantId}`);
    return body.tenantId;
  }

  /**
   * Wrap a thrown fetch error with a stable phase tag + token scrubbing.
   * Reused across SSE (`changes$`), regular POST proxies, and the new
   * session-scoped routes.
   */
  wrapUpstreamError(phase: 'connect' | 'stream', err: unknown): Error {
    const msg = err instanceof Error ? err.message : String(err);
    return new Error(`ccaas upstream ${phase} failed: ${scrubToken(msg)}`);
  }

  /**
   * Read up to 512 chars of an upstream response body for inclusion in
   * a thrown error. Cap is to avoid logging multi-MB HTML error pages
   * from misconfigured intermediaries.
   */
  async readErrorBody(res: Response): Promise<string> {
    try {
      const text = await res.text();
      return text.length > 512 ? `${text.slice(0, 512)}…` : text;
    } catch {
      return '<no body>';
    }
  }

  /** Reset the tenant cache. Test-only; not for runtime use. */
  resetTenantCacheForTests(): void {
    this.cachedTenantId = null;
  }
}

/**
 * Strip the ccaas API key out of any string that might land in a log,
 * a thrown Error message, or an HTTP response body. Two leak vectors
 * covered:
 *
 *   1. `?token=<value>` — used by the project-scoped SSE proxy because
 *      EventSource can't set headers, so the key is in the URL. A
 *      misconfigured intermediary echoing `req.url` back in an error
 *      body (e.g. "Cannot GET <full-url>") would surface the key.
 *
 *   2. `Authorization: Bearer <value>` — used by the chat-scoped
 *      proxy (fetch with auth header). If Node's fetch ever includes
 *      request headers in an error message (some runtimes do on
 *      connection failures), or if ccaas's error body ever echoes
 *      the Authorization header back, the key would leak. The Bearer
 *      branch is defence-in-depth — there's no known path today that
 *      surfaces it, but the cost of the extra regex is zero.
 *
 * Conservative on URL-encoded forms — if the surrounding text already
 * escaped or encoded the token, the regex won't match and we leave it
 * alone (the encoding is itself protection).
 */
export function scrubToken(s: string): string {
  return s
    .replace(/(token=)[^&\s"'<>]+/gi, '$1***')
    .replace(/(bearer\s+)[A-Za-z0-9._\-]+/gi, '$1***');
}
