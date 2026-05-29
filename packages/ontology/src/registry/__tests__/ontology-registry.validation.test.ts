/**
 * Cross-def validation + out-of-order registration tests.
 *
 * Splits from the main test file so it's clear when these break — the
 * deferred-validation contract is the part most likely to regress.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ObjectTypeDef } from '../../schema/index.js';
import { RegistrationError } from '../../schema/index.js';
import type { ManifestDef } from '../../manifest/index.js';
import { OntologyRegistry } from '../ontology-registry.js';

function lessonSessionRefsStudent(): ManifestDef {
  return {
    name: 'LessonSession',
    displayName: 'LessonSession',
    schemaVersion: '0.1.0',
    semantic: 'lesson',
    slots: [
      {
        apiName: 'students',
        displayName: 'students',
        target: { kind: 'objectType', apiName: 'Student' },
        collection: true,
        semantic: 'students',
      },
    ],
    state: [],
    boundaries: [],
  };
}

function student(): ObjectTypeDef {
  return {
    apiName: 'Student',
    displayName: 'Student',
    semantic: 's',
    schema: z.object({ id: z.string() }),
    links: [],
    actions: [],
  };
}

describe('out-of-order registration', () => {
  it('allows manifest to be registered before its slot target ObjectType', () => {
    const r = new OntologyRegistry();
    // No throw — local validation only for register*
    r.registerManifest(lessonSessionRefsStudent());
    r.registerObjectType(student());
    // Now cross-def validation passes
    expect(() => r.validate()).not.toThrow();
  });

  it('validate() throws when target is still missing', () => {
    const r = new OntologyRegistry();
    r.registerManifest(lessonSessionRefsStudent());
    expect(() => r.validate()).toThrow(RegistrationError);
  });

  it('validate() is idempotent — safe to call repeatedly', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    r.registerManifest(lessonSessionRefsStudent());
    r.validate();
    r.validate();
    r.validate();
    expect(r.getAllObjectTypes()).toHaveLength(1);
  });
});

describe('validate() surfaces cross-def errors', () => {
  it('reports LINK_TARGET_UNRESOLVED across types', () => {
    const r = new OntologyRegistry();
    const teacher: ObjectTypeDef = {
      ...student(),
      apiName: 'Teacher',
      links: [
        {
          apiName: 'teaches',
          displayName: 'teaches',
          target: 'Ghost',
          cardinality: '1:N',
          semantic: 'class taught',
        },
      ],
    };
    r.registerObjectType(teacher);
    try {
      r.validate();
      throw new Error('expected validate() to throw');
    } catch (e) {
      const re = e as RegistrationError;
      expect(re).toBeInstanceOf(RegistrationError);
      expect(re.errors.some((e) => e.code === 'LINK_TARGET_UNRESOLVED')).toBe(true);
    }
  });

  it('aggregates multiple errors in one throw', () => {
    const r = new OntologyRegistry();
    // Manifest with both an unresolved slot target AND a missing
    // state field referenced by a precondition (after Plan is added).
    const plan: ObjectTypeDef = {
      ...student(),
      apiName: 'Plan',
      actions: [
        {
          apiName: 'adj',
          displayName: 'adj',
          params: z.object({}),
          sideEffects: [],
          allowedRoles: ['agent'],
          auditLevel: 'log',
          semantic: 'a',
          preconditions: [{ kind: 'stateEquals', path: 'ghost', value: 1 }],
        },
      ],
    };
    r.registerObjectType(plan);
    r.registerManifest({
      name: 'M',
      displayName: 'M',
      schemaVersion: '0.1.0',
      semantic: 'm',
      slots: [
        {
          apiName: 'plan',
          displayName: 'plan',
          target: { kind: 'objectType', apiName: 'Plan' },
          semantic: 'plan',
        },
        {
          apiName: 'students',
          displayName: 'students',
          target: { kind: 'objectType', apiName: 'StillGhost' },
          semantic: 'students',
        },
      ],
      state: [],
      boundaries: [],
    });
    try {
      r.validate();
      throw new Error('expected validate() to throw');
    } catch (e) {
      const re = e as RegistrationError;
      expect(re).toBeInstanceOf(RegistrationError);
      const codes = re.errors.map((x) => x.code);
      expect(codes).toContain('SLOT_TARGET_UNRESOLVED');
      expect(codes).toContain('PRECONDITION_STATE_UNRESOLVED');
    }
  });
});
