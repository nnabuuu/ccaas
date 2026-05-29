/**
 * `@kedge-agentic/ontology/manifest` subpath — Phase 1 (core + Tier 1).
 *
 * The composition layer: ManifestDef + its constituent shapes
 * (SlotDef, StateDef, AccessBoundary, LifecycleDef). Phase 4/5
 * additions (BoundaryPredicate, NotificationRule, ObjectSet slot
 * target) deliberately omitted; see PROGRESS.md.
 */

export type { SlotDef, SlotTarget } from './slot.js';
export type { StateDef } from './state.js';
export type { AccessBoundary, BoundaryRole } from './access-boundary.js';
export type { LifecycleDef } from './lifecycle.js';
export type { ManifestDef, SchemaVersion } from './manifest-def.js';
