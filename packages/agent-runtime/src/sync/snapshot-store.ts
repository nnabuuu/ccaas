/**
 * `SnapshotStore` — per-session memory of "what the syncer last
 * believed the artifact state was". Used by the SyncEngine to detect
 * which direction changed on which path.
 *
 * Key: `(sessionId, path)`. Value: content hash + last-seen content
 * type. The store doesn't need full content — only a hash is required
 * to answer "did DB content change since I last looked?"
 *
 * Backend ships a TypeORM-backed adapter (`SessionArtifactSnapshot`
 * entity) so snapshots survive process restart. Runtime ships the
 * in-memory adapter below for tests + small deployments.
 */

export interface SnapshotEntry {
  readonly sessionId: string;
  readonly path: string;
  /** Content hash (sha-256 hex by convention; opaque to consumers). */
  readonly contentHash: string;
  readonly type: string;
  readonly updatedAt: string;
}

export interface SnapshotStore {
  /** Read all entries for a session. Used to compute diffs at sync time. */
  list(sessionId: string): Promise<ReadonlyArray<SnapshotEntry>>;

  /** Upsert one entry. */
  put(entry: SnapshotEntry): Promise<void>;

  /** Remove one entry by `(sessionId, path)`. */
  remove(sessionId: string, path: string): Promise<void>;

  /** Drop every entry for a session (called on session close). */
  clear(sessionId: string): Promise<void>;
}

/** Simple in-memory impl. Backend overrides with TypeORM-backed version. */
export class InMemorySnapshotStore implements SnapshotStore {
  // Map<sessionId, Map<path, SnapshotEntry>>
  private readonly byKey = new Map<string, Map<string, SnapshotEntry>>();

  async list(sessionId: string): Promise<ReadonlyArray<SnapshotEntry>> {
    const inner = this.byKey.get(sessionId);
    return inner ? Array.from(inner.values()) : [];
  }

  async put(entry: SnapshotEntry): Promise<void> {
    let inner = this.byKey.get(entry.sessionId);
    if (!inner) {
      inner = new Map();
      this.byKey.set(entry.sessionId, inner);
    }
    inner.set(entry.path, entry);
  }

  async remove(sessionId: string, path: string): Promise<void> {
    this.byKey.get(sessionId)?.delete(path);
  }

  async clear(sessionId: string): Promise<void> {
    this.byKey.delete(sessionId);
  }
}
