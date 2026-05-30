/**
 * `DashboardPayload` — phase 5 M5.1. The ontology-native dashboard
 * wire shape emitted by the sole dashboard endpoint
 * `GET /api/v1/workflow/sessions/:sessionId/dashboard` (the legacy
 * M3 `ObservationDashboardProjector` + `/observation-dashboard` route
 * were deleted in M5.2a; see the History section of
 * `docs/gitbook/zh/ontology/dashboard-contract.md`).
 *
 * ## Design notes
 *
 * **Pivot**: the legacy shape was 4 sibling lists keyed by various
 * dimensions (student / alert / indicator). That's a join the FRONTEND
 * has to redo whenever it wants student-centric views. The new shape
 * pivots around `students: StudentSlice[]` — every alert, observation,
 * status, and metric naturally lives ON the student. Aggregations the
 * legacy shape pre-computed are now (a) included as `metrics` for the
 * common ones, (b) derivable from the `observations` array for the
 * rare ones.
 *
 * **Observations are raw rows**: the legacy shape transformed
 * `indicator_hit` → `StudentEvent` with Chinese-language `gist`,
 * `lifecycle` → `StudentEvent` with synthesized `gist` like
 * `${name} 加入课堂`, etc. — i.e. the projector decided how to render
 * each row. The new shape surfaces the raw observation row with its
 * `data` payload intact; the frontend renders. This trades some wire
 * size for keeping the renderer next to the UI it serves.
 *
 * **Status is per-student, not per-alert**: legacy `alerts: Alert[]`
 * was a flat list with `severity`. Now `student.status` carries the
 * derived status + `previousStatus` directly; if the frontend needs a
 * flat alert list, filter `students` by `status.current in {stuck,
 * struggling, idle}`. The severity map (`stuck=urgent`, etc.) is
 * documented on the type but not pre-applied — the frontend should
 * map it the same way M4's `SEVERITY_MAP` does.
 *
 * **`indicators` stays** at the payload level (session-scoped catalog).
 * **`indicatorStats` is dropped** as a top-level field — anyone who
 * wants it can group `observations[type='indicator_hit']` by anchor.
 * Most consumers (the 3 teacher tabs) don't actually need it; the
 * one place that does (`ClassroomStatusTab` indicator bar) can
 * compute it inline.
 *
 * **studentName resolution**: legacy lived in live-lesson and pulled
 * `studentName` from the join lifecycle event's `data.studentName`.
 * The new endpoint does the same lookup on the platform side (the
 * data is in `lifecycle` observations the workflow layer writes).
 * Fallback to `studentId` when no join row exists.
 *
 * **What we DON'T include yet** — keep the surface tight:
 *   - clusterStats (lives on legacy state, not observation-derived)
 *   - coaching highlights (separate service, separate endpoint)
 *   - depth leaderboard (separate service)
 *   - questions (separate concern; not observation-derived)
 * These stay on live-lesson's `getState()` response. The new endpoint
 * is the OBSERVATION view, not the whole classroom view. The M5 second
 * pass (frontend rewrite) decides whether to compose them client-side
 * or unify the endpoints.
 *
 * **Forward compatibility**: this file lives in workflow/handlers/
 * because that's where the producer lives. M5.2 ships
 * `DashboardService.buildPayload(sessionId) → DashboardPayload`. Until
 * the M5 second pass (frontend rewrite + projector deletion), this
 * shape is scaffolding — typesafe but unused. That's intentional;
 * shipping the type contract first lets the frontend rewrite happen
 * in a separate PR with smaller blast radius.
 */

/**
 * Session-scoped indicator catalog. One entry per indicator the
 * teacher (or solution config) registered for the session via
 * `IndicatorRegistryService.setIndicators`.
 */
export interface DashboardIndicatorDef {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly description: string;
}

/**
 * Raw observation row exposed on the wire. Mirrors `Observation` from
 * `@kedge-agentic/observer-engine` but pinned to the dashboard
 * contract so internal renames don't propagate to the frontend.
 */
export interface DashboardObservationView {
  readonly id: string;
  /**
   * One of: `indicator_hit`, `exercise`, `progress`, `lifecycle`,
   * `student_status`. Frontend treats unknown types as opaque to stay
   * forward-compatible with future workflow handlers.
   */
  readonly type: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly triggerEventId: string;
}

