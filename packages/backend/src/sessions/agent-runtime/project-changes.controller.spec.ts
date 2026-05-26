/**
 * ProjectChangesController tests.
 *
 * The SSE endpoint is verified by exercising the Observable directly
 * (not via HTTP) — published events arrive at subscribers, unsubscribe
 * stops delivery.
 *
 * Invalidate is verified end-to-end with the syncer mocked: requests
 * for a known projectId fan out to the matching bound sessions.
 *
 * **Auth is NOT tested here** — it's enforced by `ProjectAccessGuard`
 * which runs in `canActivate` before the handler. Guard behavior lives
 * in `project-access.guard.spec.ts`. Controller tests assume the guard
 * already let the request through.
 */

import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

import { InMemoryChangeStream } from '@kedge-agentic/agent-runtime';

import { ProjectChangesController } from './project-changes.controller';
import { CHANGE_STREAM } from './tokens';
import { SessionService } from '../session.service';
import { SessionAssetSyncer } from './session-asset-syncer.service';
import { ProjectAccessGuard } from './project-access.guard';

describe('ProjectChangesController', () => {
  const PROJ = 'proj-1';
  let controller: ProjectChangesController;
  let changes: InMemoryChangeStream;
  let syncer: { sync: jest.Mock };
  let sessions: { findSessionsByProjectId: jest.Mock };

  beforeEach(async () => {
    changes = new InMemoryChangeStream();
    syncer = { sync: jest.fn().mockResolvedValue(undefined) };
    sessions = { findSessionsByProjectId: jest.fn().mockReturnValue([]) };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectChangesController],
      providers: [
        { provide: CHANGE_STREAM, useValue: changes },
        { provide: SessionService, useValue: sessions },
        { provide: SessionAssetSyncer, useValue: syncer },
      ],
    })
      // The controller declares `@UseGuards(ProjectAccessGuard)`. We test
      // the guard separately in `project-access.guard.spec.ts`; here we
      // stub it to always allow so we can focus on the handler semantics.
      .overrideGuard(ProjectAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(ProjectChangesController);
  });

  describe('GET /projects/:projectId/changes (SSE)', () => {
    it('emits a "subscribed" welcome event immediately', async () => {
      const first = await firstValueFrom(controller.changes$(PROJ).pipe(take(1)));
      expect((first.data as any).kind).toBe('subscribed');
      expect((first.data as any).projectId).toBe(PROJ);
    });

    it('relays published ChangeEvents to the subscriber', async () => {
      const collected = firstValueFrom(
        controller.changes$(PROJ).pipe(take(2), toArray()),
      );
      // Allow the welcome event to land, then publish a real event.
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      changes.publish({
        projectId: PROJ,
        path: 'lesson.md',
        source: 'agent',
        kind: 'updated',
        at: '2026-05-25T12:00:00.000Z',
      });
      const events = await collected;
      expect(events).toHaveLength(2);
      const last = events[1].data as any;
      expect(last.path).toBe('lesson.md');
      expect(last.source).toBe('agent');
    });

    it('unsubscribes from the ChangeStream when the Observable is torn down', async () => {
      const subscription = controller.changes$(PROJ).subscribe(() => undefined);
      expect(changes.listenerCount(PROJ)).toBe(1);
      subscription.unsubscribe();
      expect(changes.listenerCount(PROJ)).toBe(0);
    });
  });

  describe('POST /projects/:projectId/invalidate', () => {
    it('returns 0 accepted when no sessions are bound', () => {
      const out = controller.invalidate(PROJ);
      expect(out).toEqual({ accepted: 0 });
      expect(syncer.sync).not.toHaveBeenCalled();
    });

    it('fans out sync() calls to every session bound to the project', async () => {
      sessions.findSessionsByProjectId.mockReturnValueOnce(['s1', 's2', 's3']);
      const out = controller.invalidate(PROJ);
      expect(out).toEqual({ accepted: 3 });
      // sync is called fire-and-forget; allow microtasks to run
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      expect(syncer.sync).toHaveBeenCalledTimes(3);
      expect(syncer.sync).toHaveBeenCalledWith('s1');
      expect(syncer.sync).toHaveBeenCalledWith('s2');
      expect(syncer.sync).toHaveBeenCalledWith('s3');
    });

    it('does not throw when sync() rejects (fire-and-forget)', () => {
      sessions.findSessionsByProjectId.mockReturnValueOnce(['s1']);
      syncer.sync.mockRejectedValueOnce(new Error('boom'));
      const out = controller.invalidate(PROJ);
      expect(out).toEqual({ accepted: 1 });
    });
  });
});
