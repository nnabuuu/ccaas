/**
 * Project-scoped sync REST endpoints — the GUI's window into the
 * agent-runtime sync layer.
 *
 *   GET   /projects/:projectId/changes?token=K   (SSE)
 *   POST  /projects/:projectId/invalidate?token=K
 *
 * Note: ccaas does not set a global API prefix; sessions endpoints use
 * `@Controller('api/v1/sessions')` but the agent-runtime project routes
 * deliberately sit at the root namespace. Solutions wiring SSE clients
 * (e.g. the creator's `getChangesStreamUrl`) target the bare path.
 *
 * The SSE stream relays `ChangeEvent`s from the in-process
 * `InMemoryChangeStream`. The invalidate endpoint is optional sugar
 * for solutions that want lower-latency GUI→agent updates than the
 * default "wait for the next agent turn boundary" cadence.
 *
 * **Auth (Phase 2b-2)**: both endpoints are gated by `ProjectAccessGuard`
 * which validates `?token=<apiKey>` and checks the token's tenant
 * matches the project's owning tenant (via `ProjectTenantResolver`).
 * The guard runs in `canActivate` BEFORE the handler — necessary for
 * SSE, where the @Sse handler would otherwise commit HTTP 200 before
 * an in-handler auth check could reject. See `project-access.guard.ts`
 * for why this can't be done inside the Observable.
 *
 * Reject paths (handled by the Guard, surfaced as proper HTTP statuses):
 *   401: missing/invalid/expired token
 *   403: token's tenant doesn't match the project's tenant, OR
 *        no `ProjectTenantResolver` registered (default denies)
 *
 * Query-param tokens leak to access logs. Acceptable for single-tenant
 * dev / prod-with-trusted-network. For true multi-tenant prod, a
 * short-lived exchange token (`POST /sessions/exchange`) is a Phase 3
 * hardening — not in scope here.
 */

import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Sse,
  UseGuards,
  type MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import type { ChangeEvent, ChangeStream } from '@kedge-agentic/agent-runtime';

import { CHANGE_STREAM } from './tokens';
import { SessionService } from '../session.service';
import { SessionAssetSyncer } from './session-asset-syncer.service';
import { Public } from '../../auth/decorators';
import { ProjectAccessGuard } from './project-access.guard';

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
   * `@Public()` skips the global ApiKey decorator-based auth (which is
   * header-based and wouldn't fit EventSource anyway); `ProjectAccessGuard`
   * does the query-param token check + tenant match instead.
   */
  @Get('changes')
  @Public()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({
    summary: 'Live SSE feed of artifact change events for a project',
  })
  @ApiParam({ name: 'projectId', type: String })
  @ApiQuery({ name: 'token', type: String, required: true })
  @Sse('changes')
  changes$(@Param('projectId') projectId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const unsubscribe = this.changes.subscribe(projectId, (ev: ChangeEvent) => {
        subscriber.next({ data: ev });
      });
      // Initial keep-alive welcome event so the GUI knows the subscription
      // is live even before the first real change.
      const welcome: Record<string, unknown> = {
        projectId,
        kind: 'subscribed',
        at: new Date().toISOString(),
      };
      subscriber.next({ data: welcome });
      // Heartbeat every 30s so intermediate proxies don't time out.
      const heartbeat = setInterval(
        () => {
          const beat: Record<string, unknown> = {
            kind: 'heartbeat',
            at: new Date().toISOString(),
          };
          subscriber.next({ data: beat });
        },
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
  @Public()
  @UseGuards(ProjectAccessGuard)
  @HttpCode(202)
  @ApiOperation({
    summary: 'Request early sync of bound sessions for a project',
  })
  @ApiParam({ name: 'projectId', type: String })
  @ApiQuery({ name: 'token', type: String, required: true })
  invalidate(
    @Param('projectId') projectId: string,
  ): { accepted: number } {
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
