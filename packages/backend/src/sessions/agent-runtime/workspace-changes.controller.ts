/**
 * Workspace-scoped sync REST endpoints — the GUI's window into the
 * agent-runtime sync layer.
 *
 *   GET   /workspaces/:identity/changes?token=K     (SSE, canonical)
 *   POST  /workspaces/:identity/invalidate?token=K  (canonical)
 *
 *   GET   /projects/:identity/changes?token=K       (SSE, deprecated alias)
 *   POST  /projects/:identity/invalidate?token=K    (deprecated alias)
 *
 * Both URL surfaces hit the same handlers — the alias paths are kept
 * for one release while solutions migrate. Each handler accepts an
 * array of paths on its route decorator (NestJS pattern); the path
 * the request actually came in on is irrelevant to the handler.
 *
 * ccaas does not set a global API prefix; sessions endpoints use
 * `@Controller('api/v1/sessions')` but these agent-runtime routes
 * deliberately sit at the root namespace. Solutions wiring SSE clients
 * (e.g. the creator's `getChangesStreamUrl`) target the bare path.
 *
 * The SSE stream relays `ChangeEvent`s from the in-process
 * `InMemoryChangeStream`. The invalidate endpoint is optional sugar
 * for solutions that want lower-latency GUI→agent updates than the
 * default "wait for the next agent turn boundary" cadence.
 *
 * **Auth (Phase 2b-2)**: both endpoints are gated by `WorkspaceAccessGuard`
 * which validates `?token=<apiKey>` and checks the token's tenant
 * matches the workspace's owning tenant (via the resolver behind
 * `PROJECT_TENANT_RESOLVER`). The guard runs in `canActivate` BEFORE
 * the handler — necessary for SSE, where the @Sse handler would
 * otherwise commit HTTP 200 before an in-handler auth check could
 * reject. See `workspace-access.guard.ts` for why this can't be done
 * inside the Observable.
 *
 * Reject paths (handled by the Guard, surfaced as proper HTTP statuses):
 *   401: missing/invalid/expired token
 *   403: token's tenant doesn't match the workspace's tenant, OR
 *        no resolver registered (default denies)
 *
 * Query-param tokens leak to access logs. Acceptable for single-tenant
 * dev / prod-with-trusted-network. For true multi-tenant prod, a
 * short-lived exchange token (`POST /sessions/exchange`) is a Phase 3
 * hardening — not in scope here.
 *
 * β-3 of the α+β refactor (2026-05-26) renamed the controller class
 * + URL surface from `projects/:projectId` to `workspaces/:identity`.
 * `/projects/:identity/*` stays as an alias path on the same handlers
 * so legacy callers (live-lesson's pre-β-3 proxy, manual ops scripts,
 * the e2e helper) keep working without code changes.
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
import { WorkspaceAccessGuard } from './workspace-access.guard';

@ApiTags('agent-runtime')
@Controller()
export class WorkspaceChangesController {
  constructor(
    @Inject(CHANGE_STREAM) private readonly changes: ChangeStream,
    private readonly sessions: SessionService,
    private readonly syncer: SessionAssetSyncer,
  ) {}

  /**
   * Live SSE feed of `ChangeEvent`s for the workspace. Closes on client
   * disconnect (handled automatically by NestJS's SSE Observable
   * teardown).
   *
   * `@Public()` skips the global ApiKey decorator-based auth (which is
   * header-based and wouldn't fit EventSource anyway); `WorkspaceAccessGuard`
   * does the query-param token check + tenant match instead.
   *
   * Path array: handles both the canonical `workspaces/:identity/changes`
   * and the deprecated alias `projects/:identity/changes`.
   */
  @Get(['workspaces/:identity/changes', 'projects/:identity/changes'])
  @Public()
  @UseGuards(WorkspaceAccessGuard)
  @ApiOperation({
    summary: 'Live SSE feed of artifact change events for a workspace',
  })
  @ApiParam({ name: 'identity', type: String })
  @ApiQuery({ name: 'token', type: String, required: true })
  // @Sse() with no argument: Nest infers the SSE path from @Get above.
  // Don't pass `'changes'` here — that ends up overwriting PATH_METADATA
  // (both decorators write the same key) and the route only happens to
  // resolve correctly because of TS decorator evaluation order. Brittle.
  @Sse()
  changes$(@Param('identity') identity: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const unsubscribe = this.changes.subscribe(identity, (ev: ChangeEvent) => {
        subscriber.next({ data: ev });
      });
      // Initial keep-alive welcome event so the GUI knows the subscription
      // is live even before the first real change. Consumers today
      // (useProjectChanges) only key off `kind === 'subscribed'` to flip
      // an `isConnected` flag — the per-event `identity` field is
      // reserved for future per-event consumers but inert today.
      const welcome: Record<string, unknown> = {
        identity,
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
   * Request an early sync flush for any sessions currently attached to
   * `identity`. Useful when the GUI just made a DB write and wants
   * the agent to see it before the next turn boundary.
   *
   * Fire-and-forget — returns immediately; the syncer runs
   * asynchronously per-session.
   *
   * Path array: handles both the canonical
   * `workspaces/:identity/invalidate` and the deprecated alias
   * `projects/:identity/invalidate`.
   */
  @Post(['workspaces/:identity/invalidate', 'projects/:identity/invalidate'])
  @Public()
  @UseGuards(WorkspaceAccessGuard)
  @HttpCode(202)
  @ApiOperation({
    summary: 'Request early sync of attached sessions for a workspace',
  })
  @ApiParam({ name: 'identity', type: String })
  @ApiQuery({ name: 'token', type: String, required: true })
  invalidate(
    @Param('identity') identity: string,
  ): { accepted: number } {
    const bound = this.sessions.findSessionsByWorkspaceSource(identity);
    // Fire-and-forget; errors are logged by the syncer itself.
    for (const sid of bound) {
      void this.syncer.sync(sid).catch(() => undefined);
    }
    return { accepted: bound.length };
  }
}
