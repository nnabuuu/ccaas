/**
 * `TriggerDef` — declarative trigger contract for the platform Workflow
 * layer. Lives OUTSIDE `@kedge-agentic/ontology` by design: ontology is
 * a 5-piece schema spec; trigger/workflow concerns are layered above it,
 * matching Palantir's Carbon/Workshop/Notification split.
 *
 * Three kinds in a discriminated union — each watches a different
 * surface of `ManifestAccessor` / ontology streams.
 *
 *   - `event`            — fires on every event published to a manifest
 *                          stream (cross-process or in-process). The
 *                          legacy `engine.dispatch(event)` shape.
 *   - `state-change`     — fires when a manifest state field's value
 *                          transitions (Object.is comparison; no-op
 *                          for spurious sets). Backed by the
 *                          `ManifestAccessorService.onStateChange` hook.
 *   - `object-set-change` — fires when an ObjectSetDef's membership
 *                          gains/loses a member. Phase 4 ObjectSetDef
 *                          is the prerequisite; engine bootstrap warns
 *                          + skips wiring when no ObjectSet is registered.
 *
 * @see docs/gitbook/zh/platform/workflow-architecture.md (M6+)
 */

import type {
  ActionPrecondition,
  BoundaryRole,
  SetFilter,
} from '@kedge-agentic/ontology';

/**
 * Input handed to `ActionRef.args(...)` and `TriggerDef.when(...)`.
 *
 * Exactly one of `event` / `stateChange` / `setDelta` is populated,
 * matching the trigger's kind. `cascade` is engine-populated for depth
 * tracking — handlers don't construct this.
 */
export interface TriggerFireInput {
  readonly sessionId: string;
  readonly solutionId: string;

  /** Present only on kind === 'event'. */
  readonly event?: {
    readonly streamApiName: string;
    readonly payload: unknown;
  };
  /** Present only on kind === 'state-change'. */
  readonly stateChange?: {
    readonly path: string;
    readonly before: unknown;
    readonly after: unknown;
  };
  /** Present only on kind === 'object-set-change'. */
  readonly setDelta?: {
    readonly setApiName: string;
    readonly added: readonly unknown[];
    readonly removed: readonly unknown[];
  };

  /** Engine-managed cascade tracking. */
  readonly cascade: {
    readonly depth: number;
    readonly correlationId: string;
    readonly originStream?: string;
  };
}

/**
 * Pure-function mapping from a trigger fire input to the args the
 * referenced ActionDef expects. Throws → trigger dispatch aborts and
 * audits as `execution_error`.
 */
export type ArgsMapper = (
  input: TriggerFireInput,
) => Record<string, unknown> | Promise<Record<string, unknown>>;

/**
 * What action a trigger fires, and as what role.
 *
 * `as` defaults to `'agent'` to match the bridge's `defaultRole` and
 * keep audit rows uniform with agent-driven invocations. Solutions can
 * pick `'admin'` for workflow-internal actions that need to bypass
 * agent-level boundaries.
 */
export interface ActionRef {
  /**
   * Tool identifier handed to `ManifestAccessor.invokeAction(...)`. When
   * the accessor's `qualifyTool` resolver is the default identity (the
   * normal case for workflow triggers), this MUST be the fully-qualified
   * `<namespace>.<actionApiName>` as registered in
   * `SolutionToolkitRegistry` — e.g.
   * `'workflow-actions.record_lifecycle_observation'`. Bare apiName
   * silently `tool_not_found`s. See the interface JSDoc above for
   * the full rationale.
   */
  readonly action: string;
  readonly args: ArgsMapper;
  readonly as?: BoundaryRole;
}

export type TriggerKind = 'event' | 'state-change' | 'object-set-change';

interface TriggerDefCommon {
  readonly apiName: string;
  readonly manifest: string;
  readonly semantic: string;
  /**
   * Optional fast predicate. Runs BEFORE building any
   * `ManifestAccessor`, so no-op predicates cost ~nothing.
   * Errors are caught and treated as `when` returning `false`.
   */
  readonly when?: (input: TriggerFireInput) => boolean | Promise<boolean>;
  readonly then: ActionRef;
  /**
   * Per-trigger cascade ceiling. Default = engine.maxCascadeDepth (5).
   * Used to break specific cycles without lifting the global limit.
   */
  readonly cascadeBudget?: number;
  /** Within a fan-out, lower runs first. Default 0; tiebreak by registration order. */
  readonly priority?: number;
}

export type TriggerDef =
  | (TriggerDefCommon & {
      readonly kind: 'event';
      readonly watch: { readonly stream: string };
    })
  | (TriggerDefCommon & {
      readonly kind: 'state-change';
      readonly watch: {
        readonly state: string;
        /** Fire only when after-value === equals (Object.is). */
        readonly equals?: unknown;
        /**
         * Fire only when before !== transitionsTo && after === transitionsTo.
         * Useful for "fires once on entry, not on every set with same value".
         */
        readonly transitionsTo?: unknown;
      };
    })
  | (TriggerDefCommon & {
      readonly kind: 'object-set-change';
      readonly watch: {
        readonly objectSet: string;
        readonly on: 'added' | 'removed' | 'any';
        /**
         * Optional finer filter on the changed members (Phase 4 SetFilter).
         * Engine evaluates against added/removed deltas before firing.
         */
        readonly memberFilter?: SetFilter;
      };
    });

/**
 * Index key for trigger lookup. `WorkflowRegistry` uses these as the
 * inner-Map keys for O(1) routing in the hot path.
 */
export type TriggerWatchKey =
  | { readonly kind: 'event'; readonly stream: string }
  | { readonly kind: 'state-change'; readonly state: string }
  | { readonly kind: 'object-set-change'; readonly objectSet: string };

/**
 * Stable string key for indexing — `${kind}:${manifest}:${watchKey}`.
 * Centralized so the Registry + Engine + tests all derive the same string.
 */
export function triggerIndexKey(
  manifest: string,
  watch: TriggerWatchKey,
): string {
  switch (watch.kind) {
    case 'event':
      return `event:${manifest}:${watch.stream}`;
    case 'state-change':
      return `state:${manifest}:${watch.state}`;
    case 'object-set-change':
      return `set:${manifest}:${watch.objectSet}`;
  }
}

/**
 * Surface the unmetPreconditions structured detail that Phase 3's
 * bridge already returns. Re-exported so workflow handlers can read it.
 */
export type { ActionPrecondition };
