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

import type { ArtifactSnapshot } from '../artifact/workspace-artifact-source.js';
import type {
  BinaryArtifactListing,
  BinaryArtifactSnapshot,
} from '../artifact/binary-artifact-source.js';
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
  /**
   * Whether the orchestrator's `WorkspaceArtifactSource` supports
   * `deleteArtifact`. Defaults to `true`. When `false`, the engine
   * substitutes `write_fs` (restore-from-DB) for `delete_db` actions
   * so an agent-side delete is reverted on the next sync rather than
   * silently dropped, which would loop forever (`delete_db` planned,
   * warn-only no-op, plan again, ...). The agent reads the restored
   * file next turn — clear signal that delete is unsupported.
   */
  readonly allowDelete?: boolean;
}

export class SyncEngine {
  plan(input: SyncEngineInput): SyncPlan {
    const { sessionId, dbNow, fsDelta, previousSnapshot, now, hasher } = input;
    const allowDelete = input.allowDelete !== false;

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

      // Agent deleted. Three sub-cases:
      //   - !db: consistent (both empty); no-op.
      //   - db && allowDelete: propagate delete to DB; whether DB also
      //     changed is currently subsumed under agent-wins semantics
      //     (we do NOT emit a separate conflict event for delete-vs-edit;
      //     documented as a known gap, tracked for Phase 2).
      //   - db && !allowDelete: source can't delete. Restore the file
      //     in fs so the agent observes the un-delete next turn rather
      //     than looping silently. Snapshot reflects the restored state.
      if (fsDel) {
        if (!db) {
          // no nextSnapshot entry — gone from both sides
          continue;
        }
        if (allowDelete) {
          actions.push({ kind: 'delete_db', path });
          // no nextSnapshot entry — gone from both sides
          continue;
        }
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

      // Agent re-created a path the DB had deleted between turns
      // (db absent + prev present + fsMod present). Without this branch
      // the decision tree falls through to "nothing matched" and the
      // agent's bytes are silently lost on the next snapshot clear.
      // Treat as "agent wins" — persist the re-created file back to DB.
      // Same semantics as a normal save_db; differs only in motivation.
      if (!db && fsMod) {
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

  /**
   * Binary counterpart to `plan()`. Same conflict matrix, same
   * agent-wins semantics, same delete-loop guard — but content is
   * `Buffer | Uint8Array` (not `string`) and actions carry a `_binary`
   * suffix so the orchestrator can route them to the binary mount-point
   * (`artifacts-binary/`) and `fs.writeFile(absPath, buffer)` path.
   *
   * Lives on the same class so callers can share a single `SyncEngine`
   * instance; sharing nothing across the methods keeps both pure.
   *
   * Decision flow mirrors `plan()` line-for-line — see that method's
   * docstring for the matrix. Differences:
   *   - `dbNow` is a `BinaryArtifactListing[]` (metadata + content hash)
   *     because binary listing is metadata-only (full bytes are too
   *     expensive to fetch every turn). The listing's `contentHash`
   *     drives the dbChanged check directly; if absent the engine
   *     errors (the syncer fills it by fetching+hashing on demand
   *     before calling the engine).
   *   - `fsDelta.modified` carries `BinaryArtifactSnapshot` (with bytes)
   *     because the agent's writes are detected by reading the fs.
   */
  planBinary(input: BinarySyncEngineInput): BinarySyncPlan {
    const {
      sessionId,
      dbNow,
      fsDelta,
      previousSnapshot,
      now,
      hasher,
    } = input;
    const allowDelete = input.allowDelete !== false;

    const prevByPath = new Map<string, SnapshotEntry>(
      previousSnapshot.map((e) => [e.path, e]),
    );
    const dbByPath = new Map<string, BinaryArtifactListing>(
      dbNow.map((a) => [a.path, a]),
    );
    const fsModByPath = new Map<string, BinaryArtifactSnapshot>(
      fsDelta.modified.map((m) => [m.path, m]),
    );
    const fsDeletedSet = new Set(fsDelta.deleted);

    const actions: BinarySyncAction[] = [];
    const nextSnapshot: SnapshotEntry[] = [];
    const seen = new Set<string>();

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

      // The binary listing carries a precomputed contentHash. If it's
      // missing the syncer didn't do its job — fail loud rather than
      // misroute the conflict matrix.
      if (db && db.contentHash === undefined) {
        throw new Error(
          `binary listing for path "${path}" missing contentHash; ` +
          `the orchestrator must populate it (fetch+hash) before calling planBinary`,
        );
      }
      const dbHash = db ? db.contentHash! : null;
      const dbChanged = db ? !prev || prev.contentHash !== dbHash : prev !== undefined;
      const fsChanged = !!fsMod || fsDel;

      // Both sides changed — agent wins. Note that for binary we don't
      // carry `discardedDbContent` in the conflict event (could be huge);
      // the GUI must fetch it separately if it wants to surface the
      // overwritten version.
      if (db && fsMod && dbChanged) {
        actions.push({
          kind: 'conflict_agent_wins_binary',
          path,
          agentContent: fsMod.content,
          agentType: fsMod.type,
          agentSizeBytes: fsMod.sizeBytes,
          discardedDbType: db.type,
          discardedDbSizeBytes: db.sizeBytes,
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

      if (fsDel) {
        if (!db) continue;
        if (allowDelete) {
          actions.push({ kind: 'delete_db_binary', path });
          continue;
        }
        // No allowDelete: re-materialize from DB so the agent observes
        // un-delete next turn. We don't have bytes in the listing —
        // the orchestrator must fetch them when executing this action.
        actions.push({
          kind: 'write_fs_binary_from_listing',
          path,
          type: db.type,
          sizeBytes: db.sizeBytes,
          contentHash: dbHash!,
        });
        nextSnapshot.push({
          sessionId,
          path,
          contentHash: dbHash!,
          type: db.type,
          updatedAt: now,
        });
        continue;
      }

      // Only the agent wrote (DB didn't change). Save fs → DB.
      if (fsMod && !dbChanged) {
        actions.push({
          kind: 'save_db_binary',
          path,
          content: fsMod.content,
          type: fsMod.type,
          sizeBytes: fsMod.sizeBytes,
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

      // Agent re-created a binary path the DB had deleted between turns
      // (db absent + prev present + fsMod present). Without this branch
      // the agent's bytes are silently lost. Mirrors the text engine
      // fix above — "agent wins" persists the re-create back to DB.
      if (!db && fsMod) {
        actions.push({
          kind: 'save_db_binary',
          path,
          content: fsMod.content,
          type: fsMod.type,
          sizeBytes: fsMod.sizeBytes,
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
      // Orchestrator fetches bytes via `loadBinaryArtifact` when
      // executing this action.
      if (db && dbChanged) {
        actions.push({
          kind: 'write_fs_binary_from_listing',
          path,
          type: db.type,
          sizeBytes: db.sizeBytes,
          contentHash: dbHash!,
        });
        nextSnapshot.push({
          sessionId,
          path,
          contentHash: dbHash!,
          type: db.type,
          updatedAt: now,
        });
        continue;
      }

      if (!db && prev && !fsChanged) {
        actions.push({ kind: 'delete_fs_binary', path });
        continue;
      }

      if (db && prev && !dbChanged && !fsChanged) {
        nextSnapshot.push(prev);
        continue;
      }
    }

    return { actions, nextSnapshot };
  }
}

// ===========================================================================
// Binary types — kept near their consumer so the file is the single source
// for "what does the engine emit for binary artifacts". Mirrors the text
// types above with `Buffer | Uint8Array` content.
// ===========================================================================

/** Stable hash over binary bytes. Used to compare DB vs snapshot. */
export type BinaryContentHasher = (content: Buffer | Uint8Array) => string;

export interface BinaryFsDelta {
  /** Paths the agent created or modified, with current fs content. */
  readonly modified: ReadonlyArray<BinaryArtifactSnapshot>;
  /** Paths the agent deleted. */
  readonly deleted: ReadonlyArray<string>;
}

export type BinarySyncAction =
  /** Write the binary into the fs. Orchestrator fetches bytes from
   *  source via `loadBinaryArtifact(path)` because the listing only
   *  carried metadata. */
  | {
      readonly kind: 'write_fs_binary_from_listing';
      readonly path: string;
      readonly type: string;
      readonly sizeBytes: number;
      readonly contentHash: string;
    }
  /** Delete the fs file (DB no longer has this artifact). */
  | { readonly kind: 'delete_fs_binary'; readonly path: string }
  /** Persist the agent's fs bytes back to DB. */
  | {
      readonly kind: 'save_db_binary';
      readonly path: string;
      readonly content: Buffer | Uint8Array;
      readonly type: string;
      readonly sizeBytes: number;
    }
  /** Persist the agent's fs delete back to DB. */
  | { readonly kind: 'delete_db_binary'; readonly path: string }
  /** Both sides edited the same path; agent wins. The DB version is
   *  discarded; only its metadata (type, size) is captured in the
   *  event — fetching the discarded bytes is the GUI's job. */
  | {
      readonly kind: 'conflict_agent_wins_binary';
      readonly path: string;
      readonly agentContent: Buffer | Uint8Array;
      readonly agentType: string;
      readonly agentSizeBytes: number;
      readonly discardedDbType: string;
      readonly discardedDbSizeBytes: number;
    };

export interface BinarySyncPlan {
  readonly actions: ReadonlyArray<BinarySyncAction>;
  readonly nextSnapshot: ReadonlyArray<SnapshotEntry>;
}

export interface BinarySyncEngineInput {
  readonly sessionId: string;
  /** DB listing (metadata + precomputed hash). Hash MUST be populated
   *  by the orchestrator before calling the engine. */
  readonly dbNow: ReadonlyArray<BinaryArtifactListing>;
  /** Agent's fs changes for the binary mount-point. */
  readonly fsDelta: BinaryFsDelta;
  /** Previous snapshot, filtered to binary entries. (Shared store
   *  with text; the orchestrator filters by path-prefix or type.) */
  readonly previousSnapshot: ReadonlyArray<SnapshotEntry>;
  readonly now: string;
  readonly hasher: BinaryContentHasher;
  readonly allowDelete?: boolean;
}
