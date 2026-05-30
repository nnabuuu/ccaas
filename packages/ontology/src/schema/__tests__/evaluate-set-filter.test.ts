/**
 * Tests for `evaluateSetFilter` — Phase 4 (Tier 2 — partial).
 *
 * Coverage: every SetFilter discriminant, dot-path walking, the
 * `named` fail-safe stub, and the exhaustiveness check via the
 * compile-time never assignment.
 */

import { describe, expect, it } from 'vitest';
import type { SetFilter } from '../object-set.js';
import { evaluateSetFilter, type FilterRow } from '../evaluate-set-filter.js';

const ALICE: FilterRow = { id: 'a', mastery: 30, engagement: 80, name: 'Alice' };
const BOB: FilterRow = { id: 'b', mastery: 90, engagement: 90, name: 'Bob' };
const CARA: FilterRow = { id: 'c', mastery: 20, engagement: 20, name: 'Cara' };

describe('comparison ops', () => {
  it('eq matches on exact equality', () => {
    expect(evaluateSetFilter({ op: 'eq', path: 'name', value: 'Alice' }, ALICE)).toBe(true);
    expect(evaluateSetFilter({ op: 'eq', path: 'name', value: 'Bob' }, ALICE)).toBe(false);
  });

  it('ne is the negation of eq', () => {
    expect(evaluateSetFilter({ op: 'ne', path: 'name', value: 'Alice' }, ALICE)).toBe(false);
    expect(evaluateSetFilter({ op: 'ne', path: 'name', value: 'Bob' }, ALICE)).toBe(true);
  });

  it('lt / le / gt / ge on numbers', () => {
    expect(evaluateSetFilter({ op: 'lt', path: 'mastery', value: 50 }, ALICE)).toBe(true);
    expect(evaluateSetFilter({ op: 'lt', path: 'mastery', value: 30 }, ALICE)).toBe(false);
    expect(evaluateSetFilter({ op: 'le', path: 'mastery', value: 30 }, ALICE)).toBe(true);
    expect(evaluateSetFilter({ op: 'gt', path: 'mastery', value: 50 }, BOB)).toBe(true);
    expect(evaluateSetFilter({ op: 'ge', path: 'mastery', value: 90 }, BOB)).toBe(true);
  });

  it('lt / le / gt / ge against non-number operands all return false (fail-closed, symmetrically)', () => {
    expect(evaluateSetFilter({ op: 'lt', path: 'name', value: 50 }, ALICE)).toBe(false);
    expect(evaluateSetFilter({ op: 'le', path: 'name', value: 50 }, ALICE)).toBe(false);
    expect(evaluateSetFilter({ op: 'gt', path: 'name', value: 50 }, ALICE)).toBe(false);
    expect(evaluateSetFilter({ op: 'ge', path: 'name', value: 50 }, ALICE)).toBe(false);
    // Symmetric: value side non-numeric.
    expect(
      evaluateSetFilter({ op: 'gt', path: 'mastery', value: 'a' as unknown as number }, ALICE),
    ).toBe(false);
    expect(
      evaluateSetFilter({ op: 'ge', path: 'mastery', value: 'a' as unknown as number }, ALICE),
    ).toBe(false);
  });

  it('eq with null matches only when the value is exactly null', () => {
    const row: FilterRow = { stepId: null };
    expect(evaluateSetFilter({ op: 'eq', path: 'stepId', value: null }, row)).toBe(true);
    const row2: FilterRow = { stepId: 'x' };
    expect(evaluateSetFilter({ op: 'eq', path: 'stepId', value: null }, row2)).toBe(false);
  });

  it('eq does NOT type-coerce (5 !== "5")', () => {
    const row: FilterRow = { count: 5 };
    expect(evaluateSetFilter({ op: 'eq', path: 'count', value: '5' as unknown as number }, row)).toBe(false);
  });
});

describe('in / has', () => {
  it('in matches when the resolved value appears in the values list', () => {
    const f: SetFilter = { op: 'in', path: 'name', values: ['Alice', 'Bob'] };
    expect(evaluateSetFilter(f, ALICE)).toBe(true);
    expect(evaluateSetFilter(f, BOB)).toBe(true);
    expect(evaluateSetFilter(f, CARA)).toBe(false);
  });

  it('has is true when the path resolves to anything not null/undefined', () => {
    expect(evaluateSetFilter({ op: 'has', path: 'name' }, ALICE)).toBe(true);
    expect(evaluateSetFilter({ op: 'has', path: 'missing' }, ALICE)).toBe(false);
    expect(evaluateSetFilter({ op: 'has', path: 'stepId' }, { stepId: null })).toBe(false);
  });
});

