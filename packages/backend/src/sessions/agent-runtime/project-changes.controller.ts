/**
 * Project-scoped sync REST endpoints — the GUI's window into the
 * agent-runtime sync layer.
 *
 *   GET   /api/v1/projects/:projectId/changes      (SSE)
 *   POST  /api/v1/projects/:projectId/invalidate
 *
 * The SSE stream relays `ChangeEvent`s from the in-process
 * `InMemoryChangeStream`. The invalidate endpoint is optional sugar
 * for solutions that want lower-latency GUI→agent updates than the
 * default "wait for the next agent turn boundary" cadence.
 *
 * Auth: both endpoints require the caller's tenant scope. The
 * project-id space is solution-defined; the runtime treats it as
 * opaque and does no per-tenant filtering of subscriptions — solutions
 * that need that should encode tenancy in their projectId or layer a
 * solution-side guard.
 */

import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import type { ChangeEvent, ChangeStream } from '@kedge-agentic/agent-runtime';

import { CHANGE_STREAM } from './tokens';
import { SessionService } from '../session.service';
import { SessionAssetSyncer } from './session-asset-syncer.service';

@ApiTags('agent-runtime')
@Controller('projects/:projectId')
export class ProjectChangesController {
  constructor(
    @Inject(CHANGE_STREAM) private readonly changes: ChangeStream,
    private readonly sessions: SessionService,
    private readonly syncer: SessionAssetSyncer,
  ) {}

  /**
   * Live SSE feed of `ChangeEvent`s for the project. Closes on client
   * disconnect (handled automatically by NestJS's SSE Observable
   * teardown).
   *
   * Event shape:
   *   data: JSON-stringified ChangeEvent
   *     { projectId, path, source: 'agent'|'gui'|'system',
   *       kind: 'created'|'updated'|'deleted', at, actor? }
   */
  @Get('changes')
  @ApiOperation({
    summary: 'Live SSE feed of artifact change events for a project',
  })
  @ApiParam({ name: 'projectId', type: String })
  @Sse('changes')
  changes$(@Param('projectId') projectId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const unsubscribe = this.changes.subscribe(projectId, (ev: ChangeEvent) => {
        subscriber.next({ data: ev });
      });
      // initial keep-alive comment + welcome event so the GUI knows the
      // subscription is live even before the first real change.
      subscriber.next({ data: { projectId, kind: 'subscribed', at: new Date().toISOString() } as any });
      // Heartbeat every 30s so intermediate proxies don't time out.
      const heartbeat = setInterval(
        () => subscriber.next({ data: { kind: 'heartbeat', at: new Date().toISOString() } as any }),
        30_000,
      );
      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    });
  }

  /**
   * Request an early sync flush for any sessions currently bound to
   * `projectId`. Useful when the GUI just made a DB write and wants
   * the agent to see it before the next turn boundary.
   *
   * Fire-and-forget — returns immediately; the syncer runs
   * asynchronously per-session.
   */
  @Post('invalidate')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Request early sync of bound sessions for a project',
  })
  @ApiParam({ name: 'projectId', type: String })
  async invalidate(
    @Param('projectId') projectId: string,
  ): Promise<{ accepted: number }> {
    const bound = this.findSessionsBoundTo(projectId);
    // Fire-and-forget; errors are logged by the syncer itself.
    for (const sid of bound) {
      void this.syncer.sync(sid).catch(() => undefined);
    }
    return { accepted: bound.length };
  }

  private findSessionsBoundTo(projectId: string): string[] {
    return this.sessions.findSessionsByProjectId(projectId);
  }
}
