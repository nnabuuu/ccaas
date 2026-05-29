/**
 * Type-shape tests for `ObjectTypeDef` + `PickerConfig`.
 *
 * Exercises the full composition: Zod schema + meta sidecar +
 * links + actions + picker. Also confirms that Phase 4/5 fields
 * (`implements`, `validationRules`, `stateMachine`) are NOT
 * accepted — attempting to set them is a compile error.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ObjectTypeDef, PickerConfig } from '../object-type.js';
import { objectRef } from '../zod-helpers.js';

const StudentSchema = z.object({
  id: z.string(),
  name: z.string().describe('Student display name.'),
  engagementScore: z.number().min(0).max(100),
  classId: objectRef('Class'),
});

describe('ObjectTypeDef', () => {
  it('composes with schema + meta + links + actions + picker', () => {
    const Student: ObjectTypeDef<typeof StudentSchema> = {
      apiName: 'Student',
      displayName: '学生',
      semantic: 'A single student in a Class.',
      schema: StudentSchema,
      meta: {
        name: { searchable: true, displayRole: 'title' },
        engagementScore: { computed: true },
      },
      links: [
        {
          apiName: 'class',
          displayName: '所属班级',
          target: 'Class',
          cardinality: 'N:1',
          inverse: 'contains',
          traversable: true,
          semantic: 'The class this student belongs to.',
        },
      ],
      actions: [],
      picker: {
        icon: '🧑‍🎓',
        color: 'green',
        searchFields: ['name'],
        titleField: 'name',
        crossManifestSources: ['sibling'],
      },
    };
    expect(Student.apiName).toBe('Student');
    expect(Student.meta?.name?.searchable).toBe(true);
  });

  it('rejects Phase 4 field `implements` at compile time', () => {
    const x: ObjectTypeDef<typeof StudentSchema> = {
      apiName: 'X',
      displayName: 'X',
      semantic: 's',
      schema: StudentSchema,
      links: [],
      actions: [],
      // @ts-expect-error — Tier 2; lands in Phase 4
      implements: ['Mentionable'],
    };
    expect(x.apiName).toBe('X');
  });

  it('rejects Phase 5 field `validationRules` at compile time', () => {
    const x: ObjectTypeDef<typeof StudentSchema> = {
      apiName: 'X',
      displayName: 'X',
      semantic: 's',
      schema: StudentSchema,
      links: [],
      actions: [],
      // @ts-expect-error — Tier 3 (G7); lands in Phase 5
      validationRules: [],
    };
    expect(x.apiName).toBe('X');
  });

  it('rejects Phase 5 field `stateMachine` at compile time', () => {
    const x: ObjectTypeDef<typeof StudentSchema> = {
      apiName: 'X',
      displayName: 'X',
      semantic: 's',
      schema: StudentSchema,
      links: [],
      actions: [],
      // @ts-expect-error — Tier 3 (G8); lands in Phase 5
      stateMachine: { property: 'name', transitions: [] },
    };
    expect(x.apiName).toBe('X');
  });
});

describe('PickerConfig', () => {
  it('crossManifestSources accepts the three documented variants', () => {
    const c: PickerConfig = {
      icon: 'x',
      searchFields: ['a'],
      titleField: 'a',
      crossManifestSources: ['parent', 'sibling', 'all'],
    };
    expect(c.crossManifestSources).toHaveLength(3);
  });
});
