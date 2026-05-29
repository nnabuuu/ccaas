/**
 * Tests for OntologyRegistry — happy path, read API, queries,
 * duplicate detection, sealing behavior.
 *
 * Validation-specific coverage (cross-def errors via validate(),
 * cascade through out-of-order registration) lives in
 * ontology-registry.validation.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ObjectTypeDef, FunctionDef } from '../../schema/index.js';
import { RegistrationError } from '../../schema/index.js';
import type { ManifestDef } from '../../manifest/index.js';
import { OntologyRegistry } from '../ontology-registry.js';

function student(): ObjectTypeDef {
  return {
    apiName: 'Student',
    displayName: { en: 'Student', zh: '学生' },
    semantic: 'A learner.',
    schema: z.object({ id: z.string(), name: z.string() }),
    links: [],
    actions: [],
    picker: {
      icon: 'user',
      searchFields: ['name'],
      titleField: 'name',
    },
  };
}

function classType(): ObjectTypeDef {
  return {
    apiName: 'Class',
    displayName: '班级',
    semantic: 'A class of students.',
    schema: z.object({ id: z.string(), grade: z.number() }),
    links: [
      {
        apiName: 'contains',
        displayName: 'contains',
        target: 'Student',
        cardinality: '1:N',
        traversable: true,
        semantic: 'students in this class',
      },
      {
        apiName: 'createdBy',
        displayName: 'created by',
        target: 'Student',
        cardinality: 'N:1',
        traversable: false,
        semantic: 'metadata link',
      },
    ],
    actions: [],
  };
}

function lessonSession(): ManifestDef {
  return {
    name: 'LessonSession',
    displayName: '课堂会话',
    schemaVersion: '0.1.0',
    semantic: 'A run of a lesson.',
    slots: [
      {
        apiName: 'students',
        displayName: 'students',
        target: { kind: 'objectType', apiName: 'Student' },
        collection: true,
        semantic: 'enrolled students',
      },
    ],
    state: [],
    boundaries: [],
  };
}

describe('register + get happy path', () => {
  it('registers and retrieves an ObjectType', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    expect(r.getObjectType('Student')?.apiName).toBe('Student');
  });

  it('registers and retrieves a Manifest', () => {
    const r = new OntologyRegistry();
    r.registerManifest(lessonSession());
    expect(r.getManifest('LessonSession')?.name).toBe('LessonSession');
  });

  it('registers and retrieves a Function', () => {
    const r = new OntologyRegistry();
    const f: FunctionDef = {
      apiName: 'computeScore',
      displayName: 'compute',
      params: z.object({ id: z.string() }),
      returnType: z.number(),
      semantic: 'pure',
      allowedRoles: ['agent'],
    };
    r.registerFunction(f);
    expect(r.getFunction('computeScore')?.apiName).toBe('computeScore');
  });

  it('returns undefined for unregistered apiNames', () => {
    const r = new OntologyRegistry();
    expect(r.getObjectType('Ghost')).toBeUndefined();
    expect(r.getManifest('Ghost')).toBeUndefined();
    expect(r.getFunction('Ghost')).toBeUndefined();
  });

  it('getAll* returns registered defs', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    r.registerObjectType(classType());
    expect(r.getAllObjectTypes()).toHaveLength(2);
  });
});

describe('duplicate detection', () => {
  it('rejects duplicate ObjectType apiName', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    expect(() => r.registerObjectType(student())).toThrow(RegistrationError);
  });

  it('rejects duplicate Manifest name', () => {
    const r = new OntologyRegistry();
    r.registerManifest(lessonSession());
    expect(() => r.registerManifest(lessonSession())).toThrow(RegistrationError);
  });

  it('duplicate error carries DUPLICATE_DEFINITION code', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    try {
      r.registerObjectType(student());
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RegistrationError);
      const re = e as RegistrationError;
      expect(re.errors[0]?.code).toBe('DUPLICATE_DEFINITION');
    }
  });
});

describe('local validation throws on registerObjectType', () => {
  it('rejects empty semantic eagerly', () => {
    const r = new OntologyRegistry();
    const bad: ObjectTypeDef = { ...student(), semantic: '' };
    expect(() => r.registerObjectType(bad)).toThrow(RegistrationError);
    expect(r.getObjectType('Student')).toBeUndefined();
  });
});

describe('convenience queries', () => {
  it('getPickableTypes filters to those with picker', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student()); // has picker
    r.registerObjectType(classType()); // no picker
    const pickable = r.getPickableTypes();
    expect(pickable.map((t) => t.apiName)).toEqual(['Student']);
  });

  it('getTraversableLinks excludes traversable:false', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(classType());
    const links = r.getTraversableLinks('Class');
    expect(links.map((l) => l.apiName)).toEqual(['contains']);
  });

  it('getTraversableLinks returns [] for unknown type', () => {
    expect(new OntologyRegistry().getTraversableLinks('Ghost')).toEqual([]);
  });

  it('getManifestsForType returns manifests slotting the type', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    r.registerManifest(lessonSession());
    expect(r.getManifestsForType('Student').map((m) => m.name)).toEqual([
      'LessonSession',
    ]);
    expect(r.getManifestsForType('Ghost')).toEqual([]);
  });
});

describe('getDisplayName', () => {
  it('resolves plain-string displayName', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(classType()); // displayName: '班级' (plain string)
    expect(r.getDisplayName('Class')).toBe('班级');
    expect(r.getDisplayName('Class', 'zh')).toBe('班级');
  });

  it('resolves localized displayName by locale', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student()); // displayName: { en, zh }
    expect(r.getDisplayName('Student', 'en')).toBe('Student');
    expect(r.getDisplayName('Student', 'zh')).toBe('学生');
  });

  it('falls back to en when locale missing', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    expect(r.getDisplayName('Student', 'fr')).toBe('Student');
  });

  it('falls back to apiName when no def found', () => {
    expect(new OntologyRegistry().getDisplayName('Ghost')).toBe('Ghost');
  });
});

describe('seal', () => {
  it('blocks further registration after seal', () => {
    const r = new OntologyRegistry();
    r.registerObjectType(student());
    r.seal();
    expect(r.isSealed()).toBe(true);
    expect(() => r.registerObjectType(classType())).toThrow();
  });

  it('seal runs validation; throws if cross-def invariants fail', () => {
    const r = new OntologyRegistry();
    r.registerManifest({
      ...lessonSession(),
      slots: [
        {
          apiName: 'students',
          displayName: 'students',
          target: { kind: 'objectType', apiName: 'Student' }, // not registered
          collection: true,
          semantic: 'enrolled',
        },
      ],
    });
    expect(() => r.seal()).toThrow(RegistrationError);
    // seal failed; sealed flag should not have flipped
    expect(r.isSealed()).toBe(false);
  });
});

describe('getSchemaDigest (Phase 7 stub)', () => {
  it('returns a placeholder; real impl lands in commit 8', () => {
    const r = new OntologyRegistry();
    expect(r.getSchemaDigest()).toContain('phase-8-pending');
  });
});
