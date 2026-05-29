/**
 * Canonical serialization of an ontology context.
 *
 * Produces a deterministic, order-independent plain-data
 * representation. Two contexts with the same definitions but in
 * different registration order serialize to byte-equal output.
 *
 * The serialization is intentionally NOT a round-trip format —
 * deserialization back into live Zod schemas isn't supported and
 * isn't needed. The output exists to feed:
 *   1. `computeSchemaDigest()` (immutable identifier for an ontology
 *      version),
 *   2. Distribution wire format (sending schema to a peer that needs
 *      to know what fields exist without executing arbitrary code),
 *   3. Diff tooling (compare two ontologies field-by-field).
 *
 * Zod schemas are projected to JSON Schema via `zod-to-json-schema`.
 * Non-schema fields are walked as plain data with recursive key
 * sorting.
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import type {
  ActionDef,
  FunctionDef,
  LinkDef,
  ObjectTypeDef,
  ValidationContext,
} from '../schema/index.js';
import type { ManifestDef } from '../manifest/index.js';

export interface SerializedObjectType {
  readonly apiName: string;
  readonly displayName: unknown;
  readonly semantic: string;
  readonly schema: unknown;
  readonly meta?: unknown;
  readonly links: readonly SerializedLink[];
  readonly actions: readonly SerializedAction[];
  readonly picker?: unknown;
}

export interface SerializedLink {
  readonly apiName: string;
  readonly displayName: unknown;
  readonly target: string;
  readonly cardinality: string;
  readonly inverse?: string;
  readonly traversable?: boolean;
  readonly semantic: string;
}

export interface SerializedAction {
  readonly apiName: string;
  readonly displayName: unknown;
  readonly params: unknown;
  readonly sideEffects: readonly string[];
  readonly composes?: readonly string[];
  readonly preconditions?: readonly unknown[];
  readonly requiresApproval?: boolean;
  readonly allowedRoles: readonly string[];
  readonly requiredScopes?: readonly string[];
  readonly auditLevel: string;
  readonly semantic: string;
}

export interface SerializedFunction {
  readonly apiName: string;
  readonly displayName: unknown;
  readonly params: unknown;
  readonly returnType: unknown;
  readonly semantic: string;
  readonly allowedRoles: readonly string[];
  readonly requiredScopes?: readonly string[];
}

export interface SerializedManifest {
  readonly name: string;
  readonly displayName: unknown;
  readonly schemaVersion: string;
  readonly semantic: string;
  readonly slots: readonly unknown[];
  readonly streams?: readonly unknown[];
  readonly state: readonly unknown[];
  readonly boundaries: readonly unknown[];
  readonly lifecycle?: unknown;
  readonly inheritParentRole?: boolean;
}

export interface SerializedOntology {
  readonly ontologyVersion: string;
  readonly objectTypes: readonly SerializedObjectType[];
  readonly manifests: readonly SerializedManifest[];
  readonly functions: readonly SerializedFunction[];
}

const ONTOLOGY_VERSION = '0.1.0';

/**
 * Serializes a ValidationContext (typically `registry.context()`) into
 * a canonical plain-data form. Lists are sorted by their primary
 * apiName/name so the output is order-independent.
 */
export function serializeRegistry(ctx: ValidationContext): SerializedOntology {
  const objectTypes = Array.from(ctx.objectTypes.values())
    .sort(byKey('apiName'))
    .map(serializeObjectType);

  const manifests = Array.from(ctx.manifests.values())
    .sort(byKey('name'))
    .map(serializeManifest);

  const functions = ctx.functions
    ? Array.from(ctx.functions.values()).sort(byKey('apiName')).map(serializeFunction)
    : [];

  return {
    ontologyVersion: ONTOLOGY_VERSION,
    objectTypes,
    manifests,
    functions,
  };
}

/**
 * Canonical JSON stringification: object keys recursively sorted so
 * the output is deterministic regardless of insertion order. Use this
 * (not JSON.stringify) when feeding `computeSchemaDigest`.
 */
export function canonicalize(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null) return 'null';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    if (obj[k] === undefined) continue; // omit undefined to match JSON.stringify behavior
    parts.push(JSON.stringify(k) + ':' + canonicalize(obj[k]));
  }
  return '{' + parts.join(',') + '}';
}

// ────────────────────────────────────────────────────────────────────
// Per-def serializers
// ────────────────────────────────────────────────────────────────────

function serializeObjectType(t: ObjectTypeDef): SerializedObjectType {
  return {
    apiName: t.apiName,
    displayName: t.displayName,
    semantic: t.semantic,
    schema: jsonSchemaOf(t.schema),
    meta: t.meta,
    links: [...t.links].sort(byKey('apiName')).map(serializeLink),
    actions: [...t.actions].sort(byKey('apiName')).map(serializeAction),
    picker: t.picker,
  };
}

function serializeLink(l: LinkDef): SerializedLink {
  return {
    apiName: l.apiName,
    displayName: l.displayName,
    target: l.target,
    cardinality: l.cardinality,
    inverse: l.inverse,
    traversable: l.traversable,
    semantic: l.semantic,
  };
}

function serializeAction(a: ActionDef): SerializedAction {
  return {
    apiName: a.apiName,
    displayName: a.displayName,
    params: jsonSchemaOf(a.params),
    sideEffects: [...a.sideEffects].sort(),
    composes: a.composes ? [...a.composes].sort() : undefined,
    // Preconditions are AND-combined (spec §3.3), so list order is
    // semantically irrelevant. Sort by canonical-JSON of each entry
    // so two registries with the same set in different order produce
    // byte-equal output and thus equal digests.
    preconditions: a.preconditions
      ? [...a.preconditions].sort(byCanonical)
      : undefined,
    requiresApproval: a.requiresApproval,
    allowedRoles: [...a.allowedRoles].sort(),
    requiredScopes: a.requiredScopes ? [...a.requiredScopes].sort() : undefined,
    auditLevel: a.auditLevel,
    semantic: a.semantic,
  };
}

function byCanonical(x: unknown, y: unknown): number {
  const a = canonicalize(x);
  const b = canonicalize(y);
  return a < b ? -1 : a > b ? 1 : 0;
}

function serializeFunction(f: FunctionDef): SerializedFunction {
  return {
    apiName: f.apiName,
    displayName: f.displayName,
    params: jsonSchemaOf(f.params),
    returnType: jsonSchemaOf(f.returnType),
    semantic: f.semantic,
    allowedRoles: [...f.allowedRoles].sort(),
    requiredScopes: f.requiredScopes ? [...f.requiredScopes].sort() : undefined,
  };
}

function serializeManifest(m: ManifestDef): SerializedManifest {
  return {
    name: m.name,
    displayName: m.displayName,
    schemaVersion: m.schemaVersion,
    semantic: m.semantic,
    slots: [...m.slots].sort(byKey('apiName')),
    streams: m.streams ? [...m.streams].sort(byKey('apiName')) : undefined,
    state: [...m.state].sort(byKey('apiName')),
    boundaries: [...m.boundaries].sort(byKey('role')),
    lifecycle: m.lifecycle,
    inheritParentRole: m.inheritParentRole,
  };
}

// ────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────

function jsonSchemaOf(schema: z.ZodTypeAny): unknown {
  return zodToJsonSchema(schema, { $refStrategy: 'none' });
}

function byKey<K extends string>(key: K) {
  return (a: Record<K, string>, b: Record<K, string>): number => {
    if (a[key] < b[key]) return -1;
    if (a[key] > b[key]) return 1;
    return 0;
  };
}
