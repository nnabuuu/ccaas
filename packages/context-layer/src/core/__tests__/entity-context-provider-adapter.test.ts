/**
 * Tests for `createSingleSlotManifestAccessor`.
 *
 * Covers the full ManifestAccessor surface produced by the adapter
 * against a fake EntityContextProvider:
 *   - getSlot returns the resolved entity's structured data
 *   - getState / setState throw with a clear message
 *   - listActions returns []
 *   - invokeAction resolves to { ok: false, errorCode: 'internal_error' }
 *   - subscribe throws
 *   - the factory rejects non-single-slot manifests
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type {
  AtReference,
  EntityContext,
  EntityContextProvider,
} from '../interfaces.js';
import type { ManifestDef } from '@kedge-agentic/ontology';
import { createSingleSlotManifestAccessor } from '../entity-context-provider-adapter.js';

// ────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────

function recipeManifest(): ManifestDef {
  return {
    name: 'RecipeContext',
    displayName: 'Recipe Context',
    schemaVersion: '0.1.0',
    semantic: 'Single-recipe runtime context for the adapter test.',
    slots: [
      {
        apiName: 'recipe',
        displayName: 'recipe',
        target: { kind: 'objectType', apiName: 'Recipe' },
        required: true,
        semantic: 'The single recipe in this context.',
      },
    ],
    state: [],
    boundaries: [
      { role: 'agent', readable: ['recipe'], writable: [], actions: [] },
    ],
  };
}

function twoSlotManifest(): ManifestDef {
  return {
    ...recipeManifest(),
    name: 'TwoSlot',
    slots: [
      {
        apiName: 'a',
        displayName: 'a',
        target: { kind: 'objectType', apiName: 'A' },
        semantic: 'first',
      },
      {
        apiName: 'b',
        displayName: 'b',
        target: { kind: 'objectType', apiName: 'B' },
        semantic: 'second',
      },
    ],
  };
}

function provider(structured: Record<string, unknown>): EntityContextProvider {
  return {
    async getContext(id: string, _userId: string): Promise<EntityContext> {
      return {
        ref: { type: 'recipe', id, display_name: `Recipe ${id}`, summary: '' },
        structured,
        relations: [],
        attachments: [],
      };
    },
    async search(_q: string, _u: string, _l: number): Promise<AtReference[]> {
      return [];
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Factory contract
// ────────────────────────────────────────────────────────────────────

describe('createSingleSlotManifestAccessor — factory', () => {
  it('rejects a manifest with zero slots', async () => {
    await expect(
      createSingleSlotManifestAccessor({
        manifest: { ...recipeManifest(), slots: [] },
        role: 'agent',
        entityId: 'rec-1',
        userId: 'u1',
        provider: provider({}),
      }),
    ).rejects.toThrow(/exactly 1 slot/);
  });

  it('rejects a manifest with multiple slots', async () => {
    await expect(
      createSingleSlotManifestAccessor({
        manifest: twoSlotManifest(),
        role: 'agent',
        entityId: 'x',
        userId: 'u1',
        provider: provider({}),
      }),
    ).rejects.toThrow(/exactly 1 slot/);
  });

  it('returns an accessor with the bound manifest + role exposed', async () => {
    const m = recipeManifest();
    const a = await createSingleSlotManifestAccessor({
      manifest: m,
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({ name: '番茄炒蛋' }),
    });
    expect(a.manifest).toBe(m);
    expect(a.role).toBe('agent');
  });
});

// ────────────────────────────────────────────────────────────────────
// getSlot
// ────────────────────────────────────────────────────────────────────

describe('createSingleSlotManifestAccessor — getSlot', () => {
  it("returns the entity's structured data when apiName matches the slot", async () => {
    const a = await createSingleSlotManifestAccessor({
      manifest: recipeManifest(),
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({ name: '番茄炒蛋', mastery: 80 }),
    });
    const slot = a.getSlot('recipe');
    expect(slot).toEqual({ name: '番茄炒蛋', mastery: 80 });
  });

  it("returns null when apiName doesn't match the slot", async () => {
    const a = await createSingleSlotManifestAccessor({
      manifest: recipeManifest(),
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({ name: 'x' }),
    });
    expect(a.getSlot('phantom')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// getState / setState — both throw
// ────────────────────────────────────────────────────────────────────

describe('createSingleSlotManifestAccessor — state surface', () => {
  it('getState throws (no state model in this adapter)', async () => {
    const a = await createSingleSlotManifestAccessor({
      manifest: recipeManifest(),
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({}),
    });
    expect(() => a.getState('whatever')).toThrow(/no state model/);
  });

  it('setState throws (no state model in this adapter)', async () => {
    const a = await createSingleSlotManifestAccessor({
      manifest: recipeManifest(),
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({}),
    });
    expect(() => a.setState('whatever', 1)).toThrow(/no state model/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Action surface
// ────────────────────────────────────────────────────────────────────

describe('createSingleSlotManifestAccessor — action surface', () => {
  it('listActions returns []', async () => {
    const a = await createSingleSlotManifestAccessor({
      manifest: recipeManifest(),
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({}),
    });
    expect(a.listActions()).toEqual([]);
  });

  it('invokeAction returns { ok: false, errorCode: internal_error } with a clear message', async () => {
    const a = await createSingleSlotManifestAccessor({
      manifest: recipeManifest(),
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({}),
    });
    const r = await a.invokeAction('doThing', {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorCode).toBe('internal_error');
      expect(r.message).toMatch(/not exposed/);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// subscribe — throws
// ────────────────────────────────────────────────────────────────────

describe('createSingleSlotManifestAccessor — subscribe', () => {
  it('throws with a clear message', async () => {
    const a = await createSingleSlotManifestAccessor({
      manifest: recipeManifest(),
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({}),
    });
    expect(() => a.subscribe('events', () => {})).toThrow(/no source/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Type-shape regression — produced accessor is structurally a
// ManifestAccessor (compile-time check via assignability)
// ────────────────────────────────────────────────────────────────────

describe('createSingleSlotManifestAccessor — structural', () => {
  it('returns an object with every ManifestAccessor method', async () => {
    const a = await createSingleSlotManifestAccessor({
      manifest: recipeManifest(),
      role: 'agent',
      entityId: 'rec-1',
      userId: 'u1',
      provider: provider({}),
    });
    expect(typeof a.getState).toBe('function');
    expect(typeof a.setState).toBe('function');
    expect(typeof a.getSlot).toBe('function');
    expect(typeof a.listActions).toBe('function');
    expect(typeof a.invokeAction).toBe('function');
    expect(typeof a.subscribe).toBe('function');
    expect(a.manifest).toBeDefined();
    expect(a.role).toBeDefined();
  });

  // Make sure the test file actually uses zod to silence unused-import
  // warnings in case future iterations split this out.
  it.skip('placeholder for future zod-aware tests', () => {
    expect(z.string()).toBeDefined();
  });
});
