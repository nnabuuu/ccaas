/**
 * Validator coverage — one (or more) cases per ValidationCode in the
 * Tier 1 subset. Spec §9.7.
 *
 * Each describe block targets a single code so it's easy to read which
 * invariants are covered. Negative tests assert the code surfaces;
 * positive tests assert the same shape passes when the violation is
 * removed.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ActionDef } from '../action.js';
import type { FunctionDef } from '../function.js';
import type { ObjectTypeDef } from '../object-type.js';
import type { ManifestDef } from '../../manifest/index.js';
import {
  validateAll,
  validateFunction,
  validateManifest,
  validateObjectType,
  validateObjectTypeLocal,
  type ValidationContext,
  type ValidationError,
} from '../validators.js';
import { objectRef } from '../zod-helpers.js';
import { RegistrationError } from '../registration-error.js';

function codes(errors: readonly ValidationError[]): string[] {
  return errors.map((e) => e.code);
}

function objectType(overrides: Partial<ObjectTypeDef> = {}): ObjectTypeDef {
  return {
    apiName: 'Student',
    displayName: '学生',
    semantic: 'A learner.',
    schema: z.object({ id: z.string(), name: z.string() }),
    links: [],
    actions: [],
    ...overrides,
  };
}

function manifest(overrides: Partial<ManifestDef> = {}): ManifestDef {
  return {
    name: 'M',
    displayName: 'M',
    schemaVersion: '0.1.0',
    semantic: 'a manifest',
    slots: [],
    state: [],
    boundaries: [],
    ...overrides,
  };
}

function ctxFromArrays(args: {
  objectTypes?: ObjectTypeDef[];
  manifests?: ManifestDef[];
  functions?: FunctionDef[];
}): ValidationContext {
  return {
    objectTypes: new Map((args.objectTypes ?? []).map((t) => [t.apiName, t])),
    manifests: new Map((args.manifests ?? []).map((m) => [m.name, m])),
    functions: new Map((args.functions ?? []).map((f) => [f.apiName, f])),
  };
}

describe('SEMANTIC_EMPTY', () => {
  it('flags empty ObjectType.semantic', () => {
    const errors = validateObjectTypeLocal(objectType({ semantic: '' }));
    expect(codes(errors)).toContain('SEMANTIC_EMPTY');
  });

  it('flags whitespace-only semantic', () => {
    const errors = validateObjectTypeLocal(objectType({ semantic: '   ' }));
    expect(codes(errors)).toContain('SEMANTIC_EMPTY');
  });

  it('flags empty Action.semantic on nested action', () => {
    const t = objectType({
      actions: [
        {
          apiName: 'doThing',
          displayName: 'do thing',
          params: z.object({}),
          sideEffects: [],
          allowedRoles: ['agent'],
          auditLevel: 'log',
          semantic: '',
        },
      ],
    });
    expect(codes(validateObjectTypeLocal(t))).toContain('SEMANTIC_EMPTY');
  });

  it('passes when all semantic fields populated', () => {
    expect(validateObjectTypeLocal(objectType())).toHaveLength(0);
  });
});

describe('META_KEY_UNKNOWN', () => {
  it('flags meta key that is not on the schema', () => {
    const t = objectType({
      // Bypass the helper's compile-time check (simulating deserialized def).
      meta: { phantom: { searchable: true } } as ObjectTypeDef['meta'],
    });
    expect(codes(validateObjectTypeLocal(t))).toContain('META_KEY_UNKNOWN');
  });

  it('passes when meta keys match schema fields', () => {
    const t = objectType({ meta: { name: { searchable: true } } });
    expect(codes(validateObjectTypeLocal(t))).not.toContain('META_KEY_UNKNOWN');
  });
});

describe('STREAM_PAYLOAD_EXCLUSIVE', () => {
  it('flags stream with neither payloadType nor payloadSchema', () => {
    const m = manifest({
      streams: [
        {
          apiName: 'events',
          displayName: 'events',
          semantic: 's',
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({})))).toContain(
      'STREAM_PAYLOAD_EXCLUSIVE',
    );
  });

  it('flags stream with BOTH payloadType and payloadSchema', () => {
    const m = manifest({
      streams: [
        {
          apiName: 'events',
          displayName: 'events',
          payloadType: 'Event',
          payloadSchema: z.object({}),
          semantic: 's',
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({})))).toContain(
      'STREAM_PAYLOAD_EXCLUSIVE',
    );
  });

  it('passes when exactly one is set', () => {
    const m = manifest({
      streams: [
        {
          apiName: 'events',
          displayName: 'events',
          payloadSchema: z.object({}),
          semantic: 's',
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({})))).not.toContain(
      'STREAM_PAYLOAD_EXCLUSIVE',
    );
  });
});

describe('WILDCARD_OUTSIDE_ADMIN', () => {
  it("flags '*' on non-admin role", () => {
    const m = manifest({
      boundaries: [
        {
          role: 'agent',
          readable: ['*'],
          writable: [],
          actions: [],
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({})))).toContain(
      'WILDCARD_OUTSIDE_ADMIN',
    );
  });

  it("passes when '*' is on admin", () => {
    const m = manifest({
      boundaries: [
        { role: 'admin', readable: ['*'], writable: ['*'], actions: ['*'] },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({})))).not.toContain(
      'WILDCARD_OUTSIDE_ADMIN',
    );
  });
});

describe('LINK_TARGET_UNRESOLVED', () => {
  it('flags LinkDef.target with no registered ObjectType', () => {
    const t = objectType({
      links: [
        {
          apiName: 'enrolledIn',
          displayName: 'enrolled in',
          target: 'NonexistentClass',
          cardinality: 'N:1',
          semantic: 'enrolled',
        },
      ],
    });
    expect(codes(validateObjectType(t, ctxFromArrays({ objectTypes: [t] })))).toContain(
      'LINK_TARGET_UNRESOLVED',
    );
  });

  it('flags objectRef schema field with no registered target', () => {
    const t = objectType({
      schema: z.object({ id: z.string(), classId: objectRef('NonexistentClass') }),
    });
    expect(codes(validateObjectType(t, ctxFromArrays({ objectTypes: [t] })))).toContain(
      'LINK_TARGET_UNRESOLVED',
    );
  });

  it('passes when link target is registered', () => {
    const classT = objectType({ apiName: 'Class', semantic: 'A class.' });
    const studentT = objectType({
      links: [
        {
          apiName: 'enrolledIn',
          displayName: 'enrolled in',
          target: 'Class',
          cardinality: 'N:1',
          semantic: 'enrolled',
        },
      ],
    });
    expect(
      codes(validateObjectType(studentT, ctxFromArrays({ objectTypes: [studentT, classT] }))),
    ).not.toContain('LINK_TARGET_UNRESOLVED');
  });
});

describe('SLOT_TARGET_UNRESOLVED', () => {
  it('flags objectType target not registered', () => {
    const m = manifest({
      slots: [
        {
          apiName: 'plan',
          displayName: 'plan',
          target: { kind: 'objectType', apiName: 'Ghost' },
          semantic: 'g',
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({})))).toContain(
      'SLOT_TARGET_UNRESOLVED',
    );
  });

  it('flags manifest target not registered', () => {
    const m = manifest({
      slots: [
        {
          apiName: 'parent',
          displayName: 'parent',
          target: { kind: 'manifest', name: 'GhostManifest' },
          semantic: 'g',
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({})))).toContain(
      'SLOT_TARGET_UNRESOLVED',
    );
  });
});

describe('DERIVED_FROM_UNRESOLVED', () => {
  it('flags derivedFrom head that is not a slot on this manifest', () => {
    const m = manifest({
      slots: [
        {
          apiName: 'students',
          displayName: 'students',
          target: { kind: 'objectType', apiName: 'Student' },
          derivedFrom: 'phantom.contains',
          semantic: 's',
        },
      ],
    });
    const s = objectType({ apiName: 'Student' });
    expect(codes(validateManifest(m, ctxFromArrays({ objectTypes: [s] })))).toContain(
      'DERIVED_FROM_UNRESOLVED',
    );
  });

  it('flags tail link that does not exist on head slot target', () => {
    // 'students' derivedFrom 'class.ghostLink' — 'class' resolves to Class,
    // but Class has no link called 'ghostLink'.
    const studentT = objectType({ apiName: 'Student' });
    const classT = objectType({
      apiName: 'Class',
      semantic: 'A class.',
      links: [
        {
          apiName: 'contains',
          displayName: 'contains',
          target: 'Student',
          cardinality: '1:N',
          semantic: 'enrolled students',
        },
      ],
    });
    const m = manifest({
      slots: [
        {
          apiName: 'class',
          displayName: 'class',
          target: { kind: 'objectType', apiName: 'Class' },
          semantic: 'the class',
        },
        {
          apiName: 'students',
          displayName: 'students',
          target: { kind: 'objectType', apiName: 'Student' },
          collection: true,
          derivedFrom: 'class.ghostLink',
          semantic: 'enrolled',
        },
      ],
    });
    expect(
      codes(validateManifest(m, ctxFromArrays({ objectTypes: [studentT, classT] }))),
    ).toContain('DERIVED_FROM_UNRESOLVED');
  });

  it('passes when head + tail link both resolve', () => {
    const studentT = objectType({ apiName: 'Student' });
    const classT = objectType({
      apiName: 'Class',
      semantic: 'A class.',
      links: [
        {
          apiName: 'contains',
          displayName: 'contains',
          target: 'Student',
          cardinality: '1:N',
          semantic: 'enrolled students',
        },
      ],
    });
    const m = manifest({
      slots: [
        {
          apiName: 'class',
          displayName: 'class',
          target: { kind: 'objectType', apiName: 'Class' },
          semantic: 'the class',
        },
        {
          apiName: 'students',
          displayName: 'students',
          target: { kind: 'objectType', apiName: 'Student' },
          collection: true,
          derivedFrom: 'class.contains',
          semantic: 'enrolled',
        },
      ],
    });
    expect(
      codes(validateManifest(m, ctxFromArrays({ objectTypes: [studentT, classT] }))),
    ).not.toContain('DERIVED_FROM_UNRESOLVED');
  });

  it('flags tail walk when head slot targets a Manifest (not an ObjectType)', () => {
    const inner = manifest({ name: 'Inner', semantic: 'inner' });
    const m = manifest({
      slots: [
        {
          apiName: 'nested',
          displayName: 'nested',
          target: { kind: 'manifest', name: 'Inner' },
          semantic: 'nested manifest',
        },
        {
          apiName: 'derived',
          displayName: 'derived',
          target: { kind: 'objectType', apiName: 'Whatever' },
          derivedFrom: 'nested.anything',
          semantic: 'd',
        },
      ],
    });
    const ot = objectType({ apiName: 'Whatever' });
    expect(
      codes(validateManifest(m, ctxFromArrays({ objectTypes: [ot], manifests: [inner] }))),
    ).toContain('DERIVED_FROM_UNRESOLVED');
  });

  it('head-only derivedFrom is structurally valid (no tail to walk)', () => {
    const planT = objectType({ apiName: 'Plan' });
    const m = manifest({
      slots: [
        {
          apiName: 'plan',
          displayName: 'plan',
          target: { kind: 'objectType', apiName: 'Plan' },
          semantic: 'p',
        },
        {
          apiName: 'planAlias',
          displayName: 'planAlias',
          target: { kind: 'objectType', apiName: 'Plan' },
          derivedFrom: 'plan',
          semantic: 'alias',
        },
      ],
    });
    expect(
      codes(validateManifest(m, ctxFromArrays({ objectTypes: [planT] }))),
    ).not.toContain('DERIVED_FROM_UNRESOLVED');
  });
});

describe('LINK_INVERSE_UNRESOLVED', () => {
  it('flags inverse pointing to a link that does not exist on the target', () => {
    const studentT = objectType({ apiName: 'Student' });
    const classT = objectType({
      apiName: 'Class',
      semantic: 'A class.',
      links: [
        {
          apiName: 'contains',
          displayName: 'contains',
          target: 'Student',
          cardinality: '1:N',
          inverse: 'ghostInverse',
          semantic: 'enrolled',
        },
      ],
    });
    expect(
      codes(validateObjectType(classT, ctxFromArrays({ objectTypes: [classT, studentT] }))),
    ).toContain('LINK_INVERSE_UNRESOLVED');
  });

  it('passes when inverse resolves to a real link on target', () => {
    const studentT = objectType({
      apiName: 'Student',
      links: [
        {
          apiName: 'enrolledIn',
          displayName: 'enrolled in',
          target: 'Class',
          cardinality: 'N:1',
          semantic: 'belongs to',
        },
      ],
    });
    const classT = objectType({
      apiName: 'Class',
      semantic: 'A class.',
      links: [
        {
          apiName: 'contains',
          displayName: 'contains',
          target: 'Student',
          cardinality: '1:N',
          inverse: 'enrolledIn',
          semantic: 'enrolled',
        },
      ],
    });
    expect(
      codes(validateObjectType(classT, ctxFromArrays({ objectTypes: [classT, studentT] }))),
    ).not.toContain('LINK_INVERSE_UNRESOLVED');
  });

  it('inverse check is skipped when LinkDef.target itself is unresolved', () => {
    const t = objectType({
      links: [
        {
          apiName: 'enrolledIn',
          displayName: 'enrolled in',
          target: 'GhostType',
          cardinality: 'N:1',
          inverse: 'whatever',
          semantic: 'x',
        },
      ],
    });
    const errs = codes(validateObjectType(t, ctxFromArrays({ objectTypes: [t] })));
    expect(errs).toContain('LINK_TARGET_UNRESOLVED');
    // Should NOT cascade — only the target error surfaces.
    expect(errs).not.toContain('LINK_INVERSE_UNRESOLVED');
  });
});

describe('REQUIRED_SCOPE_UNKNOWN', () => {
  it('flags ActionDef.requiredScopes containing an unknown scope', () => {
    const t = objectType({
      actions: [
        {
          apiName: 'doThing',
          displayName: 'do',
          params: z.object({}),
          sideEffects: [],
          allowedRoles: ['agent'],
          auditLevel: 'log',
          semantic: 'a',
          requiredScopes: ['skills:execute', 'ghost:typo' as 'admin'],
        },
      ],
    });
    expect(codes(validateObjectTypeLocal(t))).toContain('REQUIRED_SCOPE_UNKNOWN');
  });

  it('passes when ActionDef.requiredScopes contains only valid scopes', () => {
    const t = objectType({
      actions: [
        {
          apiName: 'doThing',
          displayName: 'do',
          params: z.object({}),
          sideEffects: [],
          allowedRoles: ['agent'],
          auditLevel: 'log',
          semantic: 'a',
          requiredScopes: ['skills:execute', 'admin'],
        },
      ],
    });
    expect(codes(validateObjectTypeLocal(t))).not.toContain('REQUIRED_SCOPE_UNKNOWN');
  });

  it('flags FunctionDef.requiredScopes containing an unknown scope', () => {
    const f: FunctionDef = {
      apiName: 'compute',
      displayName: 'compute',
      params: z.object({}),
      returnType: z.number(),
      semantic: 's',
      allowedRoles: ['agent'],
      requiredScopes: ['analytics:read', 'bogus' as 'admin'],
    };
    expect(codes(validateFunction(f))).toContain('REQUIRED_SCOPE_UNKNOWN');
  });

  it('absent requiredScopes is a no-op (does not flag)', () => {
    const t = objectType({
      actions: [
        {
          apiName: 'doThing',
          displayName: 'do',
          params: z.object({}),
          sideEffects: [],
          allowedRoles: ['agent'],
          auditLevel: 'log',
          semantic: 'a',
          // requiredScopes intentionally absent
        },
      ],
    });
    expect(codes(validateObjectTypeLocal(t))).not.toContain('REQUIRED_SCOPE_UNKNOWN');
  });
});

describe('LIFECYCLE_ACTION_UNRESOLVED', () => {
  it('flags onActivate apiName not found on any slot-bound type', () => {
    const m = manifest({
      slots: [
        {
          apiName: 'plan',
          displayName: 'plan',
          target: { kind: 'objectType', apiName: 'Plan' },
          semantic: 's',
        },
      ],
      lifecycle: { onActivate: 'ghostAction' },
    });
    const plan = objectType({ apiName: 'Plan' });
    expect(codes(validateManifest(m, ctxFromArrays({ objectTypes: [plan] })))).toContain(
      'LIFECYCLE_ACTION_UNRESOLVED',
    );
  });

  it('passes when hook resolves', () => {
    const realAction: ActionDef = {
      apiName: 'startSession',
      displayName: 'start',
      params: z.object({}),
      sideEffects: [],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      semantic: 'starts the session',
    };
    const plan = objectType({ apiName: 'Plan', actions: [realAction] });
    const m = manifest({
      slots: [
        {
          apiName: 'plan',
          displayName: 'plan',
          target: { kind: 'objectType', apiName: 'Plan' },
          semantic: 's',
        },
      ],
      lifecycle: { onActivate: 'startSession' },
    });
    expect(codes(validateManifest(m, ctxFromArrays({ objectTypes: [plan] })))).not.toContain(
      'LIFECYCLE_ACTION_UNRESOLVED',
    );
  });
});

describe('PRECONDITION_STATE_UNRESOLVED', () => {
  it('flags stateEquals against missing state field', () => {
    const action: ActionDef = {
      apiName: 'adj',
      displayName: 'adj',
      params: z.object({}),
      sideEffects: [],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      semantic: 'a',
      preconditions: [{ kind: 'stateEquals', path: 'ghostField', value: 'x' }],
    };
    const t = objectType({ apiName: 'Plan', actions: [action] });
    const m = manifest({
      slots: [
        {
          apiName: 'plan',
          displayName: 'plan',
          target: { kind: 'objectType', apiName: 'Plan' },
          semantic: 's',
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({ objectTypes: [t] })))).toContain(
      'PRECONDITION_STATE_UNRESOLVED',
    );
  });
});

describe('PRECONDITION_SLOT_UNRESOLVED', () => {
  it('flags slotBound against missing slot', () => {
    const action: ActionDef = {
      apiName: 'adj',
      displayName: 'adj',
      params: z.object({}),
      sideEffects: [],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      semantic: 'a',
      preconditions: [{ kind: 'slotBound', slot: 'phantom' }],
    };
    const t = objectType({ apiName: 'Plan', actions: [action] });
    const m = manifest({
      slots: [
        {
          apiName: 'plan',
          displayName: 'plan',
          target: { kind: 'objectType', apiName: 'Plan' },
          semantic: 's',
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({ objectTypes: [t] })))).toContain(
      'PRECONDITION_SLOT_UNRESOLVED',
    );
  });
});

describe('PRECONDITION_NAMED_UNSUPPORTED (Phase 1 stub)', () => {
  it('always flags named preconditions until Phase 4', () => {
    const action: ActionDef = {
      apiName: 'adj',
      displayName: 'adj',
      params: z.object({}),
      sideEffects: [],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      semantic: 'a',
      preconditions: [{ kind: 'named', name: 'studentIsStruggling' }],
    };
    const t = objectType({ apiName: 'Plan', actions: [action] });
    const m = manifest({
      slots: [
        {
          apiName: 'plan',
          displayName: 'plan',
          target: { kind: 'objectType', apiName: 'Plan' },
          semantic: 's',
        },
      ],
    });
    expect(codes(validateManifest(m, ctxFromArrays({ objectTypes: [t] })))).toContain(
      'PRECONDITION_NAMED_UNSUPPORTED',
    );
  });
});

describe('FunctionDef validator', () => {
  it('flags empty semantic', () => {
    const f: FunctionDef = {
      apiName: 'f',
      displayName: 'f',
      params: z.object({}),
      returnType: z.number(),
      semantic: '',
      allowedRoles: ['agent'],
    };
    expect(codes(validateFunction(f))).toContain('SEMANTIC_EMPTY');
  });
});

describe('validateAll + RegistrationError', () => {
  it('aggregates errors across object types and manifests', () => {
    const badType = objectType({ semantic: '' });
    const badManifest = manifest({ semantic: '' });
    const errors = validateAll(
      ctxFromArrays({ objectTypes: [badType], manifests: [badManifest] }),
    );
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('RegistrationError carries the error list and message includes count', () => {
    const errs: ValidationError[] = [
      { code: 'SEMANTIC_EMPTY', message: 'm', path: 'ObjectType:X' },
      { code: 'WILDCARD_OUTSIDE_ADMIN', message: 'm', path: 'Manifest:Y' },
    ];
    const err = new RegistrationError(errs);
    expect(err.errors).toBe(errs);
    expect(err.name).toBe('RegistrationError');
    expect(err.message).toContain('2 error(s)');
  });
});

// ────────────────────────────────────────────────────────────────────
// Phase 4 — ObjectSetDef validators
// ────────────────────────────────────────────────────────────────────

describe('OBJECTSET_TARGET_UNRESOLVED', () => {
  it('flags ObjectSet whose target ObjectType is not registered', () => {
    const s: import('../object-set.js').ObjectSetDef = {
      apiName: 'strugglingStudents',
      displayName: '挣扎中的学生',
      objectType: 'Ghost',
      filter: { op: 'has', path: 'id' },
      semantic: 'low mastery',
    };
    const ctx: ValidationContext = {
      objectTypes: new Map(),
      manifests: new Map(),
      objectSets: new Map([[s.apiName, s]]),
    };
    expect(codes(validateAll(ctx))).toContain('OBJECTSET_TARGET_UNRESOLVED');
  });
});

describe('OBJECTSET_FIELD_UNRESOLVED', () => {
  function studentType(): ObjectTypeDef {
    return {
      apiName: 'Student',
      displayName: 'Student',
      semantic: 'a learner',
      schema: z.object({
        id: z.string(),
        mastery: z.number(),
        engagement: z.number(),
      }),
      links: [],
      actions: [],
    };
  }
  function setWithFilter(filter: import('../object-set.js').SetFilter): import('../object-set.js').ObjectSetDef {
    return {
      apiName: 'someSet',
      displayName: 's',
      objectType: 'Student',
      filter,
      semantic: 'x',
    };
  }
  function ctx(set: import('../object-set.js').ObjectSetDef): ValidationContext {
    return {
      objectTypes: new Map([['Student', studentType()]]),
      manifests: new Map(),
      objectSets: new Map([[set.apiName, set]]),
    };
  }

  it('flags a comparison op whose path is not a field on the target', () => {
    const s = setWithFilter({ op: 'lt', path: 'ghost', value: 50 });
    expect(codes(validateAll(ctx(s)))).toContain('OBJECTSET_FIELD_UNRESOLVED');
  });

  it('flags a nested and/or whose leaf path is missing', () => {
    const s = setWithFilter({
      op: 'and',
      clauses: [
        { op: 'lt', path: 'mastery', value: 50 },
        { op: 'eq', path: 'phantomField', value: 'x' },
      ],
    });
    const errs = validateAll(ctx(s));
    expect(codes(errs)).toContain('OBJECTSET_FIELD_UNRESOLVED');
  });

  it('flags a not-wrapped clause whose path is missing', () => {
    const s = setWithFilter({
      op: 'not',
      clause: { op: 'eq', path: 'missing', value: 'x' },
    });
    expect(codes(validateAll(ctx(s)))).toContain('OBJECTSET_FIELD_UNRESOLVED');
  });

  it('passes when every path resolves to a field on the target', () => {
    const s = setWithFilter({
      op: 'and',
      clauses: [
        { op: 'lt', path: 'mastery', value: 50 },
        { op: 'ge', path: 'engagement', value: 50 },
      ],
    });
    expect(codes(validateAll(ctx(s)))).not.toContain('OBJECTSET_FIELD_UNRESOLVED');
  });

  it('flags orderBy paths that do not resolve to fields', () => {
    const s: import('../object-set.js').ObjectSetDef = {
      apiName: 'someSet',
      displayName: 's',
      objectType: 'Student',
      filter: { op: 'has', path: 'id' },
      orderBy: [{ path: 'phantom', direction: 'asc' }],
      semantic: 'x',
    };
    expect(codes(validateAll(ctx(s)))).toContain('OBJECTSET_FIELD_UNRESOLVED');
  });
});

describe('OBJECTSET_NAMED_UNSUPPORTED', () => {
  it('flags a named SetFilter (predicate registry is still gated)', () => {
    const studentType: ObjectTypeDef = {
      apiName: 'Student',
      displayName: 'S',
      semantic: 's',
      schema: z.object({ id: z.string() }),
      links: [],
      actions: [],
    };
    const s: import('../object-set.js').ObjectSetDef = {
      apiName: 'special',
      displayName: 's',
      objectType: 'Student',
      filter: { op: 'named', name: 'isHighRisk' },
      semantic: 'x',
    };
    const ctx: ValidationContext = {
      objectTypes: new Map([['Student', studentType]]),
      manifests: new Map(),
      objectSets: new Map([[s.apiName, s]]),
    };
    expect(codes(validateAll(ctx))).toContain('OBJECTSET_NAMED_UNSUPPORTED');
  });
});

describe('SLOT_TARGET_UNRESOLVED (objectSet kind, Phase 4)', () => {
  it('flags a slot.target.objectSet whose name is not registered', () => {
    const m = manifest({
      slots: [
        {
          apiName: 'students',
          displayName: 'students',
          target: { kind: 'objectSet', name: 'unknownSet' },
          semantic: 's',
        },
      ],
    });
    expect(
      codes(validateManifest(m, {
        objectTypes: new Map(),
        manifests: new Map(),
        objectSets: new Map(),
      })),
    ).toContain('SLOT_TARGET_UNRESOLVED');
  });

  it('passes when slot.target.objectSet name is registered', () => {
    const studentType: ObjectTypeDef = {
      apiName: 'Student',
      displayName: 'S',
      semantic: 's',
      schema: z.object({ id: z.string() }),
      links: [],
      actions: [],
    };
    const struggling: import('../object-set.js').ObjectSetDef = {
      apiName: 'strugglingStudents',
      displayName: 's',
      objectType: 'Student',
      filter: { op: 'has', path: 'id' },
      semantic: 'x',
    };
    const m = manifest({
      slots: [
        {
          apiName: 'students',
          displayName: 'students',
          target: { kind: 'objectSet', name: 'strugglingStudents' },
          semantic: 's',
        },
      ],
    });
    const ctx: ValidationContext = {
      objectTypes: new Map([['Student', studentType]]),
      manifests: new Map(),
      objectSets: new Map([['strugglingStudents', struggling]]),
    };
    expect(codes(validateManifest(m, ctx))).not.toContain('SLOT_TARGET_UNRESOLVED');
  });
});
