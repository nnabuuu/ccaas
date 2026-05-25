/**
 * Sync sub-module — Phase 0 interface skeleton.
 *
 * `ChangeStream` carries artifact change events between actors —
 * agent ↔ GUI ↔ background workers. Today nothing implements it;
 * Phase 2 will ship an in-memory pub/sub first, then a
 * Redis-backed impl for multi-instance deployments.
 *
 * **v0 — these interfaces will likely change as Phase 2 impls are
 * built. The conflict-resolution story specifically is unsolved.**
 *
 * Open design questions deferred to Phase 2:
 *   - Conflict markers when agent + GUI edit the same artifact concurrently
 *   - Per-artifact version vector vs single timestamp
 *   - Whether to broadcast EditOperations vs final artifact state
 */

export interface ChangeEvent {
  readonly projectId: string;
  /** Same path as the artifact's path. */
  readonly path: string;
  readonly source: 'agent' | 'gui' | 'system';
  readonly kind: 'created' | 'updated' | 'deleted';
  readonly at: string;
  /** Optional: who triggered this (user id, session id, etc.). */
  readonly actor?: string;
}

export type ChangeListener = (event: ChangeEvent) => void;

export interface ChangeStream {
  /** Subscribe to all events for a project. Returns an unsubscribe function. */
  subscribe(projectId: string, listener: ChangeListener): () => void;
  publish(event: ChangeEvent): void;
}
