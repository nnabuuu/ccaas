/**
 * Tool Hook Interface
 *
 * Defines the contract for hooks that execute on tool events.
 * Simplified version for lesson-plan-designer (no onToolStart)
 */

export interface ToolHookContext {
  sessionId: string;
  toolUseId: string;
  toolName: string;
}

export interface ToolResult {
  toolName?: string;
  input?: Record<string, unknown>;
  output?: string | object;
  isError: boolean;
}

/**
 * A hook that executes after tool results
 */
export interface ToolHook {
  /**
   * Tool name(s) this hook applies to.
   * Can be a single name or array of names.
   */
  tool: string | string[];

  /**
   * Called after the tool result is processed
   */
  afterToolResult(
    result: ToolResult,
    context: ToolHookContext,
  ): Promise<void> | void;
}

/**
 * Factory function type for creating hooks with dependencies
 */
export type ToolHookFactory<T = unknown> = (deps: T) => ToolHook;
