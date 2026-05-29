/**
 * `ActionDef` is a governed write operation. At registration time it
 * compiles to a `ToolDefinition` registered with
 * `SolutionToolkitRegistry`, and the existing `ToolCallerProxy` 6-step
 * pipeline enforces sanitize/validate/permission/inject/dispatch/audit
 * — see spec §10.2 for the bridge.
 *
 * Phase 1 ships ActionDef + ActionPrecondition (Tier 1, gap-analysis
 * G2). `returnType` (Tier 3, G11) lands in Phase 5.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.3)
 */

import type { z } from 'zod';
import type { BoundaryRole } from '../types.js';
import type { LocalizedString } from './localized-string.js';

/** How much the audit pipeline records for each invocation of this Action. */
export type AuditLevel = 'none' | 'log' | 'full_diff';

/**
 * Mirror of `packages/backend/src/auth/types.ts` `ApiKeyScope`. Kept
 * as a literal union (not imported) so the ontology package stays
 * framework-free and free of backend imports. The registry validates
 * that values supplied at registration time are members of this
 * union; if the backend's scope set changes, this list must be
 * updated in lockstep.
 */
export type ApiKeyScopeLiteral =
  | 'skills:read'
  | 'skills:write'
  | 'skills:execute'
  | 'skills:delete'
  | 'mcp:read'
  | 'mcp:write'
  | 'chat'
  | 'analytics:read'
  | 'builder'
  | 'admin';

/**
 * Runtime list of every `ApiKeyScopeLiteral`. The validator walks
 * `ActionDef.requiredScopes` / `FunctionDef.requiredScopes` against
 * this set to surface typos at registration time. Keep in lockstep
 * with the union above (the `satisfies` clause guarantees the array
 * covers the type at compile time).
 */
export const API_KEY_SCOPES = [
  'skills:read',
  'skills:write',
  'skills:execute',
  'skills:delete',
  'mcp:read',
  'mcp:write',
  'chat',
  'analytics:read',
  'builder',
  'admin',
] as const satisfies readonly ApiKeyScopeLiteral[];

/**
 * Declarative precondition shapes (discriminated by `kind`).
 *
 * Three forms cover the common cases without committing to a
 * Turing-complete predicate sub-language. Richer logic escapes through
 * `kind: 'named'`, which dispatches to a `Predicate` registered on
 * `OntologyRegistry`.
 *
 * Phase 1 ships all three discriminants. `stateEquals` and `slotBound`
 * are evaluated by `checkBoundary`; `named` returns a stub denial in
 * Phase 1 (the registry-side `registerPredicate` lands in Phase 4).
 */
export type ActionPrecondition =
  /** Manifest state at `path` must equal `value`. */
  | {
      readonly kind: 'stateEquals';
      readonly path: string;
      readonly value: string | number | boolean | null;
    }
  /**
   * Named slot must currently be bound (non-null; non-empty for
   * collection slots).
   */
  | {
      readonly kind: 'slotBound';
      readonly slot: string;
    }
  /**
   * Named predicate registered on `OntologyRegistry` via
   * `registerPredicate`. `params` is an optional context payload.
   * **Phase 1 stub**: `checkBoundary` returns
   * `{ allowed: false, reason: 'named predicates land in Phase 4' }`
   * for this kind until Phase 4 ships predicate registration.
   */
  | {
      readonly kind: 'named';
      readonly name: string;
      readonly params?: Readonly<Record<string, unknown>>;
    };

export interface ActionDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;

  /**
   * Typed parameters as a Zod object schema. The same schema travels
   * through `ToolCallerProxy.argsSchema` at the bridge (spec §10.2),
   * so the proxy's sanitize+validate step parses these exact
   * constraints. Per-param semantic text lives on `.describe()` calls
   * inside the schema.
   */
  readonly params: z.ZodObject<z.ZodRawShape>;

  /**
   * Declarative side-effect tags for Agent reasoning. Format:
   * verb-prefixed strings like `'mutates:LessonSession.state.phase'`
   * or `'emits:ClassroomEvent'`. The actual mutations happen in the
   * handler; these tags let the agent reason about whether an action
   * is appropriate before invoking it.
   */
  readonly sideEffects: readonly string[];

  /**
   * Other `ActionDef.apiName`s this action transitively invokes.
   * Surfaces hidden composition for agent reasoning — without it, an
   * agent has no way to know that the handler internally also calls
   * `insertResource` (see spec §9.5).
   */
  readonly composes?: readonly string[];

  /**
   * Declarative gates evaluated by `checkBoundary` BEFORE dispatch.
   * If any precondition is unmet, the action is denied with a
   * structured `unmetPreconditions` list — the agent never sees a
   * "handler returned early because state was wrong" response.
   *
   * Added per gap-analysis G2 (Tier 1).
   */
  readonly preconditions?: readonly ActionPrecondition[];

  /** Human-approval gate before execution. */
  readonly requiresApproval?: boolean;

  /**
   * Roles allowed to invoke this action. Combined AND-style with
   * `AccessBoundary.actions` — both gates must pass.
   */
  readonly allowedRoles: readonly BoundaryRole[];

  /**
   * Required `ApiKeyScope`s for the calling session; ANY-of
   * semantics. Validated by the registry to be members of
   * `ApiKeyScopeLiteral`.
   */
  readonly requiredScopes?: readonly ApiKeyScopeLiteral[];

  readonly auditLevel: AuditLevel;

  // Phase 5 field — not yet exposed:
  //   returnType?: z.ZodTypeAny;  // Tier 3 (G11)

  /** Natural-language description for Agent consumption. REQUIRED. */
  readonly semantic: string;
}
