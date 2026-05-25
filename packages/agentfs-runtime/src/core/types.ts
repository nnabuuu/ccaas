/**
 * Public types for the agentfs-runtime core.
 *
 * `ContentSource` is the central port: adapters implement it against
 * whatever storage they like (TypeORM repositories, raw SQL,
 * JSON-on-disk, a REST API). `BaseMaterializer` talks ONLY to this
 * port — it knows nothing about the storage layer.
 *
 * Value objects (`SkillContent`, `SkillFileContent`, `McpServerContent`)
 * are readonly snapshots; adapters are responsible for constructing
 * them from their domain entities. Keeping the values readonly +
 * primitive-typed means the port's contract is the smallest possible
 * "what the materializer needs" — adapters can change their internal
 * entity shape freely without breaking core.
 */

export interface SkillFileContent {
  /**
   * Path of the file relative to the skill's root directory. Must NOT
   * contain `..` or absolute prefixes — adapters are responsible for
   * sanitizing. Example: `tools/ls-cheatsheet.md`.
   */
  readonly relativePath: string;
  readonly content: string;
}

export interface SkillContent {
  /**
   * Stable identifier (typically the storage primary key). Written into
   * `.skill.json` for downstream debugging; otherwise opaque to the
   * materializer.
   */
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  /** SKILL.md body. */
  readonly content: string;
  /** Sub-files (e.g. `tools/`, `examples/`); empty if the skill is single-file. */
  readonly files: ReadonlyArray<SkillFileContent>;
}

export interface McpServerContent {
  readonly tenantId: string;
  readonly slug: string;
  readonly name: string;
  /** MCP transport / server type (`stdio`, `sse`, etc.) — opaque to materializer. */
  readonly type: string;
  /**
   * Adapter-decided shape. The materializer JSON.stringify-s whatever
   * you put here. Pass an already-parsed object; if your storage holds
   * it as a JSON string, parse before constructing this VO.
   */
  readonly config: unknown;
}

/**
 * The port. Two methods, no more — the absolute minimum the
 * materializer needs to do its job. Adapters live outside this
 * package.
 */
export interface ContentSource {
  listActiveSkills(): Promise<ReadonlyArray<SkillContent>>;
  listActiveMcpServers(): Promise<ReadonlyArray<McpServerContent>>;
}

export interface MaterializeResult {
  baseDir: string;
  skillsWritten: number;
  /** Sub-file rows projected (not deduplicated by sha — see writeIfChanged). */
  skillFilesWritten: number;
  mcpServersWritten: number;
  durationMs: number;
}
