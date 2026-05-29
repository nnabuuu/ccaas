/**
 * `StateDef` describes a manifest-level state field — the kind of
 * runtime data that doesn't belong to any individual object but
 * tracks the operational context's progression (current teaching
 * phase, active resource index, intervention-pause flag, etc.).
 *
 * Zod-backed: the schema declares the value's type, and the initial
 * value is type-checked against it. Per-state semantic description is
 * REQUIRED — `.describe()` on the schema documents what a single
 * value means; `semantic` here documents *when state changes happen*.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§4.3)
 */

import type { z } from 'zod';
import type { LocalizedString } from '../schema/index.js';

export interface StateDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly apiName: string;
  readonly displayName: LocalizedString;
  /**
   * Zod schema for this state field. Use combinators directly:
   *   `z.enum(['waiting', 'practice', 'discuss'])`
   *   `z.boolean()`
   *   `z.string().nullable()`
   *   `z.number().int().min(0)`
   *
   * Per-value semantic description via `.describe()` on the schema is
   * allowed but `semantic` below is still required (it describes
   * *when state changes happen*, which is different from what a
   * single value means).
   */
  readonly schema: S;
  /** Initial value when the manifest activates. Type-checked against `schema`. */
  readonly initial: z.infer<S>;
  /** What this state field means and when it changes. REQUIRED. */
  readonly semantic: string;
}
