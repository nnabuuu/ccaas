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

describe('Edit operations integration (D2)', () => {
  it('US-2.1: str_replace modifies recipe text', async () => {
    const data = await editRecipe(ctx.recipes.yuxiang.id, [
      {
        op: 'str_replace',
        old_string: '鱼香肉丝是川菜经典名菜',
        new_string: '鱼香肉丝是四川经典名菜',
      },
    ]);
    expect(data.success).toBe(true);
    expect(data.document).toContain('四川经典名菜');
  });

  it('US-2.2: field_set modifies title, verified via resolve', async () => {
    const data = await editRecipe(ctx.recipes.yuxiang.id, [
      { op: 'field_set', field: 'title', value: '改良鱼香肉丝' },
    ]);
    expect(data.success).toBe(true);

    const resolveRes = await fetch(
      `${ctx.baseUrl}/context/resolve?entity_type=recipe&entity_id=${ctx.recipes.yuxiang.id}`,
    );
    const resolveData = await resolveRes.json();
    expect(resolveData.displayName).toBe('改良鱼香肉丝');
  });

  it('US-2.3: block_attr_set changes callout color', async () => {
    // callout "豆瓣酱..." is at block index 7
    const data = await editRecipe(ctx.recipes.yuxiang.id, [
      { op: 'block_attr_set', block_index: 7, attr: 'color', value: 'error' },
    ]);
    expect(data.success).toBe(true);

    const resolveRes = await fetch(
      `${ctx.baseUrl}/context/resolve?entity_type=recipe&entity_id=${ctx.recipes.yuxiang.id}`,
    );
    const resolveData = await resolveRes.json();
    const callout = resolveData.data.blocks[7];
    expect(callout.content.color).toBe('error');
  });

  it('US-2.4: block_content_set changes callout text', async () => {
    const data = await editRecipe(ctx.recipes.yuxiang.id, [
      { op: 'block_content_set', block_index: 7, field: 'text', value: '新的烹饪提示' },
    ]);
    expect(data.success).toBe(true);

    const resolveRes = await fetch(
      `${ctx.baseUrl}/context/resolve?entity_type=recipe&entity_id=${ctx.recipes.yuxiang.id}`,
    );
    const resolveData = await resolveRes.json();
    expect(resolveData.data.blocks[7].content.text).toBe('新的烹饪提示');
  });
});
