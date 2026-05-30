/**
 * Tests for `objectRef` + `getObjectRefTarget` — the branded Zod
 * helpers that let us declare typed cross-object references inside a
 * Zod schema without inventing a separate "ref type."
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  objectRef,
  getObjectRefTarget,
  objectSetRef,
  getObjectSetRefTarget,
} from '../zod-helpers.js';

describe('objectRef', () => {
  it('returns a Zod string that parses string input', () => {
    const ref = objectRef('Class');
    const result = ref.parse('abc-123');
    expect(result).toBe('abc-123');
  });

  it('rejects non-string input at parse time', () => {
    const ref = objectRef('Class');
    expect(() => ref.parse(42)).toThrow();
    expect(() => ref.parse(null)).toThrow();
  });
});

describe('getObjectRefTarget', () => {
  it('recovers the target ObjectType name from a decorated schema', () => {
    const ref = objectRef('Class');
    expect(getObjectRefTarget(ref)).toBe('Class');
  });

  it('returns the same target for different decorated instances', () => {
    const refA = objectRef('Student');
    const refB = objectRef('Student');
    expect(getObjectRefTarget(refA)).toBe('Student');
    expect(getObjectRefTarget(refB)).toBe('Student');
  });

  it('distinguishes different targets', () => {
    expect(getObjectRefTarget(objectRef('Class'))).toBe('Class');
    expect(getObjectRefTarget(objectRef('Student'))).toBe('Student');
    expect(getObjectRefTarget(objectRef('Teacher'))).toBe('Teacher');
  });

  it('returns undefined for a plain (non-decorated) Zod schema', () => {
    expect(getObjectRefTarget(z.string())).toBeUndefined();
    expect(getObjectRefTarget(z.number())).toBeUndefined();
    expect(getObjectRefTarget(z.object({}))).toBeUndefined();
  });

  it('returns undefined for an objectRef wrapped in .optional() — wrapper has its own _def', () => {
    // Documented limitation: validators must reach through wrappers to
    // find the brand. The runtime helper does not auto-unwrap; that's
    // the validator's responsibility (commit 6).
    const wrapped = objectRef('Class').optional();
    expect(getObjectRefTarget(wrapped)).toBeUndefined();
  });

  it('lets the underlying brand round-trip through a z.object', () => {
    const StudentSchema = z.object({
      id: z.string(),
      classId: objectRef('Class'),
    });
    const classIdSchema = StudentSchema.shape.classId;
    expect(getObjectRefTarget(classIdSchema)).toBe('Class');
  });
});

describe('objectSetRef + getObjectSetRefTarget (Phase 4)', () => {
  it('recovers the ObjectSet apiName from a decorated schema', () => {
    const ref = objectSetRef('strugglingStudents');
    expect(getObjectSetRefTarget(ref)).toBe('strugglingStudents');
  });

  it('parses string input like objectRef', () => {
    const ref = objectSetRef('atRiskStudents');
    expect(ref.parse('subset-1')).toBe('subset-1');
    expect(() => ref.parse(42)).toThrow();
  });

  it('distinguishes objectSetRef from objectRef on the same string target', () => {
    // Both target the literal string 'Student' but they're semantically
    // different references — objectSetRef points at an ObjectSetDef,
    // objectRef at an ObjectTypeDef. The runtime helpers see them as
    // separate brands.
    const setRef = objectSetRef('Student');
    const objRef = objectRef('Student');
    expect(getObjectSetRefTarget(setRef)).toBe('Student');
    expect(getObjectRefTarget(setRef)).toBeUndefined();
    expect(getObjectRefTarget(objRef)).toBe('Student');
    expect(getObjectSetRefTarget(objRef)).toBeUndefined();
  });

  it('returns undefined for plain Zod schemas', () => {
    expect(getObjectSetRefTarget(z.string())).toBeUndefined();
    expect(getObjectSetRefTarget(z.object({}))).toBeUndefined();
  });

  it('returns undefined for a wrapped objectSetRef (.optional)', () => {
    const wrapped = objectSetRef('strugglingStudents').optional();
    expect(getObjectSetRefTarget(wrapped)).toBeUndefined();
  });
});
