/**
 * `ProjectArtifactSource` — the **one** interface a solution implements
 * to enable bidirectional sync between its DB and the agent's
 * per-session workspace.
 *
 * Design rationale: the runtime is pull-based at turn boundaries — it
 * calls `loadArtifacts` to learn the current canonical state and
 * `saveArtifact` to persist agent-side edits. The solution can store
 * artifacts however it wants (TypeORM rows, multiple joined entities,
 * external API, raw SQL — the runtime doesn't care).
 *
 * The interface is intentionally tiny so solution authors don't have
 * to learn a new abstraction. Live-lesson's impl is ~30 lines wrapping
 * a single TypeORM repository.
 */

/**
 * One artifact as returned by a `ProjectArtifactSource`. Lean shape:
 * just enough for the syncer to write a file and detect change. No
 * `id` / `updatedAt` — `(projectId, path)` is the natural key, and
 * the snapshot store tracks change via content hash.
 *
 * Contrast with the editor-side `Artifact<TContent>` in
 * `./types.ts` — that one is richer (id, updatedAt, schemaId) because
 * editors operate on canonical store rows. `ArtifactSnapshot` is
 * the leaner shape exchanged across the source-loader port.
 */
export interface ArtifactSnapshot {
  /** Workspace-relative path, e.g. "lesson-plan.md" or "plans/q2.json". */
  readonly path: string;
  /** File content as a string. Binary support is deferred to Phase 2. */
  readonly content: string;
  /**
   * Discriminator the solution chooses (e.g. "md", "json", "yaml").
   * The runtime treats this opaquely; solutions can use it to dispatch
   * editors or to filter on read-back.
   */
  readonly type: string;
  /** Optional solution-defined metadata; opaque to the runtime. */
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * Optional return shape from `saveArtifact`. When the solution
 * normalizes / canonicalizes the path server-side (e.g.,
 * `posix.normalize`, case-fold, strip-leading-slash), it MUST surface
 * the persisted canonical path here so the runtime's snapshot store
 * records the actual key — otherwise the next `loadArtifacts` returns
 * the canonical path and the engine treats it as a new file, planning
 * a spurious `delete_fs` against the old sent-path entry. Phase 1
 * review M1.
 *
 * Solutions that do NOT normalize paths can return `void`; the
 * runtime treats the originally-sent path as canonical.
 */
export interface SaveArtifactResult {
  readonly canonicalPath?: string;
}

/**
 * The port solutions implement. Two required methods cover the full
 * bidirectional sync; `deleteArtifact` is opt-in.
 */
export interface ProjectArtifactSource {
  /**
   * Return the current canonical state of all artifacts for a project.
   * Called at:
   *   - session creation (initial materialize into the workspace)
   *   - every agent turn boundary (`agent_status: complete`)
   *   - explicit invalidate hints from the solution
   *
   * The runtime is fine with full reads every turn — projects are
   * expected to be small (live-lesson: ~5-10 files). For larger
   * projects, a Phase 2 extension may add a `loadArtifactsSince`
   * incremental method.
   *
   * Implementations should treat the read as point-in-time; if
   * consistency across artifacts matters, wrap in a transaction.
   */
  loadArtifacts(projectId: string): Promise<ReadonlyArray<ArtifactSnapshot>>;

  /**
   * Persist one artifact that the agent wrote (detected via fs diff).
   * Called once per changed path at turn boundary. Solution decides
   * how to upsert (single column, multiple columns, JSON-extract,
   * etc.).
   *
   * The runtime relies on the solution's own validation hooks
   * (`@BeforeInsert/@BeforeUpdate` for TypeORM) firing here — that's
   * how schema enforcement reaches both REST and agent-driven writes
   * through the same boundary.
   *
   * Return shape: solutions that may normalize / rewrite the path
   * server-side MUST return `{ canonicalPath }` so the runtime's
   * snapshot stays in sync with what was actually persisted. Returning
   * `void` is fine when the solution preserves the path verbatim.
   * See `SaveArtifactResult` for the rationale.
   */
  saveArtifact(
    projectId: string,
    artifact: ArtifactSnapshot,
  ): Promise<void | SaveArtifactResult>;

  /**
   * Optional: persist a deletion. If a solution doesn't want agent
   * deletes to propagate, omit this method and the runtime treats
   * deletes as no-ops (the file disappears from the agent's
   * workspace at next session, but the DB row stays).
   */
  deleteArtifact?(projectId: string, path: string): Promise<void>;
}
