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

describe('Agent workflow integration (D4)', () => {
  it('US-3.1: search → get_document → edit → verify full workflow', async () => {
    // Step 1: Agent searches for a recipe
    const searchRes = await fetch(
      `${ctx.baseUrl}/context/search?q=${encodeURIComponent('番茄')}&entity_type=recipe`,
    );
    const searchData = await searchRes.json();
    expect(searchData.results.length).toBeGreaterThanOrEqual(1);

    const target = searchData.results.find((r: any) => r.displayName.includes('番茄炒蛋'));
    expect(target).toBeDefined();
    const recipeId = target.entityId;

    // Step 2: Agent gets the document
    const docRes = await fetch(
      `${ctx.baseUrl}/context/entity/recipe/${recipeId}/document`,
    );
    const docData = await docRes.json();
    expect(docData.document).toContain('番茄炒蛋');

    // Step 3: Agent edits the recipe
    const editRes = await fetch(`${ctx.baseUrl}/context/entity/recipe/${recipeId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operations: [
          {
            op: 'str_replace',
            old_string: '番茄炒蛋是中国最普及的家常菜',
            new_string: '番茄炒蛋是最受欢迎的家常菜',
          },
        ],
      }),
    });
    const editData = await editRes.json();
    expect(editData.success).toBe(true);

    // Step 4: Agent verifies the edit
    const verifyRes = await fetch(
      `${ctx.baseUrl}/context/entity/recipe/${recipeId}/document`,
    );
    const verifyData = await verifyRes.json();
    expect(verifyData.document).toContain('最受欢迎的家常菜');
    expect(verifyData.document).not.toContain('最普及的家常菜');
  });

  it('US-3.2: Agent gets clear error when editing published recipe', async () => {
    const editRes = await fetch(
      `${ctx.baseUrl}/context/entity/recipe/${ctx.recipes.tiramisu.id}/edit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: [
            { op: 'field_set', field: 'title', value: '新提拉米苏' },
          ],
        }),
      },
    );
    const data = await editRes.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('已发布');
  });

  it('US-3.3: Agent search with no results returns empty array', async () => {
    const res = await fetch(
      `${ctx.baseUrl}/context/search?q=${encodeURIComponent('不存在的菜名xyz')}&entity_type=recipe`,
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results).toHaveLength(0);
  });

  it('US-3.4: Agent gets error for non-existent recipe document', async () => {
    const res = await fetch(
      `${ctx.baseUrl}/context/entity/recipe/00000000-0000-0000-0000-000000000000/document`,
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
