/**
 * Artifact sub-module — Phase 0 types + concrete `JsonEditProvider`.
 *
 * An `Artifact` is a single piece of typed content owned by a
 * `Project`. Examples in live-lesson terms:
 *   - lesson plan (type='markdown')   — edited via MarkdownEditor (Phase 1)
 *   - execution plan (type='json', schemaId='manifest-v1')
 *                                     — edited via JsonEditProvider (Phase 0)
 *   - attached audio/image (type='binary') — edited via BinaryEditor (Phase 1)
 *
 * **v0 — these interfaces will likely change as Phase 1 impls are
 * built. Don't depend on the shape externally until v1.**
 */

/**
 * Artifact type tag. The 3 well-known values get first-class
 * editors; arbitrary strings are allowed for solution-specific types
 * that bring their own editor.
 */
export type ArtifactType = 'markdown' | 'json' | 'binary' | string;

export interface Artifact<TContent = unknown> {
  readonly id: string;
  readonly projectId: string;
  /** URL-safe relative path within the project (e.g. "plans/q2-roadmap.json"). */
  readonly path: string;
  readonly type: ArtifactType;
  readonly content: TContent;
  /** Optional metadata that solution UI / agent can use; never validated. */
  readonly attributes: Readonly<Record<string, unknown>>;
  /** If set, content gets validated against this schema in the SchemaRegistry. */
  readonly schemaId?: string;
  readonly updatedAt: string;
}

export interface ArtifactStore {
  load(projectId: string, path: string): Promise<Artifact | null>;
  list(projectId: string): Promise<ReadonlyArray<Artifact>>;
  save(artifact: Artifact): Promise<void>;
  delete(projectId: string, path: string): Promise<void>;
}

/**
 * Editor operations. The union covers all artifact types; each
 * editor implementation supports a subset (e.g. `JsonEditProvider`
 * supports `field_set` / `json_patch` / `replace` but not
 * `str_replace`).
 */
export type EditOperation =
  | {
      readonly op: 'field_set';
      /** JSON Pointer (RFC 6901) — e.g. "/foo/bar/0" */
      readonly path: string;
      readonly value: unknown;
    }
  | {
      readonly op: 'json_patch';
      /** Array of RFC 6902 ops: { op, path, value? } */
      readonly ops: ReadonlyArray<unknown>;
    }
  | {
      readonly op: 'str_replace';
      readonly old_string: string;
      readonly new_string: string;
    }
  | {
      readonly op: 'replace';
      readonly content: unknown;
    };

export interface EditResult<TContent = unknown> {
  readonly success: boolean;
  readonly error?: string;
  readonly artifact?: Artifact<TContent>;
}

/**
 * Each editor knows how to serialize an artifact's content to a
 * canonical string (for agent reads) and how to apply a sequence of
 * edit ops (for agent + GUI writes).
 */
export interface ArtifactEditor<TContent = unknown> {
  serialize(artifact: Artifact<TContent>): string;
  edit(
    artifact: Artifact<TContent>,
    ops: ReadonlyArray<EditOperation>,
  ): Promise<EditResult<TContent>>;
}