/**
 * Derived metrics for one student. Mirrors the legacy
 * `StudentLog.systemMetrics` + the metrics computed by
 * `StatusChangeService.computeMetrics`. The platform-side
 * `DashboardService` is the single source of truth; the frontend
 * should consume these directly rather than re-deriving from
 * `observations`.
 */
export interface DashboardStudentMetrics {
  readonly messageCount: number;
  readonly knowledgeCount: number;
  readonly misconceptionCount: number;
  /**
   * 0..100 integer (avg of all `exercise.score` rows, rounded). `null`
   * when the student has no scored exercises yet — distinguishes
   * "no data" from "all-zero scores" (M5 pass-2 S1). Frontend should
   * treat null as "hide the metric" rather than render `0%`.
   */
  readonly exerciseCorrectRate: number | null;
  /**
   * Epoch ms. Sourced from `createdAt` of the most recent
   * `indicator_hit` / `exercise` / `progress` row (i.e. activity
   * types only; `student_status` mutations don't count — matches
   * `StatusChangeService.ACTIVITY_TYPES`). `null` when the student
   * has no activity yet.
   */
  readonly lastActiveAt: number | null;
  /**
   * Most recent `progress.step` value, or `null` if none. Frontend
   * formats as `step-${n}` if it needs the legacy string shape.
   */
  readonly currentStep: number | null;
}

/**
 * Student status as derived by M4 `StatusChangeService`. `null` when
 * the student has no `student_status` row yet (early in the session
 * or no cascade has fired).
 */
export interface DashboardStudentStatus {
  /** 'active'|'struggling'|'stuck'|'idle'|'cruising' — open string for fwd-compat. */
  readonly current: string;
  readonly previous: string | null;
  /**
   * Epoch ms — `student_status.updatedAt`. Differs from
   * `metrics.lastActiveAt`: derivedAt jumps every cascade, lastActiveAt
   * only on real activity.
   */
  readonly derivedAt: number;
  readonly summary: string;
  /**
   * Free-text message attached by the derivation step. Frontend uses
   * this for the alert body when `current` is alertable. `null` when
   * the derivation chose not to emit one (e.g. active → active
   * transitions).
   */
  readonly alertMessage: string | null;
}

/**
 * Per-student slice — the unit of teacher-dashboard rendering. The
 * legacy `{logs, alerts}` lists are reconstructable from this slice
 * via simple filters:
 *   - `logs`-equivalent: pivot `observations` into the legacy
 *     `StudentEvent` shape if the frontend still wants it
 *   - `alerts`-equivalent: filter `students` by
 *     `status?.current in ['stuck', 'struggling', 'idle']`
 */
export interface DashboardStudentSlice {
  readonly studentId: string;
  readonly studentName: string;
  readonly status: DashboardStudentStatus | null;
  readonly metrics: DashboardStudentMetrics;
  /**
   * All observation rows for this student, chronologically ascending
   * by `createdAt`. Includes `student_status` (frontend can hide it
   * if it wants).
   */
  readonly observations: readonly DashboardObservationView[];
}

/**
 * Top-level payload returned by the NEW endpoint (M5.2). One per
 * session. `students` is sorted by `studentId` for stable diffing
 * (matches the legacy projector's choice — frontend doesn't depend
 * on order).
 */
export interface DashboardPayload {
  readonly sessionId: string;
  readonly indicators: readonly DashboardIndicatorDef[];
  readonly students: readonly DashboardStudentSlice[];
  /**
   * Epoch ms — when this payload was assembled. Lets the frontend
   * pin cache invalidation against a server timestamp instead of
   * its own clock.
   */
  readonly generatedAt: number;
}

/**
 * Severity map the frontend should apply when rendering alertable
 * statuses. Documented here so backend + frontend agree on the
 * mapping without round-tripping the literal through every payload.
 * Matches `StatusChangeService.SEVERITY_MAP`.
 */
export const DASHBOARD_SEVERITY_MAP: Readonly<
  Record<string, 'info' | 'warn' | 'urgent' | null>
> = Object.freeze({
  stuck: 'urgent',
  struggling: 'warn',
  idle: 'info',
  active: null,
  cruising: null,
});
