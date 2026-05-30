/**
 * `WorkflowDispatchService` — public API for application-layer services
 * (ClassroomService, StudentSubmissionService, DiscussService, …) to
 * push ontology events to the platform Workflow engine.
 *
 * Phase 5 M2 shape:
 *   - At-most-once enqueue: caller provides the eventId; we insert a
 *     row in `ontology_event_outbox` and return. drain worker handles
 *     delivery.
 *   - Fire-and-forget from the caller's perspective. failures inside
 *     enqueue (DB error, etc.) get logged but never thrown — the
 *     legacy observer-engine dispatch stays alongside this during the
 *     M2 transition, so a single outbox failure is non-fatal.
 *
 * Wraps `@kedge-agentic/workflow-client`'s `WorkflowClient` only inside
 * the drain worker — not here. The application layer never sees the
 * HTTP client directly.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { WorkflowOutboxRepository } from './workflow-outbox.repository';

export interface DispatchEventInput {
  readonly sessionId: string;
  readonly manifestName: string;
  readonly streamApiName: string;
  readonly entityId: string;
  readonly payload: Record<string, unknown>;
  /** Optional caller-supplied eventId. Default: new UUID. */
  readonly eventId?: string;
  readonly correlationId?: string;
}

@Injectable()
export class WorkflowDispatchService {
  private readonly logger = new Logger(WorkflowDispatchService.name);
  /** Counter for ops visibility into outbox enqueue failures (pass-1 S-3). */
  private enqueueFailures = 0;

  constructor(
    private readonly outbox: WorkflowOutboxRepository,
    private readonly config: ConfigService,
  ) {}

  /** Ops/health hook. Resets only via process restart. */
  getEnqueueFailureCount(): number {
    return this.enqueueFailures;
  }

  /**
   * Returns true if env-flag-gated workflow dispatch is enabled. Defaults
   * to TRUE — outbox accumulates events even if the platform isn't
   * receiving yet (drain worker handles delivery once it is).
   *
   * Set `LIVE_LESSON_WORKFLOW_DISPATCH=disabled` to fully short-circuit
   * (no outbox writes; useful when running the live-lesson backend in
   * isolation against an older platform that doesn't have the M1 ingest
   * endpoint).
   */
  isEnabled(): boolean {
    const v =
      this.config.get<string>('LIVE_LESSON_WORKFLOW_DISPATCH') ??
      process.env.LIVE_LESSON_WORKFLOW_DISPATCH;
    return v !== 'disabled';
  }

  async pushEvent(input: DispatchEventInput): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    const eventId = input.eventId ?? randomUUID();
    try {
      await this.outbox.enqueue({
        eventId,
        sessionId: input.sessionId,
        manifestName: input.manifestName,
        streamApiName: input.streamApiName,
        entityId: input.entityId,
        payload: input.payload,
        correlationId: input.correlationId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.enqueueFailures += 1;
      this.logger.error(
        `outbox enqueue failed for event ${eventId} on session ${input.sessionId}: ${msg} ` +
          `(total enqueue failures: ${this.enqueueFailures})`,
      );
      // **No row was persisted** — the catch is on `repo.save()` itself,
      // so the drain worker has nothing to retry. The event is dropped
      // from the workflow path. Legacy observer-engine (M2 dual-write)
      // is the safety net until M3 retires it; after M3, an enqueue
      // failure here is a real lost event. Monitor via
      // `getEnqueueFailureCount()` before deploying M3.
    }
  }
}
