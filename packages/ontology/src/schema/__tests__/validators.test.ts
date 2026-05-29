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
