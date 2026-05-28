/**
 * Core types for the ToolCallerProxy abstraction.
 *
 * Contract reference: docs/design-tool-caller-proxy.md §4 (Request
 * Envelope, ExecutionContext, Ambient Identity) and §5.3 (Tool
 * Registration).
 *
 * What the agent writes (`ToolCallRequest`) is intentionally tiny:
 * tool name + args. Everything else (identity, scope, permissions)
 * comes from the platform-asserted `ExecutionContext`, which is bound
 * at session creation and read-only thereafter.
 */

import type { ZodTypeAny } from 'zod';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The entire agent-writable surface. */
export interface ToolCallRequest {
  /** Namespaced tool identifier, e.g. `lessonplan.generate`. */
  tool: string;
  /** Tool-specific arguments (will be sanitized + validated). */
  args: Record<string, unknown>;
}

/**
 * Platform-asserted execution context, injected by the proxy.
 *
 * The agent CANNOT influence any field here — they are derived
 * from the verified session and never from agent output.
 */
export interface ExecutionContext {
  /** Owning solution / tenant slug (UUID resolves to slug elsewhere). */
  solutionId: string;
  /** Session this invocation belongs to. */
  sessionId: string;
  /** End user the session is acting on behalf of, if any. */
  actingUserId?: string;
  /** Forward-compat: role the session is acting in. Not yet enforced. */
  actingRole?: string;
  /** API key that authenticated the session-creation request. */
  apiKeyId?: string;
  /**
   * Per-tool data-scope constraint resolved by the proxy.
   * STUB for this round — always undefined until the permission engine
   * lands. Solution handlers should treat undefined as "scope unknown,
   * apply maximum restriction".
   */
  effectiveScope?: 'own' | 'subordinate' | 'org' | 'all';
}

/**
 * The full invocation handed to a tool handler. `args` is the
 * sanitized + Zod-validated payload; `context` is platform-asserted.
 */
export interface ToolInvocation<TArgs = Record<string, unknown>> {
  /** Namespaced tool name actually being invoked. */
  tool: string;
  args: TArgs;
  context: ExecutionContext;
}

/** Result of a tool handler, returned to the engine adapter. */
export type ToolResult =
  | { ok: true; content: ToolResultContent[] }
  | {
      ok: false;
      /**
       * Natural-language reason — surfaces to the LLM as a structured
       * response, not an exception. The LLM should be able to relay
       * "your input was invalid because X" to the user without a crash.
       */
      reason: string;
      /** For audit + debugging. Never sent to the model. */
      code:
        | 'validation_failed'
        | 'permission_denied'
        | 'tool_not_found'
        | 'handler_error';
    };

export interface ToolResultContent {
  type: 'text';
  text: string;
}

/**
 * What a solution declares for each tool it exposes.
 *
 * `argsSchema` does double duty: it generates the JSON Schema for the
 * agent-facing tool description (via zod-to-json-schema in the engine
 * adapter), AND it validates args at runtime in the proxy pipeline.
 *
 * `requiredPermissions` and `visibility` are declared today but NOT
 * enforced — the permission engine is deferred to a later round (see
 * design doc §6).
 */
export interface ToolDefinition<TArgs = Record<string, unknown>> {
  /** Local name within the toolkit's namespace. */
  name: string;
  /** Plain-language summary shown to the agent. */
  description: string;
  /** Zod schema for the tool's args. Used for validation + schema export. */
  argsSchema: ZodTypeAny;
  /**
   * Optional precomputed JSON Schema to expose to the agent instead
   * of one derived from `argsSchema` via `zod-to-json-schema`. Used
   * for `StdioMcpToolkit` migrations where the upstream stdio server
   * already publishes a JSON Schema and we want the agent to see
   * THAT schema verbatim — avoiding drift between the two
   * representations. The ToolCallerProxy still runs `argsSchema.parse`
   * for the reserved-field strip + validation pipeline.
   */
  jsonSchemaOverride?: Record<string, unknown>;
  /** Declarative permissions list. STUB — not enforced this round. */
  requiredPermissions?: string[];
  /** Role-based visibility filter. STUB — not enforced this round. */
  visibility?: { roles?: string[] };
  /** Handler called by the proxy after sanitize/validate/inject. */
  handler: (invocation: ToolInvocation<TArgs>) => Promise<ToolResult>;
}

/**
 * A logical grouping of related tools under a single namespace.
 * Registered in the SolutionToolkitRegistry at solution-import time.
 */
export interface SolutionToolkit {
  /** Used as the prefix in fully-qualified tool names, e.g. `lessonplan`. */
  namespace: string;
  /** Owning solution. Toolkits are scoped per-solutionId. */
  solutionId: string;
  /** Tools provided by this toolkit. */
  tools: ToolDefinition<any>[];
}

/**
 * Audit entry recorded for every tool call (success or failure).
 * Persisted via the existing `tool_events` table; this is the in-memory
 * shape before write-down.
 */
export interface ToolCallAuditEntry {
  sessionId: string;
  solutionId: string;
  actingUserId?: string;
  tool: string;
  /** Reserved-field strip results (names only — never values). */
  strippedFields: readonly string[];
  /** Outcome — ok / which failure step. */
  outcome:
    | 'ok'
    | 'validation_failed'
    | 'permission_denied'
    | 'tool_not_found'
    | 'handler_error';
  /** Sanitized args after strip+validate, for replay/debug. */
  argsRedacted: Record<string, unknown>;
  startedAt: number;
  durationMs: number;
}