describe('boolean ops', () => {
  it('and requires every clause to match', () => {
    const f: SetFilter = {
      op: 'and',
      clauses: [
        { op: 'lt', path: 'mastery', value: 50 },
        { op: 'ge', path: 'engagement', value: 50 },
      ],
    };
    expect(evaluateSetFilter(f, ALICE)).toBe(true); // 30 < 50, 80 >= 50
    expect(evaluateSetFilter(f, BOB)).toBe(false); // 90 not < 50
    expect(evaluateSetFilter(f, CARA)).toBe(false); // 20 < 50 but 20 not >= 50
  });

  it('and on empty clauses returns true (vacuous truth)', () => {
    expect(evaluateSetFilter({ op: 'and', clauses: [] }, ALICE)).toBe(true);
  });

  it('or requires at least one clause to match', () => {
    const f: SetFilter = {
      op: 'or',
      clauses: [
        { op: 'eq', path: 'name', value: 'Alice' },
        { op: 'eq', path: 'name', value: 'Bob' },
      ],
    };
    expect(evaluateSetFilter(f, ALICE)).toBe(true);
    expect(evaluateSetFilter(f, BOB)).toBe(true);
    expect(evaluateSetFilter(f, CARA)).toBe(false);
  });

  it('or on empty clauses returns false', () => {
    expect(evaluateSetFilter({ op: 'or', clauses: [] }, ALICE)).toBe(false);
  });

  it('not inverts a single clause', () => {
    expect(
      evaluateSetFilter(
        { op: 'not', clause: { op: 'eq', path: 'name', value: 'Alice' } },
        ALICE,
      ),
    ).toBe(false);
    expect(
      evaluateSetFilter(
        { op: 'not', clause: { op: 'eq', path: 'name', value: 'Bob' } },
        ALICE,
      ),
    ).toBe(true);
  });

  it('nested and-of-or works as expected', () => {
    const f: SetFilter = {
      op: 'and',
      clauses: [
        {
          op: 'or',
          clauses: [
            { op: 'eq', path: 'name', value: 'Alice' },
            { op: 'eq', path: 'name', value: 'Cara' },
          ],
        },
        { op: 'lt', path: 'mastery', value: 50 },
      ],
    };
    expect(evaluateSetFilter(f, ALICE)).toBe(true); // Alice + 30
    expect(evaluateSetFilter(f, BOB)).toBe(false); // Bob excluded by or
    expect(evaluateSetFilter(f, CARA)).toBe(true); // Cara + 20
  });
});

describe('named (fail-safe stub)', () => {
  it('always returns false until the predicate registry lands', () => {
    const f: SetFilter = { op: 'named', name: 'isHighRisk' };
    expect(evaluateSetFilter(f, ALICE)).toBe(false);
    expect(evaluateSetFilter(f, BOB)).toBe(false);
  });
});

describe('dot-path resolution', () => {
  it('walks nested objects', () => {
    const row: FilterRow = { class: { name: 'Math 101' } };
    expect(evaluateSetFilter({ op: 'eq', path: 'class.name', value: 'Math 101' }, row)).toBe(true);
  });

  it('returns false when walking through null/undefined', () => {
    const row: FilterRow = { class: null };
    expect(evaluateSetFilter({ op: 'eq', path: 'class.name', value: 'anything' }, row)).toBe(false);
    expect(evaluateSetFilter({ op: 'has', path: 'class.name' }, row)).toBe(false);
  });

  it('returns false when an intermediate is a primitive (cannot index into it)', () => {
    const row: FilterRow = { name: 'Alice' };
    expect(evaluateSetFilter({ op: 'has', path: 'name.length' }, row)).toBe(false);
  });
});

describe('canonical strugglingStudents fixture', () => {
  it('the spec §3.9 sample filter selects the right rows', () => {
    const strugglingFilter: SetFilter = {
      op: 'and',
      clauses: [
        { op: 'lt', path: 'mastery', value: 50 },
        { op: 'ge', path: 'engagement', value: 50 },
      ],
    };
    const students: FilterRow[] = [ALICE, BOB, CARA];
    const matching = students.filter((s) => evaluateSetFilter(strugglingFilter, s));
    expect(matching).toEqual([ALICE]);
  });
});
