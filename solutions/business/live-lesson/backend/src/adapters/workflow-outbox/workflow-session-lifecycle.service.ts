/**
 * `WorkflowSessionLifecycleService` — phase 5 M6 pass-1 S1. Signals
 * session-end to the platform so per-session state (indicator catalog,
 * workflow engine queue) is freed. Wired from `ClassroomService.endSession`.
 *
 * Fire-and-forget mirrors the rest of the workflow-outbox adapters.
 * Failure logs but doesn't disrupt user-visible session-end. The
 * platform endpoint is idempotent — a retried DELETE returns 204.
 *
 * Same CCAAS_URL / CCAAS_API_KEY / LIVE_LESSON_WORKFLOW_DISPATCH config
 * as the other workflow-outbox services.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkflowClient } from '@kedge-agentic/workflow-client';
import { WorkflowDispatchService } from './workflow-dispatch.service';

@Injectable()
export class WorkflowSessionLifecycleService {
  private readonly logger = new Logger(WorkflowSessionLifecycleService.name);
  private client: WorkflowClient | undefined;
  private apiKeyWarned = false;

  constructor(
    private readonly config: ConfigService,
    private readonly dispatch: WorkflowDispatchService,
  ) {}

  /**
   * Signal session-end. Fire-and-forget; never throws. Returns once
   * the HTTP call resolves (success or fail) so callers can sequence
   * teardown deterministically if needed.
   */
  async clearSession(sessionId: string): Promise<void> {
    if (!this.dispatch.isEnabled()) return;
    const client = this.ensureClient();
    if (!client) return;
    const outcome = await client.clearSession(sessionId);
    if (outcome.status === 'failed') {
      this.logger.warn(
        `clearSession failed for ${sessionId}: ${outcome.error}` +
          (outcome.httpStatus ? ` (HTTP ${outcome.httpStatus})` : '') +
          `; retryable=${outcome.retryable}`,
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
          'CCAAS_API_KEY not set — session-end signal disabled. Platform IndicatorRegistry will leak per-session state until restart.',
        );
        this.apiKeyWarned = true;
      }
      return undefined;
    }
    this.client = new WorkflowClient({ baseUrl, apiKey });
    return this.client;
  }
}
