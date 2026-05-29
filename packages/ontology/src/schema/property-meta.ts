/**
 * `PropertyMeta` is the per-field governance + presentation sidecar
 * that lives alongside an `ObjectTypeDef.schema`. The Zod schema is
 * the source of truth for field shapes; this sidecar carries only what
 * Zod has no concept of: picker hints, computed flag, optional i18n
 * displayName override.
 *
 * Phase 1 ships the four core fields. `classification` and `redaction`
 * (Tier 3, gap-analysis G9 + G12) land in Phase 5.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.1)
 */

import type { z } from 'zod';
import type { LocalizedString } from './localized-string.js';

/**
 * Per-property sidecar entry. Every field is optional — a field that
 * needs no metadata (`id: z.string()`) has no entry in the meta map.
 */
export interface PropertyMeta {
  /**
   * Optional i18n override for this field's display label. If absent,
   * the property's display label is derived from the field's Zod
   * `.describe()` text or, failing that, the field key itself.
   */
  readonly displayName?: LocalizedString;

  /** @Picker hint: include this property in full-text search. */
  readonly searchable?: boolean;

  /** @Picker hint: rendering role in list views. */
  readonly displayRole?: 'title' | 'subtitle' | 'badge' | 'body' | 'hidden';

  /**
   * Marks the property as derived at runtime. Readable by any role
   * permitted by the AccessBoundary, but `boundary-check.ts` rejects
   * writes regardless of role — the Zod schema doesn't know about
   * computed-ness; that's why this sidecar exists.
   */
  readonly computed?: boolean;

  // Phase 5 fields — not yet exposed:
  //   classification?: readonly Classification[];  // Tier 3 (G9)
  //   redaction?: { roles, strategy, maskTemplate? };  // Tier 3 (G12)
}

/**
 * Sidecar map keyed by field names of the bound schema. The generic
 * constraint ensures misnamed keys are TS errors at the
 * `defineObjectType` call site.
 *
 * @example
 *   const StudentSchema = z.object({ id: z.string(), name: z.string() });
 *   const meta: PropertyMetaMap<typeof StudentSchema> = {
 *     name: { searchable: true, displayRole: 'title' },
 *     // typo: { foo: { ... } }  // ← TS error
 *   };
 */
export type PropertyMetaMap<S extends z.ZodObject<z.ZodRawShape>> = Partial<
  Record<keyof z.infer<S>, PropertyMeta>
>;
