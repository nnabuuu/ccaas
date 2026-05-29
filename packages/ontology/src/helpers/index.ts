/**
 * `@kedge-agentic/ontology/helpers` subpath — Phase 1 (core).
 *
 * The `define*` family of type-narrowing passthroughs. Use these at
 * Solution definition sites so the meta sidecar's keys and StateDef's
 * `initial` value are checked against their bound schemas.
 *
 * Phase 4 will add: `defineInterface`, `defineObjectSet`.
 */

export {
  defineObjectType,
  defineAction,
  defineFunction,
  defineManifest,
  defineStateField,
} from './define.js';
