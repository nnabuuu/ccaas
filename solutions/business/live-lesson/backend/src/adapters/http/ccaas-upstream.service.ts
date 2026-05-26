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
   */
  private cachedTenantId: string | null = null;

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
 * Strip `token=<value>` from any string before it might land in a log,
 * a thrown Error message, or an HTTP response body.
 *
 * The SSE upstream URL we open against ccaas looks like
 * `${CCAAS_URL}/projects/:id/changes?token=${CCAAS_API_KEY}` — the
 * master tenant key is literally in the URL. We never log the URL
 * ourselves, but two paths could indirectly leak it:
 *   - the upstream's error body (e.g. a misconfigured intermediary's
 *     "Cannot GET <full-url>" page that echoes `req.url`)
 *   - Node's own fetch-failure messages on some runtimes
 * Apply scrubbing wherever those land in user-visible strings.
 *
 * Matches `token=` followed by any non-whitespace / non-separator chars.
 * Conservative — if the surrounding text already escaped or encoded
 * the token, the regex won't match and we leave it alone (the encoding
 * is itself protection).
 */
export function scrubToken(s: string): string {
  return s.replace(/(token=)[^&\s"'<>]+/gi, '$1***');
}
