import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createTestApp, seedRecipes, type TestContext } from './test-helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
}, 30000);

beforeEach(async () => {
  ctx.recipes = await seedRecipes(ctx.app);
});

afterAll(async () => {
  await ctx?.app?.close();
});

async function editRecipe(id: string, operations: any[]) {
  const res = await fetch(`${ctx.baseUrl}/context/entity/recipe/${id}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations }),
  });
  return res.json();
}

describe('Edge cases integration (D3)', () => {
  it('US-2.7: rejects editing published recipe', async () => {
    const data = await editRecipe(ctx.recipes.tiramisu.id, [
      { op: 'field_set', field: 'title', value: '新提拉米苏' },
    ]);
    expect(data.success).toBe(false);
    expect(data.error).toContain('已发布');
  });

  it('US-2.8: rejects non-editable field (status)', async () => {
    const data = await editRecipe(ctx.recipes.yuxiang.id, [
      { op: 'field_set', field: 'status', value: 'published' },
    ]);
    expect(data.success).toBe(false);
    expect(data.error).toContain('status');
  });

  it('US-2.5: str_replace preserves ingredient category attribute', async () => {
    const data = await editRecipe(ctx.recipes.yuxiang.id, [
      {
        op: 'str_replace',
        old_string: '鱼香肉丝是川菜经典名菜',
        new_string: '鱼香肉丝是四川经典名菜',
      },
    ]);
    expect(data.success).toBe(true);

    // Verify ingredient category preserved
    const resolveRes = await fetch(
      `${ctx.baseUrl}/context/resolve?entity_type=recipe&entity_id=${ctx.recipes.yuxiang.id}`,
    );
    const resolveData = await resolveRes.json();
    const ingredientBlock = resolveData.data.blocks.find(
      (b: any) => b.type === 'ingredient' && b.content.category === '主料',
    );
    expect(ingredientBlock).toBeDefined();
    expect(ingredientBlock.content.items[0].name).toBe('猪里脊');
  });

  it('US-2.6: str_replace preserves callout color attribute', async () => {
    // Edit a TEXT block (not the callout) — unchanged callout should preserve color
    const data = await editRecipe(ctx.recipes.yuxiang.id, [
      {
        op: 'str_replace',
        old_string: '鱼香肉丝是川菜经典名菜',
        new_string: '鱼香肉丝是四川经典名菜',
      },
    ]);
    expect(data.success).toBe(true);

    // Verify callout color preserved (block unchanged → attributes kept)
    const resolveRes = await fetch(
      `${ctx.baseUrl}/context/resolve?entity_type=recipe&entity_id=${ctx.recipes.yuxiang.id}`,
    );
    const resolveData = await resolveRes.json();
    const callout = resolveData.data.blocks.find(
      (b: any) => b.type === 'callout' && b.content.text.includes('豆瓣酱'),
    );
    expect(callout).toBeDefined();
    expect(callout.content.color).toBe('warning');
  });

  it('US-2.9: three sequential edits maintain data integrity', async () => {
    // Edit 1: str_replace text
    const r1 = await editRecipe(ctx.recipes.yuxiang.id, [
      {
        op: 'str_replace',
        old_string: '鱼香肉丝是川菜经典名菜',
        new_string: '鱼香肉丝是经典川菜',
      },
    ]);
    expect(r1.success).toBe(true);

    // Edit 2: block_attr_set callout color
    const r2 = await editRecipe(ctx.recipes.yuxiang.id, [
      { op: 'block_attr_set', block_index: 7, attr: 'color', value: 'error' },
    ]);
    expect(r2.success).toBe(true);

    // Edit 3: field_set title
    const r3 = await editRecipe(ctx.recipes.yuxiang.id, [
      { op: 'field_set', field: 'title', value: '改良鱼香肉丝' },
    ]);
    expect(r3.success).toBe(true);

    // Verify all edits persisted
    const docRes = await fetch(
      `${ctx.baseUrl}/context/entity/recipe/${ctx.recipes.yuxiang.id}/document`,
    );
    const docData = await docRes.json();
    expect(docData.document).toContain('经典川菜');
    expect(docData.document).toContain('<!-- type:ingredient');
    expect(docData.document).toContain('猪里脊');

    const resolveRes = await fetch(
      `${ctx.baseUrl}/context/resolve?entity_type=recipe&entity_id=${ctx.recipes.yuxiang.id}`,
    );
    const resolveData = await resolveRes.json();
    expect(resolveData.displayName).toBe('改良鱼香肉丝');
    expect(resolveData.data.blocks[7].content.color).toBe('error');
    // Ingredient category still preserved
    const ingredient = resolveData.data.blocks.find(
      (b: any) => b.type === 'ingredient' && b.content.category === '主料',
    );
    expect(ingredient).toBeDefined();
  });

  it('empty search returns no results without error', async () => {
    const res = await fetch(
      `${ctx.baseUrl}/context/search?q=${encodeURIComponent('不存在的菜')}&entity_type=recipe`,
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it('get document for non-existent ID returns error', async () => {
    const res = await fetch(
      `${ctx.baseUrl}/context/entity/recipe/non-existent-id-12345/document`,
    );
    expect(res.ok).toBe(false);
  });
});
