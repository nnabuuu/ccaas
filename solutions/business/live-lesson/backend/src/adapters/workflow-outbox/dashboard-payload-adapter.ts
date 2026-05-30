/**
 * `DashboardPayloadAdapter` — Phase 5 M5.2a transitional adapter.
 *
 * Translates the platform's ontology-native `DashboardPayload`
 * (returned by `GET /api/v1/workflow/sessions/:id/dashboard`) into the
 * legacy 4-array shape (`logs / alerts / indicatorStats / indicators`)
 * the live-lesson teacher dashboard frontend already consumes via
 * `state.observation`.
 *
 * **This entire file is scheduled for deletion in M5.2b** (frontend
 * rewrite), where the 3 teacher tabs migrate to consume
 * `DashboardPayload` directly. Keeping the conversion pure +
 * stand-alone makes that deletion trivial.
 *
 * ## Bug fix folded in
 *
 * The deleted `ObservationQueryService` (M6.3, commit `83c0206e`)
 * used to synthesize Chinese gist strings for lifecycle / exercise /
 * progress events. The platform projector never did the synthesis —
 * it passes raw `data` through. So between M6.3 and this commit the
 * frontend was rendering `undefined` for those event gists. This
 * adapter restores the synthesis (templates lifted from the deleted
 * service) AND closes the bug.
 *
 * ## Score scale assumption
 *
 * `exercise.score` is treated as 0–100 (matches the deleted
 * ObservationQueryService + StatusChangeService.computeMetrics).
 * The workflow schema's `score: z.number().optional()` is unconstrained,
 * but every writer emits 0–100.
 *
 * ## lastActiveAt semantics
 *
 * The new payload's `metrics.lastActiveAt` only counts the activity
 * types (`indicator_hit / exercise / progress`); see
 * `DashboardStudentMetrics` JSDoc + M5 pass-2 S2. The legacy schema
 * declares `systemMetrics.lastActiveAt: number` (non-null), so we
 * fall back to `Date.now()` when the platform returns `null` — same
 * fallback as the deleted ObservationQueryService used.
 */

import type {
  StudentLog,
  StudentEvent,
  Alert,
  IndicatorStats,
  IndicatorDef,
} from '../../schemas/classroom/observation';

// ──────────────────────────────────────────────────────────────
// Wire-shape interfaces (mirror `dashboard-payload.types.ts` on the
// platform side). Defined locally to keep live-lesson decoupled from
// `@kedge-agentic/backend` internals. These will go away with this
// whole file in M5.2b.
// ──────────────────────────────────────────────────────────────

interface DashboardIndicatorDef {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly description: string;
}

interface DashboardObservationView {
  readonly id: string;
  readonly type: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly triggerEventId: string;
}

interface DashboardStudentMetrics {
  readonly messageCount: number;
  readonly knowledgeCount: number;
  readonly misconceptionCount: number;
  readonly exerciseCorrectRate: number | null;
  readonly lastActiveAt: number | null;
  readonly currentStep: number | null;
}

interface DashboardStudentStatus {
  readonly current: string;
  readonly previous: string | null;
  readonly derivedAt: number;
  readonly summary: string;
  readonly alertMessage: string | null;
}

interface DashboardStudentSlice {
  readonly studentId: string;
  readonly studentName: string;
  readonly status: DashboardStudentStatus | null;
  readonly metrics: DashboardStudentMetrics;
  readonly observations: readonly DashboardObservationView[];
}

export interface DashboardPayload {
  readonly sessionId: string;
  readonly indicators: readonly DashboardIndicatorDef[];
  readonly students: readonly DashboardStudentSlice[];
  readonly generatedAt: number;
}

// ──────────────────────────────────────────────────────────────
// Public output (matches legacy live-lesson observation contract).
// ──────────────────────────────────────────────────────────────

export interface DashboardFetchResult {
  readonly logs: StudentLog[];
  readonly alerts: Alert[];
  readonly indicatorStats: IndicatorStats[];
  readonly indicators: IndicatorDef[];
  /**
   * Stamped `'platform'` always (post-M6.3 — no local fallback).
   * Kept as a field for future observability if a local layer ever
   * comes back.
   */
  readonly source: 'platform';
}

// ──────────────────────────────────────────────────────────────
// Severity mapping (mirrors platform's `DASHBOARD_SEVERITY_MAP`).
// ──────────────────────────────────────────────────────────────

const SEVERITY_MAP: Record<string, 'info' | 'warn' | 'urgent' | null> = {
  stuck: 'urgent',
  struggling: 'warn',
  idle: 'info',
  active: null,
  cruising: null,
};

// ──────────────────────────────────────────────────────────────
// Defensive parser. The workflow client returns `unknown`; this
// narrows to `DashboardPayload | null` (null means "shape unrecognized,
// treat as empty"). Both arms preserve the adapter's invariant of
// returning a non-null `DashboardFetchResult`.
// ──────────────────────────────────────────────────────────────

