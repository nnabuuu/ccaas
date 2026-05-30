/**
 * `WorkflowDashboardFetchService` — HTTP fetch from the platform's
 * dashboard endpoint. Post-M5.2a calls the NEW
 * `GET /api/v1/workflow/sessions/:id/dashboard` (returns ontology-native
 * `DashboardPayload`) and routes the result through
 * `DashboardPayloadAdapter` to derive the legacy 4-array shape the
 * frontend still consumes.
 *
 * The conversion lives in `dashboard-payload-adapter.ts` so the
 * **M5.2b** frontend rewrite can delete the adapter + this transitional
 * fallback in one focused commit. After M5.2b the live-lesson side
 * just passes the typed payload straight through.
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
import {
  adaptDashboardPayload,
  parseDashboardPayload,
  type DashboardFetchResult,
} from './dashboard-payload-adapter';
import { WorkflowDispatchService } from './workflow-dispatch.service';

export type { DashboardFetchResult };

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
   * Fetch the dashboard from the platform and return the legacy
   * 4-array shape the live-lesson teacher frontend already consumes.
   *
   * Returns `null` on (caller surfaces an empty dashboard; post-M6.3
   * there is no local fallback):
   *   - `LIVE_LESSON_WORKFLOW_DISPATCH=disabled`
   *   - missing CCAAS_API_KEY
   *   - any non-200 from the platform (5xx, 4xx, network, timeout)
   *
   * Returns an EMPTY `DashboardFetchResult` (logs=[], alerts=[], …)
   * on malformed payload — `parseDashboardPayload` returns `null`,
   * `adaptDashboardPayload(null)` lands in the empty arm. The
   * dashboard goes dark rather than crashing the polling endpoint.
   */
  async fetchPlatform(sessionId: string): Promise<DashboardFetchResult | null> {
    if (!this.dispatch.isEnabled()) return null;
    const client = this.ensureClient();
    if (!client) return null;
    const outcome: WorkflowDashboardOutcome = await client.getDashboard(sessionId);
    if (outcome.status !== 'ok') {
      this.logger.warn(
        `dashboard fetch failed for ${sessionId}: ${outcome.error}` +
          (outcome.httpStatus ? ` (HTTP ${outcome.httpStatus})` : ''),
      );
      return null;
    }
    return adaptDashboardPayload(parseDashboardPayload(outcome.payload));
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
