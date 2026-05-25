/**
 * `SyncEngine.plan()` — the **pure** conflict-resolution heart of the
 * pull-based sync. Given three inputs (current DB state, current fs
 * delta, last-known snapshot) it produces an action plan; an
 * orchestrator outside this module performs the I/O.
 *
 * Keeping this pure makes it cheap to exhaustively unit-test the 4
 * cases of the conflict matrix (see `plan` docstring) without
 * standing up a session or a database.
 *
 * The matrix per path P:
 *
 *   dbChanged ↓  | fsChanged →   no              yes
 *   no                            no-op            fs → DB (agent-only edit)
 *   yes                           DB → fs (gui)    BOTH → AGENT WINS + conflict event
 *
 * Where:
 *   - `dbChanged`  = source.loadArtifacts hash ≠ snapshot.contentHash
 *   - `fsChanged`  = path is in /fs/diff output (agent wrote it)
 *
 * Plus the "DB has a new path" (created) and "DB no longer has a
 * path" (deleted) edge cases.
 */

import type { ArtifactSnapshot } from '../artifact/project-artifact-source.js';
import type { SnapshotEntry } from './snapshot-store.js';

/** Stable hash of an artifact's content. Used to compare DB vs snapshot. */
export type ContentHasher = (content: string) => string;

export interface FsDelta {
  /** Paths the agent created or modified, with current fs content. */
  readonly modified: ReadonlyArray<{ path: string; content: string; type: string }>;
  /** Paths the agent deleted. */
  readonly deleted: ReadonlyArray<string>;
}

export type SyncAction =
  /** Write DB content into the fs (e.g. GUI made a change between turns). */
  | { readonly kind: 'write_fs'; readonly path: string; readonly content: string; readonly type: string }
  /** Delete the fs file (DB no longer has this artifact). */
  | { readonly kind: 'delete_fs'; readonly path: string }
  /** Persist the agent's fs content back to DB. */
  | { readonly kind: 'save_db'; readonly path: string; readonly content: string; readonly type: string }
  /** Persist the agent's fs delete back to DB. */
  | { readonly kind: 'delete_db'; readonly path: string }
  /** Both sides edited the same path; agent wins. Persist agent's version, but
   *  emit a conflict event so the GUI can surface the discarded DB version. */
  | {
      readonly kind: 'conflict_agent_wins';
      readonly path: string;
      readonly agentContent: string;
      readonly agentType: string;
      readonly discardedDbContent: string;
      readonly discardedDbType: string;
    };

export interface SyncPlan {
  readonly actions: ReadonlyArray<SyncAction>;
  /**
   * Post-sync snapshot — the syncer commits this to `SnapshotStore` after
   * applying actions successfully. Captures the post-state per path
   * (which side won, what the resulting content is).
   */
  readonly nextSnapshot: ReadonlyArray<SnapshotEntry>;
}

export interface SyncEngineInput {
  readonly sessionId: string;
  /** Canonical state from `source.loadArtifacts(projectId)`. */
  readonly dbNow: ReadonlyArray<ArtifactSnapshot>;
  /** Agent's fs changes since last sync (from `/fs/diff` filtered to `artifacts/`). */
  readonly fsDelta: FsDelta;
  /** Previous snapshot from `SnapshotStore.list(sessionId)`. */
  readonly previousSnapshot: ReadonlyArray<SnapshotEntry>;
  readonly now: string;
  readonly hasher: ContentHasher;
}

export class SyncEngine {
  plan(input: SyncEngineInput): SyncPlan {
    const { sessionId, dbNow, fsDelta, previousSnapshot, now, hasher } = input;

    const prevByPath = new Map<string, SnapshotEntry>(
      previousSnapshot.map((e) => [e.path, e]),
    );
    const dbByPath = new Map<string, ArtifactSnapshot>(
      dbNow.map((a) => [a.path, a]),
    );
    const fsModByPath = new Map<string, { path: string; content: string; type: string }>(
      fsDelta.modified.map((m) => [m.path, m]),
    );
    const fsDeletedSet = new Set(fsDelta.deleted);

    const actions: SyncAction[] = [];
    const nextSnapshot: SnapshotEntry[] = [];
    const seen = new Set<string>();

    // Walk every path that appears anywhere (DB or fs delta).
    for (const path of new Set<string>([
      ...dbByPath.keys(),
      ...fsModByPath.keys(),
      ...fsDeletedSet,
      ...prevByPath.keys(),
    ])) {
      if (seen.has(path)) continue;
      seen.add(path);

      const db = dbByPath.get(path);
      const fsMod = fsModByPath.get(path);
      const fsDel = fsDeletedSet.has(path);
      const prev = prevByPath.get(path);

      const dbHash = db ? hasher(db.content) : null;
      const dbChanged = db ? !prev || prev.contentHash !== dbHash : prev !== undefined;
      const fsChanged = !!fsMod || fsDel;

      // Decision tree:

      // Both sides changed — agent wins.
      if (db && fsMod && dbChanged) {
        actions.push({
          kind: 'conflict_agent_wins',
          path,
          agentContent: fsMod.content,
          agentType: fsMod.type,
          discardedDbContent: db.content,
          discardedDbType: db.type,
        });
        nextSnapshot.push({
          sessionId,
          path,
          contentHash: hasher(fsMod.content),
          type: fsMod.type,
          updatedAt: now,
        });
        continue;
      }

      // Agent deleted; DB still has it but unchanged → propagate delete to DB.
      // If DB also changed, we treat agent-delete as winning (agent intent
      // is explicit destruction).
      if (fsDel) {
        actions.push({ kind: 'delete_db', path });
        // no nextSnapshot entry — gone from both sides
        continue;
      }

      // Only the agent wrote (DB didn't change). Save fs → DB.
      if (fsMod && !dbChanged) {
        actions.push({
          kind: 'save_db',
          path,
          content: fsMod.content,
          type: fsMod.type,
        });
        nextSnapshot.push({
          sessionId,
          path,
          contentHash: hasher(fsMod.content),
          type: fsMod.type,
          updatedAt: now,
        });
        continue;
      }

      // Only DB changed (or DB created a new artifact). Write fs.
      if (db && dbChanged) {
        actions.push({
          kind: 'write_fs',
          path,
          content: db.content,
          type: db.type,
        });
        nextSnapshot.push({
          sessionId,
          path,
          contentHash: hasher(db.content),
          type: db.type,
          updatedAt: now,
        });
        continue;
      }

      // DB no longer has this path (and agent didn't touch it) → delete from fs.
      if (!db && prev && !fsChanged) {
        actions.push({ kind: 'delete_fs', path });
        // no nextSnapshot entry — gone from both sides
        continue;
      }

      // Nothing changed; carry the previous snapshot forward.
      if (db && prev && !dbChanged && !fsChanged) {
        nextSnapshot.push(prev);
        continue;
      }
    }

    return { actions, nextSnapshot };
  }
}
