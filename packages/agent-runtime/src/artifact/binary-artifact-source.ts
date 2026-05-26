/**
 * `BinaryArtifactSource` — the binary counterpart to
 * `WorkspaceArtifactSource`. Solutions implement it when they need to
 * sync byte-content artifacts (images, audio, PDFs) alongside their
 * text artifacts.
 *
 * Why a separate port from `WorkspaceArtifactSource`?
 *   - content type is `Buffer | Uint8Array`, not `string`. Co-mingling
 *     would complicate every consumer's type story even when they only
 *     handle text.
 *   - solutions opt in independently — many solutions are text-only
 *     and shouldn't be forced to declare a no-op binary store.
 *   - REST transport differs: text uses `application/json` with content
 *     inlined; binary uses `application/octet-stream` streamed via
 *     `node:stream/pipeline` to keep memory bounded.
 *
 * **Workspace mount-point convention**: the ccaas syncer materializes
 * binary artifacts under `artifacts-binary/` (sibling of `artifacts/`
 * for text). The split keeps the agent's `Read` / `cat` tools from
 * streaming a JPEG into context. Solutions don't need to know this —
 * they only see workspace-relative paths in the snapshots.
 */

/**
 * One binary artifact as returned by a `BinaryArtifactSource`. Mirrors
 * `ArtifactSnapshot` (text) shape; the only difference is `content`
 * type. `(projectId, path)` is the natural key; the snapshot store
 * tracks change via sha-256 over the bytes (same hash as text).
 */
export interface BinaryArtifactSnapshot {
  /** Workspace-relative path, e.g. "hero.png" or "lessons/01/audio.mp3". */
  readonly path: string;
  /** Raw bytes. `Buffer` in Node; `Uint8Array` for portability. */
  readonly content: Buffer | Uint8Array;
  /**
   * Discriminator the solution chooses (e.g. "png", "mp3", "pdf"). The
   * runtime treats this opaquely; solutions can use it for MIME-type
   * dispatch on the REST side.
   */
  readonly type: string;
  /**
   * Byte length of `content`. Required so the runtime can enforce size
   * limits BEFORE buffering — when streaming download from a solution
   * REST adapter, the adapter can short-circuit on content-length
   * before draining the body.
   */
  readonly sizeBytes: number;
  /** Optional solution-defined metadata; opaque to the runtime. */
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * Optional return shape from `saveBinaryArtifact`. Same canonical-path
 * semantics as `SaveArtifactResult` for text (Phase 2b-1).
 */
export interface SaveBinaryArtifactResult {
  readonly canonicalPath?: string;
}

/**
 * Listing entry for `listBinaryArtifacts` — metadata only, no bytes.
 * Lets a consumer enumerate cheaply without paying for content
 * transfer. The runtime's sync layer uses this to detect added /
 * deleted artifacts; content is fetched lazily via `loadBinaryArtifact`
 * only for the paths that actually need to be materialized.
 */
export interface BinaryArtifactListing {
  readonly path: string;
  readonly type: string;
  readonly sizeBytes: number;
  /** Optional precomputed sha-256 hex; if present saves a full fetch
   *  when the snapshot's hash already matches. */
  readonly contentHash?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * The port solutions implement for binary artifacts. Listing vs
 * loading is split (unlike text which inlines content) because binary
 * content can be large — full reads every turn would be prohibitive.
 */
export interface BinaryArtifactSource {
  /**
   * Optional max content size in bytes. The REST adapter enforces this
   * via content-length pre-check; uploads exceeding the limit are
   * rejected (HTTP 413) before any disk write. Omitted = unbounded
   * (solution accepts the responsibility).
   */
  readonly maxBytes?: number;

  /**
   * Enumerate every binary artifact for a project. Metadata only —
   * paths, types, sizes, optional precomputed hashes. The runtime
   * compares the returned hashes (or fetches+hashes on demand) against
   * the snapshot to plan sync actions.
   *
   * Called at the same cadence as `WorkspaceArtifactSource.loadArtifacts`
   * (session start, agent turn boundary, explicit invalidate).
   */
  listBinaryArtifacts(
    projectId: string,
  ): Promise<ReadonlyArray<BinaryArtifactListing>>;

  /**
   * Fetch the bytes of a single artifact. Should stream internally
   * (the REST adapter uses `node:stream/pipeline`) — implementations
   * are free to return a fully-materialized `Buffer` if their backing
   * store doesn't support streaming, but the runtime's syncer will
   * happily consume a stream when it can.
   */
  loadBinaryArtifact(
    projectId: string,
    path: string,
  ): Promise<BinaryArtifactSnapshot>;

  /**
   * Persist one binary artifact (the agent wrote/replaced it). Same
   * canonical-path return semantics as the text variant.
   */
  saveBinaryArtifact(
    projectId: string,
    artifact: BinaryArtifactSnapshot,
  ): Promise<void | SaveBinaryArtifactResult>;

  /**
   * Optional: persist a deletion. Same opt-in semantics as
   * `WorkspaceArtifactSource.deleteArtifact` — omitting it means the
   * runtime treats agent deletes as no-ops (and restores the file
   * on the next sync to avoid a delete loop).
   */
  deleteBinaryArtifact?(projectId: string, path: string): Promise<void>;
}
