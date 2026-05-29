/**
 * `SlotDef` is a typed placeholder in a `Manifest` that gets bound to
 * a specific object instance (or collection of instances) at runtime.
 *
 * Phase 1 ships two `SlotTarget` discriminants: `'objectType'` and
 * `'manifest'`. The `'objectSet'` discriminant (Tier 2, gap-analysis
 * G6) lands in Phase 4.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§4.2)
 */

import type { LocalizedString } from '../schema/index.js';

/**
 * Slot target discriminator. Phase 1 ships two kinds:
 *
 *  - `'objectType'`: bind to an ObjectTypeDef instance (the default).
 *  - `'manifest'`:   nest a child manifest (spec §9.2).
 *
 * Phase 4 adds:
 *  - `'objectSet'`: bind to an ObjectSetDef (Tier 2). Collection-typed
 *    by definition.
 */
export type SlotTarget =
  | { readonly kind: 'objectType'; readonly apiName: string }
  | { readonly kind: 'manifest'; readonly name: string };

export interface SlotDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  readonly target: SlotTarget;
  /** True = bound to many instances; false / undef = single instance. */
  readonly collection?: boolean;
  /** When `required: true`, manifest activation blocks until this slot is bound. */
  readonly required?: boolean;
  /**
   * Dot-path expression that derives this slot's binding from another
   * slot, e.g. `'class.contains'` (follow `Class.contains` LinkDef
   * from the `class` slot). Resolved by `manifest/resolve.ts`.
   * Validators reject paths that don't resolve through declared
   * LinkDefs at registration.
   */
  readonly derivedFrom?: string;
  /** Natural-language description for Agent reasoning. REQUIRED. */
  readonly semantic: string;
}
