/**
 * `AccessBoundary` declares what a specific role can see and do
 * within a manifest. Combined AND-style with each `ActionDef`'s own
 * `allowedRoles`, this creates a double-gate: the manifest must
 * allow the operation AND the action must allow the role.
 *
 * Phase 1 ships `readable` / `writable` as `readonly string[]` —
 * pure path strings. The `BoundaryPathEntry` union (path string OR
 * `{ slot, where: BoundaryPredicate }`) for row-level security lands
 * in Phase 4 alongside the `BoundaryPredicate` sub-language. This is
 * documented in PROGRESS.md's decisions log.
 *
 * `BoundaryRole` is re-exported here as its canonical home, per spec
 * §4.4. The type itself lives in `../types.ts` to break the
 * cross-layer import cycle that would otherwise form with
 * `schema/action.ts` (which references `BoundaryRole` on
 * `ActionDef.allowedRoles`).
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§4.4)
 */

export type { BoundaryRole } from '../types.js';
import type { BoundaryRole } from '../types.js';

export interface AccessBoundary {
  readonly role: BoundaryRole;
  /**
   * Slot names or dot-paths into properties (e.g. `'plan'` or
   * `'plan.objective'`). `'*'` wildcard is permitted only for the
   * `'admin'` role — validators warn on `'*'` under any other role.
   *
   * Phase 1 ships pure path strings. The Phase 4 extension adds
   * `{ slot, where: BoundaryPredicate }` entries for row-level
   * security (forward-compatible since `string | { slot, where }`
   * is a backward-compatible widening).
   */
  readonly readable: readonly string[];
  /**
   * Typically a strict subset of `readable`. Agents should usually
   * only write to manifest state, not to underlying business
   * objects. Same shape as `readable`.
   */
  readonly writable: readonly string[];
  /** `ActionDef.apiName`s callable by this role. */
  readonly actions: readonly string[];
  /** `StreamDef.apiName`s this role may subscribe to. */
  readonly subscribes?: readonly string[];
}
