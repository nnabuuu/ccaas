/**
 * Registration-time invariants for the ontology. Spec §9.7.
 *
 * Pure functions that take definitions (+ optional cross-def context)
 * and return a list of `ValidationError`s. An empty list means
 * everything is valid. The registry (commit 7) calls these on every
 * `register*` and on cascade re-validation when a referenced def is
 * registered late.
 *
 * Phase 1 ships the Tier 1 subset:
 *
 *   - SEMANTIC_EMPTY            — every def's `semantic` is non-empty
 *   - META_KEY_UNKNOWN          — ObjectTypeDef.meta keys must be
 *                                 schema fields (caught by TS at the
 *                                 helper site too; this is the runtime
 *                                 safety net for deserialized defs)
 *   - WILDCARD_OUTSIDE_ADMIN    — '*' in readable/writable/actions/
 *                                 subscribes only allowed for role
 *                                 'admin' (policy guard against
 *                                 accidental grants)
 *   - STREAM_PAYLOAD_EXCLUSIVE  — exactly one of payloadType /
 *                                 payloadSchema must be set
 *   - LINK_TARGET_UNRESOLVED    — LinkDef.target must resolve to a
 *                                 registered ObjectType
 *   - SLOT_TARGET_UNRESOLVED    — SlotDef.target.apiName / .name must
 *                                 resolve to a registered ObjectType
 *                                 (objectType kind) or Manifest
 *                                 (manifest kind)
 *   - DERIVED_FROM_UNRESOLVED   — SlotDef.derivedFrom dot-path must
 *                                 resolve via slot-graph traversal
 *   - LIFECYCLE_ACTION_UNRESOLVED — each LifecycleDef hook apiName must
 *                                   resolve to an ActionDef on a
 *                                   slot-bound ObjectType
 *   - PRECONDITION_STATE_UNRESOLVED — stateEquals.path must resolve to
 *                                     a manifest state field
 *   - PRECONDITION_SLOT_UNRESOLVED  — slotBound.slot must resolve to a
 *                                     manifest slot apiName
 *   - PRECONDITION_NAMED_UNSUPPORTED — Phase 1 stub; named-predicate
 *                                      registry lands in Phase 4
 *
 * Each validator is pure and stateless — no I/O, no mutation. Cross-
 * def validators take a `ValidationContext` so they can resolve
 * references without owning a registry handle.
 *
 * @see ../../../docs/ontology/kedge-ontology-design.md (§9.7)
 */

import type { ActionDef, ActionPrecondition } from './action.js';
import type { FunctionDef } from './function.js';
import type { LinkDef } from './link.js';
import type { ObjectTypeDef } from './object-type.js';
import type { StreamDef } from './stream.js';
import type {
  AccessBoundary,
  LifecycleDef,
  ManifestDef,
  SlotDef,
} from '../manifest/index.js';
import { getObjectRefTarget } from './zod-helpers.js';

export type ValidationCode =
  | 'SEMANTIC_EMPTY'
  | 'META_KEY_UNKNOWN'
  | 'WILDCARD_OUTSIDE_ADMIN'
  | 'STREAM_PAYLOAD_EXCLUSIVE'
  | 'LINK_TARGET_UNRESOLVED'
  | 'SLOT_TARGET_UNRESOLVED'
  | 'DERIVED_FROM_UNRESOLVED'
  | 'LIFECYCLE_ACTION_UNRESOLVED'
  | 'PRECONDITION_STATE_UNRESOLVED'
  | 'PRECONDITION_SLOT_UNRESOLVED'
  | 'PRECONDITION_NAMED_UNSUPPORTED'
  | 'DUPLICATE_DEFINITION';

export interface ValidationError {
  readonly code: ValidationCode;
  readonly message: string;
  /** Hierarchical path locating the issue, e.g. `Manifest:X.slots[0].target`. */
  readonly path: string;
}

export interface ValidationContext {
  readonly objectTypes: ReadonlyMap<string, ObjectTypeDef>;
  readonly manifests: ReadonlyMap<string, ManifestDef>;
  readonly functions?: ReadonlyMap<string, FunctionDef>;
}

// ────────────────────────────────────────────────────────────────────
// Local validators — no cross-def lookup required
// ────────────────────────────────────────────────────────────────────