export function parseDashboardPayload(payload: unknown): DashboardPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (!Array.isArray(obj.students)) return null;
  return {
    sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : '',
    indicators: Array.isArray(obj.indicators)
      ? (obj.indicators as DashboardIndicatorDef[])
      : [],
    students: obj.students as DashboardStudentSlice[],
    generatedAt: typeof obj.generatedAt === 'number' ? obj.generatedAt : 0,
  };
}

// ──────────────────────────────────────────────────────────────
// Main conversion.
// ──────────────────────────────────────────────────────────────

export function adaptDashboardPayload(
  payload: DashboardPayload | null,
): DashboardFetchResult {
  if (!payload) {
    return {
      logs: [],
      alerts: [],
      indicatorStats: [],
      indicators: [],
      source: 'platform',
    };
  }

  const indicators = filterIndicators(payload.indicators);
  const indicatorLabelById = new Map(indicators.map((i) => [i.id, i.label]));

  const logs: StudentLog[] = [];
  const alerts: Alert[] = [];
  const allIndicatorHits: Array<{
    studentId: string;
    anchors: string[];
    gist: string;
    updatedAt: number;
  }> = [];

  for (const student of payload.students) {
    const events: StudentEvent[] = [];
    let eventCounter = 0;
    let lastMisconceptionAnchor: string | null = null;

    for (const obs of student.observations) {
      // student_status drives alerts only; never appears in events
      if (obs.type === 'student_status') continue;

      eventCounter += 1;
      const event = observationToStudentEvent(
        eventCounter,
        student.studentName,
        student.studentId,
        obs,
      );
      events.push(event);

      // Track indicator_hit anchors for indicatorStats + lastMisconceptionAnchor
      if (obs.type === 'indicator_hit') {
        const anchors = Array.isArray(obs.data.anchors)
          ? (obs.data.anchors as string[])
          : [];
        const gist = typeof obs.data.gist === 'string' ? obs.data.gist : '';
        allIndicatorHits.push({
          studentId: student.studentId,
          anchors,
          gist,
          updatedAt: obs.updatedAt,
        });
        for (const a of anchors) {
          if (a.startsWith('M')) lastMisconceptionAnchor = a;
        }
      }
    }

    logs.push({
      studentId: student.studentId,
      studentName: student.studentName,
      events,
      systemMetrics: {
        messageCount: student.metrics.messageCount,
        // Legacy schema declares non-null number; new shape allows
        // null. Fall back to now() so the frontend's
        // `now - lastActiveAt` math never NaNs. Matches the deleted
        // ObservationQueryService fallback.
        lastActiveAt: student.metrics.lastActiveAt ?? Date.now(),
        exerciseCorrectRate: student.metrics.exerciseCorrectRate ?? 0,
        currentStep:
          student.metrics.currentStep != null
            ? `step-${student.metrics.currentStep}`
            : '',
      },
    });

    // Alert derivation: only on alertable status, never on transitions
    // to non-alertable. Status `null` means no derivation yet.
    const status = student.status;
    if (status && SEVERITY_MAP[status.current] != null) {
      const severity = SEVERITY_MAP[status.current] as 'info' | 'warn' | 'urgent';
      const indicatorLabel = lastMisconceptionAnchor
        ? indicatorLabelById.get(lastMisconceptionAnchor) ?? lastMisconceptionAnchor
        : null;
      alerts.push({
        timestamp: status.derivedAt,
        studentName: student.studentName,
        studentId: student.studentId,
        severity,
        message:
          status.alertMessage ??
          synthesizeAlertMessage(student.studentName, status.current, indicatorLabel),
        indicatorId: lastMisconceptionAnchor,
      });
    }
  }

  // Sort alerts by severity (urgent first), matching legacy behavior.
  alerts.sort(
    (a, b) =>
      severityOrder(a.severity) - severityOrder(b.severity),
  );

  const indicatorStats = buildIndicatorStats(indicators, allIndicatorHits);

  return {
    logs,
    alerts,
    indicatorStats,
    indicators,
    source: 'platform',
  };
}

// ──────────────────────────────────────────────────────────────
// Helpers.
// ──────────────────────────────────────────────────────────────

/**
 * Per-observation `(type, data.action)` → StudentEvent + Chinese gist
 * lookup. Templates lifted from the deleted ObservationQueryService.
 * Default branch falls back to `obs.type` so the frontend never
 * sees `undefined`.
 */
