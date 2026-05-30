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

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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

  constructor(
    private readonly outbox: WorkflowOutboxRepository,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
  ) {}

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
      this.config?.get<string>('LIVE_LESSON_WORKFLOW_DISPATCH') ??
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
      this.logger.error(
        `outbox enqueue failed for event ${eventId} on session ${input.sessionId}: ${msg}`,
      );
      // legacy observer-engine path stays running; M2 dual-write means
      // a missed outbox row doesn't lose the event from the user-facing
      // perspective. drain worker will retry next interval if the row
      // landed but a follow-up update failed.
    }
  }
}
