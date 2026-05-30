/**
 * `POST /api/v1/workflow/sessions/:sessionId/events` — cross-process
 * event ingest from solution-side outbox workers (live-lesson and
 * future tenants).
 *
 * Contract (phase 5 m1):
 *   - Auth: `@Auth('chat')` scope (matches existing ccaas proxy)
 *   - Body: `WorkflowEventDto` (eventId + manifestName + streamApiName +
 *     entityId + payload + optional correlationId)
 *   - Dedup gate (FIRST thing the controller does): if
 *     `ObserverEventRepository.hasEvent(eventId)` is already true,
 *     return 200 with `{dropped: 'duplicate'}` + metrics counter.
 *     Idempotent — outbox retries are safe.
 *   - Audit: every accepted event gets a row in `observer_events`.
 *     Persist runs BEFORE dispatch so a crash mid-dispatch doesn't
 *     lose the event (idempotency on replay via the dedup gate above).
 *   - Dispatch: `WorkflowEngine.ingestEvent` opens a fresh cascade
 *     frame and fans out to matching triggers via the per-session
 *     queue.
 *   - Returns 202 Accepted to signal fire-and-forget semantics
 *     (the actual trigger work completes async).
 *
 * Env flag `WORKFLOW_INGEST=enabled|disabled` (default disabled in M1)
 * gates the dispatch. When disabled the controller still persists the
 * event but skips the engine call — this keeps the wire warm for
 * solutions migrating their dispatch sites without forcing them to
 * coordinate the engine wiring.
 */

import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Inject,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { OntologyRegistry } from '@kedge-agentic/ontology';
import { ONTOLOGY_REGISTRY } from '../../ontology/ontology-registry.provider';
import { Auth, TenantId } from '../../auth/decorators';
import { WorkflowMetricsService } from '../workflow-metrics.service';
import { WorkflowEngineService } from '../workflow-engine.service';
import { ObserverEventRepository } from '../persistence/observer-event-repository';
import { WorkflowEventDto } from './event-ingest.dto';

/**
 * Detect a unique-constraint violation across SQLite and Postgres
 * without coupling the controller to a specific driver. The dedup
 * race-recovery path (pass-1 M-1) needs to recognize these in the
 * save() catch but treat every other error as a true 500.
 */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown; driverError?: { code?: unknown } };
  if (typeof e.code === 'string' && /UNIQUE|23505/.test(e.code)) return true;
  if (
    typeof e.driverError?.code === 'string' &&
    /UNIQUE|23505/.test(e.driverError.code)
  ) {
    return true;
  }
  if (typeof e.message === 'string' && /UNIQUE constraint failed/i.test(e.message)) {
    return true;
  }
  return false;
}

export type WorkflowIngestResponse =
  | { readonly accepted: true; readonly eventId: string }
  | { readonly accepted: false; readonly dropped: 'duplicate'; readonly eventId: string }
  | { readonly accepted: false; readonly dropped: 'disabled'; readonly eventId: string };

@ApiTags('workflow')
@Controller('api/v1/workflow/sessions')
export class EventIngestController {
  constructor(
    private readonly events: ObserverEventRepository,
    private readonly engine: WorkflowEngineService,
    private readonly metrics: WorkflowMetricsService,
    @Inject(ONTOLOGY_REGISTRY) private readonly ontology: OntologyRegistry,
  ) {}

