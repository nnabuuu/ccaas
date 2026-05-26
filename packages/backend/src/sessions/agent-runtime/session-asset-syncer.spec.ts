/**
 * SessionAssetSyncer orchestration tests.
 *
 * Mocked deps; the SyncEngine itself is exercised directly (not mocked)
 * because it's pure and already extensively unit-tested in the
 * agent-runtime package. These tests focus on the orchestrator's
 * integration logic: hook gating, projectId lookup, fs↔DB action
 * dispatch, and ChangeStream publication.
 */

import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fs, existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  InMemoryChangeStream,
  InMemorySnapshotStore,
  type ProjectArtifactSource,
  type ArtifactSnapshot,
  type ChangeEvent,
} from '@kedge-agentic/agent-runtime';

import {
  CHANGE_STREAM,
  PROJECT_ARTIFACT_SOURCE_REGISTRY,
  PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY,
  SNAPSHOT_STORE,
} from './agent-runtime.module';
import { SessionAssetSyncer, ARTIFACTS_DIR, COALESCE_WINDOW_MS } from './session-asset-syncer.service';
import { SessionService } from '../session.service';
import { SessionMetadataService } from '../services/session-metadata.service';
import { SolutionsService } from '../../solutions/solutions.service';
import type { FsDiffEntry } from '../workspace/types';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

class FakeSource implements ProjectArtifactSource {
  rows: ArtifactSnapshot[] = [];
  saved: Array<{ projectId: string; artifact: ArtifactSnapshot }> = [];
  deleted: Array<{ projectId: string; path: string }> = [];
  /** When set, saveArtifact() returns this canonical path for the next call. */
  nextCanonicalPath: string | null = null;

  async loadArtifacts(): Promise<ReadonlyArray<ArtifactSnapshot>> {
    return this.rows;
  }
  async saveArtifact(projectId: string, artifact: ArtifactSnapshot) {
    this.saved.push({ projectId, artifact });
    if (this.nextCanonicalPath) {
      const canonical = this.nextCanonicalPath;
      this.nextCanonicalPath = null;
      return { canonicalPath: canonical };
    }
    return;
  }
  async deleteArtifact(projectId: string, p: string): Promise<void> {
    this.deleted.push({ projectId, path: p });
  }
}

function makeMockSession(opts: {
  sessionId: string;
  workspaceDir: string;
  solutionId?: string;
  diffEntries?: FsDiffEntry[];
}) {
  return {
    sessionId: opts.sessionId,
    workspaceDir: opts.workspaceDir,
    solutionId: opts.solutionId,
    workspaceHandle: {
      sessionId: opts.sessionId,
      path: opts.workspaceDir,
      diff: opts.diffEntries
        ? async () => opts.diffEntries!
        : undefined,
    },
  } as any;
}

async function makeWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syncer-test-'));
  await fs.mkdir(path.join(dir, ARTIFACTS_DIR), { recursive: true });
  return dir;
}

