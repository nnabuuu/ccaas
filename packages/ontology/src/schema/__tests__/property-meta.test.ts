/**
 * Type-level tests for `PropertyMeta` + `PropertyMetaMap`.
 *
 * The interesting property of `PropertyMetaMap<S>` is that the keys
 * are constrained to `keyof z.infer<S>` — misspelling a field name
 * is a compile error. We exercise both the positive case (valid keys
 * compile) and the negative case (invalid keys fail) via
 * `@ts-expect-error` comments.
 *
 * vitest runs these as runtime tests too, but the assertion that
 * matters is that `tsc --noEmit` accepts the positive cases and
 * rejects the negative ones (verified at build time).
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { PropertyMeta, PropertyMetaMap } from '../property-meta.js';

const StudentSchema = z.object({
  id: z.string(),
  name: z.string(),
  engagementScore: z.number(),
});

describe('PropertyMetaMap', () => {
  it('accepts a map keyed by valid field names', () => {
    const meta: PropertyMetaMap<typeof StudentSchema> = {
      name: { searchable: true, displayRole: 'title' },
      engagementScore: { computed: true },
    };
    expect(meta.name?.searchable).toBe(true);
    expect(meta.engagementScore?.computed).toBe(true);
  });

  it('accepts an empty map (every entry is optional)', () => {
    const meta: PropertyMetaMap<typeof StudentSchema> = {};
    expect(Object.keys(meta)).toHaveLength(0);
  });

  it('rejects misnamed keys at compile time', () => {
    const meta: PropertyMetaMap<typeof StudentSchema> = {
      // @ts-expect-error — 'foo' is not a key of StudentSchema's inferred type
      foo: { searchable: true },
    };
    // Runtime presence is not the test; the test is that the line
    // above fails to type-check without the @ts-expect-error.
    expect(meta).toBeDefined();
  });

  it('allows partial entries — searchable without displayRole, etc.', () => {
    const meta: PropertyMetaMap<typeof StudentSchema> = {
      name: { searchable: true },
    };
    expect(meta.name?.displayRole).toBeUndefined();
  });
});

describe('PropertyMeta', () => {
  it('all fields are optional', () => {
    const empty: PropertyMeta = {};
    expect(empty).toEqual({});
  });

  it('displayRole accepts the documented enum values', () => {
    const roles: PropertyMeta['displayRole'][] = [
      'title',
      'subtitle',
      'badge',
      'body',
      'hidden',
      undefined,
    ];
    expect(roles).toHaveLength(6);
  });
});