/** Validates one ObjectTypeDef in isolation (no link/action target resolution). */
export function validateObjectTypeLocal(
  t: ObjectTypeDef,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const base = `ObjectType:${t.apiName}`;

  if (!t.semantic || t.semantic.trim().length === 0) {
    errors.push({
      code: 'SEMANTIC_EMPTY',
      message: 'ObjectTypeDef.semantic is required and must be non-empty',
      path: base,
    });
  }

  // Meta keys vs schema fields. TS catches this at the helper site;
  // this is the runtime safety net for defs that bypass the helpers
  // (e.g. deserialized from JSON, programmatically constructed).
  if (t.meta) {
    const schemaShape = t.schema.shape;
    const schemaKeys = new Set(Object.keys(schemaShape));
    for (const metaKey of Object.keys(t.meta)) {
      if (!schemaKeys.has(metaKey)) {
        errors.push({
          code: 'META_KEY_UNKNOWN',
          message: `meta key '${metaKey}' is not a field on the schema`,
          path: `${base}.meta.${metaKey}`,
        });
      }
    }
  }

  // Per-action local: semantic non-empty
  for (let i = 0; i < t.actions.length; i++) {
    const a = t.actions[i];
    if (!a.semantic || a.semantic.trim().length === 0) {
      errors.push({
        code: 'SEMANTIC_EMPTY',
        message: 'ActionDef.semantic is required and must be non-empty',
        path: `${base}.actions[${i}]:${a.apiName}`,
      });
    }
  }

  // Per-link local: semantic non-empty
  for (let i = 0; i < t.links.length; i++) {
    const l = t.links[i];
    if (!l.semantic || l.semantic.trim().length === 0) {
      errors.push({
        code: 'SEMANTIC_EMPTY',
        message: 'LinkDef.semantic is required and must be non-empty',
        path: `${base}.links[${i}]:${l.apiName}`,
      });
    }
  }

  return errors;
}

/** Validates one FunctionDef in isolation. */
export function validateFunction(f: FunctionDef): ValidationError[] {
  const errors: ValidationError[] = [];
  const base = `Function:${f.apiName}`;
  if (!f.semantic || f.semantic.trim().length === 0) {
    errors.push({
      code: 'SEMANTIC_EMPTY',
      message: 'FunctionDef.semantic is required and must be non-empty',
      path: base,
    });
  }
  return errors;
}

/** Validates one StreamDef in isolation (used by manifest-level walk). */
function validateStreamLocal(
  s: StreamDef,
  ownerPath: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `${ownerPath}.streams:${s.apiName}`;
  if (!s.semantic || s.semantic.trim().length === 0) {
    errors.push({
      code: 'SEMANTIC_EMPTY',
      message: 'StreamDef.semantic is required and must be non-empty',
      path,
    });
  }
  const hasType = s.payloadType !== undefined;
  const hasSchema = s.payloadSchema !== undefined;
  if (hasType === hasSchema) {
    errors.push({
      code: 'STREAM_PAYLOAD_EXCLUSIVE',
      message:
        'StreamDef must set exactly one of payloadType or payloadSchema',
      path,
    });
  }
  return errors;
}

/** Validates AccessBoundary list for the `'*'`-only-on-admin policy. */
function validateBoundaries(
  boundaries: readonly AccessBoundary[],
  ownerPath: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];
    if (b.role === 'admin') continue;
    const fields: ReadonlyArray<['readable' | 'writable' | 'actions' | 'subscribes', readonly string[] | undefined]> = [
      ['readable', b.readable],
      ['writable', b.writable],
      ['actions', b.actions],
      ['subscribes', b.subscribes],
    ];
    for (const [name, list] of fields) {
      if (list && list.includes('*')) {
        errors.push({
          code: 'WILDCARD_OUTSIDE_ADMIN',
          message: `'*' wildcard only allowed for role 'admin'; found in '${b.role}'.${name}`,
          path: `${ownerPath}.boundaries[${i}]:${b.role}.${name}`,
        });
      }
    }
  }
  return errors;
}

// ────────────────────────────────────────────────────────────────────
// Cross-def validators — require a ValidationContext
// ────────────────────────────────────────────────────────────────────

