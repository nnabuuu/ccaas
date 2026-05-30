/**
 * `ObservationDashboardProjector` — phase 5 M3. Translates the
 * platform-side ontology-aligned `Observation` rows back into the
 * legacy `{logs, alerts, indicatorStats}` JSON the 3-tab live-lesson
 * teacher dashboard already consumes (`ObservationQueryService.getObservationDashboard`).
 *
 * Phase 5 contract (Path B from the impl plan): Workflow handlers
 * write a NEW ontology-native shape; the projector preserves the
 * legacy wire shape so the frontend stays byte-identical during the
 * transition. M5 deletes this projector + rewrites the 3 tabs to
 * consume the ontology shape directly.
 *
 * M3 simplifications (documented for M4/M5 follow-up):
 *   - `studentName` falls back to `studentId` because student names
 *     live in the live-lesson DB; cross-process resolution is M4.
 *   - `indicatorStats` returns `[]`; indicators are stateful and live
 *     in `IndicatorRegistryService` which is M4.
 *   - `alerts` are derived from existing `student_status` observation
 *     rows. Pre-M4 those rows don't exist yet, so alerts are empty
 *     until the StatusChangeHandler is rewritten (M4).
 *
 * **LOC budget**: pass-1 reviewer flagged that the M3 translator must
 * stay <500 lines. Current size is well under — most complexity lives
 * in the legacy ObservationQueryService that this replaces.
 */

import { Injectable } from '@nestjs/common';
import type { Observation } from '@kedge-agentic/observer-engine';
import { ObservationRepository } from '../../persistence/observation-repository';
import { IndicatorRegistryService } from '../../llm/indicator-registry.service';

/** Legacy contract. Matches `solutions/business/live-lesson/backend/src/schemas/classroom/observation.ts`. */
export interface StudentEvent {
  readonly timestamp: number;
  readonly anchors?: readonly string[];
  readonly gist?: string;
  readonly quote?: string;
  readonly source: 'llm' | 'system';
  readonly systemType?: string;
  readonly data?: Record<string, unknown>;
}

export interface SystemMetrics {
  readonly messageCount: number;
  readonly lastActiveAt: number | null;
  readonly exerciseCorrectRate: number | null;
  readonly currentStep: number | null;
}

export interface StudentLog {
  readonly studentId: string;
  readonly studentName: string;
  readonly events: readonly StudentEvent[];
  readonly systemMetrics: SystemMetrics;
  readonly status?: string;
}

export interface Alert {
  readonly timestamp: number;
  readonly studentName: string;
  readonly studentId: string;
  readonly severity: 'urgent' | 'warn' | 'info';
  readonly message: string;
  readonly indicatorId?: string;
}

export interface IndicatorStats {
  readonly indicatorId: string;
  readonly label: string;
  readonly type: string;
  readonly studentCount: number;
  readonly latestGist?: string;
  readonly updatedAt: number;
}

export interface ObservationDashboardPayload {
  readonly logs: readonly StudentLog[];
  readonly alerts: readonly Alert[];
  readonly indicatorStats: readonly IndicatorStats[];
}

@Injectable()
export class ObservationDashboardProjector {
  constructor(
    private readonly observations: ObservationRepository,
    private readonly indicators: IndicatorRegistryService,
  ) {}

  async project(sessionId: string): Promise<ObservationDashboardPayload> {
    const rows = await this.observations.getBySession(sessionId);
    const byStudent = new Map<string, Observation[]>();
    for (const obs of rows) {
      const list = byStudent.get(obs.entityId);
      if (list) {
        list.push(obs);
      } else {
        byStudent.set(obs.entityId, [obs]);
      }
    }

    const logs: StudentLog[] = [];
    const alerts: Alert[] = [];
    for (const [entityId, observations] of byStudent) {
      const { log, alert } = this.buildStudentLog(entityId, observations);
      logs.push(log);
      if (alert) alerts.push(alert);
    }

    // Sort logs by studentId for stable output (legacy was insertion-
    // ordered; sorting makes diff tooling happy + frontend doesn't care).
    logs.sort((a, b) => a.studentId.localeCompare(b.studentId));

    return {
      logs,
      alerts,
      // M5.3b: indicator stats computed from the IndicatorRegistry
      // catalog + the platform's indicator_hit observation rows. The
      // M5 second pass deletes this projector entirely, so the
      // throwaway compute lives here rather than in DashboardService
      // (which serves the new ontology-native shape).
      indicatorStats: this.computeIndicatorStats(sessionId, rows),
    };
  }

