/**
 * `FunctionDef` is a pure, side-effect-free, typed computation.
 * Distinct from `ActionDef` by *intent*: functions return values,
 * actions change state.
 *
 * Compiles to a `ToolDefinition` at registration time (same bridge as
 * ActionDef) but with the audit level pinned at `'log'` (never
 * `'full_diff'`) and the approval gate skipped entirely. The agent's
 * projected view (spec §11) lists functions in a separate "What you
 * can compute" section, distinct from "What you can do."
 *
 * Added per gap-analysis G1 (Tier 1).
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.7)
 */

import type { z } from 'zod';
import type { BoundaryRole } from '../types.js';
import type { LocalizedString } from './localized-string.js';
import type { ApiKeyScopeLiteral } from './action.js';

export interface FunctionDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;

  /**
   * Typed parameters as a Zod object schema (same shape as
   * `ActionDef.params`).
   */
  readonly params: z.ZodObject<z.ZodRawShape>;

  /**
   * Shape of the returned value as a Zod schema. Per-field
   * `.describe()` carries semantic text for the agent's projected
   * view.
   */
  readonly returnType: z.ZodTypeAny;

  /** Natural-language description for Agent consumption. REQUIRED. */
  readonly semantic: string;

  /** Roles allowed to invoke this function. */
  readonly allowedRoles: readonly BoundaryRole[];

  /** Required `ApiKeyScope`s for the calling session; ANY-of semantics. */
  readonly requiredScopes?: readonly ApiKeyScopeLiteral[];

  // Deliberately absent (per spec §3.7):
  //   - sideEffects (functions have none, by definition)
  //   - composes (function composition is a handler concern, not schema)
  //   - preconditions (a precondition that gates a pure read is suspicious;
  //     if needed, use AccessBoundary.readable instead)
  //   - requiresApproval (approval for a read is a category error)
  //   - auditLevel (pinned at 'log' by the bridge — see spec §10.1)
}
