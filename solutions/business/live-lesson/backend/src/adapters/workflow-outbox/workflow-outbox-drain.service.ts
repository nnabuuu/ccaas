/**
 * `WorkflowOutboxDrainService` — periodic worker that drains the outbox
 * by pushing each pending row to the platform via `WorkflowClient`.
 *
 * Cadence: every 2 seconds (configurable via
 * `LIVE_LESSON_WORKFLOW_DRAIN_INTERVAL_MS`). Each tick pulls up to 50
 * pending rows whose `nextAttemptAtEpoch <= now` and processes them
 * sequentially. Sequential because:
 *   - per-session ordering is preserved (events on same session push
 *     in createdAt order; concurrent pushes would race)
 *   - the platform's dedup is per-eventId so concurrent failures don't
 *     cause incorrect double-fires, just wasted HTTP traffic
 *
 * Backoff schedule (exponential, capped):
 *   - attempt 1 fails → next try in 2s
 *   - attempt 2 fails → next try in 8s
 *   - attempt 3 fails → next try in 32s
 *   - attempt N fails → next try in min(2^(2N-1), 600) seconds
 *   - poisoned after 8 attempts (>10 min) of retryable failure
 *
 * Env config:
 *   - CCAAS_URL: platform base URL (defaults to http://localhost:3001)
 *   - CCAAS_API_KEY: required; if missing the worker logs once + skips
 *   - LIVE_LESSON_WORKFLOW_DRAIN_INTERVAL_MS: optional override
 *   - LIVE_LESSON_WORKFLOW_DISPATCH=disabled: turn the worker off entirely
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WorkflowClient,
  type WorkflowPushOutcome,
} from '@kedge-agentic/workflow-client';
import { WorkflowOutboxRepository } from './workflow-outbox.repository';
import { WorkflowDispatchService } from './workflow-dispatch.service';

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_BATCH = 50;
const MAX_BACKOFF_SECONDS = 600;
const POISON_AFTER_ATTEMPTS = 8;

@Injectable()
export class WorkflowOutboxDrainService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WorkflowOutboxDrainService.name);
  private timer: NodeJS.Timeout | undefined;
  private client: WorkflowClient | undefined;
  private apiKeyWarned = false;
  /**
   * Re-entrancy guard (pass-1 M-2): setInterval doesn't await prior tick,
   * so a slow tick can overlap with the next firing. Without this guard,
   * two ticks would both `findPendingDue` the same rows + push them
   * concurrently, racing on `markRetry` / `markDelivered` and corrupting
   * the state machine. We skip the next tick when one is in flight.
   * The drain just resumes on the following interval.
   */
  private tickInFlight = false;

  constructor(
    private readonly outbox: WorkflowOutboxRepository,
    private readonly dispatch: WorkflowDispatchService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.dispatch.isEnabled()) {
      this.logger.log(
        'LIVE_LESSON_WORKFLOW_DISPATCH=disabled — outbox drain worker is OFF.',
      );
      return;
    }
    const intervalMs = this.resolveIntervalMs();
    this.logger.log(
      `Workflow outbox drain worker started (interval=${intervalMs}ms).`,
    );
    this.timer = setInterval(() => {
      if (this.tickInFlight) {
        // Skip silently; the next interval picks up where this one stopped.
        return;
      }
      this.tickInFlight = true;
      void this.tick()
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`outbox drain tick threw: ${msg}`);
        })
        .finally(() => {
          this.tickInFlight = false;
        });
    }, intervalMs);
    // Run an immediate tick at boot so the first event delivers without
    // waiting a full interval (helpful in tests + dev).
    if (!this.tickInFlight) {
      this.tickInFlight = true;
      void this.tick()
        .catch(() => undefined)
        .finally(() => {
          this.tickInFlight = false;
        });
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Test helper: process a single tick synchronously. */
  async tick(): Promise<number> {
    if (!this.dispatch.isEnabled()) return 0;
    const client = this.ensureClient();
    if (!client) return 0;

    const now = Date.now();
    const rows = await this.outbox.findPendingDue(now, DEFAULT_BATCH);
    let processed = 0;
    for (const row of rows) {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.outbox.markPoisoned(row.id, `payload JSON.parse failed: ${msg}`);
        continue;
      }

      const outcome = await client.pushEvent(row.sessionId, {
        eventId: row.eventId,
        manifestName: row.manifestName,
        streamApiName: row.streamApiName,
        entityId: row.entityId,
        payload,
        correlationId: row.correlationId ?? undefined,
      });

      await this.handleOutcome(row.id, row.attempts, outcome);
      processed += 1;
    }
    return processed;
  }

  private async handleOutcome(
    id: string,
    priorAttempts: number,
    outcome: WorkflowPushOutcome,
  ): Promise<void> {
    switch (outcome.status) {
      case 'accepted':
      case 'duplicate':
      case 'disabled':
        await this.outbox.markDelivered(id);
        return;
      case 'failed': {
        const nextAttempts = priorAttempts + 1;
        if (!outcome.retryable) {
          await this.outbox.markPoisoned(id, outcome.error);
          return;
        }
        if (nextAttempts >= POISON_AFTER_ATTEMPTS) {
          await this.outbox.markPoisoned(
            id,
            `gave up after ${nextAttempts} retryable failures; last error: ${outcome.error}`,
          );
          return;
        }
        const backoffSec = Math.min(
          Math.pow(2, nextAttempts * 2 - 1),
          MAX_BACKOFF_SECONDS,
        );
        await this.outbox.markRetry(
          id,
          nextAttempts,
          outcome.error,
          Date.now() + backoffSec * 1000,
        );
        return;
      }
    }
  }

  private resolveIntervalMs(): number {
    const v =
      this.config.get<string>('LIVE_LESSON_WORKFLOW_DRAIN_INTERVAL_MS') ??
      process.env.LIVE_LESSON_WORKFLOW_DRAIN_INTERVAL_MS;
    if (!v) return DEFAULT_INTERVAL_MS;
    const parsed = Number.parseInt(v, 10);
    return Number.isFinite(parsed) && parsed >= 100 ? parsed : DEFAULT_INTERVAL_MS;
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
          'CCAAS_API_KEY not set — outbox drain worker is idle. Set it in .env to enable workflow event delivery.',
        );
        this.apiKeyWarned = true;
      }
      return undefined;
    }
    this.client = new WorkflowClient({ baseUrl, apiKey });
    return this.client;
  }
}
