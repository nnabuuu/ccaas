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
  SNAPSHOT_STORE,
} from './agent-runtime.module';
import { SessionAssetSyncer, ARTIFACTS_DIR } from './session-asset-syncer.service';
import { SessionService } from '../session.service';
import { SessionMetadataService } from '../services/session-metadata.service';
import { TenantsService } from '../../tenants/tenants.service';
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
  tenantId?: string;
  diffEntries?: FsDiffEntry[];
}) {
  return {
    sessionId: opts.sessionId,
    workspaceDir: opts.workspaceDir,
    tenantId: opts.tenantId,
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
        makeMockSession({ sessionId: SID, workspaceDir, tenantId: TID })),
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
    const tenantsSvc = {
      findOne: jest.fn(async (id: string) => ({ id, slug: 'live-lesson' })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionAssetSyncer,
        { provide: PROJECT_ARTIFACT_SOURCE_REGISTRY, useValue: registry },
        { provide: SNAPSHOT_STORE, useValue: snapshots },
        { provide: CHANGE_STREAM, useValue: changes },
        { provide: SessionService, useValue: sessionSvc },
        { provide: SessionMetadataService, useValue: metaSvc },
        { provide: TenantsService, useValue: tenantsSvc },
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
      sessionId: SID, workspaceDir, tenantId: TID,
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
      sessionId: SID, workspaceDir, tenantId: TID,
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
      sessionId: SID, workspaceDir, tenantId: TID,
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
        { provide: SNAPSHOT_STORE, useValue: snapshots },
        { provide: CHANGE_STREAM, useValue: changes },
        { provide: SessionService, useValue: sessionSvc },
        { provide: SessionMetadataService, useValue: metaSvc },
        { provide: TenantsService, useValue: { findOne: jest.fn(async () => null) } },
      ],
    }).compile();
    const localSyncer = moduleRef.get(SessionAssetSyncer);

    sessionSvc.getSession.mockReturnValue(makeMockSession({
      sessionId: SID, workspaceDir, tenantId: TID,
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
      sessionId: SID, workspaceDir, tenantId: TID,
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

      await syncer.onSessionBound({ sessionId: SID, tenantId: TID, projectId: PROJ });

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
        sessionId: SID, tenantId: TID, projectId: PROJ,
      })).resolves.toBeUndefined();
    });
  });
});
