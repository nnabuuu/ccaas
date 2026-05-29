/**
 * `StreamDef` is a first-class push event stream declared on a
 * `ManifestDef`. Distinct from `SlotDef` because its semantics are
 * subscribe-only (push), not read-once (pull). See spec §9.3 for the
 * design rationale.
 *
 * Each stream carries its event payload as either:
 *   - `payloadType`: the apiName of an `ObjectType` whose Zod schema
 *     defines the payload shape (use this when events are also
 *     persisted as first-class objects)
 *   - `payloadSchema`: an inline Zod schema (use this for ephemeral
 *     payloads not persisted as ObjectTypes — e.g. progress ticks)
 *
 * Exactly one of the two must be set; validators enforce.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.5)
 */

import type { z } from 'zod';
import type { LocalizedString } from './localized-string.js';

export interface StreamDef {
  readonly apiName: string;
  readonly displayName: LocalizedString;

  /**
   * `ObjectTypeDef.apiName` of the event payload. Use for streams
   * whose events are also persisted as first-class objects.
   */
  readonly payloadType?: string;

  /**
   * Inline payload Zod schema, for streams whose events are NOT
   * persisted as standalone ObjectTypes (e.g. ephemeral progress
   * ticks). Exactly one of `payloadType` or `payloadSchema` must be
   * set; validators enforce.
   */
  readonly payloadSchema?: z.ZodTypeAny;

  /**
   * What this stream emits, when, and what subscribers should do.
   * REQUIRED.
   */
  readonly semantic: string;

  /**
   * Backpressure hint for the runtime. `'drop_oldest'` is the
   * recommended default for high-volume observability streams (e.g.
   * the GLM classroom-observation event stream).
   */
  readonly backpressure?: 'drop_oldest' | 'block_producer' | 'unbounded';
}
