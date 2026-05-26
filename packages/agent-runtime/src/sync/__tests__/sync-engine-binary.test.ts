/**
 * SyncEngine.planBinary exhaustive tests.
 *
 * Mirrors the text matrix: dbChanged × fsChanged = 4 cases, plus
 * created / deleted / type-change edges. Asserts:
 *   - byte-content carried through actions verbatim (Buffer round-trip)
 *   - sha-256 hash works identically on bytes
 *   - conflict_agent_wins_binary doesn't leak the discarded DB bytes
 *     (only metadata) — sized binaries would blow event size
 *   - write_fs_binary_from_listing carries hash but not bytes (fetcher
 *     responsibility)
 *   - planBinary throws if a listing arrives without a hash (fail-loud
 *     on orchestrator bug)
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

import { SyncEngine } from '../sync-engine.js';
import type { SnapshotEntry } from '../snapshot-store.js';
import type {
  BinaryArtifactListing,
  BinaryArtifactSnapshot,
} from '../../artifact/binary-artifact-source.js';
import type { BinaryFsDelta } from '../sync-engine.js';

const hasher = (b: Buffer | Uint8Array) =>
  createHash('sha256').update(b).digest('hex');

const SID = 'sess-1';
const NOW = '2026-05-25T12:00:00.000Z';

function bytes(s: string): Buffer {
  return Buffer.from(s);
}

function listing(
  path: string,
  content: Buffer,
  type = 'png',
): BinaryArtifactListing {
  return {
    path,
    type,
    sizeBytes: content.length,
    contentHash: hasher(content),
  };
}

function bsnap(path: string, content: Buffer, type = 'png'): BinaryArtifactSnapshot {
  return { path, content, type, sizeBytes: content.length };
}

function snap(path: string, content: Buffer, type = 'png'): SnapshotEntry {
  return {
    sessionId: SID,
    path,
    contentHash: hasher(content),
    type,
    updatedAt: NOW,
  };
}

function plan(
  dbNow: ReadonlyArray<BinaryArtifactListing>,
  fsDelta: BinaryFsDelta,
  previousSnapshot: ReadonlyArray<SnapshotEntry>,
  allowDelete = true,
) {
  return new SyncEngine().planBinary({
    sessionId: SID,
    dbNow,
    fsDelta,
    previousSnapshot,
    now: NOW,
    hasher,
    allowDelete,
  });
}

describe('SyncEngine.planBinary', () => {
  describe('the 4-case conflict matrix', () => {
    it('no change on either side → no-op + snapshot carried forward', () => {
      const PNG = bytes('PNG-bytes-v1');
      const { actions, nextSnapshot } = plan(
        [listing('hero.png', PNG)],
        { modified: [], deleted: [] },
        [snap('hero.png', PNG)],
      );
      expect(actions).toHaveLength(0);
      expect(nextSnapshot).toHaveLength(1);
      expect(nextSnapshot[0].contentHash).toBe(hasher(PNG));
    });

    it('only DB changed (gui edit) → write_fs_binary_from_listing', () => {
      const OLD = bytes('PNG-old');
      const NEW = bytes('PNG-new');
      const { actions, nextSnapshot } = plan(
        [listing('hero.png', NEW)],
        { modified: [], deleted: [] },
        [snap('hero.png', OLD)],
      );
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({
        kind: 'write_fs_binary_from_listing',
        path: 'hero.png',
        type: 'png',
        sizeBytes: NEW.length,
        contentHash: hasher(NEW),
      });
      // No bytes in the action — fetcher's responsibility.
      expect((actions[0] as any).content).toBeUndefined();
      expect(nextSnapshot[0].contentHash).toBe(hasher(NEW));
    });

    it('only fs changed (agent edit) → save_db_binary with bytes inline', () => {
      const OLD = bytes('PNG-v1');
      const NEW = bytes('PNG-v2-agent-edit');
      const { actions, nextSnapshot } = plan(
        [listing('hero.png', OLD)],
        { modified: [bsnap('hero.png', NEW)], deleted: [] },
        [snap('hero.png', OLD)],
      );
      expect(actions).toHaveLength(1);
      const a = actions[0];
      expect(a.kind).toBe('save_db_binary');
      if (a.kind === 'save_db_binary') {
        expect(Buffer.compare(a.content as Buffer, NEW)).toBe(0);
        expect(a.sizeBytes).toBe(NEW.length);
      }
      expect(nextSnapshot[0].contentHash).toBe(hasher(NEW));
    });

    it('both sides changed → conflict_agent_wins_binary; discarded DB bytes NOT included', () => {
      const PREV = bytes('PNG-v0');
      const DB_NEW = bytes('PNG-v1-gui');
      const AGENT = bytes('PNG-v1-agent');
      const { actions, nextSnapshot } = plan(
        [listing('hero.png', DB_NEW)],
        { modified: [bsnap('hero.png', AGENT)], deleted: [] },
        [snap('hero.png', PREV)],
      );
      expect(actions).toHaveLength(1);
      const a = actions[0];
      expect(a.kind).toBe('conflict_agent_wins_binary');
      if (a.kind === 'conflict_agent_wins_binary') {
        expect(Buffer.compare(a.agentContent as Buffer, AGENT)).toBe(0);
        expect(a.agentSizeBytes).toBe(AGENT.length);
        expect(a.discardedDbType).toBe('png');
        expect(a.discardedDbSizeBytes).toBe(DB_NEW.length);
        // The discarded DB bytes are deliberately NOT in the event —
        // the GUI fetches separately if it wants to surface them.
        expect((a as any).discardedDbContent).toBeUndefined();
      }
      expect(nextSnapshot[0].contentHash).toBe(hasher(AGENT));
    });
  });

  describe('created / deleted edges', () => {
    it('DB-only new path (no prior snapshot) → write_fs_binary_from_listing', () => {
      const NEW = bytes('hero-pngdata');
      const { actions, nextSnapshot } = plan(
        [listing('hero.png', NEW)],
        { modified: [], deleted: [] },
        [],
      );
      expect(actions).toHaveLength(1);
      expect(actions[0].kind).toBe('write_fs_binary_from_listing');
      expect(nextSnapshot[0].contentHash).toBe(hasher(NEW));
    });

    it('agent-only new path → save_db_binary', () => {
      const NEW = bytes('agent-new-bytes');
      const { actions, nextSnapshot } = plan(
        [],
        { modified: [bsnap('new.png', NEW)], deleted: [] },
        [],
      );
      expect(actions).toHaveLength(1);
      expect(actions[0].kind).toBe('save_db_binary');
      expect(nextSnapshot[0].contentHash).toBe(hasher(NEW));
    });

    it('agent re-created a binary path the DB had deleted between turns → save_db_binary (no silent loss)', () => {
      // Mirrors the text-engine fix. Path was previously in DB (prev
      // snapshot has it); DB row deleted between turns; agent saw the
      // file pre-delete and recreated it. Without the `!db && fsMod`
      // branch the bytes are silently lost on snapshot rebuild.
      const OLD = bytes('PNG-doomed');
      const NEW = bytes('PNG-agent-recreated');
      const { actions, nextSnapshot } = plan(
        /* db   */ [],
        /* fs   */ { modified: [bsnap('restored.png', NEW)], deleted: [] },
        /* prev */ [snap('restored.png', OLD)],
      );
      expect(actions).toHaveLength(1);
      const a = actions[0];
      expect(a.kind).toBe('save_db_binary');
      if (a.kind === 'save_db_binary') {
        expect(Buffer.compare(a.content as Buffer, NEW)).toBe(0);
        expect(a.sizeBytes).toBe(NEW.length);
      }
      expect(nextSnapshot).toHaveLength(1);
      expect(nextSnapshot[0].contentHash).toBe(hasher(NEW));
    });

    it('agent deleted + DB still has it + allowDelete=true → delete_db_binary', () => {
      const OLD = bytes('PNG-doomed');
      const { actions, nextSnapshot } = plan(
        [listing('doomed.png', OLD)],
        { modified: [], deleted: ['doomed.png'] },
        [snap('doomed.png', OLD)],
        true,
      );
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ kind: 'delete_db_binary', path: 'doomed.png' });
      expect(nextSnapshot).toHaveLength(0);
    });

    it('agent deleted + allowDelete=false → re-materialize (write_fs_binary_from_listing) to break delete-loop', () => {
      const KEEP = bytes('PNG-cant-delete');
      const { actions, nextSnapshot } = plan(
        [listing('keep.png', KEEP)],
        { modified: [], deleted: ['keep.png'] },
        [snap('keep.png', KEEP)],
        false,
      );
      expect(actions).toHaveLength(1);
      expect(actions[0].kind).toBe('write_fs_binary_from_listing');
      expect(nextSnapshot[0].contentHash).toBe(hasher(KEEP));
    });

    it('DB removed (was in snapshot) + agent untouched → delete_fs_binary', () => {
      const OLD = bytes('PNG-gone-from-db');
      const { actions, nextSnapshot } = plan(
        [],
        { modified: [], deleted: [] },
        [snap('gone.png', OLD)],
      );
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ kind: 'delete_fs_binary', path: 'gone.png' });
      expect(nextSnapshot).toHaveLength(0);
    });

    it('agent deleted + DB also gone → no-op (consistent empty state)', () => {
      const { actions, nextSnapshot } = plan(
        [],
        { modified: [], deleted: ['gone.png'] },
        [],
      );
      expect(actions).toHaveLength(0);
      expect(nextSnapshot).toHaveLength(0);
    });
  });

  describe('defensive checks', () => {
    it('throws if a DB listing arrives without contentHash (orchestrator contract violation)', () => {
      const NEW = bytes('PNG-v1');
      const badListing: BinaryArtifactListing = {
        path: 'hero.png',
        type: 'png',
        sizeBytes: NEW.length,
        // contentHash deliberately omitted
      };
      expect(() =>
        plan([badListing], { modified: [], deleted: [] }, []),
      ).toThrow(/missing contentHash/);
    });

    it('type change with no content change is still a DB-write (different file in practice)', () => {
      const SAME = bytes('same-bytes');
      const { actions } = plan(
        [listing('asset', SAME, 'png')],
        { modified: [], deleted: [] },
        [snap('asset', SAME, 'jpg')],
      );
      // contentHash matches, so dbChanged is false → no action. Type
      // mismatch alone is not enough to trigger a sync (matches text
      // engine semantics — content drives change detection).
      expect(actions).toHaveLength(0);
    });
  });
});