function observationToStudentEvent(
  counter: number,
  studentName: string,
  studentId: string,
  obs: DashboardObservationView,
): StudentEvent {
  const data = obs.data;
  const base: Omit<StudentEvent, 'gist' | 'source' | 'systemType' | 'anchors' | 'quote'> = {
    id: `e${counter}`,
    timestamp: obs.createdAt,
    updatedAt: obs.updatedAt,
  };

  if (obs.type === 'indicator_hit') {
    const anchors = Array.isArray(data.anchors) ? (data.anchors as string[]) : [];
    const gist = typeof data.gist === 'string' && data.gist.length > 0
      ? data.gist
      : '(无 gist)';
    const quote = typeof data.quote === 'string' ? data.quote : null;
    return {
      ...base,
      anchors,
      gist,
      quote,
      source: 'llm',
    };
  }

  // System-source events from here down.
  const opaqueData = data as Record<string, unknown>;
  let systemType: string;
  let gist: string;

  if (obs.type === 'lifecycle') {
    const action = typeof opaqueData.action === 'string' ? opaqueData.action : 'unknown';
    systemType = action;
    const resolvedName =
      typeof opaqueData.studentName === 'string' && opaqueData.studentName.length > 0
        ? opaqueData.studentName
        : studentName || studentId;
    if (action === 'join') {
      gist = `${resolvedName} 加入课堂`;
    } else if (action === 'leave') {
      gist = `${resolvedName} 离开课堂`;
    } else if (action === 'translate_request') {
      const text = typeof opaqueData.text === 'string' ? opaqueData.text : '…';
      gist = `查词：${text}`;
    } else if (action === 'discuss_complete') {
      gist = '完成讨论';
    } else if (action === 'continue_chat_turn') {
      gist = '继续追问';
    } else {
      gist = action;
    }
  } else if (obs.type === 'exercise') {
    systemType = 'exercise_result';
    const step = opaqueData.step ?? '?';
    const score = opaqueData.score;
    const scoreSuffix = typeof score === 'number' ? `，得分 ${score}%` : '';
    gist = `提交 Step ${step} 答案${scoreSuffix}`;
  } else if (obs.type === 'progress') {
    systemType = 'step_complete';
    const taskNum = opaqueData.taskNum ?? opaqueData.step ?? '?';
    const nextTask = opaqueData.nextTask;
    const nextSuffix = nextTask !== undefined ? `，进入 Task ${nextTask}` : '';
    gist = `完成 Task ${taskNum}${nextSuffix}`;
  } else {
    // Unknown observation type — never undefined.
    systemType = obs.type;
    gist = obs.type;
  }

  return {
    ...base,
    anchors: [],
    gist,
    quote: null,
    source: 'system',
    systemType,
    data: opaqueData,
  };
}

function synthesizeAlertMessage(
  studentName: string,
  status: string,
  indicatorLabel: string | null,
): string {
  const suffix = indicatorLabel ? ` (${indicatorLabel})` : '';
  if (status === 'stuck') {
    return `${studentName} 遇到持续困难${suffix}`;
  }
  if (status === 'struggling') {
    return `${studentName} 出现误解信号${suffix}`;
  }
  if (status === 'idle') {
    return `${studentName} 超过 3 分钟无活动`;
  }
  return `${studentName} 状态：${status}`;
}

function severityOrder(severity: 'info' | 'warn' | 'urgent'): number {
  return severity === 'urgent' ? 0 : severity === 'warn' ? 1 : 2;
}

/**
 * Build per-indicator stats by groupBy-ing indicator_hit observations
 * against the registered indicator catalog. Mirrors the deleted
 * `ObservationQueryService.computeIndicatorStats` shape.
 */
function buildIndicatorStats(
  catalog: IndicatorDef[],
  hits: Array<{
    studentId: string;
    anchors: string[];
    gist: string;
    updatedAt: number;
  }>,
): IndicatorStats[] {
  if (catalog.length === 0) return [];
  type Acc = { students: Set<string>; latestGist: string; updatedAt: number };
  const accByAnchor = new Map<string, Acc>();
  for (const def of catalog) {
    accByAnchor.set(def.id, { students: new Set(), latestGist: '', updatedAt: 0 });
  }
  for (const hit of hits) {
    for (const anchor of hit.anchors) {
      const acc = accByAnchor.get(anchor);
      if (!acc) continue; // unknown anchor — fail closed
      acc.students.add(hit.studentId);
      if (hit.updatedAt > acc.updatedAt) {
        acc.latestGist = hit.gist;
        acc.updatedAt = hit.updatedAt;
      }
    }
  }
  return catalog.map((def) => {
    const acc = accByAnchor.get(def.id) ?? {
      students: new Set<string>(),
      latestGist: '',
      updatedAt: 0,
    };
    return {
      indicatorId: def.id,
      label: def.label,
      type: def.type,
      studentCount: acc.students.size,
      latestGist: acc.latestGist,
      updatedAt: acc.updatedAt,
    };
  });
}

/**
 * Defensive filter to the narrow `knowledge / misconception` union the
 * live-lesson schema declares. Platform IndicatorRegistry's `type` is
 * `string`; we drop anything else. Mirrors the helper that previously
 * lived inside `workflow-dashboard-fetch.service.ts`.
 */
function filterIndicators(arr: readonly DashboardIndicatorDef[]): IndicatorDef[] {
  const out: IndicatorDef[] = [];
  for (const d of arr) {
    if (
      typeof d.id !== 'string' ||
      typeof d.label !== 'string' ||
      typeof d.description !== 'string'
    ) {
      continue;
    }
    if (d.type !== 'knowledge' && d.type !== 'misconception') continue;
    out.push({
      id: d.id,
      type: d.type,
      label: d.label,
      description: d.description,
    });
  }
  return out;
}
