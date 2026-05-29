/**
 * Boundary-check inputs and decisions. Spec §5.2.
 *
 * `checkBoundary` is the pure-function predicate that gates every
 * read / write / action / subscribe. The shapes here are the contract
 * both sides agree on:
 *
 *   - Callers (typically `ManifestAccessor` implementations) shape
 *     `BoundaryCheckInput` and pass it to `checkBoundary`.
 *   - `checkBoundary` returns a `BoundaryDecision` which the caller
 *     uses verbatim to allow or deny the operation.
 *
 * Phase 1 refinement over the spec: `BoundaryCheckInput` carries
 * optional `state` and `boundSlots` snapshots so action preconditions
 * (Tier 1, gap-analysis G2) can be evaluated by the same pure check.
 * Without them, `stateEquals` / `slotBound` preconditions fail-safe
 * (treated as unmet).
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§5.2)
 */

import type { ActionDef, ActionPrecondition } from '../schema/index.js';
import type { ManifestDef } from '../manifest/index.js';
import type { BoundaryRole } from '../types.js';

export type BoundaryOp =
  | { readonly kind: 'read'; readonly path: string }
  | { readonly kind: 'write'; readonly path: string }
  | {
      readonly kind: 'action';
      readonly actionApiName: string;
      /**
       * When provided, `ActionDef.allowedRoles` AND
       * `ActionDef.preconditions` are also checked (two-gate per spec
       * §3.3). Without it, only `boundary.actions` is verified —
       * suitable for early "is this action even visible to this role?"
       * filtering before the registry is in scope.
       */
      readonly actionDef?: ActionDef;
    }
  | { readonly kind: 'subscribe'; readonly streamApiName: string };

export interface BoundaryCheckInput {
  readonly manifest: ManifestDef;
  readonly role: BoundaryRole;
  readonly op: BoundaryOp;
  /**
   * Optional runtime state snapshot (state apiName → current value).
   * Required to evaluate `ActionPrecondition` of kind `stateEquals`.
   * Absent → those preconditions fail (denial returned).
   */
  readonly state?: Readonly<Record<string, unknown>>;
  /**
   * Optional snapshot of which slots currently have a binding. Required
   * to evaluate `ActionPrecondition` of kind `slotBound`. Absent →
   * those preconditions fail (denial returned).
   */
  readonly boundSlots?: ReadonlySet<string>;
}

export type BoundaryDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: string;
      /**
       * If denial was driven by precondition failure (rather than a
       * boundary/roles miss), the specific preconditions that failed.
       * Surfaced so callers can wrap them into an `ActionResult` of
       * `errorCode: 'precondition_unmet'`.
       */
      readonly unmetPreconditions?: readonly ActionPrecondition[];
    };
