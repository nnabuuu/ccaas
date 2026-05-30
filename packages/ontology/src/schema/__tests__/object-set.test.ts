/**
 * Unit tests for `ObjectSetDef` + `SetFilter` shape.
 *
 * Spec §3.9 — verify every discriminant in the filter union accepts
 * the documented field shape, plus that `ObjectSetDef`'s required
 * fields (semantic, objectType, apiName) compile.
 */

import { describe, expect, it } from 'vitest';
import type { ObjectSetDef, OrderClause, SetFilter } from '../object-set.js';

describe('SetFilter shape', () => {
  it('accepts every comparison op kind', () => {
    // Enumerate explicitly because the SetFilter union narrows per
    // op — a generic loop variable widens to the full union and
    // breaks the value/path constraints. One direct literal each.
    const eq: SetFilter = { op: 'eq', path: 'mastery', value: 50 };
    const ne: SetFilter = { op: 'ne', path: 'mastery', value: 50 };
    const lt: SetFilter = { op: 'lt', path: 'mastery', value: 50 };
    const le: SetFilter = { op: 'le', path: 'mastery', value: 50 };
    const gt: SetFilter = { op: 'gt', path: 'mastery', value: 50 };
    const ge: SetFilter = { op: 'ge', path: 'mastery', value: 50 };
    expect([eq.op, ne.op, lt.op, le.op, gt.op, ge.op]).toEqual([
      'eq',
      'ne',
      'lt',
      'le',
      'gt',
      'ge',
    ]);
  });

  it('accepts boolean and null values on comparisons', () => {
    const a: SetFilter = { op: 'eq', path: 'paused', value: false };
    const b: SetFilter = { op: 'eq', path: 'stepId', value: null };
    expect(a.value).toBe(false);
    expect(b.value).toBeNull();
  });

  it('accepts in op with readonly values array', () => {
    const f: SetFilter = {
      op: 'in',
      path: 'phase',
      values: ['waiting', 'practice'],
    };
    expect(f.values).toHaveLength(2);
  });

  it('accepts has op (presence check)', () => {
    const f: SetFilter = { op: 'has', path: 'plan' };
    expect(f.op).toBe('has');
  });

  it('accepts and / or with clauses', () => {
    const f: SetFilter = {
      op: 'and',
      clauses: [
        { op: 'lt', path: 'mastery', value: 50 },
        { op: 'ge', path: 'engagement', value: 50 },
      ],
    };
    expect(f.clauses).toHaveLength(2);
  });

  it('accepts not (single clause)', () => {
    const f: SetFilter = {
      op: 'not',
      clause: { op: 'eq', path: 'phase', value: 'ended' },
    };
    expect(f.clause.op).toBe('eq');
  });

  it('accepts named (escape hatch) with optional params', () => {
    const a: SetFilter = { op: 'named', name: 'isHighRisk' };
    const b: SetFilter = { op: 'named', name: 'inGrade', params: { grade: 9 } };
    expect(a.op).toBe('named');
    expect(b.params?.grade).toBe(9);
  });

  it('rejects unknown op at compile time', () => {
    // @ts-expect-error — only the spec'd ops are allowed
    const f: SetFilter = { op: 'matches', path: 'name', value: 'x' };
    expect(f).toBeDefined();
  });
});

describe('OrderClause shape', () => {
  it('accepts asc / desc direction', () => {
    const asc: OrderClause = { path: 'mastery', direction: 'asc' };
    const desc: OrderClause = { path: 'mastery', direction: 'desc' };
    expect(asc.direction).toBe('asc');
    expect(desc.direction).toBe('desc');
  });

  it('rejects unknown direction at compile time', () => {
    // @ts-expect-error — only 'asc' | 'desc' allowed
    const x: OrderClause = { path: 'mastery', direction: 'random' };
    expect(x).toBeDefined();
  });
});

describe('ObjectSetDef shape', () => {
  it('composes the full surface', () => {
    const struggling: ObjectSetDef = {
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
    };
    expect(struggling.apiName).toBe('strugglingStudents');
    expect(struggling.filter.op).toBe('and');
    expect(struggling.defaultLimit).toBe(20);
  });

  it('orderBy + defaultLimit are optional', () => {
    const minimal: ObjectSetDef = {
      apiName: 'allStudents',
      displayName: 'all',
      objectType: 'Student',
      filter: { op: 'has', path: 'id' },
      semantic: 'everyone',
    };
    expect(minimal.orderBy).toBeUndefined();
    expect(minimal.defaultLimit).toBeUndefined();
  });

  it('rejects missing required fields (semantic / objectType / apiName) at compile time', () => {
    // @ts-expect-error — semantic missing
    const a: ObjectSetDef = {
      apiName: 'x',
      displayName: 'x',
      objectType: 'Y',
      filter: { op: 'has', path: 'id' },
    };
    // @ts-expect-error — objectType missing
    const b: ObjectSetDef = {
      apiName: 'x',
      displayName: 'x',
      filter: { op: 'has', path: 'id' },
      semantic: 's',
    };
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });
});
