/**
 * `ObjectTypeDef` is the composite: properties (via Zod schema) + meta
 * sidecar + links + actions + picker config.
 *
 * Phase 1 ships the core composite. `implements` (Tier 2),
 * `validationRules` (Tier 3, G7), and `stateMachine` (Tier 3, G8) are
 * deliberately NOT in the interface — attempting to use them is a
 * compile error, which is the gating mechanism for deferred features.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.4)
 */

import type { z } from 'zod';
import type { LocalizedString } from './localized-string.js';
import type { PropertyMetaMap } from './property-meta.js';
import type { LinkDef } from './link.js';
import type { ActionDef } from './action.js';

export interface PickerConfig {
  readonly icon: string;
  readonly color?: string;
  /** Subset of property apiNames to include in full-text search. */
  readonly searchFields: readonly string[];
  /** Property apiName whose value renders as the headline. */
  readonly titleField: string;
  /** Property apiName for subtitle/summary line (optional). */
  readonly subtitleField?: string;
  /**
   * Allow this type to be referenced from manifests OTHER than the
   * one declaring the picker context (spec §9.4). Default: hermetic
   * (no cross-manifest references).
   */
  readonly crossManifestSources?: readonly ('parent' | 'sibling' | 'all')[];
}

export interface ObjectTypeDef<
  S extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
> {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /**
   * Overall description of what this object represents.
   * REQUIRED — validators reject empty strings at registration.
   */
  readonly semantic: string;
  /**
   * Zod object schema — the source of truth for structural shape.
   * Field names are property apiNames; field types determine
   * everything downstream (TS inference, JSON Schema projection,
   * `ToolCallerProxy` validation). Per-field semantic text lives on
   * `.describe('...')` calls inside the schema.
   */
  readonly schema: S;
  /**
   * Sidecar carrying picker / governance hints Zod has no concept of
   * (searchable, displayRole, computed, optional displayName i18n).
   * Keys are constrained to `keyof z.infer<S>` — misspellings are
   * compile-time errors.
   */
  readonly meta?: PropertyMetaMap<S>;
  readonly links: readonly LinkDef[];
  readonly actions: readonly ActionDef[];
  readonly picker?: PickerConfig;

  // Phase 4/5 fields — not yet exposed:
  //   implements?: readonly string[];                    // Tier 2 (§3.8)
  //   validationRules?: readonly ValidationRuleMeta[];   // Tier 3 (§3.10, G7)
  //   stateMachine?: StateMachineDef;                    // Tier 3 (§3.11, G8)
}
