/**
 * `IndicatorRegistryService` — Phase 5 M4. Holds per-session
 * `IndicatorDef[]` for LLM-driven handlers to read.
 *
 * Replaces the legacy `setSessionMeta({indicators})` shape (which lived
 * inside the observer-engine's `HandlerContext`). Live-lesson registers
 * indicators per-session via PUT `/api/v1/workflow/sessions/:id/indicators`.
 *
 * **Tenant isolation** (M5 pass-1 MF3): keyed by `(solutionId, sessionId)`
 * tuple. Two tenants holding the same sessionId (low probability but
 * possible if sessionId generation isn't globally unique) cannot read or
 * overwrite each other's catalogs. Callers must thread `solutionId` from
 * the invocation context (M4 handlers do this via
 * `invocation.context.solutionId`; the PUT controller via `@TenantId()`).
 *
 * In-memory only — indicators are session-scoped + ephemeral. A
 * platform restart loses them; the live-lesson side re-pushes on the
 * next session start.
 */

import { Injectable } from '@nestjs/common';

export interface IndicatorDef {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly description: string;
}

/**
 * `\x1f` (ASCII Unit Separator) — not a legal character in identifiers,
 * URLs, or any sensible tenant/session id. A space delimiter would
 * silently collide if any caller ever resolved `solutionId` to a slug
 * containing whitespace (e.g. `'live lesson'` + session `'b c'` would
 * collide with `'live'` + session `'lesson b c'`). M5 pass-2 N4.
 */
const KEY_DELIMITER = '\x1f';

function key(solutionId: string, sessionId: string): string {
  return `${solutionId}${KEY_DELIMITER}${sessionId}`;
}

@Injectable()
export class IndicatorRegistryService {
  private readonly byKey = new Map<string, readonly IndicatorDef[]>();

  setIndicators(
    solutionId: string,
    sessionId: string,
    indicators: readonly IndicatorDef[],
  ): void {
    this.byKey.set(key(solutionId, sessionId), indicators);
  }

  getIndicators(
    solutionId: string,
    sessionId: string,
  ): readonly IndicatorDef[] {
    return this.byKey.get(key(solutionId, sessionId)) ?? [];
  }

  /**
   * Drop a session's catalog. Removes entries across ALL tenants for
   * the given sessionId — used by `WorkflowEngineService.clearSession`
   * which only has `sessionId` from the engine's per-session queue.
   * The teardown boundary is intentionally broader than the
   * authorization boundary because session ids are globally unique by
   * construction (UUIDv4).
   *
   * The suffix check uses the `\x1f` delimiter so a sessionId that
   * happens to be a substring of another sessionId is NOT
   * accidentally dropped (defense-in-depth invariant tested in the
   * spec).
   */
  clearSession(sessionId: string): void {
    const suffix = `${KEY_DELIMITER}${sessionId}`;
    for (const k of this.byKey.keys()) {
      if (k.endsWith(suffix)) {
        this.byKey.delete(k);
      }
    }
  }

  /**
   * Tenant-scoped clear. Drops the catalog only for the
   * `(solutionId, sessionId)` tuple. Used by external HTTP callers
   * (the DELETE endpoint) where we want the cleared scope to match
   * the tenant binding — so a chat-scoped key from tenant A can't
   * accidentally clear tenant B's data even if both tenants
   * coincidentally share a sessionId. M6 pass-2 SF3.
   */
  clearTenantSession(solutionId: string, sessionId: string): void {
    this.byKey.delete(key(solutionId, sessionId));
  }

  /** Test helper. */
  reset(): void {
    this.byKey.clear();
  }
}