/** Full ObjectTypeDef walk: local + link target resolution. */
export function validateObjectType(
  t: ObjectTypeDef,
  ctx: ValidationContext,
): ValidationError[] {
  const errors = validateObjectTypeLocal(t);
  const base = `ObjectType:${t.apiName}`;

  for (let i = 0; i < t.links.length; i++) {
    const l: LinkDef = t.links[i];
    if (!ctx.objectTypes.has(l.target)) {
      errors.push({
        code: 'LINK_TARGET_UNRESOLVED',
        message: `LinkDef.target '${l.target}' does not resolve to a registered ObjectType`,
        path: `${base}.links[${i}]:${l.apiName}.target`,
      });
    }
  }

  // Schema-level objectRef brand resolution.
  // Walk the top-level schema shape; any branded field's target must
  // resolve. Phase 1 only inspects the top level (not nested objects /
  // arrays of refs); that covers the common case and keeps the
  // implementation honest about its current scope.
  const shape = t.schema.shape;
  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const target = getObjectRefTarget(fieldSchema);
    if (target && !ctx.objectTypes.has(target)) {
      errors.push({
        code: 'LINK_TARGET_UNRESOLVED',
        message: `objectRef('${target}') on field '${fieldName}' does not resolve to a registered ObjectType`,
        path: `${base}.schema.${fieldName}`,
      });
    }
  }

  return errors;
}

