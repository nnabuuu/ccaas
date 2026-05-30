/**
 * Branded Zod helpers for typed cross-object references.
 *
 * `objectRef('Class')` returns a branded `z.string()` — TS sees a
 * narrowed string type (so misassignments are compile errors), and
 * runtime introspection can recover the target ObjectType name via
 * `getObjectRefTarget(schema)`.
 *
 * Phase 1 ships `objectRef`. `objectSetRef` lands in Phase 4 alongside
 * the ObjectSetDef primitive.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.1 — "Reference target" row, §3.6 — usage)
 */

import { z } from 'zod';

/**
 * Internal symbol used as a unique key on a Zod schema's `_def` to
 * stash the target ObjectType name. Using a Symbol (vs a string key)
 * avoids any chance of collision with Zod's own `_def` fields or with
 * other libraries that decorate `_def`.
 */
const OBJECT_REF_TARGET = Symbol.for('@kedge-agentic/ontology/objectRef.target');

/**
 * Companion symbol for `objectSetRef` — same pattern, separate key so
 * a schema branded as an objectRef vs objectSetRef stays
 * distinguishable at runtime.
 */
const OBJECT_SET_REF_TARGET = Symbol.for('@kedge-agentic/ontology/objectSetRef.target');

/**
 * Declare a property as a reference to another ObjectTypeDef.
 *
 * @example
 *   const StudentSchema = z.object({
 *     id: z.string(),
 *     classId: objectRef('Class'),
 *   });
 *
 * The brand on the returned type lets TS catch cross-target
 * misassignments (assigning a `Class`-ref to a `Teacher`-ref field
 * fails to type-check). Runtime introspection via
 * `getObjectRefTarget(schema)` returns `'Class'`.
 */
export function objectRef<T extends string>(target: T) {
  const schema = z.string().brand<`__objectRef:${T}`>();
  // Stash the target name on the schema's _def for runtime introspection.
  // Non-enumerable so it doesn't appear in JSON serialization / debug output
  // by accident.
  Object.defineProperty(schema._def as unknown as Record<symbol, unknown>, OBJECT_REF_TARGET, {
    value: target,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return schema;
}

/**
 * Read the target ObjectType apiName from a schema previously decorated
 * by `objectRef(...)`. Returns `undefined` for any schema that wasn't
 * decorated — including `.optional()` wrappers around an objectRef,
 * which lose the metadata since the wrapper has its own `_def`.
 *
 * Validators (commit 6) use this to confirm every `objectRef('X')` in
 * a registered schema resolves to a registered ObjectType `X`.
 */
export function getObjectRefTarget(schema: z.ZodTypeAny): string | undefined {
  const def = schema._def as unknown as Record<symbol, unknown>;
  const value = def[OBJECT_REF_TARGET];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Declare a property as a reference to a named ObjectSetDef.
 *
 * Mirrors `objectRef` but the brand carries an ObjectSetDef apiName
 * (vs an ObjectTypeDef apiName). Used inside `ActionDef.params` Zod
 * schemas to accept an ObjectSet as a parameter — the runtime
 * introspection via `getObjectSetRefTarget` recovers the apiName for
 * the ManifestAccessor to resolve at invocation time.
 *
 * Phase 4 (Tier 2). Per spec §3.9.
 *
 * @example
 *   const Params = z.object({
 *     targets: objectSetRef('strugglingStudents').describe('students to flag'),
 *     reason: z.string(),
 *   });
 */
export function objectSetRef<T extends string>(target: T) {
  const schema = z.string().brand<`__objectSetRef:${T}`>();
  Object.defineProperty(
    schema._def as unknown as Record<symbol, unknown>,
    OBJECT_SET_REF_TARGET,
    {
      value: target,
      enumerable: false,
      writable: false,
      configurable: false,
    },
  );
  return schema;
}

/**
 * Read the target ObjectSet apiName from a schema previously decorated
 * by `objectSetRef(...)`. Returns `undefined` for any schema that
 * wasn't decorated — including `.optional()` wrappers around an
 * objectSetRef (same caveat as `getObjectRefTarget`).
 */
export function getObjectSetRefTarget(schema: z.ZodTypeAny): string | undefined {
  const def = schema._def as unknown as Record<symbol, unknown>;
  const value = def[OBJECT_SET_REF_TARGET];
  return typeof value === 'string' ? value : undefined;
}
