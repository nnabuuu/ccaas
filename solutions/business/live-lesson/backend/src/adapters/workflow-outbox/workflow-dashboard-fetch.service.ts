/**
 * `WorkflowDashboardFetchService` — phase 5 M5.3b + M6.3. HTTP fetch
 * from the platform's legacy projector endpoint
 * (GET /api/v1/workflow/sessions/:id/observation-dashboard).
 *
 * M6.3 removes the LOCAL ObservationQueryService fallback that M5.3b
 * shipped. The fallback was only useful while the legacy
 * observer-engine handlers were still writing observation rows to
 * live-lesson's local DB. After M6.2 retired those handlers, the
 * local table stops being written to — the fallback now just serves
 * progressively-stale data. Better to return `null` and let the caller
 * surface "platform unreachable" honestly. Outage resilience is the
 * platform's concern (HA + caching), not the solution's.
 *
 * Env config mirrors `WorkflowOutboxDrainService` /
 * `WorkflowIndicatorPushService` so the platform URL + API key live
 * in one place per solution.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WorkflowClient,
  type WorkflowDashboardOutcome,
} from '@kedge-agentic/workflow-client';
import type {
  StudentLog,
  Alert,
  IndicatorStats,
  IndicatorDef,
} from '../../schemas/classroom/observation';
import { WorkflowDispatchService } from './workflow-dispatch.service';

export interface DashboardFetchResult {
  readonly logs: StudentLog[];
  readonly alerts: Alert[];
  readonly indicatorStats: IndicatorStats[];
  /**
   * Session-scoped catalog of indicator definitions. Added in M6.3
   * so live-lesson's `getState().observation.indicators` field can
   * source from the platform projector instead of the deleted local
   * `ObservationQueryService.getIndicators` cache.
   */
  readonly indicators: IndicatorDef[];
  /**
   * Always `'platform'` post-M6.3. Kept as a field for future
   * observability hooks (e.g. if we ever re-add a local cache layer).
   */
  readonly source: 'platform';
}

@Injectable()
export class WorkflowDashboardFetchService {
  private readonly logger = new Logger(WorkflowDashboardFetchService.name);
  private client: WorkflowClient | undefined;
  private apiKeyWarned = false;

  constructor(
    private readonly config: ConfigService,
    private readonly dispatch: WorkflowDispatchService,
  ) {}

  /**
   * Fetch the dashboard from the platform. Returns `null` when the
   * platform is unreachable — caller surfaces an empty dashboard
   * (post-M6.3 there is no local fallback).
   *
   * Returns `null` on:
   *   - `LIVE_LESSON_WORKFLOW_DISPATCH=disabled`
   *   - missing CCAAS_API_KEY
   *   - any non-200 from the platform (5xx, 4xx, network, timeout)
   *   - malformed payload (shape doesn't match the projector contract)
   */
  async fetchPlatform(sessionId: string): Promise<DashboardFetchResult | null> {
    if (!this.dispatch.isEnabled()) return null;
    const client = this.ensureClient();
    if (!client) return null;
    const outcome: WorkflowDashboardOutcome =
      await client.getObservationDashboard(sessionId);
    if (outcome.status !== 'ok') {
      this.logger.warn(
        `dashboard fetch failed for ${sessionId}: ${outcome.error}` +
          (outcome.httpStatus ? ` (HTTP ${outcome.httpStatus})` : ''),
      );
      return null;
    }
    return narrowPayload(outcome.payload);
  }

  private ensureClient(): WorkflowClient | undefined {
    if (this.client) return this.client;
    const baseUrl =
      this.config.get<string>('CCAAS_URL') ??
      process.env.CCAAS_URL ??
      'http://localhost:3001';
    const apiKey =
      this.config.get<string>('CCAAS_API_KEY') ?? process.env.CCAAS_API_KEY;
    if (!apiKey) {
      if (!this.apiKeyWarned) {
        this.logger.warn(
          'CCAAS_API_KEY not set — dashboard fetch is disabled.',
        );
        this.apiKeyWarned = true;
      }
      return undefined;
    }
    this.client = new WorkflowClient({ baseUrl, apiKey });
    return this.client;
  }
}

/**
 * Narrow `unknown` from the workflow-client to our typed shape. We
 * accept whatever the projector returns — defensive defaults if
 * fields are missing — and stamp `source: 'platform'`.
 */
function narrowPayload(payload: unknown): DashboardFetchResult {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    return {
      logs: Array.isArray(obj.logs) ? (obj.logs as StudentLog[]) : [],
      alerts: Array.isArray(obj.alerts) ? (obj.alerts as Alert[]) : [],
      indicatorStats: Array.isArray(obj.indicatorStats)
        ? (obj.indicatorStats as IndicatorStats[])
        : [],
      // M6 pass-1 S5: defensive filter to the narrow knowledge/misconception
      // union the live-lesson schema declares. Platform IndicatorRegistry
      // accepts any string `type`; without this filter the cast would lie
      // when a future caller pushes `type: 'process'`.
      indicators: Array.isArray(obj.indicators)
        ? filterIndicators(obj.indicators as unknown[])
        : [],
      source: 'platform',
    };
  }
  return {
    logs: [],
    alerts: [],
    indicatorStats: [],
    indicators: [],
    source: 'platform',
  };
}

function filterIndicators(arr: unknown[]): IndicatorDef[] {
  const out: IndicatorDef[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const d = raw as Record<string, unknown>;
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
