/**
 * Result of an `invokeAction()` call. Spec §5.3.
 *
 * Phase 1 ships the success+failure discriminant plus `stateChanges`
 * (so callers can react to what an action mutated without
 * round-tripping through the accessor again). `returnValue` is Phase 5
 * (gap-analysis G7) — the corresponding `ActionDef.returnType` is also
 * Phase 5; both land together so an `ok: true` result with a
 * `returnValue` is only meaningful once actions declare what they
 * return.
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§5.3)
 */

import type { ActionPrecondition } from '../schema/index.js';

export type ActionErrorCode =
  /** AccessBoundary or ActionDef.allowedRoles rejected the call. */
  | 'boundary_denied'
  /** Boundary passed, but one or more ActionPreconditions were unmet. */
  | 'precondition_unmet'
  /** Zod parsing of `params` failed. */
  | 'validation_failed'
  /** Action body threw / rejected. */
  | 'execution_error'
  /** Anything not classified above (registry lookup miss, etc). */
  | 'internal_error';

// Phase 5 will add: 'compliance_blocked' (Tier 3, G9 classification-driven denial)

export interface StateChange {
  /** Dot-path of the mutated state field, e.g. `'phase'`. */
  readonly path: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

export type ActionResult =
  | {
      readonly ok: true;
      /**
       * State mutations performed by the action. Empty/absent if the
       * action was read-only (allowed by ActionDef.sideEffects shape).
       */
      readonly stateChanges?: readonly StateChange[];
      // Phase 5: readonly returnValue?: unknown;
    }
  | {
      readonly ok: false;
      readonly errorCode: ActionErrorCode;
      readonly message: string;
      /**
       * When `errorCode === 'precondition_unmet'`, the specific
       * preconditions that failed (Tier 1, gap-analysis G2). Callers
       * surface these to the user so they understand why the action
       * was blocked.
       */
      readonly unmetPreconditions?: readonly ActionPrecondition[];
    };
