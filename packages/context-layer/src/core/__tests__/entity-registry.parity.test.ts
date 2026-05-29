/**
 * Behavioral parity baseline for `EntityRegistry`.
 *
 * Phase 2 (this work) refactors EntityRegistry to internally delegate
 * to `OntologyRegistry` from `@kedge-agentic/ontology`. The refactor
 * must NOT change any observable behavior — recipe-book and
 * live-lesson should keep working without code changes.
 *
 * This file is the safety net for that promise. Every public method
 * of EntityRegistry gets at least one assertion against a fixture
 * that mirrors recipe-book's actual onModuleInit (recipe +
 * recipe_section + their parent/child relation + the recipe provider).
 *
 * **THIS FILE EXISTS BEFORE THE REFACTOR LANDS.** If the refactor
 * breaks any assertion here, the refactor is wrong — fix the
 * delegation, not the test. New assertions can be added but existing
 * ones must continue to hold.
 */

import { describe, expect, it } from 'vitest';
import { EntityRegistry } from '../entity-registry.js';
import type {
  AtReference,
  EntityContext,
  EntityContextProvider,
  ReferenceableOptions,
  RelationInfo,
} from '../interfaces.js';

// ────────────────────────────────────────────────────────────────────
// Fixture: mirrors solutions/business/recipe-book/backend/src/
//   referenceable/referenceable.module.ts:onModuleInit()
// ────────────────────────────────────────────────────────────────────

const RECIPE_OPTS: ReferenceableOptions = {
  type: 'recipe',
  displayName: '食谱',
  icon: '🍳',
  color: 'orange',
  abilities: { search: true, browse: true, resolve: true, track: true },
};

const RECIPE_SECTION_OPTS: ReferenceableOptions = {
  type: 'recipe_section',
  displayName: '章节',
  icon: '📑',
  color: 'amber',
  abilities: { search: true, browse: true, resolve: true },
};

const RECIPE_RELATION: RelationInfo = {
  parent: 'recipe',
  child: 'recipe_section',
  label: '章节',
  foreignKey: 'recipeId',
};

function recipeBookRegistry(): EntityRegistry {
  const r = new EntityRegistry();
  r.register(RECIPE_OPTS);
  r.register(RECIPE_SECTION_OPTS);
  r.setRelations([RECIPE_RELATION]);
  return r;
}

