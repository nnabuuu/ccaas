/**
 * `IndicatorRegistryService` — Phase 5 M4. Holds per-session
 * `IndicatorDef[]` for LLM-driven handlers to read.
 *
 * Replaces the legacy `setSessionMeta({indicators})` shape (which lived
 * inside the observer-engine's `HandlerContext`). Live-lesson registers
 * indicators per-session via the new `POST /api/v1/workflow/sessions/:id/indicators`
 * endpoint (lands in a follow-up commit) — until then, indicators
 * register programmatically through `setIndicators(sessionId, defs)`
 * during the M4 dual-write transition.
 *
 * In-memory only — indicators are session-scoped + ephemeral. A
 * platform restart loses them; the live-lesson side re-pushes on
 * reconnect (same as the legacy session meta).
 */

import { Injectable } from '@nestjs/common';

export interface IndicatorDef {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly description: string;
}

@Injectable()
export class IndicatorRegistryService {
  private readonly bySession = new Map<string, readonly IndicatorDef[]>();

  setIndicators(sessionId: string, indicators: readonly IndicatorDef[]): void {
    this.bySession.set(sessionId, indicators);
  }

  getIndicators(sessionId: string): readonly IndicatorDef[] {
    return this.bySession.get(sessionId) ?? [];
  }

  clearSession(sessionId: string): void {
    this.bySession.delete(sessionId);
  }

  /** Test helper. */
  reset(): void {
    this.bySession.clear();
  }
}
