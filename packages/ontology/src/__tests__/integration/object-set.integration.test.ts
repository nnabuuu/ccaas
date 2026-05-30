/**
 * End-to-end integration test for the Phase 4 (Tier 2 — partial)
 * ObjectSetDef sliver.
 *
 * Wires every layer together:
 *
 *   helpers (defineObjectType + defineObjectSet)
 *     → schema primitives (ObjectSetDef + SetFilter)
 *     → registry registration + seal() (runs cross-def validation
 *       including SetFilter path resolution against the target
 *       ObjectType's Zod schema)
 *     → query API (getObjectSet + getObjectSetsForType)
 *     → evaluateSetFilter against a real fixture of students
 *
 * Uses the canonical live-lesson strugglingStudents motivating
 * example from the Phase 4 trigger-candidates audit (PROGRESS.md).
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  defineObjectSet,
  defineObjectType,
  evaluateSetFilter,
  OntologyRegistry,
  RegistrationError,
  type FilterRow,
  type ObjectSetDef,
} from '../../index.js';

// ────────────────────────────────────────────────────────────────────
// Fixture
// ────────────────────────────────────────────────────────────────────

function buildOntologyWithStudents(): {
  registry: OntologyRegistry;
  strugglingStudents: ObjectSetDef;
} {
  const Student = defineObjectType({
    apiName: 'Student',
    displayName: 'Student',
    semantic: 'A learner in a class.',
    schema: z.object({
      id: z.string(),
      name: z.string(),
      mastery: z.number().min(0).max(100),
      engagement: z.number().min(0).max(100),
    }),
    links: [],
    actions: [],
  });

  const strugglingStudents = defineObjectSet({
    apiName: 'strugglingStudents',
    displayName: { en: 'Struggling students', zh: '挣扎中的学生' },
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
    semantic: 'Students with low mastery but still actively engaged.',
  });

  const registry = new OntologyRegistry();
  registry.registerObjectType(Student);
  registry.registerObjectSet(strugglingStudents);
  registry.seal();

  return { registry, strugglingStudents };
}

const ALICE: FilterRow = { id: 'a', name: 'Alice', mastery: 30, engagement: 80 };
const BOB: FilterRow = { id: 'b', name: 'Bob', mastery: 90, engagement: 90 };
const CARA: FilterRow = { id: 'c', name: 'Cara', mastery: 20, engagement: 20 };
const DAN: FilterRow = { id: 'd', name: 'Dan', mastery: 40, engagement: 60 };
// Eli sits exactly on the `engagement >= 50` boundary. He distinguishes
// `ge` (which matches him) from `gt` (which doesn't). A bug that flipped
// the filter's `ge` to `gt` would un-match Eli — without him the
// integration test wouldn't notice.
const ELI: FilterRow = { id: 'e', name: 'Eli', mastery: 30, engagement: 50 };
const ALL_STUDENTS = [ALICE, BOB, CARA, DAN, ELI] as const;

// ────────────────────────────────────────────────────────────────────
// Registration + seal end-to-end
// ────────────────────────────────────────────────────────────────────

describe('ObjectSetDef end-to-end via registry + seal', () => {
  it('register + seal succeeds for the strugglingStudents fixture', () => {
    expect(() => buildOntologyWithStudents()).not.toThrow();
  });

  it('getObjectSet returns the registered def', () => {
    const { registry, strugglingStudents } = buildOntologyWithStudents();
    expect(registry.getObjectSet('strugglingStudents')).toBe(strugglingStudents);
  });

  it('getObjectSetsForType("Student") returns the set', () => {
    const { registry } = buildOntologyWithStudents();
    const sets = registry.getObjectSetsForType('Student');
    expect(sets.map((s) => s.apiName)).toEqual(['strugglingStudents']);
  });

  it('getObjectSetsForType returns empty for an unrelated type', () => {
    const { registry } = buildOntologyWithStudents();
    expect(registry.getObjectSetsForType('Resource')).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────
// Filter evaluation against fixture rows — the canonical proof
// ────────────────────────────────────────────────────────────────────

describe('strugglingStudents filter selects the right subset', () => {
  it('Alice matches (mastery 30 < 50, engagement 80 >= 50)', () => {
    const { strugglingStudents } = buildOntologyWithStudents();
    expect(evaluateSetFilter(strugglingStudents.filter, ALICE)).toBe(true);
  });

  it('Bob does not match (mastery 90 not < 50)', () => {
    const { strugglingStudents } = buildOntologyWithStudents();
    expect(evaluateSetFilter(strugglingStudents.filter, BOB)).toBe(false);
  });

  it('Cara does not match (engagement 20 not >= 50)', () => {
    const { strugglingStudents } = buildOntologyWithStudents();
    expect(evaluateSetFilter(strugglingStudents.filter, CARA)).toBe(false);
  });

  it('Dan matches (mastery 40 < 50, engagement 60 >= 50)', () => {
    const { strugglingStudents } = buildOntologyWithStudents();
    expect(evaluateSetFilter(strugglingStudents.filter, DAN)).toBe(true);
  });

  it('Eli matches at the ge-50 boundary (engagement exactly 50)', () => {
    // Probes `ge` vs `gt` — a regression that flipped the operator
    // would drop Eli but keep Alice/Dan.
    const { strugglingStudents } = buildOntologyWithStudents();
    expect(evaluateSetFilter(strugglingStudents.filter, ELI)).toBe(true);
  });

  it('filtering the whole class yields exactly { Alice, Dan, Eli }', () => {
    const { strugglingStudents } = buildOntologyWithStudents();
    const matching = ALL_STUDENTS.filter((s) =>
      evaluateSetFilter(strugglingStudents.filter, s),
    );
    expect(matching.map((s) => s.id).sort()).toEqual(['a', 'd', 'e']);
  });
});

// ────────────────────────────────────────────────────────────────────
// Cross-def validation errors caught at seal()
// ────────────────────────────────────────────────────────────────────

describe('seal() rejects ObjectSetDefs with unresolved paths', () => {
  it('rejects a filter referencing a missing field on the target', () => {
    const Student = defineObjectType({
      apiName: 'Student',
      displayName: 'Student',
      semantic: 'a learner',
      schema: z.object({ id: z.string(), mastery: z.number() }),
      links: [],
      actions: [],
    });
    const bad = defineObjectSet({
      apiName: 'bad',
      displayName: 'bad',
      objectType: 'Student',
      filter: { op: 'eq', path: 'engagement', value: 50 }, // engagement not in schema
      semantic: 's',
    });
    const r = new OntologyRegistry();
    r.registerObjectType(Student);
    r.registerObjectSet(bad);
    try {
      r.seal();
      throw new Error('seal should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RegistrationError);
      const re = e as RegistrationError;
      expect(re.errors.some((x) => x.code === 'OBJECTSET_FIELD_UNRESOLVED')).toBe(true);
    }
  });

  it('rejects a filter targeting an unregistered ObjectType', () => {
    const orphan = defineObjectSet({
      apiName: 'orphan',
      displayName: 'orphan',
      objectType: 'Ghost',
      filter: { op: 'has', path: 'id' },
      semantic: 's',
    });
    const r = new OntologyRegistry();
    r.registerObjectSet(orphan);
    try {
      r.seal();
      throw new Error('seal should have thrown');
    } catch (e) {
      const re = e as RegistrationError;
      expect(re.errors.some((x) => x.code === 'OBJECTSET_TARGET_UNRESOLVED')).toBe(true);
    }
  });
});
