/**
 * WorkspaceProvider abstraction — pluggable backend for per-session workspaces.
 *
 * Two implementations ship in this folder:
 *   - LocalWorkspaceProvider  — mkdir + symlink, today's behavior
 *   - AgentfsWorkspaceProvider — agentfs (Turso) overlay FS per session
 *
 * Selected at module init via config.workspace.provider ('local' | 'agentfs').
 * Both yield a WorkspaceHandle whose `path` is at
 * `${WORKSPACE_DIR}/sessions/{sessionId}` — identical layout, so consumers
 * that read `session.workspaceDir` as a string keep working unchanged.
 *
 * See packages/vfs-poc/docs/WORKSPACE_PROVIDER.md for the full design,
 * sanity-check findings (A: concurrency, B: agentfs init --force race),
 * and risk register.
 */

/** DI token for `@Inject(WORKSPACE_PROVIDER)`. */
export const WORKSPACE_PROVIDER = 'WORKSPACE_PROVIDER';

/**
 * MCP server setup is intentionally NOT a provider concern — callers
 * still go through the existing `SessionService.createMcpSymlinks(session)`
 * path once mcpServers is populated on the session, regardless of which
 * provider materialized the workspace. Both LocalProvider (plain dir)
 * and AgentfsProvider (mount point) expose a real fs path where
 * `WorkspaceService.createMcpSymlinks` can drop symlinks targeting host fs.
 */
export interface CreateOpts {
  sessionId: string;
  /** Stored on the handle; downstream code uses it for tenant-aware fs ops. */
  tenantId?: string;
}

export interface WorkspaceHandle {
  sessionId: string;
  /**
   * Absolute path consumers should use as `cwd` for the CLI spawn AND as
   * the root for raw fs ops. For both LocalProvider and AgentfsProvider
   * this resolves to `${WORKSPACE_DIR}/sessions/{sessionId}`.
   */
  path: string;
  /** Optional: snapshot the workspace's mutable state under `label`. */
  snapshot?(label: string): Promise<string>;
  /** Optional: revert workspace to a previously-taken snapshot. */
  rollback?(label: string): Promise<void>;
}

export interface WorkspaceCapabilities {
  /** True if `snapshot`/`rollback` are implemented on returned handles. */
  snapshot: boolean;
  /** True if the same session can be mounted at multiple paths (agentfs FUSE-only feature). */
  multiMount: boolean;
  /** True if creating a session by branching from another is cheap. */
  fastClone: boolean;
}

/**
 * Lifecycle:
 *   create  → returns handle, idempotent for the same sessionId in-flight (provider must dedup)
 *   close   → release locks / unmount; KEEP delta data on disk (matches today's `closeSession` soft-close)
 *   destroy → close + delete underlying data; not currently called by SessionService but provided for future
 *
 * onModuleInit (optional) runs once at backend startup — used by
 * AgentfsProvider to fail-fast on a missing binary AND to clean stale
 * mounts from a previous backend process that died mid-flight.
 */
export interface WorkspaceProvider {
  create(opts: CreateOpts): Promise<WorkspaceHandle>;
  close(sessionId: string): Promise<void>;
  destroy(sessionId: string): Promise<void>;
  capabilities(): WorkspaceCapabilities;
  onModuleInit?(): Promise<void>;
}
