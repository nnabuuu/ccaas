import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, type TestContext } from './test-helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
}, 30000);

afterAll(async () => {
  await ctx?.app?.close();
});

describe('Context API integration (D1)', () => {
  it('US-1.5: entity-types returns recipe type', async () => {
    const res = await fetch(`${ctx.baseUrl}/context/entity-types`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.types).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'recipe', displayName: '食谱' }),
      ]),
    );
  });

  it('US-1.1: browse returns all recipes with displayName and subtitle', async () => {
    const res = await fetch(`${ctx.baseUrl}/context/browse?entity_type=recipe`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(3);
    expect(data.items.length).toBeGreaterThanOrEqual(3);
    for (const item of data.items) {
      expect(item.displayName).toBeTruthy();
      expect(item.subtitle).toBeDefined();
    }
  });

  it('US-1.2: search "鱼香" returns matching results', async () => {
    const res = await fetch(
      `${ctx.baseUrl}/context/search?q=${encodeURIComponent('鱼香')}&entity_type=recipe`,
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    expect(data.results.some((r: any) => r.displayName.includes('鱼香肉丝'))).toBe(true);
  });

  it('US-1.4: entity context returns ref and structured data', async () => {
    const res = await fetch(
      `${ctx.baseUrl}/context/entity/recipe/${ctx.recipes.yuxiang.id}`,
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.ref.type).toBe('recipe');
    expect(data.ref.display_name).toContain('鱼香肉丝');
    expect(data.structured.title).toBe('鱼香肉丝');
    expect(data.structured.cuisine).toBe('川菜');
  });

  it('US-1.3: document returns markdown with ingredient blocks', async () => {
    const res = await fetch(
      `${ctx.baseUrl}/context/entity/recipe/${ctx.recipes.yuxiang.id}/document`,
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.document).toContain('<!-- type:ingredient');
    expect(data.document).toContain('猪里脊');
  });

  it('US-1.6: resolve returns displayName and data', async () => {
    const res = await fetch(
      `${ctx.baseUrl}/context/resolve?entity_type=recipe&entity_id=${ctx.recipes.yuxiang.id}`,
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.displayName).toBe('鱼香肉丝');
    expect(data.data).toBeDefined();
    expect(data.data.title).toBe('鱼香肉丝');
  });
});