function stubProvider(): EntityContextProvider {
  return {
    async getContext(id: string): Promise<EntityContext> {
      return {
        ref: { type: 'recipe', id, display_name: `Recipe ${id}`, summary: '' },
        structured: {},
        relations: [],
        attachments: [],
      };
    },
    async search(_query: string): Promise<AtReference[]> {
      return [];
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// register + getEntity + getAllEntities
// ────────────────────────────────────────────────────────────────────

describe('register', () => {
  it('stores an entity by its options.type', () => {
    const r = new EntityRegistry();
    r.register(RECIPE_OPTS);
    const stored = r.getEntity('recipe');
    expect(stored).toBeDefined();
    expect(stored?.options).toEqual(RECIPE_OPTS);
  });

  it('preserves controllerPath and entityClass when provided', () => {
    const r = new EntityRegistry();
    class Dummy {}
    r.register(RECIPE_OPTS, '/api/recipes', Dummy);
    const stored = r.getEntity('recipe');
    expect(stored?.controllerPath).toBe('/api/recipes');
    expect(stored?.entityClass).toBe(Dummy);
  });

  it('overwrites existing entry when register called twice with same type', () => {
    const r = new EntityRegistry();
    r.register(RECIPE_OPTS);
    const updated: ReferenceableOptions = { ...RECIPE_OPTS, displayName: '更新菜谱' };
    r.register(updated);
    expect(r.getEntity('recipe')?.options.displayName).toBe('更新菜谱');
  });
});

describe('getEntity', () => {
  it('returns undefined for unregistered type', () => {
    expect(new EntityRegistry().getEntity('ghost')).toBeUndefined();
  });
});

describe('getAllEntities', () => {
  it('returns a Map of every registered entity keyed by type', () => {
    const r = recipeBookRegistry();
    const all = r.getAllEntities();
    expect(all.size).toBe(2);
    expect(all.has('recipe')).toBe(true);
    expect(all.has('recipe_section')).toBe(true);
  });

  it('returns an empty map when nothing registered', () => {
    expect(new EntityRegistry().getAllEntities().size).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// setRelations + getRelationTree + computeRoots (via getRelationTree.roots)
// ────────────────────────────────────────────────────────────────────

describe('setRelations + getRelationTree', () => {
  it('stores relations and exposes them via getRelationTree', () => {
    const r = recipeBookRegistry();
    const tree = r.getRelationTree();
    expect(tree.relations).toEqual([RECIPE_RELATION]);
  });

  it('computes roots as entity types that are not the child of any relation', () => {
    const r = recipeBookRegistry();
    expect(r.getRelationTree().roots).toEqual(['recipe']);
  });

  it('roots include every registered type when there are no relations', () => {
    const r = new EntityRegistry();
    r.register(RECIPE_OPTS);
    r.register(RECIPE_SECTION_OPTS);
    r.setRelations([]);
    const roots = r.getRelationTree().roots.sort();
    expect(roots).toEqual(['recipe', 'recipe_section']);
  });

  it('returns defensive copies (caller mutation does not affect registry)', () => {
    const r = recipeBookRegistry();
    const tree = r.getRelationTree();
    tree.roots.push('hacked');
    tree.relations.push({ parent: 'x', child: 'y', label: 'l', foreignKey: 'fk' });
    const fresh = r.getRelationTree();
    expect(fresh.roots).not.toContain('hacked');
    expect(fresh.relations).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// getEntityTypes — the API-shaped output
// ────────────────────────────────────────────────────────────────────

describe('getEntityTypes', () => {
  it('returns { types, tree } shape matching EntityTypesResponse', () => {
    const r = recipeBookRegistry();
    const out = r.getEntityTypes();
    expect(out).toHaveProperty('types');
    expect(out).toHaveProperty('tree');
    expect(Array.isArray(out.types)).toBe(true);
    expect(out.tree).toHaveProperty('roots');
    expect(out.tree).toHaveProperty('relations');
  });

  it('every types[] entry has the EntityTypeInfo shape', () => {
    const r = recipeBookRegistry();
    const out = r.getEntityTypes();
    const recipe = out.types.find((t) => t.type === 'recipe');
    expect(recipe).toEqual({
      type: 'recipe',
      displayName: '食谱',
      icon: '🍳',
      color: 'orange',
      searchable: true,
      browsable: true,
    });
  });

  it("color is null when ReferenceableOptions omits it", () => {
    const r = new EntityRegistry();
    r.register({
      type: 'plain',
      displayName: 'Plain',
      icon: '⚪',
      abilities: { search: true, browse: true },
    });
    const info = r.getEntityTypes().types.find((t) => t.type === 'plain');
    expect(info?.color).toBeNull();
  });

  it('searchable defaults to true when abilities.search is omitted', () => {
    const r = new EntityRegistry();
    r.register({ type: 'x', displayName: 'X', icon: 'x' });
    expect(r.getEntityTypes().types[0].searchable).toBe(true);
  });

  it('searchable is false when abilities.search is explicitly false', () => {
    const r = new EntityRegistry();
    r.register({ type: 'x', displayName: 'X', icon: 'x', abilities: { search: false } });
    expect(r.getEntityTypes().types[0].searchable).toBe(false);
  });

  it('searchable is true when abilities.search is an options object', () => {
    const r = new EntityRegistry();
    r.register({
      type: 'x',
      displayName: 'X',
      icon: 'x',
      abilities: { search: { queryParam: 'q', endpoint: '/api/x/search' } },
    });
    expect(r.getEntityTypes().types[0].searchable).toBe(true);
  });

  it('browsable defaults to true when abilities.browse is omitted', () => {
    const r = new EntityRegistry();
    r.register({ type: 'x', displayName: 'X', icon: 'x' });
    expect(r.getEntityTypes().types[0].browsable).toBe(true);
  });

  it('browsable is false when abilities.browse is explicitly false', () => {
    const r = new EntityRegistry();
    r.register({ type: 'x', displayName: 'X', icon: 'x', abilities: { browse: false } });
    expect(r.getEntityTypes().types[0].browsable).toBe(false);
  });

  it('the tree embedded in getEntityTypes matches getRelationTree exactly', () => {
    const r = recipeBookRegistry();
    expect(r.getEntityTypes().tree).toEqual(r.getRelationTree());
  });
});

// ────────────────────────────────────────────────────────────────────
// Relation lookup helpers
// ────────────────────────────────────────────────────────────────────

describe('hasChildren', () => {
  it('returns true for an entity type that appears as a relation parent', () => {
    expect(recipeBookRegistry().hasChildren('recipe')).toBe(true);
  });

  it('returns false for an entity type that is never a parent', () => {
    expect(recipeBookRegistry().hasChildren('recipe_section')).toBe(false);
  });

  it('returns false for an unregistered type', () => {
    expect(recipeBookRegistry().hasChildren('ghost')).toBe(false);
  });
});

describe('getChildRelations', () => {
  it('returns relations where the given type is the parent', () => {
    const rels = recipeBookRegistry().getChildRelations('recipe');
    expect(rels).toHaveLength(1);
    expect(rels[0].child).toBe('recipe_section');
  });

  it('returns [] when type has no children', () => {
    expect(recipeBookRegistry().getChildRelations('recipe_section')).toEqual([]);
  });
});

describe('getParentRelation', () => {
  it('returns the relation where the given type is the child', () => {
    const rel = recipeBookRegistry().getParentRelation('recipe_section');
    expect(rel?.parent).toBe('recipe');
    expect(rel?.foreignKey).toBe('recipeId');
  });

  it('returns undefined for a root type (no parent)', () => {
    expect(recipeBookRegistry().getParentRelation('recipe')).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────
// cacheParent + getBreadcrumb
// ────────────────────────────────────────────────────────────────────

describe('cacheParent + getBreadcrumb', () => {
  it('returns null when no parent is cached', () => {
    const r = recipeBookRegistry();
    expect(r.getBreadcrumb('recipe_section', 'sec-1')).toBeNull();
  });

  it('returns a single-item breadcrumb when one parent level is cached', () => {
    const r = recipeBookRegistry();
    r.cacheParent('recipe_section', 'sec-1', 'recipe', 'rec-1', '番茄炒蛋');
    const crumbs = r.getBreadcrumb('recipe_section', 'sec-1');
    expect(crumbs).toEqual([
      { type: 'recipe', id: 'rec-1', displayName: '番茄炒蛋', icon: '🍳' },
    ]);
  });

  it('walks multi-level parent chains, ordered root-first', () => {
    const r = new EntityRegistry();
    r.register({ type: 'cookbook', displayName: '菜谱集', icon: '📚' });
    r.register({ type: 'recipe', displayName: '食谱', icon: '🍳' });
    r.register({ type: 'recipe_section', displayName: '章节', icon: '📑' });
    r.cacheParent('recipe_section', 'sec-1', 'recipe', 'rec-1', '番茄炒蛋');
    r.cacheParent('recipe', 'rec-1', 'cookbook', 'cb-1', '家常菜');
    const crumbs = r.getBreadcrumb('recipe_section', 'sec-1');
    expect(crumbs).toHaveLength(2);
    // Root-first ordering
    expect(crumbs?.[0].type).toBe('cookbook');
    expect(crumbs?.[1].type).toBe('recipe');
  });

  it('breaks the walk when an intermediate parent type is not registered', () => {
    const r = recipeBookRegistry();
    r.cacheParent('recipe_section', 'sec-1', 'unknown_type', 'x', 'X');
    expect(r.getBreadcrumb('recipe_section', 'sec-1')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// EntityContextProvider registration
// ────────────────────────────────────────────────────────────────────

describe('registerProvider + getProvider + hasProvider', () => {
  it('hasProvider returns false before registration', () => {
    expect(new EntityRegistry().hasProvider('recipe')).toBe(false);
  });

  it('hasProvider returns true after registration', () => {
    const r = new EntityRegistry();
    r.registerProvider('recipe', stubProvider());
    expect(r.hasProvider('recipe')).toBe(true);
  });

  it('getProvider returns the registered provider instance', () => {
    const r = new EntityRegistry();
    const provider = stubProvider();
    r.registerProvider('recipe', provider);
    expect(r.getProvider('recipe')).toBe(provider);
  });

  it('getProvider returns undefined for unregistered type', () => {
    expect(new EntityRegistry().getProvider('recipe')).toBeUndefined();
  });

  it('registering a new provider for the same type overwrites the previous one', () => {
    const r = new EntityRegistry();
    const a = stubProvider();
    const b = stubProvider();
    r.registerProvider('recipe', a);
    r.registerProvider('recipe', b);
    expect(r.getProvider('recipe')).toBe(b);
  });
});

// ────────────────────────────────────────────────────────────────────
// End-to-end fixture parity (recipe-book onModuleInit shape)
// ────────────────────────────────────────────────────────────────────

describe('recipe-book onModuleInit parity snapshot', () => {
  it('produces exactly the EntityTypesResponse recipe-book expects', () => {
    const r = recipeBookRegistry();
    r.registerProvider('recipe', stubProvider());
    const out = r.getEntityTypes();
    expect(out).toEqual({
      types: [
        {
          type: 'recipe',
          displayName: '食谱',
          icon: '🍳',
          color: 'orange',
          searchable: true,
          browsable: true,
        },
        {
          type: 'recipe_section',
          displayName: '章节',
          icon: '📑',
          color: 'amber',
          searchable: true,
          browsable: true,
        },
      ],
      tree: {
        roots: ['recipe'],
        relations: [
          { parent: 'recipe', child: 'recipe_section', label: '章节', foreignKey: 'recipeId' },
        ],
      },
    });
  });
});
