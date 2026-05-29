/**
 * `LinkDef` is a named, typed relationship between two `ObjectType`s.
 * Links live on the source ObjectType and reference the target by
 * `apiName` — no inline embedding, no nesting.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.2)
 */

import type { LocalizedString } from './localized-string.js';

export type LinkCardinality = '1:1' | '1:N' | 'N:1' | 'N:M';

export interface LinkDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** `ObjectTypeDef.apiName` of the link target. */
  readonly target: string;
  readonly cardinality: LinkCardinality;
  /**
   * Name of the inverse link on the target. Strongly recommended —
   * without it, traversal works A→B but not B→A, which breaks the
   * @Picker "show me what references this" pattern.
   */
  readonly inverse?: string;
  /**
   * @Picker hint: whether the picker UI offers a "drill into this
   * link" affordance for this relationship. Not all relationships
   * should be browsable (e.g. `createdBy` is metadata, not navigation).
   */
  readonly traversable?: boolean;
  /**
   * Natural-language description for Agent reasoning. Required —
   * validators reject empty strings at registration time.
   */
  readonly semantic: string;
}
