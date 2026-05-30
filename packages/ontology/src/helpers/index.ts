/**
 * `@kedge-agentic/ontology/helpers` subpath.
 *
 * The `define*` family of type-narrowing passthroughs. Use these at
 * Solution definition sites so the meta sidecar's keys and StateDef's
 * `initial` value are checked against their bound schemas.
 *
 * Phase 4 (Tier 2 — partial) added `defineObjectSet`. `defineInterface`
 * still pending until the Interface primitive lands.
 */

export {
  defineObjectType,
  defineAction,
  defineFunction,
  defineManifest,
  defineStateField,
  defineObjectSet,
} from './define.js';
