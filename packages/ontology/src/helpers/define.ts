/**
 * `define*` helpers — thin type-narrowing passthroughs.
 *
 * Each helper accepts a definition object and returns it unchanged.
 * The value lives entirely in TypeScript's inference: callers get
 * autocomplete + structural checking from the generic constraint,
 * without runtime overhead.
 *
 * Why a no-op function instead of just typing the literal:
 *
 *   1. `defineObjectType` carries `<S extends ZodObject<...>>`, which
 *      makes the `meta` sidecar's keys type-check against the schema's
 *      inferred shape. Without the helper, callers would have to
 *      explicitly annotate `ObjectTypeDef<typeof schema>` at every
 *      definition site.
 *   2. `defineStateField` narrows the `initial` value's type to
 *      `z.infer<typeof schema>` so a state field declared with
 *      `z.enum(['waiting', 'practice'])` can only accept those two
 *      literal strings as `initial`.
 *   3. Helpers are the natural call site for future Phase 1+ static
 *      asserts (e.g. validating `displayName` non-empty at compile
 *      time via template-literal checks). No such checks land in
 *      Phase 1, but having the funnel exists is what lets them land
 *      later without a churn-y consumer migration.
 *
 * Runtime validation (registration-time invariants from spec §9.7)
 * is the registry's job — not the helpers'. These functions trust
 * their inputs and let the registry reject misshapen defs at register
 * time.
 *
 * Phase 4/5 helpers absent: `defineInterface`, `defineObjectSet` (Phase
 * 4); no Phase 5 helpers planned beyond extensions to the existing
 * ones.
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§6 Registry / §9.7 invariants)
 */

import type { z } from 'zod';
import type {
  ActionDef,
  FunctionDef,
  ObjectTypeDef,
} from '../schema/index.js';
import type { ManifestDef, StateDef } from '../manifest/index.js';

/** Narrow an ObjectTypeDef literal to its schema's exact shape. */
export function defineObjectType<S extends z.ZodObject<z.ZodRawShape>>(
  def: ObjectTypeDef<S>,
): ObjectTypeDef<S> {
  return def;
}

/** Passthrough for ActionDef literals (no schema-bound generic needed). */
export function defineAction(def: ActionDef): ActionDef {
  return def;
}

/** Passthrough for FunctionDef literals. */
export function defineFunction(def: FunctionDef): FunctionDef {
  return def;
}

/** Passthrough for ManifestDef literals. */
export function defineManifest(def: ManifestDef): ManifestDef {
  return def;
}

/**
 * Narrows `initial` to `z.infer<typeof def.schema>`. Mis-typed initial
 * values (e.g. `initial: 'unknown'` against `z.enum(['a','b'])`) are
 * compile errors at the call site.
 *
 * The generic is constrained loosely (`ZodTypeAny`) because state
 * fields legitimately use non-object schemas (`z.enum(...)`,
 * `z.boolean()`, `z.string().nullable()`).
 */
export function defineStateField<S extends z.ZodTypeAny>(def: {
  readonly apiName: string;
  readonly displayName: StateDef['displayName'];
  readonly schema: S;
  readonly initial: z.infer<S>;
  readonly semantic: string;
}): StateDef {
  return def;
}
