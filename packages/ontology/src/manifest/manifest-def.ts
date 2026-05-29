/**
 * `ManifestDef` is the composite that binds object types into a
 * runtime operational context. Spec §4.6.
 *
 * Phase 1 ships the core composite (slots + streams + state +
 * boundaries + lifecycle + schemaVersion + inheritParentRole).
 * `notifications` (Tier 3, gap-analysis G10) is deliberately NOT in
 * the interface — attempting to set it is a compile error.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§4.6)
 */

import type { LocalizedString, StreamDef } from '../schema/index.js';
import type { SlotDef } from './slot.js';
import type { StateDef } from './state.js';
import type { AccessBoundary } from './access-boundary.js';
import type { LifecycleDef } from './lifecycle.js';

/**
 * Semver-flavored version string. Each manifest instance carries the
 * `schemaVersion` it was created with; migrations are explicit (spec
 * §9.1) — runtime never silently upgrades.
 */
export type SchemaVersion = string;

export interface ManifestDef {
  readonly name: string;
  readonly displayName: LocalizedString;
  readonly schemaVersion: SchemaVersion;
  /**
   * What this manifest represents as an operational context.
   * REQUIRED.
   */
  readonly semantic: string;
  readonly slots: readonly SlotDef[];
  readonly streams?: readonly StreamDef[];
  readonly state: readonly StateDef[];
  readonly boundaries: readonly AccessBoundary[];
  readonly lifecycle?: LifecycleDef;
  /**
   * When this manifest is nested inside another (via a `SlotDef`
   * with `target.kind === 'manifest'`), should the parent role
   * propagate into the child? Default: `false` (child boundaries are
   * evaluated independently with their own role mapping). Spec §9.2.
   */
  readonly inheritParentRole?: boolean;

  // Phase 5 field — not yet exposed:
  //   notifications?: readonly NotificationRule[];  // Tier 3 (G10)
}