  @Post(':sessionId/events')
  @Auth('chat')
  @ApiOperation({
    summary: '推送 ontology 事件 / Push ontology event',
    description:
      'Cross-process event push from a solution-side outbox to the platform Workflow engine. Idempotent: a previously-seen eventId returns 200 with `dropped: "duplicate"`. Returns 202 on accept; trigger evaluation happens async.',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 202, description: '事件被接受 / Event accepted (dispatch fires async)' })
  @ApiResponse({ status: 200, description: '重复事件已忽略 / Duplicate event dropped' })
  @ApiResponse({ status: 400, description: '校验失败 / Validation failed' })
  async ingest(
    @Param('sessionId') sessionId: string,
    @TenantId() solutionId: string | undefined,
    @Body() body: WorkflowEventDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WorkflowIngestResponse> {
    if (!solutionId) {
      // @Auth('chat') guarantees a context, but TenantId may be null
      // for admin-scope keys that aren't bound to a single tenant.
      // We require the tenant binding to write per-session events.
      throw new Error('solutionId not resolved from auth context');
    }

    // Pass-1 M-3: validate manifest + stream + payload shape BEFORE
    // persisting. Without this gate, a tenant can push events for
    // unknown manifests/streams + bloat observer_events with garbage.
    const manifest = this.ontology.getManifest(body.manifestName);
    if (!manifest) {
      throw new BadRequestException(
        `manifest "${body.manifestName}" is not registered in this platform`,
      );
    }
    const streamDef = manifest.streams?.find(
      (s) => s.apiName === body.streamApiName,
    );
    if (!streamDef) {
      throw new BadRequestException(
        `stream "${body.streamApiName}" is not declared on manifest "${body.manifestName}"`,
      );
    }
    if (streamDef.payloadSchema) {
      const parsed = streamDef.payloadSchema.safeParse(body.payload);
      if (!parsed.success) {
        throw new BadRequestException(
          `payload does not match "${body.streamApiName}" stream payloadSchema: ` +
            parsed.error.issues
              .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
              .join('; '),
        );
      }
    }

    // Optimistic dedup check + unique-constraint catch.
    // The hasEvent() pre-check is a fast path for the common
    // sequential-retry case (live-lesson outbox processes rows one at
    // a time). But under concurrent POSTs of the same eventId (parallel
    // outbox workers, or two retries crossing the wire) both could
    // pass the gate. The catch on `save()` ABOVE the engine dispatch
    // protects against that exact race: the PK on observer_events.id
    // fires a unique-constraint error, which we recover into the same
    // duplicate response the pre-check would have produced. Pass-1 M-1.
    if (await this.events.hasEvent(body.eventId)) {
      this.metrics.inc('events_dropped_duplicate');
      res.status(HttpStatus.OK);
      return {
        accepted: false,
        dropped: 'duplicate',
        eventId: body.eventId,
      };
    }

    // Persist BEFORE dispatch — if the engine crashes mid-dispatch,
    // the next outbox retry sees the row via dedup and returns
    // {dropped:'duplicate'} cleanly.
    try {
      await this.events.save({
        id: body.eventId,
        type: body.streamApiName, // legacy field reuse — type === stream name
        sessionId,
        entityId: body.entityId,
        solutionId,
        timestamp: Date.now(),
        payload: body.payload,
        metadata: body.correlationId
          ? { correlationId: body.correlationId, source: 'workflow-client' }
          : undefined,
      });
    } catch (err) {
      // SQLite/Postgres unique-constraint codes vary; match on the
      // common signals. The cleanup is the same in either case —
      // treat as duplicate, return 200, never as 500.
      if (isUniqueViolation(err)) {
        this.metrics.inc('events_dropped_duplicate');
        res.status(HttpStatus.OK);
        return {
          accepted: false,
          dropped: 'duplicate',
          eventId: body.eventId,
        };
      }
      throw err;
    }

    // Env flag gate for boot-time backout.
    if (process.env.WORKFLOW_INGEST !== 'enabled') {
      res.status(HttpStatus.ACCEPTED);
      return {
        accepted: false,
        dropped: 'disabled',
        eventId: body.eventId,
      };
    }

    // Fire-and-forget dispatch.
    void this.engine
      .ingestEvent({
        sessionId,
        solutionId,
        manifestName: body.manifestName,
        streamApiName: body.streamApiName,
        payload: body.payload,
        eventId: body.eventId,
      })
      .catch(() => {
        // engine swallows everything internally; this catch is belt + suspenders
      });

    res.status(HttpStatus.ACCEPTED);
    return { accepted: true, eventId: body.eventId };
  }
}
