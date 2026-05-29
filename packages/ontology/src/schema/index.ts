/**
 * `@kedge-agentic/ontology/schema` subpath — Phase 1 (core + Tier 1).
 *
 * Importable shapes for declaring typed business objects, actions,
 * functions, links, and event streams. The Zod schema attached to each
 * `ObjectTypeDef` / `ActionDef` / `FunctionDef` is the source of truth
 * for field shapes; this subpath provides the surrounding governance +
 * presentation primitives.
 */

export type { LocalizedString } from './localized-string.js';
export type { PropertyMeta, PropertyMetaMap } from './property-meta.js';
export { objectRef, getObjectRefTarget } from './zod-helpers.js';
export type { LinkDef, LinkCardinality } from './link.js';
export type {
  ActionDef,
  ActionPrecondition,
  ApiKeyScopeLiteral,
  AuditLevel,
} from './action.js';
export type { FunctionDef } from './function.js';
export type { ObjectTypeDef, PickerConfig } from './object-type.js';
export type { StreamDef } from './stream.js';
