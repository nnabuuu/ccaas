/**
 * Tests for `EntityRegistry.getObjectTypeSchema` (Phase 2 addition).
 *
 * The accessor reads the Zod schema from the underlying
 * `OntologyRegistry` for a registered type. Phase 2 ships a
 * placeholder `z.object({}).passthrough()` for every type because
 * `ReferenceableOptions` carries no schema; solutions can upgrade
 * later by registering via `defineObjectType` directly.
 *
 * This test file covers the contract:
 *   - Returns a Zod object for a registered type
 *   - Returns `undefined` for an unregistered type
 *   - The returned schema actually validates (proves it's a real Zod
 *     schema, not a fake structural object)
 *   - The placeholder accepts any shape (passthrough behavior)
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EntityRegistry } from '../entity-registry.js';
import type { ReferenceableOptions } from '../interfaces.js';

const RECIPE_OPTS: ReferenceableOptions = {
  type: 'recipe',
  displayName: '食谱',
  icon: '🍳',
  color: 'orange',
  abilities: { search: true, browse: true, resolve: true, track: true },
};

describe('EntityRegistry.getObjectTypeSchema', () => {
  it('returns a Zod object for a registered type', () => {
    const r = new EntityRegistry();
    r.register(RECIPE_OPTS);
    const schema = r.getObjectTypeSchema('recipe');
    expect(schema).toBeDefined();
    expect(schema).toBeInstanceOf(z.ZodObject);
  });

  it('returns undefined for an unregistered type', () => {
    expect(new EntityRegistry().getObjectTypeSchema('ghost')).toBeUndefined();
  });

  it('the returned schema actually parses an empty object successfully', () => {
    const r = new EntityRegistry();
    r.register(RECIPE_OPTS);
    const schema = r.getObjectTypeSchema('recipe');
    const parsed = schema!.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it('the placeholder schema accepts arbitrary extra fields (passthrough)', () => {
    // Phase 2 ships z.object({}).passthrough() — entity instances
    // have undeclared fields, and we don't want a strict-shape schema
    // to reject them. This test pins the passthrough behavior so a
    // future tightening (e.g. switching to z.object({}).strict())
    // is a conscious change with a test failure to signal it.
    const r = new EntityRegistry();
    r.register(RECIPE_OPTS);
    const schema = r.getObjectTypeSchema('recipe');
    const parsed = schema!.safeParse({
      id: 'rec-1',
      name: '番茄炒蛋',
      ingredients: ['番茄', '鸡蛋'],
      extraNestedField: { whatever: true },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Passthrough preserves unknown keys
      expect(parsed.data).toMatchObject({
        id: 'rec-1',
        name: '番茄炒蛋',
      });
    }
  });

  it('the schema accessor still returns a valid Zod schema after re-registration', () => {
    // After register-with-overwrite, the schema must still be a
    // valid placeholder. (We deliberately don't assert instance
    // identity vs the pre-overwrite schema — the implementation may
    // share a hoisted constant or rebuild; the contract is "valid
    // schema after overwrite", not "fresh instance".)
    const r = new EntityRegistry();
    r.register(RECIPE_OPTS);
    r.register({ ...RECIPE_OPTS, displayName: '更新菜谱' });
    const after = r.getObjectTypeSchema('recipe');
    expect(after).toBeDefined();
    expect(after).toBeInstanceOf(z.ZodObject);
    expect(after!.safeParse({ id: 'x', anything: 1 }).success).toBe(true);
  });
});
