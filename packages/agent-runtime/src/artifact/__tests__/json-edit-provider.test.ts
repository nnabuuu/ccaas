/**
 * JsonEditProvider tests.
 *
 * Covers field_set (RFC 6901), json_patch (RFC 6902 add/remove/replace),
 * wholesale replace, schema validation pass+fail, atomicity (no
 * mutation of input on failure), unsupported-op errors, and that
 * updatedAt advances on success.
 */

import { describe, it, expect } from 'vitest';

import { JsonEditProvider } from '../json-edit-provider.js';
import type { Artifact } from '../types.js';
import type { SchemaValidator } from '../../schema/types.js';

function makeArtifact<T>(content: T): Artifact<T> {
  return {
    id: 'a-1',
    projectId: 'p-1',
    path: 'plan.json',
    type: 'json',
    content,
    attributes: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('JsonEditProvider', () => {
  describe('field_set (RFC 6901)', () => {
    it('sets a top-level field', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({ name: 'old' } as object), [
        { op: 'field_set', path: '/name', value: 'new' },
      ]);
      expect(r.success).toBe(true);
      expect(r.artifact!.content).toEqual({ name: 'new' });
    });

    it('sets a nested field, creating missing intermediates', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({} as object), [
        { op: 'field_set', path: '/foo/bar/baz', value: 42 },
      ]);
      expect(r.success).toBe(true);
      expect(r.artifact!.content).toEqual({ foo: { bar: { baz: 42 } } });
    });

    it('sets an array index', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({ items: ['a', 'b', 'c'] } as object), [
        { op: 'field_set', path: '/items/1', value: 'B' },
      ]);
      expect(r.success).toBe(true);
      expect((r.artifact!.content as { items: string[] }).items).toEqual(['a', 'B', 'c']);
    });

    it('appends to array via "-" pointer token', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({ items: ['a'] } as object), [
        { op: 'field_set', path: '/items/-', value: 'b' },
      ]);
      expect((r.artifact!.content as { items: string[] }).items).toEqual(['a', 'b']);
    });

    it('decodes ~1 and ~0 escape sequences in pointer tokens', async () => {
      const ed = new JsonEditProvider();
      // Set a key literally containing "/" → "a/b" → escaped as "a~1b"
      const r = await ed.edit(makeArtifact({} as object), [
        { op: 'field_set', path: '/a~1b', value: 1 },
      ]);
      expect(r.artifact!.content).toEqual({ 'a/b': 1 });
    });

    it('rejects malformed ~ escapes (must be ~0 or ~1)', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({} as object), [
        { op: 'field_set', path: '/a~2b', value: 1 },
      ]);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/must be followed by "0" or "1"/);
    });

    it('auto-creates an array intermediate when next token is a numeric index', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({} as object), [
        { op: 'field_set', path: '/items/0/title', value: 'first' },
      ]);
      expect(r.success).toBe(true);
      expect(r.artifact!.content).toEqual({ items: [{ title: 'first' }] });
      expect(Array.isArray((r.artifact!.content as { items: unknown }).items)).toBe(true);
    });

    it('auto-creates an array intermediate when next token is "-" (append)', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({} as object), [
        { op: 'field_set', path: '/tags/-', value: 'first' },
      ]);
      expect((r.artifact!.content as { tags: unknown }).tags).toEqual(['first']);
    });
  });

  describe('json_patch (RFC 6902 subset)', () => {
    it('applies a sequence of add/replace/remove ops', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({ a: 1, b: 2 } as object), [
        {
          op: 'json_patch',
          ops: [
            { op: 'add', path: '/c', value: 3 },
            { op: 'replace', path: '/a', value: 10 },
            { op: 'remove', path: '/b' },
          ],
        },
      ]);
      expect(r.artifact!.content).toEqual({ a: 10, c: 3 });
    });

    it('removes an array element by index', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({ items: ['a', 'b', 'c'] } as object), [
        { op: 'json_patch', ops: [{ op: 'remove', path: '/items/1' }] },
      ]);
      expect((r.artifact!.content as { items: string[] }).items).toEqual(['a', 'c']);
    });

    it('returns success:false with clear error on unsupported op (copy)', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({ a: 1 } as object), [
        { op: 'json_patch', ops: [{ op: 'copy', path: '/b', from: '/a' }] },
      ]);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/unsupported json-patch op: "copy"/);
    });
  });

  describe('replace', () => {
    it('replaces the whole content', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({ a: 1 } as object), [
        { op: 'replace', content: { fresh: 'state' } },
      ]);
      expect(r.artifact!.content).toEqual({ fresh: 'state' });
    });
  });

  describe('atomicity / immutability', () => {
    it('returns failure cleanly when an op throws; input untouched', async () => {
      const ed = new JsonEditProvider();
      const input = makeArtifact({ items: [1, 2, 3] } as object);
      const r = await ed.edit(input, [
        { op: 'field_set', path: '/items/0', value: 99 }, // ok
        { op: 'json_patch', ops: [{ op: 'remove', path: '/items/99' }] }, // bad index
      ]);
      expect(r.success).toBe(false);
      // input.content NOT mutated despite the first op having "applied" to a clone
      expect(input.content).toEqual({ items: [1, 2, 3] });
    });

    it('does not mutate input on success either (clone semantics)', async () => {
      const ed = new JsonEditProvider();
      const input = makeArtifact({ a: 1 } as object);
      const before = JSON.stringify(input);
      await ed.edit(input, [{ op: 'field_set', path: '/a', value: 999 }]);
      expect(JSON.stringify(input)).toBe(before);
    });
  });

  describe('schema validation', () => {
    const stricterThanThree: SchemaValidator<{ a: number }> = {
      validate: (v) => {
        const obj = v as { a?: unknown };
        if (typeof obj?.a !== 'number') return { ok: false, error: 'a must be number' };
        if (obj.a < 3) return { ok: false, error: 'a must be >= 3' };
        return { ok: true, value: obj as { a: number } };
      },
    };

    it('passes when post-edit content validates', async () => {
      const ed = new JsonEditProvider({ validator: stricterThanThree });
      const r = await ed.edit(makeArtifact({ a: 1 } as object), [
        { op: 'field_set', path: '/a', value: 5 },
      ]);
      expect(r.success).toBe(true);
    });

    it('returns failure when post-edit content fails schema', async () => {
      const ed = new JsonEditProvider({ validator: stricterThanThree });
      const r = await ed.edit(makeArtifact({ a: 1 } as object), [
        { op: 'field_set', path: '/a', value: 2 },
      ]);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/a must be >= 3/);
    });
  });

  describe('misc', () => {
    it('rejects str_replace with a clear message pointing at MarkdownEditor', async () => {
      const ed = new JsonEditProvider();
      const r = await ed.edit(makeArtifact({ a: 1 } as object), [
        { op: 'str_replace', old_string: 'a', new_string: 'b' },
      ]);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/MarkdownArtifactEditor/);
    });

    it('empty ops array → no-op success with updatedAt advanced', async () => {
      const ed = new JsonEditProvider();
      const input = makeArtifact({ a: 1 } as object);
      const r = await ed.edit(input, []);
      expect(r.success).toBe(true);
      expect(r.artifact!.content).toEqual({ a: 1 });
      expect(r.artifact!.updatedAt).not.toBe(input.updatedAt);
    });

    it('serialize returns pretty JSON', () => {
      const ed = new JsonEditProvider();
      const s = ed.serialize(makeArtifact({ a: 1, b: [2, 3] } as object));
      expect(s).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
    });
  });
});
