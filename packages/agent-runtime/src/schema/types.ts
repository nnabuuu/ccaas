/**
 * Schema sub-module — Phase 0 interface skeleton.
 *
 * A `SchemaRegistry` maps a `schemaId` (e.g. "manifest-v1") to a
 * `SchemaValidator`. Concrete adapters land in Phase 1 (Zod first,
 * JSON Schema second).
 *
 * **v0 — these interfaces will likely change as Phase 1 impls are
 * built. Don't depend on the shape externally until v1.**
 *
 * Why the validator returns a discriminated union instead of
 * throwing: edit-paths want to test validity *before* persisting,
 * and a thrown exception is harder to fold into an `EditResult`.
 */

export type ValidationResult<T = unknown> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export interface SchemaValidator<T = unknown> {
  validate(value: unknown): ValidationResult<T>;
}

export interface SchemaRegistry {
  register(schemaId: string, validator: SchemaValidator): void;
  get(schemaId: string): SchemaValidator | undefined;
  /** Convenience: registry-wide validate. Returns ok:false if schemaId not found. */
  validate(schemaId: string, value: unknown): ValidationResult;
}
