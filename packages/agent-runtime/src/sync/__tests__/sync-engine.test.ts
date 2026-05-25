/**
 * SyncEngine.plan exhaustive tests.
 *
 * Coverage matrix per path: dbChanged × fsChanged = 4 cases, plus
 * created/deleted edge cases, plus type-change handling.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

import { SyncEngine } from '../sync-engine.js';
import type { ArtifactSnapshot } from '../../artifact/project-artifact-source.js';
import type { SnapshotEntry } from '../snapshot-store.js';
import type { FsDelta } from '../sync-engine.js';

const hasher = (s: string) => createHash('sha256').update(s).digest('hex');

const SID = 'sess-1';
const NOW = '2026-05-25T12:00:00.000Z';

function snap(path: string, content: string, type = 'md'): SnapshotEntry {
  return { sessionId: SID, path, contentHash: hasher(content), type, updatedAt: NOW };
}

function artifact(path: string, content: string, type = 'md'): ArtifactSnapshot {
  return { path, content, type };
}

function plan(
  dbNow: ReadonlyArray<ArtifactSnapshot>,
  fsDelta: FsDelta,
  previousSnapshot: ReadonlyArray<SnapshotEntry>,
  opts: { allowDelete?: boolean } = {},
) {
  return new SyncEngine().plan({
    sessionId: SID,
    dbNow,
    fsDelta,
    previousSnapshot,
    now: NOW,
    hasher,
    ...(opts.allowDelete !== undefined && { allowDelete: opts.allowDelete }),
  });
}

describe('SyncEngine.plan — 4-case conflict matrix', () => {
  it('no-op: nothing changed on either side', () => {
    const db = [artifact('lesson.md', 'v1')];
    const result = plan(db, { modified: [], deleted: [] }, [snap('lesson.md', 'v1')]);
    expect(result.actions).toEqual([]);
    expect(result.nextSnapshot).toHaveLength(1);
    expect(result.nextSnapshot[0].path).toBe('lesson.md');
  });

  it('DB-only change → write_fs action', () => {
    const db = [artifact('lesson.md', 'v2')];
    const result = plan(db, { modified: [], deleted: [] }, [snap('lesson.md', 'v1')]);
    expect(result.actions).toEqual([
      { kind: 'write_fs', path: 'lesson.md', content: 'v2', type: 'md' },
    ]);
    expect(result.nextSnapshot[0].contentHash).toBe(hasher('v2'));
  });

  it('fs-only change → save_db action', () => {
    const db = [artifact('lesson.md', 'v1')];
    const fsDelta: FsDelta = {
      modified: [{ path: 'lesson.md', content: 'agent-edit', type: 'md' }],
      deleted: [],
    };
    const result = plan(db, fsDelta, [snap('lesson.md', 'v1')]);
    expect(result.actions).toEqual([
      { kind: 'save_db', path: 'lesson.md', content: 'agent-edit', type: 'md' },
    ]);
    expect(result.nextSnapshot[0].contentHash).toBe(hasher('agent-edit'));
  });

  it('both changed → conflict_agent_wins + discarded DB version preserved', () => {
    const db = [artifact('lesson.md', 'gui-edit')];
    const fsDelta: FsDelta = {
      modified: [{ path: 'lesson.md', content: 'agent-edit', type: 'md' }],
      deleted: [],
    };
    const result = plan(db, fsDelta, [snap('lesson.md', 'v1')]);
    expect(result.actions).toHaveLength(1);
    const action = result.actions[0];
    expect(action.kind).toBe('conflict_agent_wins');
    if (action.kind === 'conflict_agent_wins') {
      expect(action.agentContent).toBe('agent-edit');
      expect(action.discardedDbContent).toBe('gui-edit');
    }
    expect(result.nextSnapshot[0].contentHash).toBe(hasher('agent-edit'));
  });
});

describe('SyncEngine.plan — create/delete edge cases', () => {
  it('DB created a new artifact (no previous snapshot) → write_fs', () => {
    const db = [artifact('new.md', 'hello')];
    const result = plan(db, { modified: [], deleted: [] }, []);
    expect(result.actions).toEqual([
      { kind: 'write_fs', path: 'new.md', content: 'hello', type: 'md' },
    ]);
    expect(result.nextSnapshot).toHaveLength(1);
  });

  it('DB deleted an artifact → delete_fs', () => {
    const result = plan([], { modified: [], deleted: [] }, [snap('gone.md', 'old')]);
    expect(result.actions).toEqual([{ kind: 'delete_fs', path: 'gone.md' }]);
    expect(result.nextSnapshot).toHaveLength(0);
  });

  it('Agent deleted an artifact → delete_db (even if DB still has it unchanged)', () => {
    const db = [artifact('lesson.md', 'v1')];
    const fsDelta: FsDelta = { modified: [], deleted: ['lesson.md'] };
    const result = plan(db, fsDelta, [snap('lesson.md', 'v1')]);
    expect(result.actions).toEqual([{ kind: 'delete_db', path: 'lesson.md' }]);
    expect(result.nextSnapshot).toHaveLength(0);
  });

  it('Agent created a new file (DB has no row yet) → save_db', () => {
    const fsDelta: FsDelta = {
      modified: [{ path: 'notes.md', content: 'agent jot', type: 'md' }],
      deleted: [],
    };
    const result = plan([], fsDelta, []);
    expect(result.actions).toEqual([
      { kind: 'save_db', path: 'notes.md', content: 'agent jot', type: 'md' },
    ]);
  });
});

describe('SyncEngine.plan — multi-path scenarios', () => {
  it('handles a mix of all 4 cases in a single plan', () => {
    const db = [
      artifact('a-noop.md', 'same'),
      artifact('b-db-only.md', 'gui-new'),
      artifact('c-conflict.md', 'gui-edit'),
      // d-fs-only: not in db
    ];
    const fsDelta: FsDelta = {
      modified: [
        { path: 'c-conflict.md', content: 'agent-edit', type: 'md' },
        { path: 'd-fs-only.md', content: 'agent-new', type: 'md' },
      ],
      deleted: [],
    };
    const prev = [
      snap('a-noop.md', 'same'),
      snap('b-db-only.md', 'gui-old'),
      snap('c-conflict.md', 'orig'),
    ];
    const result = plan(db, fsDelta, prev);

    const kinds = result.actions.map((a) => a.kind).sort();
    expect(kinds).toEqual(['conflict_agent_wins', 'save_db', 'write_fs']);

    // 4 surviving paths post-sync (a, b, c-with-agent-content, d)
    expect(result.nextSnapshot).toHaveLength(4);
  });

  it('type change carried in nextSnapshot', () => {
    const db = [artifact('plan.md', 'md-content', 'md')];
    const fsDelta: FsDelta = {
      modified: [{ path: 'plan.md', content: '{}', type: 'json' }],
      deleted: [],
    };
    const result = plan(db, fsDelta, [snap('plan.md', 'orig', 'md')]);
    // fs-only change wins; type updates to whatever the agent wrote
    expect(result.actions[0].kind).toBe('conflict_agent_wins');
    expect(result.nextSnapshot[0].type).toBe('json');
  });
});

describe('SyncEngine.plan — allowDelete option', () => {
  it('allowDelete=true (default): agent delete + DB has row → delete_db', () => {
    const db = [artifact('lesson.md', 'v1')];
    const fsDelta: FsDelta = { modified: [], deleted: ['lesson.md'] };
    const result = plan(db, fsDelta, [snap('lesson.md', 'v1')]);
    expect(result.actions).toEqual([{ kind: 'delete_db', path: 'lesson.md' }]);
    expect(result.nextSnapshot).toHaveLength(0);
  });

  it('allowDelete=false + agent delete + DB has row → write_fs (restore from DB), no delete_db', () => {
    const db = [artifact('lesson.md', 'v1')];
    const fsDelta: FsDelta = { modified: [], deleted: ['lesson.md'] };
    const result = plan(db, fsDelta, [snap('lesson.md', 'v1')], { allowDelete: false });
    expect(result.actions).toEqual([
      { kind: 'write_fs', path: 'lesson.md', content: 'v1', type: 'md' },
    ]);
    // Snapshot reflects the restored state — so next sync sees no change,
    // breaking the loop the old code would have created.
    expect(result.nextSnapshot).toHaveLength(1);
    expect(result.nextSnapshot[0].contentHash).toBe(hasher('v1'));
  });

  it('allowDelete=false + agent delete + DB does NOT have row → no-op', () => {
    const fsDelta: FsDelta = { modified: [], deleted: ['ghost.md'] };
    const result = plan([], fsDelta, []);
    expect(result.actions).toEqual([]);
    expect(result.nextSnapshot).toHaveLength(0);
  });
});
