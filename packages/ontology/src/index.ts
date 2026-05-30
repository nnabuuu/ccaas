/**
 * `@kedge-agentic/ontology` — Phase 1 (v0.1.0) catch-all entry.
 *
 * Prefer subpath imports for new code:
 *   import { ObjectTypeDef } from '@kedge-agentic/ontology/schema';
 *   import { ManifestDef } from '@kedge-agentic/ontology/manifest';
 *   import { OntologyRegistry } from '@kedge-agentic/ontology/registry';
 *
 * This barrel re-exports everything from the subpaths for convenience.
 * Subsequent commits in Phase 1 will populate the rest of the
 * subpaths (manifest, accessor, registry, helpers, semantic,
 * distribution). See `docs/ontology/PROGRESS.md` for status.
 */

export const ONTOLOGY_VERSION = '0.1.0';

// Cross-layer type aliases
export type { BoundaryRole } from './types.js';

// Schema subpath
export type {
  LocalizedString,
  PropertyMeta,
  PropertyMetaMap,
  LinkDef,
  LinkCardinality,
  ActionDef,
  ActionPrecondition,
  ApiKeyScopeLiteral,
  AuditLevel,
  FunctionDef,
  ObjectTypeDef,
  PickerConfig,
  StreamDef,
  ObjectSetDef,
  SetFilter,
  OrderClause,
} from './schema/index.js';
export {
  objectRef,
  getObjectRefTarget,
  objectSetRef,
  getObjectSetRefTarget,
  evaluateSetFilter,
  type FilterRow,
} from './schema/index.js';

// Validators + RegistrationError
export type {
  ValidationCode,
  ValidationError,
  ValidationContext,
} from './schema/index.js';
export {
  validateObjectType,
  validateObjectTypeLocal,
  validateManifest,
  validateFunction,
  validateAll,
  RegistrationError,
} from './schema/index.js';

// Manifest subpath
export type {
  SlotDef,
  SlotTarget,
  StateDef,
  AccessBoundary,
  LifecycleDef,
  ManifestDef,
  SchemaVersion,
} from './manifest/index.js';

// Accessor subpath
export type {
  ActionResult,
  ActionErrorCode,
  StateChange,
  BoundaryDecision,
  BoundaryCheckInput,
  BoundaryOp,
  ManifestAccessor,
  ActionDescriptor,
} from './accessor/index.js';
export { checkBoundary } from './accessor/index.js';

// Helpers subpath
export {
  defineObjectType,
  defineAction,
  defineFunction,
  defineManifest,
  defineStateField,
  defineObjectSet,
} from './helpers/index.js';

// Registry subpath
export { OntologyRegistry } from './registry/index.js';

// Distribution subpath
export {
  serializeRegistry,
  canonicalize,
  computeSchemaDigest,
  type SerializedOntology,
  type SerializedObjectType,
  type SerializedLink,
  type SerializedAction,
  type SerializedFunction,
  type SerializedManifest,
} from './distribution/index.js';

// Semantic subpath
export {
  projectManifest,
  projectAsAnthropicTools,
  projectAsMcpTools,
  projectAsSystemPrompt,
  type ProjectionFormat,
  type ProjectionInput,
  type ProjectionResult,
  type AnthropicTool,
  type McpTool,
} from './semantic/index.js';
