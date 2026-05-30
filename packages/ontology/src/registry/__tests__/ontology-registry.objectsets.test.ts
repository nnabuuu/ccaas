/**
 * Phase 4 (Tier 2 — partial) — OntologyRegistry methods for
 * ObjectSetDef. Cross-def filter-path validation is exercised in
 * the integration test (Step 8); this file covers the
 * registry-surface contract:
 *
 *   - registerObjectSet runs local validation eagerly + rejects
 *     duplicates
 *   - getObjectSet / getAllObjectSets / getObjectSetsForType
 *     return the right defs
 *   - context() exposes the objectSets map
 */

import { describe, expect, it } from 'vitest';
import type { ObjectSetDef } from '../../schema/index.js';
import { RegistrationError } from '../../schema/index.js';
import { OntologyRegistry } from '../ontology-registry.js';

function struggling(): ObjectSetDef {
  return {
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
    semantic: 'Low mastery but engaged.',
  };
}

function atRisk(): ObjectSetDef {
  return {
    apiName: 'atRiskStudents',
    displayName: '风险学生',
    objectType: 'Student',
    filter: {
      op: 'and',
      clauses: [
        { op: 'lt', path: 'mastery', value: 50 },
        { op: 'lt', path: 'engagement', value: 50 },
      ],
    },
    semantic: 'Low mastery and disengaged.',
  };
}

function activeAssignments(): ObjectSetDef {
  return {
    apiName: 'activeAssignments',
    displayName: 'Active assignments',
    objectType: 'Assignment',
    filter: { op: 'eq', path: 'status', value: 'open' },
    semantic: 'Assignments currently open.',
  };
}

describe('registerObjectSet', () => {
  it('stores the def keyed by apiName', () => {
    const r = new OntologyRegistry();
    const s = struggling();
    r.registerObjectSet(s);
    expect(r.getObjectSet('strugglingStudents')).toBe(s);
  });

  it('rejects duplicate apiName', () => {
    const r = new OntologyRegistry();
    r.registerObjectSet(struggling());
    expect(() => r.registerObjectSet(struggling())).toThrow(RegistrationError);
  });

  it('duplicate error carries DUPLICATE_DEFINITION code', () => {
    const r = new OntologyRegistry();
    r.registerObjectSet(struggling());
    try {
      r.registerObjectSet(struggling());
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RegistrationError);
      const re = e as RegistrationError;
      expect(re.errors[0]?.code).toBe('DUPLICATE_DEFINITION');
    }
  });

  it('rejects empty semantic at register time', () => {
    const r = new OntologyRegistry();
    expect(() =>
      r.registerObjectSet({ ...struggling(), semantic: '' }),
    ).toThrow(RegistrationError);
  });

  it('rejects registration after seal', () => {
    const r = new OntologyRegistry();
    r.seal();
    expect(() => r.registerObjectSet(struggling())).toThrow(/sealed/);
  });
});

describe('getObjectSet / getAllObjectSets', () => {
  it('getObjectSet returns undefined for unknown apiName', () => {
    expect(new OntologyRegistry().getObjectSet('ghost')).toBeUndefined();
  });

  it('getAllObjectSets returns every registered def', () => {
    const r = new OntologyRegistry();
    r.registerObjectSet(struggling());
    r.registerObjectSet(atRisk());
    r.registerObjectSet(activeAssignments());
    expect(r.getAllObjectSets()).toHaveLength(3);
  });
});

describe('getObjectSetsForType', () => {
  it('filters by objectType apiName', () => {
    const r = new OntologyRegistry();
    r.registerObjectSet(struggling()); // Student
    r.registerObjectSet(atRisk()); // Student
    r.registerObjectSet(activeAssignments()); // Assignment
    const studentSets = r.getObjectSetsForType('Student');
    expect(studentSets.map((s) => s.apiName).sort()).toEqual([
      'atRiskStudents',
      'strugglingStudents',
    ]);
    const assignmentSets = r.getObjectSetsForType('Assignment');
    expect(assignmentSets.map((s) => s.apiName)).toEqual(['activeAssignments']);
  });

  it('returns empty array when no sets target the given type', () => {
    const r = new OntologyRegistry();
    r.registerObjectSet(struggling());
    expect(r.getObjectSetsForType('Resource')).toEqual([]);
  });
});

describe('context() exposes objectSets', () => {
  it('the returned ValidationContext includes the objectSets map', () => {
    const r = new OntologyRegistry();
    r.registerObjectSet(struggling());
    const ctx = r.context();
    expect(ctx.objectSets).toBeDefined();
    expect(ctx.objectSets?.has('strugglingStudents')).toBe(true);
  });
});
