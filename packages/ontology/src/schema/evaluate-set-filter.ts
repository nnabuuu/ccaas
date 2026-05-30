/**
 * Pure evaluation of a `SetFilter` against a single row.
 *
 * Phase 4 (Tier 2 — partial). Recursive over the small first-order
 * language: comparison ops (`eq` / `ne` / `lt` / `le` / `gt` / `ge`),
 * collection ops (`in`, `has`), boolean ops (`and` / `or` / `not`),
 * and a `named` escape hatch.
 *
 * No I/O. No side effects. Single source of truth so the live
 * `ManifestAccessor` impl (Phase 3 / 4 follow-up), the
 * `OntologyRegistry`'s projection serializer, and downstream tests
 * agree on what a filter computes.
 *
 * Path semantics: dot-paths walk plain `Record<string, unknown>`
 * structures. `'mastery'` reads `row.mastery`; `'class.name'` reads
 * `row.class?.name`. Walking through `null` / `undefined` returns
 * `undefined` (no NPE). Type coercion is intentionally avoided —
 * `eq` does `Object.is`, so `'5'` and `5` are not equal.
 *
 * The `named` op is a Phase 1-style fail-safe stub today: it always
 * evaluates to `false` because `OntologyRegistry.registerPredicate`
 * is still gated. A later Phase 4 sliver lights this up.
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§3.9)
 */

import type { SetFilter } from './object-set.js';

export type FilterRow = Readonly<Record<string, unknown>>;

/**
 * Evaluate `filter` against `row`. Returns true iff the row matches.
 *
 * Pure. Idempotent. Safe to call concurrently against the same filter.
 */
export function evaluateSetFilter(filter: SetFilter, row: FilterRow): boolean {
  switch (filter.op) {
    case 'eq':
      return Object.is(resolvePath(row, filter.path), filter.value);
    case 'ne':
      return !Object.is(resolvePath(row, filter.path), filter.value);
    case 'lt':
      return compareNumbers(resolvePath(row, filter.path), filter.value) < 0;
    case 'le':
      return compareNumbers(resolvePath(row, filter.path), filter.value) <= 0;
    case 'gt':
      return compareNumbers(resolvePath(row, filter.path), filter.value) > 0;
    case 'ge':
      return compareNumbers(resolvePath(row, filter.path), filter.value) >= 0;
    case 'in': {
      const v = resolvePath(row, filter.path);
      return filter.values.some((candidate) => Object.is(candidate, v));
    }
    case 'has': {
      const v = resolvePath(row, filter.path);
      return v !== undefined && v !== null;
    }
    case 'and':
      return filter.clauses.every((c) => evaluateSetFilter(c, row));
    case 'or':
      return filter.clauses.some((c) => evaluateSetFilter(c, row));
    case 'not':
      return !evaluateSetFilter(filter.clause, row);
    case 'named':
      // Phase 1-style stub. Named-predicate registry is still gated;
      // until it lands, every named precondition evaluates to "not
      // matched" so a filter referencing one fails closed.
      return false;
    default: {
      // Exhaustiveness — any future SetFilter variant added without a
      // case here trips the `never`-assignment compile error.
      const _exhaustive: never = filter;
      void _exhaustive;
      return false;
    }
  }
}

/**
 * Walk a dot-path against an opaque object. Returns `undefined` for
 * missing segments or when intermediate values are `null`/`undefined`
 * — never throws.
 */
function resolvePath(row: FilterRow, path: string): unknown {
  const segments = path.split('.');
  let cur: unknown = row;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Numeric comparison helper. Returns:
 *   - negative if a < b
 *   - 0       if a === b OR either side is not a finite number
 *   - positive if a > b
 *
 * Non-number operands collapse to 0 instead of throwing because
 * `evaluateSetFilter` is called as a predicate — returning 0 means
 * "comparison is not meaningful," which makes lt/gt return false
 * (matching the fail-closed convention used by the `named` stub).
 */
function compareNumbers(a: unknown, b: unknown): number {
  if (typeof a !== 'number' || typeof b !== 'number') return 0;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return a - b;
}
