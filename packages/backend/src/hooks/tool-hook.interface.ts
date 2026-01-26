/**
 * Tool Hook Interface
 *
 * Defines the contract for hooks that execute on tool events.
 */

export interface ToolHookContext {
  sessionId: string;
  clientId: string;
  toolUseId: string;
  timestamp: string;
}

export interface ToolStartInfo {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
  agentType?: string;
  decisionLogic?: {
    why?: string;
    benefit?: string;
    nextStep?: string;
  };
}

import type { ToolErrorType } from './error-classifier';

export interface ToolResult {
  toolName: string;
  input: Record<string, unknown>;
  output: string | object;
  isError: boolean;
  durationMs: number;
  // Enhanced error tracking
  errorMessage?: string;           // Actual error text when isError is true
  errorType?: ToolErrorType;       // Classified error type
  parentToolUseId?: string;        // Parent tool if spawned by Task sub-agent
  nestingLevel?: number;           // 0=main agent, 1+=sub-agent depth
  executionOrder?: number;         // Execution sequence within message
}

/**
 * A hook that executes on tool events (start and/or end)
 */
export interface ToolHook {
  /**
   * Tool name(s) this hook applies to.
   * Can be a single name or array of names.
   * Use '*' to match all tools.
   */
  tool: string | string[];

  /**
   * Called when a tool starts execution (optional)
   */
  onToolStart?(
    info: ToolStartInfo,
    context: ToolHookContext,
  ): Promise<void> | void;

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
