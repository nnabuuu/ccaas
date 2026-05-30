/**
 * `WorkflowDashboardFetchService` — phase 5 M5.3b. HTTP fetch from
 * the platform's legacy projector endpoint
 * (GET /api/v1/workflow/sessions/:id/observation-dashboard) so the
 * live-lesson backend can stop reading from its OWN observation table
 * for the dashboard. Cross-process source-of-truth alignment.
 *
 * Why HTTP fetch instead of direct DB:
 *   - Post-M3 the canonical observation rows live on the PLATFORM
 *     side (workflow handlers write there). Live-lesson's local DB
 *     observations are dual-written-dead-code until M6 deletion.
 *   - HTTP keeps the network boundary explicit so M6 can drop the
 *     local observation table cleanly without code changes here.
 *
 * Fallback: if the fetch fails, we fall back to the LOCAL
 * `ObservationQueryService.getObservationDashboard(sessionId)`. The
 * local path is "stale during transition" — it reads live-lesson's
 * own observation table which still has dual-written rows — so it's
 * not wrong, just slightly behind the platform on chat_turn data.
 * The fallback prevents dashboard from going dark when the platform
 * is unreachable.
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
} from '../../schemas/classroom/observation';
import { WorkflowDispatchService } from './workflow-dispatch.service';

export interface DashboardFetchResult {
  readonly logs: StudentLog[];
  readonly alerts: Alert[];
  readonly indicatorStats: IndicatorStats[];
  readonly source: 'platform' | 'local-fallback';
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
   * caller should fall back to the local path (HTTP failed AND the
   * caller has a local source). The outcome's `source` field lets
   * the caller emit metrics about platform vs local serving.
   *
   * Returns `null` on:
   *   - `LIVE_LESSON_WORKFLOW_DISPATCH=disabled` (treat platform as
   *     unreachable)
   *   - missing CCAAS_API_KEY (treat platform as unauthorized)
   *   - any non-200 from the platform (5xx, 4xx, network)
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
          'CCAAS_API_KEY not set — dashboard fetch is disabled; using local fallback.',
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
      source: 'platform',
    };
  }
  return { logs: [], alerts: [], indicatorStats: [], source: 'platform' };
}
