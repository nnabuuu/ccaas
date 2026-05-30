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
  Body,
  Controller,
  HttpStatus,
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
import { Auth, TenantId } from '../../auth/decorators';
import { WorkflowMetricsService } from '../workflow-metrics.service';
import { WorkflowEngineService } from '../workflow-engine.service';
import { ObserverEventRepository } from '../persistence/observer-event-repository';
import { WorkflowEventDto } from './event-ingest.dto';

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

    // Dedup FIRST. Returns 200 OK with metadata so retrying outbox
    // workers can mark their row delivered.
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