describe('SessionAssetSyncer', () => {
  const SID = 'sess-1';
  const PROJ = 'proj-1';
  const TID = 'tenant-1';

  let workspaceDir: string;
  let source: FakeSource;
  let changes: InMemoryChangeStream;
  let snapshots: InMemorySnapshotStore;
  let sessionSvc: { getSession: jest.Mock };
  let metaSvc: { get: jest.Mock };
  let syncer: SessionAssetSyncer;
  let sourceRegistry: { getForTenantSlug: jest.Mock };

  beforeEach(async () => {
    workspaceDir = await makeWorkspace();
    source = new FakeSource();
    changes = new InMemoryChangeStream();
    snapshots = new InMemorySnapshotStore();
    sessionSvc = {
      getSession: jest.fn(() =>
        makeMockSession({ sessionId: SID, workspaceDir, solutionId: TID })),
    };
    metaSvc = {
      get: jest.fn(async (sid: string, tid: string, key: string) => {
        if (sid !== SID || tid !== TID || key !== 'projectId') {
          throw new NotFoundException();
        }
        return { key, value: PROJ, updatedAt: '2026-05-25T00:00:00Z' };
      }),
    };

    const registry = {
      getForTenantSlug: jest.fn(() => source),
    };
    // Phase 2b-4: binary registry defaults to returning null for every
    // tenant (no binaryArtifactUrl configured) so the syncer's binary
    // half is a no-op for the existing text-focused tests. Tests that
    // exercise binary behavior override this in-line.
    const binaryRegistry = {
      getForTenantSlug: jest.fn(async () => null),
    };
    const tenantsSvc = {
      findOne: jest.fn(async (id: string) => ({ id, slug: 'live-lesson' })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionAssetSyncer,
        { provide: PROJECT_ARTIFACT_SOURCE_REGISTRY, useValue: registry },
        { provide: PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY, useValue: binaryRegistry },
        { provide: SNAPSHOT_STORE, useValue: snapshots },
        { provide: CHANGE_STREAM, useValue: changes },
        { provide: SessionService, useValue: sessionSvc },
        { provide: SessionMetadataService, useValue: metaSvc },
        { provide: SolutionsService, useValue: tenantsSvc },
      ],
    }).compile();
    syncer = moduleRef.get(SessionAssetSyncer);
    sourceRegistry = registry;
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it('no-op when session has no projectId binding', async () => {
    metaSvc.get.mockImplementationOnce(async () => {
      throw new NotFoundException();
    });
    source.rows = [{ path: 'lesson.md', content: 'v1', type: 'md' }];
    await syncer.sync(SID);
    expect(source.saved).toEqual([]);
    expect(existsSync(path.join(workspaceDir, ARTIFACTS_DIR, 'lesson.md'))).toBe(false);
  });

  it('DB-only change writes file into workspace + publishes gui ChangeEvent', async () => {
    source.rows = [{ path: 'lesson.md', content: 'gui-write', type: 'md' }];
    // no previous snapshot → treated as new
    const events: ChangeEvent[] = [];
    changes.subscribe(PROJ, (e) => events.push(e));

    await syncer.sync(SID);

    const written = await fs.readFile(
      path.join(workspaceDir, ARTIFACTS_DIR, 'lesson.md'), 'utf8',
    );
    expect(written).toBe('gui-write');
    expect(source.saved).toEqual([]);
    // change event flushed via microtask queue
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ projectId: PROJ, path: 'lesson.md', source: 'gui', kind: 'updated' });
  });

  it('fs-only change (agent wrote) propagates to DB via saveArtifact', async () => {
    const agentFile = path.join(workspaceDir, ARTIFACTS_DIR, 'notes.md');
    await fs.writeFile(agentFile, 'agent-jot');
    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
      diffEntries: [{ op: 'added', type: 'file', path: '/artifacts/notes.md' }],
    }));
    source.rows = []; // DB doesn't have it

    await syncer.sync(SID);

    expect(source.saved).toHaveLength(1);
    expect(source.saved[0]).toEqual({
      projectId: PROJ,
      artifact: { path: 'notes.md', content: 'agent-jot', type: 'md' },
    });
  });

  // ── walk-based fallback (workspace handle without native diff) ───────
  // These tests cover the LocalProvider case where `workspaceHandle.diff`
  // is undefined. Without the fallback, every sync would be a no-op
  // because there's no diff source → agent edits would never sync back
  // to the solution DB. The fallback walks artifactsDir and computes
  // the delta against the previous snapshot.

  it('walk fallback: agent-modified file propagates to DB when handle has no diff()', async () => {
    // Pre-existing snapshot reflects what was there before the agent ran.
    await snapshots.put({
      sessionId: SID, path: 'manifest.json',
      contentHash: sha256('{"title":"old"}'),
      type: 'json',
      updatedAt: '2026-05-25T00:00:00Z',
    });
    // DB also has the old content.
    source.rows = [{ path: 'manifest.json', content: '{"title":"old"}', type: 'json' }];
    // Agent edited the file in the workspace (newer content on disk).
    const agentFile = path.join(workspaceDir, ARTIFACTS_DIR, 'manifest.json');
    await fs.mkdir(path.dirname(agentFile), { recursive: true });
    await fs.writeFile(agentFile, '{"title":"agent-edited"}');
    // Crucially: no diffEntries → workspaceHandle.diff is undefined.
    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
    }));

    await syncer.sync(SID);

    expect(source.saved).toHaveLength(1);
    expect(source.saved[0]).toEqual({
      projectId: PROJ,
      artifact: { path: 'manifest.json', content: '{"title":"agent-edited"}', type: 'json' },
    });
  });

  it('walk fallback: agent-added file (not in snapshot) propagates to DB', async () => {
    // No snapshot, no DB rows.
    const agentFile = path.join(workspaceDir, ARTIFACTS_DIR, 'plan', 'lesson.md');
    await fs.mkdir(path.dirname(agentFile), { recursive: true });
    await fs.writeFile(agentFile, '# Agent-created plan');
    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
    }));

    await syncer.sync(SID);

    expect(source.saved).toHaveLength(1);
    expect(source.saved[0]).toEqual({
      projectId: PROJ,
      artifact: { path: 'plan/lesson.md', content: '# Agent-created plan', type: 'md' },
    });
  });

  it('walk fallback: agent-deleted file (in snapshot, missing on disk) propagates as delete', async () => {
    // Snapshot records a file the agent later removed.
    await snapshots.put({
      sessionId: SID, path: 'todo.md',
      contentHash: sha256('something'),
      type: 'md',
      updatedAt: '2026-05-25T00:00:00Z',
    });
    source.rows = [{ path: 'todo.md', content: 'something', type: 'md' }];
    // Workspace artifacts dir exists but todo.md is NOT in it.
    await fs.mkdir(path.join(workspaceDir, ARTIFACTS_DIR), { recursive: true });
    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
    }));

    await syncer.sync(SID);

    expect(source.deleted).toEqual([
      { projectId: PROJ, path: 'todo.md' },
    ]);
  });

  it('walk fallback: no diff and no changes → no-op (no saveArtifact)', async () => {
    // Snapshot + DB + FS all agree.
    const content = '{"k":"v"}';
    await snapshots.put({
      sessionId: SID, path: 'cfg.json',
      contentHash: sha256(content), type: 'json',
      updatedAt: '2026-05-25T00:00:00Z',
    });
    source.rows = [{ path: 'cfg.json', content, type: 'json' }];
    const f = path.join(workspaceDir, ARTIFACTS_DIR, 'cfg.json');
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, content);
    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
    }));

    await syncer.sync(SID);

    expect(source.saved).toEqual([]);
    expect(source.deleted).toEqual([]);
  });

  it('both sides changed → agent wins, DB receives agent content', async () => {
    // Pre-existing snapshot reflecting an initial state
    await snapshots.put({
      sessionId: SID, path: 'lesson.md',
      contentHash: sha256('v0'), type: 'md',
      updatedAt: '2026-05-25T00:00:00Z',
    });
    // DB now has GUI's edit
    source.rows = [{ path: 'lesson.md', content: 'gui-edit', type: 'md' }];
    // FS has the agent's edit
    await fs.writeFile(path.join(workspaceDir, ARTIFACTS_DIR, 'lesson.md'), 'agent-edit');
    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
      diffEntries: [{ op: 'modified', type: 'file', path: '/artifacts/lesson.md' }],
    }));

    const events: ChangeEvent[] = [];
    changes.subscribe(PROJ, (e) => events.push(e));

    await syncer.sync(SID);

    // Agent's version persisted to DB; fs untouched (already has agent content).
    expect(source.saved).toEqual([
      { projectId: PROJ, artifact: { path: 'lesson.md', content: 'agent-edit', type: 'md' } },
    ]);
    const fsContent = await fs.readFile(
      path.join(workspaceDir, ARTIFACTS_DIR, 'lesson.md'), 'utf8',
    );
    expect(fsContent).toBe('agent-edit');

    // Conflict event published
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe('conflict-agent-wins');
    expect(events[0].source).toBe('agent');
  });

  it('agent delete propagates to DB via deleteArtifact', async () => {
    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
      diffEntries: [{ op: 'removed', type: 'file', path: '/artifacts/lesson.md' }],
    }));
    source.rows = [{ path: 'lesson.md', content: 'v1', type: 'md' }];

    await syncer.sync(SID);

    expect(source.deleted).toEqual([{ projectId: PROJ, path: 'lesson.md' }]);
    expect(source.saved).toEqual([]);
  });

  it('agent delete restores file from DB when source lacks deleteArtifact', async () => {
    // Override the source to NOT implement deleteArtifact.
    const noDeleteSource: ProjectArtifactSource = {
      loadArtifacts: async () => [{ path: 'lesson.md', content: 'v1', type: 'md' }],
      saveArtifact: jest.fn(async () => undefined),
      // deleteArtifact intentionally omitted
    };

    const localRegistry = {
      getForTenantSlug: jest.fn(() => noDeleteSource),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionAssetSyncer,
        { provide: PROJECT_ARTIFACT_SOURCE_REGISTRY, useValue: localRegistry },
        // Phase 2b-4: binary registry not exercised here; null = skip.
        {
          provide: PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY,
          useValue: { getForTenantSlug: jest.fn(async () => null) },
        },
        { provide: SNAPSHOT_STORE, useValue: snapshots },
        { provide: CHANGE_STREAM, useValue: changes },
        { provide: SessionService, useValue: sessionSvc },
        { provide: SessionMetadataService, useValue: metaSvc },
        { provide: SolutionsService, useValue: { findOne: jest.fn(async () => null) } },
      ],
    }).compile();
    const localSyncer = moduleRef.get(SessionAssetSyncer);

    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
      diffEntries: [{ op: 'removed', type: 'file', path: '/artifacts/lesson.md' }],
    }));

    await localSyncer.sync(SID);

    // File should be restored on the agent's workspace, not deleted from DB.
    const restored = await fs.readFile(
      path.join(workspaceDir, ARTIFACTS_DIR, 'lesson.md'), 'utf8',
    );
    expect(restored).toBe('v1');
    expect(noDeleteSource.saveArtifact).not.toHaveBeenCalled();
  });

  it('snapshot uses canonical path when source returns one (Phase 1 M1)', async () => {
    // agent wrote `LESSON.MD`; solution normalizes server-side to `lesson.md`
    const agentFile = path.join(workspaceDir, ARTIFACTS_DIR, 'LESSON.MD');
    await fs.writeFile(agentFile, 'agent-version');
    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, solutionId: TID,
      diffEntries: [{ op: 'added', type: 'file', path: '/artifacts/LESSON.MD' }],
    }));
    source.rows = [];
    source.nextCanonicalPath = 'lesson.md';

    await syncer.sync(SID);

    expect(source.saved).toHaveLength(1);
    expect(source.saved[0].artifact.path).toBe('LESSON.MD');

    // Snapshot should record the canonical path, not the sent path —
    // otherwise next sync sees `lesson.md` in dbNow + `LESSON.MD` in
    // snapshot and plans a spurious delete_fs.
    const snap = await snapshots.list(SID);
    expect(snap).toHaveLength(1);
    expect(snap[0].path).toBe('lesson.md');
  });

  it('snapshot updated to reflect post-sync state', async () => {
    source.rows = [{ path: 'lesson.md', content: 'first-load', type: 'md' }];
    await syncer.sync(SID);

    const snap = await snapshots.list(SID);
    expect(snap).toHaveLength(1);
    expect(snap[0]).toMatchObject({
      sessionId: SID,
      path: 'lesson.md',
      contentHash: sha256('first-load'),
      type: 'md',
    });
  });

  it('no-op when registry returns null for the session tenant (unconfigured)', async () => {
    // Simulate a tenant with no per-tenant URL AND no default fallback.
    sourceRegistry.getForTenantSlug.mockReturnValueOnce(null);
    source.rows = [{ path: 'lesson.md', content: 'v1', type: 'md' }];

    await syncer.sync(SID);

    expect(source.saved).toEqual([]);
    expect(existsSync(path.join(workspaceDir, ARTIFACTS_DIR, 'lesson.md'))).toBe(false);
  });

  it('non-complete turn statuses are ignored by onTurnComplete', async () => {
    source.rows = [{ path: 'lesson.md', content: 'v1', type: 'md' }];
    await syncer.onTurnComplete({ sessionId: SID, status: 'cancelled', exitCode: null });
    expect(source.saved).toEqual([]);
    expect(existsSync(path.join(workspaceDir, ARTIFACTS_DIR, 'lesson.md'))).toBe(false);

    await syncer.onTurnComplete({ sessionId: SID, status: 'error', exitCode: 1 });
    expect(source.saved).toEqual([]);
  });

  it('thrown error inside sync is swallowed by onTurnComplete (does not propagate)', async () => {
    sessionSvc.getSession.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(syncer.onTurnComplete({ sessionId: SID, status: 'complete', exitCode: 0 }))
      .resolves.toBeUndefined();
  });

  describe('onSessionBound — bootstrap hook', () => {
    it('materializes initial artifacts from source.loadArtifacts into workspace', async () => {
      source.rows = [
        { path: 'lesson-plan.md', content: '# Hello', type: 'md' },
        { path: 'execution-plan.json', content: '{"v":1}', type: 'json' },
      ];

      await syncer.onSessionBound({
        sessionId: SID,
        solutionId: TID,
        projectId: PROJ,
        workspaceSource: { sourceIdentity: PROJ },
      });

      const plan = await fs.readFile(
        path.join(workspaceDir, ARTIFACTS_DIR, 'lesson-plan.md'), 'utf8',
      );
      const exec = await fs.readFile(
        path.join(workspaceDir, ARTIFACTS_DIR, 'execution-plan.json'), 'utf8',
      );
      expect(plan).toBe('# Hello');
      expect(exec).toBe('{"v":1}');

      const snap = await snapshots.list(SID);
      expect(snap).toHaveLength(2);
      expect(new Set(snap.map((e) => e.path))).toEqual(new Set([
        'lesson-plan.md',
        'execution-plan.json',
      ]));
    });

    it('swallows errors so bootstrap failure does not break session create', async () => {
      sessionSvc.getSession.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      await expect(syncer.onSessionBound({
        sessionId: SID,
        solutionId: TID,
        projectId: PROJ,
        workspaceSource: { sourceIdentity: PROJ },
      })).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Coalesce — dedup G4 dual-trigger so the second sync is a no-op wait
  // -----------------------------------------------------------------------

  describe('coalesce — back-to-back sync() calls within the window', () => {
    it('skips the second loadArtifacts when called twice within COALESCE_WINDOW_MS', async () => {
      // The G4 case: bindToProject fires session.bound → onSessionBound
      // kicks off sync; worker then awaits its own explicit sync. Both
      // observe the same DB state — the second pass would just load
      // + diff + plan 0 actions, wasting a round trip. With coalesce,
      // the second call awaits the in-flight one and returns.
      const loadSpy = jest.spyOn(source, 'loadArtifacts');
      source.rows = [{ path: 'a.md', content: 'v1', type: 'md' }];

      // Fire two syncs in parallel — no awaits between them. The 2nd
      // will reach the projectLocks check while the 1st is in flight,
      // registeredAt < 100ms ago → coalesce.
      await Promise.all([syncer.sync(SID), syncer.sync(SID)]);

      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('still chains a second sync that arrives AFTER the window (e.g. real later trigger)', async () => {
      jest.useFakeTimers();
      try {
        const loadSpy = jest.spyOn(source, 'loadArtifacts');
        source.rows = [{ path: 'a.md', content: 'v1', type: 'md' }];

        // First sync runs to completion; lock GC'd by the cleanup
        // in finally{}. (Even without GC, advancing time past the
        // coalesce window forces the next call to chain.)
        await syncer.sync(SID);
        expect(loadSpy).toHaveBeenCalledTimes(1);

        jest.setSystemTime(Date.now() + COALESCE_WINDOW_MS + 50);

        // A real later sync should NOT be coalesced — it has its
        // own intent (push agent edits, observe new DB state, etc).
        await syncer.sync(SID);
        expect(loadSpy).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('coalesced caller still surfaces correctness when the in-flight sync fires its ChangeEvents', async () => {
      // The coalesced call returns without doing its own pass, but
      // the in-flight sync IS doing the real work — its ChangeEvents
      // must still reach subscribers. This pins that contract.
      source.rows = [{ path: 'b.md', content: 'gui', type: 'md' }];
      const events: ChangeEvent[] = [];
      changes.subscribe(PROJ, (e) => events.push(e));

      await Promise.all([syncer.sync(SID), syncer.sync(SID)]);
      await new Promise((r) => queueMicrotask(() => r(undefined)));

      // Single in-flight sync emitted exactly one ChangeEvent for
      // the materialization. Coalesce didn't suppress the event.
      const updated = events.filter((e) => e.kind === 'updated');
      expect(updated).toHaveLength(1);
      expect(updated[0].path).toBe('b.md');
    });
  });

  // -----------------------------------------------------------------------
  // Phase 2b-4 — binary half
  // -----------------------------------------------------------------------

  describe('binary half', () => {
    const ARTIFACTS_BINARY_DIR = 'artifacts-binary';

    class FakeBinarySource {
      listings: Array<{
        path: string;
        type: string;
        sizeBytes: number;
        contentHash?: string;
      }> = [];
      saved: Array<{ projectId: string; artifact: any }> = [];
      deleted: Array<{ projectId: string; path: string }> = [];
      loaded: Array<{ projectId: string; path: string }> = [];

      async listBinaryArtifacts() {
        return this.listings;
      }
      async loadBinaryArtifact(projectId: string, p: string) {
        this.loaded.push({ projectId, path: p });
        const meta = this.listings.find((l) => l.path === p)!;
        // For tests we synthesize bytes deterministically from path.
        const content = Buffer.from(`bytes-of-${p}`);
        return {
          path: p,
          content,
          type: meta?.type ?? 'application/octet-stream',
          sizeBytes: content.length,
        };
      }
      async saveBinaryArtifact(projectId: string, artifact: any) {
        this.saved.push({ projectId, artifact });
      }
      async deleteBinaryArtifact(projectId: string, p: string) {
        this.deleted.push({ projectId, path: p });
      }
    }

    let binarySource: FakeBinarySource;
    let binaryRegistry: { getForTenantSlug: jest.Mock };
    let binarySyncer: SessionAssetSyncer;

    beforeEach(async () => {
      binarySource = new FakeBinarySource();
      binaryRegistry = {
        getForTenantSlug: jest.fn(async () => binarySource),
      };
      // Re-build the module wiring the binary registry up.
      const tenantsSvc = {
        findOne: jest.fn(async (id: string) => ({ id, slug: 'live-lesson' })),
      };
      const textRegistry = {
        getForTenantSlug: jest.fn(() => source),
      };
      const moduleRef = await Test.createTestingModule({
        providers: [
          SessionAssetSyncer,
          { provide: PROJECT_ARTIFACT_SOURCE_REGISTRY, useValue: textRegistry },
          { provide: PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY, useValue: binaryRegistry },
          { provide: SNAPSHOT_STORE, useValue: snapshots },
          { provide: CHANGE_STREAM, useValue: changes },
          { provide: SessionService, useValue: sessionSvc },
          { provide: SessionMetadataService, useValue: metaSvc },
          { provide: SolutionsService, useValue: tenantsSvc },
        ],
      }).compile();
      binarySyncer = moduleRef.get(SessionAssetSyncer);
    });

    it('materializes a DB binary into artifacts-binary/ on first sync', async () => {
      binarySource.listings = [
        {
          path: 'hero.png',
          type: 'png',
          sizeBytes: 'bytes-of-hero.png'.length,
          contentHash: sha256('bytes-of-hero.png'),
        },
      ];

      await binarySyncer.sync(SID);

      const written = await fs.readFile(
        path.join(workspaceDir, ARTIFACTS_BINARY_DIR, 'hero.png'),
      );
      expect(Buffer.compare(written, Buffer.from('bytes-of-hero.png'))).toBe(0);

      // Snapshot stores the binary path with the prefix re-applied.
      const snaps = await snapshots.list(SID);
      const binarySnap = snaps.find((s) => s.path === 'artifacts-binary/hero.png');
      expect(binarySnap).toBeDefined();
      expect(binarySnap!.contentHash).toBe(sha256('bytes-of-hero.png'));
    });

    it('emits a ChangeEvent (source=gui, actor=binary) for the materialization', async () => {
      const seen: ChangeEvent[] = [];
      changes.subscribe(PROJ, (ev) => seen.push(ev));
      binarySource.listings = [
        {
          path: 'audio.mp3',
          type: 'mp3',
          sizeBytes: 'bytes-of-audio.mp3'.length,
          contentHash: sha256('bytes-of-audio.mp3'),
        },
      ];

      await binarySyncer.sync(SID);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({
        projectId: PROJ,
        path: 'audio.mp3',
        source: 'gui',
        kind: 'updated',
        actor: 'binary',
      });
    });

    it('persists agent-side binary edits via saveBinaryArtifact', async () => {
      // Empty DB; agent created a new binary in artifacts-binary/.
      const newBytes = Buffer.from('agent-png-bytes');
      const artifactsBinaryDir = path.join(workspaceDir, ARTIFACTS_BINARY_DIR);
      await fs.mkdir(artifactsBinaryDir, { recursive: true });
      await fs.writeFile(path.join(artifactsBinaryDir, 'icon.png'), newBytes);

      // Sessionmock with diff() reporting the agent-added file.
      sessionSvc.getSession.mockReturnValue(
        makeMockSession({
          sessionId: SID,
          workspaceDir,
          solutionId: TID,
          diffEntries: [
            { type: 'file', op: 'added', path: '/artifacts-binary/icon.png' } as any,
          ],
        }),
      );

      await binarySyncer.sync(SID);

      expect(binarySource.saved).toHaveLength(1);
      expect(binarySource.saved[0].artifact.path).toBe('icon.png');
      expect(
        Buffer.compare(
          binarySource.saved[0].artifact.content as Buffer,
          newBytes,
        ),
      ).toBe(0);
      expect(binarySource.saved[0].artifact.sizeBytes).toBe(newBytes.length);
    });

    it('skips the binary half cleanly when no binarySource is registered', async () => {
      binaryRegistry.getForTenantSlug.mockResolvedValueOnce(null);
      // Should not throw, should not even create artifacts-binary/ dir.
      await binarySyncer.sync(SID);
      const exists = await fs
        .stat(path.join(workspaceDir, ARTIFACTS_BINARY_DIR))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('fetches+hashes listing entries that lack a precomputed contentHash', async () => {
      // No contentHash on the listing — syncer should call loadBinaryArtifact
      // to compute one before planBinary runs.
      binarySource.listings = [
        { path: 'no-hash.bin', type: 'bin', sizeBytes: 17 },
      ];
      await binarySyncer.sync(SID);
      expect(binarySource.loaded).toContainEqual({
        projectId: PROJ,
        path: 'no-hash.bin',
      });
      // And the materialization itself happens — second loadBinaryArtifact
      // for the write_fs_binary_from_listing action.
      const written = await fs.readFile(
        path.join(workspaceDir, ARTIFACTS_BINARY_DIR, 'no-hash.bin'),
      );
      expect(written.length).toBeGreaterThan(0);
    });
  });
});