/** Full ManifestDef walk: local + slot/stream/boundary/lifecycle/precondition resolution. */
export function validateManifest(
  m: ManifestDef,
  ctx: ValidationContext,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const base = `Manifest:${m.name}`;

  if (!m.semantic || m.semantic.trim().length === 0) {
    errors.push({
      code: 'SEMANTIC_EMPTY',
      message: 'ManifestDef.semantic is required and must be non-empty',
      path: base,
    });
  }

  // Slot target + derivedFrom resolution
  const slotApiNames = new Set(m.slots.map((s) => s.apiName));
  for (let i = 0; i < m.slots.length; i++) {
    const slot = m.slots[i];
    errors.push(...validateSlot(slot, i, m, ctx, slotApiNames));
  }

  // Stream local checks
  for (const s of m.streams ?? []) {
    errors.push(...validateStreamLocal(s, base));
  }

  // State semantic non-empty
  for (let i = 0; i < m.state.length; i++) {
    const f = m.state[i];
    if (!f.semantic || f.semantic.trim().length === 0) {
      errors.push({
        code: 'SEMANTIC_EMPTY',
        message: 'StateDef.semantic is required and must be non-empty',
        path: `${base}.state[${i}]:${f.apiName}`,
      });
    }
  }

  // Boundary wildcard policy
  errors.push(...validateBoundaries(m.boundaries, base));

  // Lifecycle hook resolution
  if (m.lifecycle) {
    errors.push(...validateLifecycle(m.lifecycle, m, ctx, base));
  }

  // Precondition resolution: each slot-bound ObjectType's actions can
  // carry preconditions that reference state.path / slot apiNames on
  // THIS manifest. Walk them.
  const stateApiNames = new Set(m.state.map((f) => f.apiName));
  for (const slot of m.slots) {
    if (slot.target.kind !== 'objectType') continue;
    const ot = ctx.objectTypes.get(slot.target.apiName);
    if (!ot) continue; // SLOT_TARGET_UNRESOLVED already reported
    for (let ai = 0; ai < ot.actions.length; ai++) {
      const action = ot.actions[ai];
      errors.push(
        ...validateActionPreconditions(
          action,
          stateApiNames,
          slotApiNames,
          `${base}.slots:${slot.apiName}.actions[${ai}]:${action.apiName}`,
        ),
      );
    }
  }

  return errors;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function validateSlot(
  slot: SlotDef,
  i: number,
  m: ManifestDef,
  ctx: ValidationContext,
  slotApiNames: ReadonlySet<string>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `Manifest:${m.name}.slots[${i}]:${slot.apiName}`;

  if (!slot.semantic || slot.semantic.trim().length === 0) {
    errors.push({
      code: 'SEMANTIC_EMPTY',
      message: 'SlotDef.semantic is required and must be non-empty',
      path,
    });
  }

  // Target resolution
  if (slot.target.kind === 'objectType') {
    if (!ctx.objectTypes.has(slot.target.apiName)) {
      errors.push({
        code: 'SLOT_TARGET_UNRESOLVED',
        message: `SlotDef.target objectType '${slot.target.apiName}' does not resolve to a registered ObjectType`,
        path: `${path}.target`,
      });
    }
  } else if (slot.target.kind === 'manifest') {
    if (!ctx.manifests.has(slot.target.name)) {
      errors.push({
        code: 'SLOT_TARGET_UNRESOLVED',
        message: `SlotDef.target manifest '${slot.target.name}' does not resolve to a registered Manifest`,
        path: `${path}.target`,
      });
    }
  }

  // derivedFrom: must reference another slot on THIS manifest (head),
  // and the head must be a non-collection slot whose target type has a
  // link with the trailing apiName. Phase 1 only checks the head.
  if (slot.derivedFrom) {
    const head = slot.derivedFrom.split('.')[0];
    if (!slotApiNames.has(head)) {
      errors.push({
        code: 'DERIVED_FROM_UNRESOLVED',
        message: `SlotDef.derivedFrom '${slot.derivedFrom}' head '${head}' is not a slot on this manifest`,
        path: `${path}.derivedFrom`,
      });
    }
  }

  return errors;
}

function validateLifecycle(
  lifecycle: LifecycleDef,
  m: ManifestDef,
  ctx: ValidationContext,
  base: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const knownActions = new Set<string>();
  for (const slot of m.slots) {
    if (slot.target.kind !== 'objectType') continue;
    const ot = ctx.objectTypes.get(slot.target.apiName);
    if (!ot) continue;
    for (const a of ot.actions) knownActions.add(a.apiName);
  }
  const hooks: ReadonlyArray<['onActivate' | 'onDeactivate' | 'onSlotChange' | 'onStateChange', string | undefined]> = [
    ['onActivate', lifecycle.onActivate],
    ['onDeactivate', lifecycle.onDeactivate],
    ['onSlotChange', lifecycle.onSlotChange],
    ['onStateChange', lifecycle.onStateChange],
  ];
  for (const [name, apiName] of hooks) {
    if (apiName && !knownActions.has(apiName)) {
      errors.push({
        code: 'LIFECYCLE_ACTION_UNRESOLVED',
        message: `lifecycle.${name} '${apiName}' does not resolve to an ActionDef on any slot-bound ObjectType`,
        path: `${base}.lifecycle.${name}`,
      });
    }
  }
  return errors;
}

function validateActionPreconditions(
  action: ActionDef,
  stateApiNames: ReadonlySet<string>,
  slotApiNames: ReadonlySet<string>,
  basePath: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const preconditions = action.preconditions ?? [];
  for (let i = 0; i < preconditions.length; i++) {
    const pc: ActionPrecondition = preconditions[i];
    const path = `${basePath}.preconditions[${i}]`;
    switch (pc.kind) {
      case 'stateEquals': {
        // Path's head must be a known state field. Sub-paths are
        // permitted as a forward-compat shape (Phase 1 evaluator only
        // direct-keys, so a sub-path will fail-safe at runtime — but
        // the schema accepts them).
        const head = pc.path.split('.')[0];
        if (!stateApiNames.has(head)) {
          errors.push({
            code: 'PRECONDITION_STATE_UNRESOLVED',
            message: `stateEquals.path '${pc.path}' head '${head}' is not a state field on this manifest`,
            path,
          });
        }
        break;
      }
      case 'slotBound': {
        if (!slotApiNames.has(pc.slot)) {
          errors.push({
            code: 'PRECONDITION_SLOT_UNRESOLVED',
            message: `slotBound.slot '${pc.slot}' is not a slot on this manifest`,
            path,
          });
        }
        break;
      }
      case 'named': {
        errors.push({
          code: 'PRECONDITION_NAMED_UNSUPPORTED',
          message: `named precondition '${pc.name}' — registerPredicate lands in Phase 4`,
          path,
        });
        break;
      }
    }
  }
  return errors;
}

// ────────────────────────────────────────────────────────────────────
// Aggregate
// ────────────────────────────────────────────────────────────────────

/**
 * Validates every def in the context. Returns the aggregated error
 * list. Callers convert to `RegistrationError` when they want to
 * throw.
 */
export function validateAll(ctx: ValidationContext): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const t of ctx.objectTypes.values()) {
    errors.push(...validateObjectType(t, ctx));
  }
  for (const m of ctx.manifests.values()) {
    errors.push(...validateManifest(m, ctx));
  }
  if (ctx.functions) {
    for (const f of ctx.functions.values()) {
      errors.push(...validateFunction(f));
    }
  }
  return errors;
}
