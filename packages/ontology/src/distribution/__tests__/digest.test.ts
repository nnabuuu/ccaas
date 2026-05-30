/**
 * Order-independence + stability tests for the digest pipeline.
 *
 * The promise: two registries with the same defs in different
 * registration order produce the same digest. Same registry across
 * two runs produces the same digest. Changing any field changes the
 * digest.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ObjectTypeDef } from '../../schema/index.js';
import { OntologyRegistry } from '../../registry/index.js';
import { canonicalize, serializeRegistry } from '../serialize.js';
import { computeSchemaDigest } from '../digest.js';

function studentType(): ObjectTypeDef {
  return {
    apiName: 'Student',
    displayName: 'Student',
    semantic: 's',
    schema: z.object({ id: z.string(), name: z.string() }),
    links: [],
    actions: [],
  };
}

function classType(): ObjectTypeDef {
  return {
    apiName: 'Class',
    displayName: 'Class',
    semantic: 'c',
    schema: z.object({ id: z.string() }),
    links: [],
    actions: [],
  };
}

describe('canonicalize', () => {
  it('sorts object keys recursively', () => {
    const a = canonicalize({ b: 1, a: 2 });
    const b = canonicalize({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('handles nested mixed structures', () => {
    const c = canonicalize({ z: [{ b: 1, a: 2 }], a: { y: 1, x: 2 } });
    expect(c).toBe('{"a":{"x":2,"y":1},"z":[{"a":2,"b":1}]}');
  });

  it('omits undefined values (matching JSON.stringify)', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe('serializeRegistry — order independence', () => {
  it('byte-equal output regardless of registration order', () => {
    const r1 = new OntologyRegistry();
    r1.registerObjectType(studentType());
    r1.registerObjectType(classType());

    const r2 = new OntologyRegistry();
    r2.registerObjectType(classType());
    r2.registerObjectType(studentType());

    const s1 = canonicalize(serializeRegistry(r1.context()));
    const s2 = canonicalize(serializeRegistry(r2.context()));
    expect(s1).toBe(s2);
  });

  it('sorts ObjectTypes by apiName in the output', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(studentType());
    r.registerObjectType(classType());
    const s = serializeRegistry(r.context());
    expect(s.objectTypes.map((t) => t.apiName)).toEqual(['Class', 'Student']);
  });
});

describe('computeSchemaDigest', () => {
  it('returns sha256-prefixed lowercase hex', () => {
    const r = new OntologyRegistry();
    expect(computeSchemaDigest(serializeRegistry(r.context()))).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
  });

  it('order-independent: same digest regardless of registration order', () => {
    const r1 = new OntologyRegistry();
    r1.registerObjectType(studentType());
    r1.registerObjectType(classType());

    const r2 = new OntologyRegistry();
    r2.registerObjectType(classType());
    r2.registerObjectType(studentType());

    expect(r1.getSchemaDigest()).toBe(r2.getSchemaDigest());
  });

  it('digest changes when a field changes', () => {
    const r1 = new OntologyRegistry();
    r1.registerObjectType(studentType());
    const d1 = r1.getSchemaDigest();

    const r2 = new OntologyRegistry();
    r2.registerObjectType({ ...studentType(), semantic: 'different' });
    const d2 = r2.getSchemaDigest();

    expect(d1).not.toBe(d2);
  });

  it('digest changes when an ObjectType is added', () => {
    const r = new OntologyRegistry();
    const empty = r.getSchemaDigest();
    r.registerObjectType(studentType());
    expect(r.getSchemaDigest()).not.toBe(empty);
  });

  it('digest stable across two computations of the same registry', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(studentType());
    r.registerObjectType(classType());
    expect(r.getSchemaDigest()).toBe(r.getSchemaDigest());
  });

  it('empty registry produces a stable, well-formed digest', () => {
    // The empty digest is the identity for "no schema yet" — useful as
    // a sentinel for "has anything been registered?" without exposing
    // the internal Maps. Should be stable across runs.
    const r1 = new OntologyRegistry();
    const r2 = new OntologyRegistry();
    expect(r1.getSchemaDigest()).toBe(r2.getSchemaDigest());
    expect(r1.getSchemaDigest()).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('function-only registry produces a different digest than empty', () => {
    // Catches a regression where serializeRegistry might drop the
    // functions list when objectTypes + manifests are both empty.
    const empty = new OntologyRegistry().getSchemaDigest();
    const r = new OntologyRegistry();
    r.registerFunction({
      apiName: 'compute',
      displayName: 'compute',
      params: z.object({ x: z.number() }),
      returnType: z.number(),
      semantic: 's',
      allowedRoles: ['agent'],
    });
    expect(r.getSchemaDigest()).not.toBe(empty);
    expect(r.getSchemaDigest()).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('serialized output explicitly carries empty arrays (not omitted)', () => {
    // Explicit empty arrays in serialization keep the JSON Schema shape
    // predictable for consumers — they don't have to special-case
    // "missing means empty."
    const s = serializeRegistry(new OntologyRegistry().context());
    expect(s.objectTypes).toEqual([]);
    expect(s.manifests).toEqual([]);
    expect(s.functions).toEqual([]);
    expect(s.objectSets).toEqual([]);
    expect(s.ontologyVersion).toBeDefined();
  });

  it('digest is independent of ActionDef.preconditions list order', () => {
    function planWithPreconditions(
      preconditions: Array<
        | { kind: 'stateEquals'; path: string; value: string }
        | { kind: 'slotBound'; slot: string }
      >,
    ): ObjectTypeDef {
      return {
        apiName: 'Plan',
        displayName: 'Plan',
        semantic: 'p',
        schema: z.object({ id: z.string() }),
        links: [],
        actions: [
          {
            apiName: 'adj',
            displayName: 'adj',
            params: z.object({}),
            sideEffects: [],
            allowedRoles: ['agent'],
            auditLevel: 'log',
            semantic: 'a',
            preconditions,
          },
        ],
      };
    }
    const r1 = new OntologyRegistry();
    r1.registerObjectType(
      planWithPreconditions([
        { kind: 'stateEquals', path: 'phase', value: 'practice' },
        { kind: 'slotBound', slot: 'students' },
      ]),
    );
    const r2 = new OntologyRegistry();
    r2.registerObjectType(
      planWithPreconditions([
        { kind: 'slotBound', slot: 'students' },
        { kind: 'stateEquals', path: 'phase', value: 'practice' },
      ]),
    );
    expect(r1.getSchemaDigest()).toBe(r2.getSchemaDigest());
  });
});

// ────────────────────────────────────────────────────────────────────
// Phase 4 — ObjectSetDef inclusion in the serialized payload + digest
// ────────────────────────────────────────────────────────────────────

describe('ObjectSetDef inclusion (Phase 4)', () => {
  function student(): import('../../schema/index.js').ObjectTypeDef {
    return {
      apiName: 'Student',
      displayName: 'Student',
      semantic: 'A learner',
      schema: z.object({ id: z.string(), mastery: z.number() }),
      links: [],
      actions: [],
    };
  }

  it('serializeRegistry now exposes the objectSets array', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    r.registerObjectSet({
      apiName: 'strugglingStudents',
      displayName: 's',
      objectType: 'Student',
      filter: { op: 'lt', path: 'mastery', value: 50 },
      semantic: 'x',
    });
    const out = serializeRegistry(r.context());
    expect(out.objectSets).toHaveLength(1);
    expect(out.objectSets[0].apiName).toBe('strugglingStudents');
  });

  it('digest changes when an ObjectSetDef is added (S1 regression)', () => {
    const r1 = new OntologyRegistry();
    r1.registerObjectType(student());
    const before = r1.getSchemaDigest();

    const r2 = new OntologyRegistry();
    r2.registerObjectType(student());
    r2.registerObjectSet({
      apiName: 'strugglingStudents',
      displayName: 's',
      objectType: 'Student',
      filter: { op: 'lt', path: 'mastery', value: 50 },
      semantic: 'x',
    });
    expect(r2.getSchemaDigest()).not.toBe(before);
  });

  it('digest changes when only the filter shape differs', () => {
    function makeReg(filter: import('../../schema/index.js').SetFilter) {
      const r = new OntologyRegistry();
      r.registerObjectType(student());
      r.registerObjectSet({
        apiName: 'subset',
        displayName: 's',
        objectType: 'Student',
        filter,
        semantic: 'x',
      });
      return r;
    }
    const a = makeReg({ op: 'lt', path: 'mastery', value: 50 });
    const b = makeReg({ op: 'lt', path: 'mastery', value: 70 });
    expect(a.getSchemaDigest()).not.toBe(b.getSchemaDigest());
  });

  it('digest is order-independent across ObjectSetDefs registered in different order', () => {
    const setA: import('../../schema/index.js').ObjectSetDef = {
      apiName: 'a',
      displayName: 'a',
      objectType: 'Student',
      filter: { op: 'has', path: 'id' },
      semantic: 'x',
    };
    const setB: import('../../schema/index.js').ObjectSetDef = {
      apiName: 'b',
      displayName: 'b',
      objectType: 'Student',
      filter: { op: 'has', path: 'id' },
      semantic: 'x',
    };
    const r1 = new OntologyRegistry();
    r1.registerObjectType(student());
    r1.registerObjectSet(setA);
    r1.registerObjectSet(setB);
    const r2 = new OntologyRegistry();
    r2.registerObjectType(student());
    r2.registerObjectSet(setB);
    r2.registerObjectSet(setA);
    expect(r1.getSchemaDigest()).toBe(r2.getSchemaDigest());
  });
});
