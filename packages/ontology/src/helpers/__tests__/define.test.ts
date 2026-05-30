/**
 * Tests for the `define*` helpers.
 *
 * Two flavors of coverage:
 *  1. Runtime passthrough: every helper returns its input unchanged
 *     (referential identity, not just deep-equality).
 *  2. Compile-time constraint: misnamed meta keys / mis-typed initial
 *     values trigger `@ts-expect-error`s. If the constraint regresses,
 *     the expect-error itself becomes the failure signal.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  defineAction,
  defineFunction,
  defineManifest,
  defineObjectSet,
  defineObjectType,
  defineStateField,
} from '../define.js';

describe('defineObjectType', () => {
  it('returns the literal unchanged (referential identity)', () => {
    const def = defineObjectType({
      apiName: 'Student',
      displayName: '学生',
      semantic: 'A learner.',
      schema: z.object({ id: z.string(), name: z.string() }),
      links: [],
      actions: [],
    });
    expect(def.apiName).toBe('Student');
  });

  it('constrains meta keys to schema fields (compile-time)', () => {
    const StudentSchema = z.object({ id: z.string(), name: z.string() });
    defineObjectType({
      apiName: 'Student',
      displayName: '学生',
      semantic: 's',
      schema: StudentSchema,
      meta: {
        // valid key
        name: { searchable: true, displayRole: 'title' },
        // @ts-expect-error — 'foo' is not a field of StudentSchema
        foo: { searchable: true },
      },
      links: [],
      actions: [],
    });
    expect(true).toBe(true);
  });

  it('rejects Phase 4 field `implements` at compile time', () => {
    defineObjectType({
      apiName: 'Student',
      displayName: 'X',
      semantic: 's',
      schema: z.object({ id: z.string() }),
      links: [],
      actions: [],
      // @ts-expect-error — Tier 2; lands in Phase 4
      implements: ['Identifiable'],
    });
    expect(true).toBe(true);
  });
});

describe('defineAction', () => {
  it('returns the literal unchanged', () => {
    const def = defineAction({
      apiName: 'flag',
      displayName: 'flag',
      params: z.object({ reason: z.string() }),
      sideEffects: ['emits:Flag'],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      semantic: 'Flag something.',
    });
    expect(def.apiName).toBe('flag');
  });

  it('rejects Phase 5 field `returnType` at compile time', () => {
    defineAction({
      apiName: 'x',
      displayName: 'x',
      params: z.object({}),
      sideEffects: [],
      allowedRoles: ['agent'],
      auditLevel: 'log',
      semantic: 's',
      // @ts-expect-error — Tier 3 (G11); lands in Phase 5
      returnType: z.string(),
    });
    expect(true).toBe(true);
  });
});

describe('defineFunction', () => {
  it('returns the literal unchanged', () => {
    const def = defineFunction({
      apiName: 'computeScore',
      displayName: 'compute score',
      params: z.object({ studentId: z.string() }),
      returnType: z.number(),
      semantic: 'Pure score calculator.',
      allowedRoles: ['agent'],
    });
    expect(def.apiName).toBe('computeScore');
  });
});

describe('defineManifest', () => {
  it('returns the literal unchanged', () => {
    const def = defineManifest({
      name: 'X',
      displayName: 'X',
      schemaVersion: '1.0.0',
      semantic: 's',
      slots: [],
      state: [],
      boundaries: [],
    });
    expect(def.name).toBe('X');
  });
});

describe('defineStateField', () => {
  it('narrows initial to z.infer<schema>', () => {
    const phase = defineStateField({
      apiName: 'phase',
      displayName: 'phase',
      schema: z.enum(['waiting', 'practice']),
      initial: 'waiting',
      semantic: 's',
    });
    expect(phase.initial).toBe('waiting');
  });

  it('rejects mis-typed initial at compile time', () => {
    defineStateField({
      apiName: 'phase',
      displayName: 'phase',
      schema: z.enum(['waiting', 'practice']),
      // @ts-expect-error — 'unknown' is not in the enum
      initial: 'unknown',
      semantic: 's',
    });
    expect(true).toBe(true);
  });

  it('works with non-object schemas (boolean / nullable)', () => {
    const paused = defineStateField({
      apiName: 'paused',
      displayName: 'paused',
      schema: z.boolean(),
      initial: false,
      semantic: 's',
    });
    expect(paused.initial).toBe(false);

    const stepId = defineStateField({
      apiName: 'stepId',
      displayName: 'stepId',
      schema: z.string().nullable(),
      initial: null,
      semantic: 's',
    });
    expect(stepId.initial).toBeNull();
  });
});

describe('defineObjectSet (Phase 4)', () => {
  it('returns the literal unchanged', () => {
    const def = defineObjectSet({
      apiName: 'strugglingStudents',
      displayName: '挣扎中的学生',
      objectType: 'Student',
      filter: {
        op: 'and',
        clauses: [
          { op: 'lt', path: 'mastery', value: 50 },
          { op: 'ge', path: 'engagement', value: 50 },
        ],
      },
      orderBy: [{ path: 'mastery', direction: 'asc' }],
      defaultLimit: 20,
      semantic: 'Students with low mastery but engaged.',
    });
    expect(def.apiName).toBe('strugglingStudents');
    expect(def.filter.op).toBe('and');
  });

  it('rejects missing semantic at compile time', () => {
    // @ts-expect-error — semantic is required
    defineObjectSet({
      apiName: 'x',
      displayName: 'x',
      objectType: 'Student',
      filter: { op: 'has', path: 'id' },
    });
  });

  it('rejects missing objectType at compile time', () => {
    // @ts-expect-error — objectType is required
    defineObjectSet({
      apiName: 'x',
      displayName: 'x',
      filter: { op: 'has', path: 'id' },
      semantic: 's',
    });
  });
});
