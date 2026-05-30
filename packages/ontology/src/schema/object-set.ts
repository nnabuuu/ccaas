/**
 * `ObjectSetDef` — Tier 2, Phase 4. A named, typed, filterable
 * collection of objects of a given `ObjectType`.
 *
 * Common shape in agent reasoning: "the set of struggling students
 * this session," "resources used in the last 3 lessons,"
 * "submissions awaiting Teacher Zhang's grading." Today these live
 * as derived slots with hardcoded filter logic; ObjectSetDef makes
 * them first-class so they can be passed as Action parameters,
 * referenced cross-manifest, and surfaced to the agent as an
 * inspectable schema.
 *
 * Identity is by `apiName` (not by filter structure) — two sets that
 * happen to compute the same predicate are distinct unless their
 * apiNames match. Gap-analysis Open Question #4.
 *
 * Phase 4 ships ObjectSetDef + SetFilter + OrderClause. The other
 * Tier 2 primitives (`InterfaceDef`, `BoundaryPredicate`) stay
 * compile-time-blocked.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.9)
 */

import type { LocalizedString } from './localized-string.js';

/**
 * Small first-order filter language — deliberately not Turing-complete.
 * Richer logic escapes through `op: 'named'`, which dispatches to a
 * predicate registered on `OntologyRegistry` (same escape hatch
 * pattern as `ActionPrecondition` §3.3 and `BoundaryPredicate` §5.5).
 *
 * Phase 4 ships all discriminants. The `'named'` evaluation is a
 * Phase 1-style stub today (always fails) because
 * `OntologyRegistry.registerPredicate` is still gated; that landing
 * is a separate Phase 4 sliver.
 */
export type SetFilter =
  | {
      readonly op: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge';
      readonly path: string;
      readonly value: string | number | boolean | null;
    }
  | {
      readonly op: 'in';
      readonly path: string;
      readonly values: readonly (string | number | boolean)[];
    }
  | {
      readonly op: 'has';
      readonly path: string;
    }
  | {
      readonly op: 'and' | 'or';
      readonly clauses: readonly SetFilter[];
    }
  | {
      readonly op: 'not';
      readonly clause: SetFilter;
    }
  | {
      readonly op: 'named';
      readonly name: string;
      readonly params?: Readonly<Record<string, unknown>>;
    };

/**
 * Sort order applied after filtering, before pagination.
 */
export interface OrderClause {
  readonly path: string;
  readonly direction: 'asc' | 'desc';
}

/**
 * Named, typed, filterable collection. Registered on
 * `OntologyRegistry` via `registerObjectSet`; consumed by:
 *   - `SlotDef.target = { kind: 'objectSet', name }` to materialize a
 *     collection slot from the named set
 *   - `objectSetRef(name)` inside an `ActionDef.params` Zod schema to
 *     accept the set as a parameter
 *   - direct `OntologyRegistry.getObjectSet(name)` lookup for
 *     introspection
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.9)
 */
export interface ObjectSetDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /** `ObjectTypeDef.apiName` whose instances populate this set. */
  readonly objectType: string;
  /** Filter predicate evaluated by the ManifestAccessor implementation. */
  readonly filter: SetFilter;
  /** Optional ordering applied after filtering, before pagination. */
  readonly orderBy?: readonly OrderClause[];
  /** Optional default page size; consumers may override. */
  readonly defaultLimit?: number;
  /** Natural-language description for Agent consumption. REQUIRED. */
  readonly semantic: string;
}
