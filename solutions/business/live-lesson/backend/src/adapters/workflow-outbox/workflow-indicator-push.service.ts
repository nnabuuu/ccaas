/**
 * `WorkflowIndicatorPushService` — phase 5 M5.3a. The wire that
 * pushes a session's indicator catalog to the platform's
 * `IndicatorRegistryService` so the M4 LLM handlers can fire.
 *
 * Why it's separate from `WorkflowDispatchService`:
 *   - Indicators are STATIC config (one push per session start), not
 *     a stream of events — outbox queue + retry-with-backoff is
 *     overkill.
 *   - PUT semantics are idempotent — the platform endpoint replaces
 *     on every call. If the first push fails, the next lesson start
 *     re-pushes naturally.
 *   - Fire-and-forget from the application layer's POV — failures
 *     log but never throw, mirroring the event dispatch contract.
 *
 * Tradeoffs (documented for M5.3b reviewer):
 *   - If the platform is unreachable at session start AND the
 *     dashboard fetch is already cut over (post-M5.3b), the dashboard
 *     loses chat_turn data for that session until the next restart.
 *     Acceptable today (lesson restart re-pushes); revisit if the
 *     reliability gap shows up in ops.
 *   - We don't queue+retry the push because the event outbox is
 *     append-only / per-event-id; an indicator-catalog overlay would
 *     need a different storage model. Not worth building before we
 *     see the failure mode in real traffic.
 *
 * Env config mirrors the outbox drain worker:
 *   - CCAAS_URL (default http://localhost:3001)
 *   - CCAAS_API_KEY (required; warns + skips when missing)
 *   - LIVE_LESSON_WORKFLOW_DISPATCH=disabled — skips entirely (matches
 *     `WorkflowDispatchService.isEnabled()`).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WorkflowClient,
  type WorkflowIndicatorDef,
} from '@kedge-agentic/workflow-client';
import { WorkflowDispatchService } from './workflow-dispatch.service';

@Injectable()
export class WorkflowIndicatorPushService {
  private readonly logger = new Logger(WorkflowIndicatorPushService.name);
  private client: WorkflowClient | undefined;
  private apiKeyWarned = false;

  constructor(
    private readonly config: ConfigService,
    private readonly dispatch: WorkflowDispatchService,
  ) {}

  /**
   * Fire-and-forget push. Never throws. Returns the outcome for
   * tests + ops; callers in production ignore it.
   */
  async pushIndicators(
    sessionId: string,
    indicators: readonly WorkflowIndicatorDef[],
  ): Promise<void> {
    if (!this.dispatch.isEnabled()) return;
    const client = this.ensureClient();
    if (!client) return;
    const outcome = await client.setIndicators(sessionId, indicators);
    if (outcome.status === 'failed') {
      this.logger.warn(
        `setIndicators failed for session ${sessionId}: ` +
          `${outcome.error}${outcome.httpStatus ? ` (HTTP ${outcome.httpStatus})` : ''}; retryable=${outcome.retryable}`,
      );
    }
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
          'CCAAS_API_KEY not set — indicator push is idle. Set it in .env to enable platform-side M4 cascade.',
        );
        this.apiKeyWarned = true;
      }
      return undefined;
    }
    this.client = new WorkflowClient({ baseUrl, apiKey });
    return this.client;
  }
}
