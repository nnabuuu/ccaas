/**
 * `DashboardService` — phase 5 M5.2. Builds the ontology-native
 * `DashboardPayload` from observation rows + the session indicator
 * catalog.
 *
 * Producer for `GET /api/v1/workflow/sessions/:sessionId/dashboard`
 * (DashboardController). Lives alongside the M3
 * `ObservationDashboardProjector` (legacy `{logs, alerts,
 * indicatorStats}` shape) during the M5 transition — both endpoints
 * serve the same observation rows, just two wire shapes. The M5
 * second pass (frontend rewrite) deletes the projector + controller.
 *
 * Shape rationale lives next to the types
 * (`dashboard-payload.types.ts`); this file is the assembly logic.
 */

import { Injectable } from '@nestjs/common';
import type { Observation } from '@kedge-agentic/observer-engine';
import { ObservationRepository } from '../../persistence/observation-repository';
import { IndicatorRegistryService } from '../../llm/indicator-registry.service';
import type {
  DashboardIndicatorDef,
  DashboardObservationView,
  DashboardPayload,
  DashboardStudentMetrics,
  DashboardStudentSlice,
  DashboardStudentStatus,
} from './dashboard-payload.types';

/**
 * Activity-type allowlist for `lastActiveAt`. Same set as
 * `StatusChangeService.ACTIVITY_TYPES` — `student_status` mutations
 * don't count toward "last active" because the service rewrites that
 * row on every cascade.
 */
const ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  'indicator_hit',
  'exercise',
  'progress',
]);

@Injectable()
export class DashboardService {
  constructor(
    private readonly observations: ObservationRepository,
    private readonly indicators: IndicatorRegistryService,
  ) {}

  /**
   * Build the dashboard payload for a session. Single DB read for
   * observations, single map lookup for indicators.
   */
  async buildPayload(sessionId: string): Promise<DashboardPayload> {
    const rows = await this.observations.getBySession(sessionId);
    const byStudent = groupByEntity(rows);

    const students: DashboardStudentSlice[] = [];
    for (const [studentId, studentRows] of byStudent) {
      students.push(buildStudentSlice(studentId, studentRows));
    }
    // Stable order for diffing / cache keying.
    students.sort((a, b) => a.studentId.localeCompare(b.studentId));

    const indicatorDefs: DashboardIndicatorDef[] = this.indicators
      .getIndicators(sessionId)
      .map((i) => ({
        id: i.id,
        type: i.type,
        label: i.label,
        description: i.description,
      }));

    return {
      sessionId,
      indicators: indicatorDefs,
      students,
      generatedAt: Date.now(),
    };
  }
}

function groupByEntity(rows: readonly Observation[]): Map<string, Observation[]> {
  const out = new Map<string, Observation[]>();
  for (const r of rows) {
    const list = out.get(r.entityId);
    if (list) list.push(r);
    else out.set(r.entityId, [r]);
  }
  return out;
}

function buildStudentSlice(
  studentId: string,
  rows: readonly Observation[],
): DashboardStudentSlice {
  // Rows from getBySession() arrive in createdAt-ASC order; preserve it.
  const observations: DashboardObservationView[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    data: (r.data ?? {}) as Readonly<Record<string, unknown>>,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    triggerEventId: r.triggerEventId,
  }));

  return {
    studentId,
    studentName: resolveStudentName(studentId, rows),
    status: extractStatus(rows),
    metrics: computeMetrics(rows),
    observations,
  };
}

/**
 * Pulls `studentName` from the join lifecycle event's data payload.
 * The M2 `record_lifecycle_observation` action writes
 * `{action: 'join', studentName, ...}` for every join, so the lookup
 * is `rows.find(type='lifecycle' && data.action='join').data.studentName`.
 * Falls back to `studentId` when no join row exists (e.g. observations
 * predate the lifecycle handler, or a synthetic test seed).
 */
function resolveStudentName(
  studentId: string,
  rows: readonly Observation[],
): string {
  for (const r of rows) {
    if (r.type !== 'lifecycle') continue;
    const data = (r.data ?? {}) as { action?: string; studentName?: string };
    if (data.action === 'join' && typeof data.studentName === 'string' && data.studentName.length > 0) {
      return data.studentName;
    }
  }
  return studentId;
}

function extractStatus(rows: readonly Observation[]): DashboardStudentStatus | null {
  // Last student_status row wins. There should be at most one in
  // practice (StatusChangeService updates in place), but iterating
  // is robust to historical data.
  let latest: Observation | null = null;
  for (const r of rows) {
    if (r.type !== 'student_status') continue;
    if (!latest || r.updatedAt > latest.updatedAt) latest = r;
  }
  if (!latest) return null;
  const data = (latest.data ?? {}) as {
    status?: string;
    previousStatus?: string | null;
    summary?: string;
    alertMessage?: string | null;
  };
  if (typeof data.status !== 'string') return null;
  return {
    current: data.status,
    previous: data.previousStatus ?? null,
    derivedAt: latest.updatedAt,
    summary: data.summary ?? '',
    alertMessage: data.alertMessage ?? null,
  };
}

function computeMetrics(rows: readonly Observation[]): DashboardStudentMetrics {
  let messageCount = 0;
  let knowledgeCount = 0;
  let misconceptionCount = 0;
  const scores: number[] = [];
  let lastActiveAt: number | null = null;
  let currentStep: number | null = null;

  for (const r of rows) {
    if (ACTIVITY_TYPES.has(r.type)) {
      if (lastActiveAt === null || r.createdAt > lastActiveAt) {
        lastActiveAt = r.createdAt;
      }
    }
    if (r.type === 'indicator_hit') {
      messageCount += 1;
      const anchors = (r.data as { anchors?: string[] }).anchors ?? [];
      for (const a of anchors) {
        if (a.startsWith('M')) misconceptionCount += 1;
        else if (a.startsWith('K')) knowledgeCount += 1;
      }
    } else if (r.type === 'exercise') {
      const s = (r.data as { score?: number }).score;
      if (typeof s === 'number') scores.push(s);
    } else if (r.type === 'progress') {
      // progress.step is the step the student just COMPLETED; treat
      // its value as currentStep so the frontend can render
      // "step-${currentStep}". Most recent progress row wins because
      // rows iterate in createdAt ASC.
      const s = (r.data as { step?: number }).step;
      if (typeof s === 'number') currentStep = s;
    }
  }

  const exerciseCorrectRate =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

  return {
    messageCount,
    knowledgeCount,
    misconceptionCount,
    exerciseCorrectRate,
    lastActiveAt,
    currentStep,
  };
}
