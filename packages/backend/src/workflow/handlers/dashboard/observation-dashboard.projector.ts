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
  constructor(private readonly observations: ObservationRepository) {}

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
    for (const [entityId, observations] of byStudent) {
      logs.push(this.buildStudentLog(entityId, observations));
    }

    // Sort logs by studentId for stable output (legacy was insertion-
    // ordered; sorting makes diff tooling happy + frontend doesn't care).
    logs.sort((a, b) => a.studentId.localeCompare(b.studentId));

    return {
      logs,
      // M3 simplification: alerts derive from student_status observations
      // which the StatusChangeHandler (M4) writes. Until M4 lands, no
      // alerts surface from the ontology path.
      alerts: [],
      // M3 simplification: indicator stats need the IndicatorRegistry
      // which moves in M4. Until then no indicator stats from this path.
      indicatorStats: [],
    };
  }

  private buildStudentLog(
    entityId: string,
    observations: readonly Observation[],
  ): StudentLog {
    const events: StudentEvent[] = [];
    let messageCount = 0;
    let lastActiveAt: number | null = null;
    let exerciseCorrectRate: number | null = null;
    let currentStep: number | null = null;

    for (const obs of observations) {
      const data = (obs.data ?? {}) as Record<string, unknown>;
      const timestamp = obs.createdAt;
      if (lastActiveAt === null || timestamp > lastActiveAt) {
        lastActiveAt = timestamp;
      }

      switch (obs.type) {
        case 'lifecycle': {
          const action = typeof data.action === 'string' ? data.action : 'unknown';
          // 'translate_request' and 'continue_chat_turn' both look like
          // chat-adjacent events in the legacy shape; bump messageCount
          // for any non-join lifecycle so the dashboard's "messages"
          // counter still moves.
          if (action !== 'join') messageCount += 1;
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
    };
  }
}