  private computeIndicatorStats(
    sessionId: string,
    rows: readonly Observation[],
  ): IndicatorStats[] {
    const catalog = this.indicators.getIndicators(sessionId);
    if (catalog.length === 0) return [];

    type Acc = { students: Set<string>; latestGist: string; updatedAt: number };
    const accByAnchor = new Map<string, Acc>();
    for (const def of catalog) {
      accByAnchor.set(def.id, { students: new Set(), latestGist: '', updatedAt: 0 });
    }
    for (const r of rows) {
      if (r.type !== 'indicator_hit') continue;
      const data = (r.data ?? {}) as { anchors?: string[]; gist?: string };
      const anchors = data.anchors ?? [];
      const gist = data.gist ?? '';
      for (const anchor of anchors) {
        const acc = accByAnchor.get(anchor);
        if (!acc) continue; // unknown anchor — fail-closed, don't surface
        acc.students.add(r.entityId);
        if (r.updatedAt > acc.updatedAt) {
          acc.latestGist = gist;
          acc.updatedAt = r.updatedAt;
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

  private buildStudentLog(
    entityId: string,
    observations: readonly Observation[],
  ): { log: StudentLog; alert: Alert | null } {
    const events: StudentEvent[] = [];
    let messageCount = 0;
    let lastActiveAt: number | null = null;
    let exerciseCorrectRate: number | null = null;
    let currentStep: number | null = null;
    let status: string | undefined;
    let alert: Alert | null = null;

    for (const obs of observations) {
      const data = (obs.data ?? {}) as Record<string, unknown>;
      const timestamp = obs.createdAt;
      if (lastActiveAt === null || timestamp > lastActiveAt) {
        lastActiveAt = timestamp;
      }

      switch (obs.type) {
        case 'lifecycle': {
          const action = typeof data.action === 'string' ? data.action : 'unknown';
          // messageCount is bumped only in `indicator_hit` (M4) — the
          // M4 source of chat-turn truth. Lifecycle events
          // (join / translate_request / discuss_complete /
          // continue_chat_turn) are NOT counted as messages by the
          // legacy dashboard definition, so they fall through here.
          events.push({
            timestamp,
            source: 'system',
            systemType: action,
            data,
          });
          break;
        }
        case 'exercise': {
          if (typeof data.score === 'number') {
            exerciseCorrectRate = data.score;
          }
          if (typeof data.step === 'number') {
            currentStep = data.step;
          }
          events.push({
            timestamp,
            source: 'system',
            systemType: 'exercise_result',
            data,
          });
          break;
        }
        case 'progress': {
          if (typeof data.step === 'number') {
            currentStep = data.step;
          }
          events.push({
            timestamp,
            source: 'system',
            systemType: 'step_complete',
            data,
          });
          break;
        }
        case 'indicator_hit': {
          // M4: LLM-classified indicator hit. Counts as a chat-turn
          // message in the legacy dashboard's messageCount metric.
          messageCount += 1;
          events.push({
            timestamp,
            source: 'llm',
            anchors: Array.isArray(data.anchors) ? (data.anchors as string[]) : [],
            gist: typeof data.gist === 'string' ? data.gist : undefined,
            quote: typeof data.quote === 'string' ? data.quote : undefined,
            data,
          });
          break;
        }
        case 'student_status': {
          // M4: derived status. Surface the latest status + build alert
          // when the status is alertable (stuck/struggling/idle).
          status = typeof data.status === 'string' ? data.status : undefined;
          const alertable = ['stuck', 'struggling', 'idle'] as const;
          if (typeof status === 'string' && alertable.includes(status as any)) {
            const sev =
              status === 'stuck'
                ? 'urgent'
                : status === 'struggling'
                  ? 'warn'
                  : 'info';
            alert = {
              timestamp,
              studentName: entityId, // M3-style placeholder
              studentId: entityId,
              severity: sev,
              message:
                typeof data.alertMessage === 'string' && data.alertMessage.length > 0
                  ? data.alertMessage
                  : `Status: ${status}`,
            };
          }
          break;
        }
        default: {
          // Unknown observation types fall through as opaque system events
          // so the dashboard never silently drops data.
          events.push({
            timestamp,
            source: 'system',
            systemType: obs.type,
            data,
          });
        }
      }
    }

    return {
      log: {
        studentId: entityId,
        // M3 placeholder; M4 resolves real student name (see file header).
        studentName: entityId,
        events,
        systemMetrics: {
          messageCount,
          lastActiveAt,
          exerciseCorrectRate,
          currentStep,
        },
        status,
      },
      alert,
    };
  }
}
