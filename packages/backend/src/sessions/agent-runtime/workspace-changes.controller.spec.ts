/**
 * WorkspaceChangesController tests.
 *
 * The SSE endpoint is verified by exercising the Observable directly
 * (not via HTTP) — published events arrive at subscribers, unsubscribe
 * stops delivery.
 *
 * Invalidate is verified end-to-end with the syncer mocked: requests
 * for a known identity fan out to the matching attached sessions.
 *
 * **Auth is NOT tested here** — it's enforced by `WorkspaceAccessGuard`
 * which runs in `canActivate` before the handler. Guard behavior lives
 * in `workspace-access.guard.spec.ts`. Controller tests assume the
 * guard already let the request through.
 *
 * The controller registers each handler under TWO paths
 * (`workspaces/:identity/*` canonical + `projects/:identity/*`
 * deprecated alias). At the controller-method level there's only one
 * implementation — these tests call the handler directly, so they
 * cover both URL surfaces by construction. The HTTP-routing layer
 * (which actually maps both URLs to the same method) is NestJS's
 * concern, exercised at module-bootstrap time when the path-array
 * decorator is processed.
 */

import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

import { InMemoryChangeStream } from '@kedge-agentic/agent-runtime';

import { WorkspaceChangesController } from './workspace-changes.controller';
import { CHANGE_STREAM } from './tokens';
import { SessionService } from '../session.service';
import { SessionAssetSyncer } from './session-asset-syncer.service';
import { WorkspaceAccessGuard } from './workspace-access.guard';

describe('WorkspaceChangesController', () => {
  const IDENTITY = 'proj-1';
  let controller: WorkspaceChangesController;
  let changes: InMemoryChangeStream;
  let syncer: { sync: jest.Mock };
  let sessions: { findSessionsByWorkspaceSource: jest.Mock };

  beforeEach(async () => {
    changes = new InMemoryChangeStream();
    syncer = { sync: jest.fn().mockResolvedValue(undefined) };
    sessions = { findSessionsByWorkspaceSource: jest.fn().mockReturnValue([]) };

    const moduleRef = await Test.createTestingModule({
      controllers: [WorkspaceChangesController],
      providers: [
        { provide: CHANGE_STREAM, useValue: changes },
        { provide: SessionService, useValue: sessions },
        { provide: SessionAssetSyncer, useValue: syncer },
      ],
    })
      // The controller declares `@UseGuards(WorkspaceAccessGuard)`. We
      // test the guard separately in `workspace-access.guard.spec.ts`;
      // here we stub it to always allow so we can focus on the handler
      // semantics.
      .overrideGuard(WorkspaceAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(WorkspaceChangesController);
  });

  describe('GET changes (SSE) — handles both /workspaces/:identity and /projects/:identity', () => {
    it('emits a "subscribed" welcome event immediately', async () => {
      const first = await firstValueFrom(controller.changes$(IDENTITY).pipe(take(1)));
      const data = first.data as { kind: string; identity: string };
      expect(data.kind).toBe('subscribed');
      // β-3: welcome carries `identity`. No `projectId` echoed —
      // useProjectChanges + the e2e helper only check `kind`. Real
      // ChangeEvents (from InMemoryChangeStream.publish) still
      // carry `projectId` because they originate elsewhere.
      expect(data.identity).toBe(IDENTITY);
    });

    it('relays published ChangeEvents to the subscriber', async () => {
      const collected = firstValueFrom(
        controller.changes$(IDENTITY).pipe(take(2), toArray()),
      );
      // Allow the welcome event to land, then publish a real event.
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      changes.publish({
        projectId: IDENTITY,
        path: 'lesson.md',
        source: 'agent',
        kind: 'updated',
        at: '2026-05-25T12:00:00.000Z',
      });
      const events = await collected;
      expect(events).toHaveLength(2);
      const last = events[1].data as { path: string; source: string };
      expect(last.path).toBe('lesson.md');
      expect(last.source).toBe('agent');
    });

    it('unsubscribes from the ChangeStream when the Observable is torn down', async () => {
      const subscription = controller.changes$(IDENTITY).subscribe(() => undefined);
      expect(changes.listenerCount(IDENTITY)).toBe(1);
      subscription.unsubscribe();
      expect(changes.listenerCount(IDENTITY)).toBe(0);
    });
  });

  describe('POST invalidate — handles both /workspaces/:identity and /projects/:identity', () => {
    it('returns 0 accepted when no sessions are attached', () => {
      const out = controller.invalidate(IDENTITY);
      expect(out).toEqual({ accepted: 0 });
      expect(syncer.sync).not.toHaveBeenCalled();
    });

    it('fans out sync() calls to every session attached to the workspace', async () => {
      sessions.findSessionsByWorkspaceSource.mockReturnValueOnce(['s1', 's2', 's3']);
      const out = controller.invalidate(IDENTITY);
      expect(out).toEqual({ accepted: 3 });
      // sync is called fire-and-forget; allow microtasks to run
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      expect(syncer.sync).toHaveBeenCalledTimes(3);
      expect(syncer.sync).toHaveBeenCalledWith('s1');
      expect(syncer.sync).toHaveBeenCalledWith('s2');
      expect(syncer.sync).toHaveBeenCalledWith('s3');
    });

    it('does not throw when sync() rejects (fire-and-forget)', () => {
      sessions.findSessionsByWorkspaceSource.mockReturnValueOnce(['s1']);
      syncer.sync.mockRejectedValueOnce(new Error('boom'));
      const out = controller.invalidate(IDENTITY);
      expect(out).toEqual({ accepted: 1 });
    });

    it('calls findSessionsByWorkspaceSource (canonical), not the deprecated alias', () => {
      // Pin the controller's dependency on the β-2 canonical method —
      // catches a regression where someone "fixes" the alias by
      // routing through findSessionsByProjectId again.
      controller.invalidate(IDENTITY);
      expect(sessions.findSessionsByWorkspaceSource).toHaveBeenCalledWith(IDENTITY);
    });
  });
});
