/**
 * Engine-adapter contract.
 *
 * One adapter per engine type (Claude Code MCP, OpenCode, custom).
 * The adapter is the only place that knows about engine-native
 * protocols — solutions stay engine-agnostic by registering toolkits
 * against the platform's typed contract.
 *
 * This round ships ONE adapter (MCP for Claude Code). The interface is
 * narrow on purpose to keep the migration surface small. Future
 * adapters (OpenCode, etc.) will expand this surface as concrete
 * needs emerge.
 *
 * Reference: design doc §5.1 (Engine Adapter Layer).
 */

import type { ExecutionContext, ToolDefinition } from './types';

/**
 * Per-session adapter handle. The adapter is responsible for the
 * engine's tool-list exposure + tool-call routing. The handle is
 * created at session spawn and disposed at session end.
 */
export interface EngineAdapterSession {
  /** Cleanly shut down adapter-owned resources (subprocesses, IPC). */
  dispose(): Promise<void>;
}

/**
 * Factory contract — the SessionService picks an adapter and asks
 * for a per-session handle at spawn. Identity (`context`) flows in
 * here once and is captured by the adapter for the session's life.
 */
export interface EngineAdapter {
  /** Stable adapter identifier — useful in logs + audit. */
  readonly engineId: string;

  /**
   * Build a per-session adapter handle. The handle owns any engine-
   * specific subprocesses or IPC channels.
   *
   * @param context Immutable session identity + scope.
   * @param tools  Fully-qualified tool definitions the session can see.
   */
  spawnSession(
    context: ExecutionContext,
    tools: Array<{
      qualifiedName: string;
      definition: ToolDefinition;
    }>,
  ): Promise<EngineAdapterSession>;
}
