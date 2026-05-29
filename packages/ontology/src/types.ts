/**
 * Cross-layer type aliases shared between `schema/` and `manifest/`.
 *
 * Lives here (not in either subdir) to avoid the cross-layer import
 * graph that would otherwise form: `schema/action.ts` references
 * `BoundaryRole` (a manifest concept) on `ActionDef.allowedRoles`, and
 * `manifest/access-boundary.ts` is its canonical home. By extracting
 * the type to a top-level file, both layers import without a cycle and
 * the canonical re-export from `manifest/access-boundary.ts` still
 * makes the type discoverable at its spec-documented location.
 *
 * Keep this file tiny — anything not strictly cross-layer should live
 * in its primary layer.
 */

/**
 * Logical role within a manifest. Maps mechanically to the existing
 * platform roles + scopes — see design spec §10.3 for the mapping
 * table. The canonical home for this type is
 * `manifest/access-boundary.ts`, which re-exports it.
 *
 * @see ../docs/ontology/kedge-ontology-design.md (§4.4)
 */
export type BoundaryRole =
  | 'agent' // The AI agent operating within the manifest
  | 'picker' // The @Picker UI consumer (typically end-user-driven)
  | 'admin' // Platform / solution admin
  | (string & {}); // Solution-defined custom roles permitted; the &{} preserves literal-type narrowing for the named members
