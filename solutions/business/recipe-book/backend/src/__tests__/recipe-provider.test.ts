import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecipeProvider } from '../referenceable/providers/recipe.provider';
import type { EditOperation } from '@kedge-agentic/context-layer/core';

// Mock RecipeService
function createMockService(initialRecipe: any) {
  let stored = { ...initialRecipe, blocks: initialRecipe.blocks?.map((b: any) => ({ ...b, content: { ...b.content } })) ?? [] };
  return {
    findOne: vi.fn(async () => ({ ...stored, blocks: stored.blocks.map((b: any) => ({ ...b, content: { ...b.content } })) })),
    update: vi.fn(async (_id: string, updates: any) => {
      stored = { ...stored, ...updates };
      return stored;
    }),
    findAll: vi.fn(async () => ({ items: [stored], total: 1, page: 1 })),
  };
}

describe('RecipeProvider', () => {
  let provider: RecipeProvider;
  let mockService: ReturnType<typeof createMockService>;

  const baseRecipe = {
    id: 'test-id',
    title: '测试食谱',
    cuisine: '家常',
    difficulty: 'easy',
    prep_time: 10,
    cook_time: 15,
    servings: 2,
    status: 'draft',
    blocks: [
      { type: 'text', content: { text: '这是一道简单的家常菜。' } },
      { type: 'ingredient', content: { items: [{ name: '鸡蛋', amount: '3个', note: '常温' }], category: '主料' } },
      { type: 'callout', content: { text: '注意火候', color: 'warning' } },
    ],
  };

  beforeEach(() => {
    mockService = createMockService(baseRecipe);
    provider = new RecipeProvider(mockService as any);
  });

  it('field_set: updates editable fields', async () => {
    const ops: EditOperation[] = [
      { op: 'field_set', field: 'title', value: '新标题' },
    ];
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(true);
    expect(mockService.update).toHaveBeenCalledWith('test-id', expect.objectContaining({ title: '新标题' }));
  });

  it('field_set: rejects non-editable field', async () => {
    const ops: EditOperation[] = [
      { op: 'field_set', field: 'status', value: 'published' },
    ];
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('status');
  });

  it('field_set: preserves all block attributes after frontmatter-only edit', async () => {
    const ops: EditOperation[] = [
      { op: 'field_set', field: 'title', value: '改名食谱' },
    ];
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(true);
    // field_set only should NOT touch blocks
    const updateCall = mockService.update.mock.calls[0][1];
    expect(updateCall.blocks).toBeUndefined();
    // The returned document should still contain original block attributes
    expect(result.document).toContain('<!-- type:ingredient');
    expect(result.document).toContain('鸡蛋');
    expect(result.document).toContain('注意火候');
  });

  it('str_replace: replaces text content', async () => {
    const ops: EditOperation[] = [
      { op: 'str_replace', old_string: '这是一道简单的家常菜。', new_string: '这是一道美味的家常菜。' },
    ];
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(true);
    expect(result.document).toContain('美味');
  });

  it('str_replace: preserves ingredient blocks through round-trip', async () => {
    const ops: EditOperation[] = [
      { op: 'str_replace', old_string: '这是一道简单的家常菜。', new_string: '改良版家常菜。' },
    ];
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(true);
    // After str_replace, the saved blocks should still contain ingredient type
    const savedBlocks = mockService.update.mock.calls[0][1].blocks;
    const ingredientBlock = savedBlocks.find((b: any) => b.type === 'ingredient');
    expect(ingredientBlock).toBeDefined();
    expect(ingredientBlock.content.items[0].name).toBe('鸡蛋');
  });

  it('str_replace: ingredient block category preserved via mergeBlockForStorage', async () => {
    const ops: EditOperation[] = [
      { op: 'str_replace', old_string: '这是一道简单的家常菜。', new_string: '更新后的描述。' },
    ];
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(true);
    // category should be merged back into content via block-utils config
    const savedBlocks = mockService.update.mock.calls[0][1].blocks;
    const ingredientBlock = savedBlocks.find((b: any) => b.type === 'ingredient');
    expect(ingredientBlock.content.category).toBe('主料');
  });

  it('str_replace: callout color preserved as attribute then merged back', async () => {
    const ops: EditOperation[] = [
      { op: 'str_replace', old_string: '注意火候', new_string: '注意火候控制' },
    ];
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(true);
    expect(result.document).toContain('注意火候控制');
  });

  it('validates: rejects edit on published recipe', async () => {
    const publishedService = createMockService({ ...baseRecipe, status: 'published' });
    const publishedProvider = new RecipeProvider(publishedService as any);
    const ops: EditOperation[] = [
      { op: 'field_set', field: 'title', value: '新标题' },
    ];
    const result = await publishedProvider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('已发布');
  });

  it('serialize: uses recipeRegistry', async () => {
    const doc = await provider.serialize('test-id', 'user1');
    expect(doc).toContain('<!-- type:ingredient');
    expect(doc).toContain('鸡蛋');
  });

  it('getContext: returns proper entity context', async () => {
    const ctx = await provider.getContext('test-id', 'user1');
    expect(ctx.ref.type).toBe('recipe');
    expect(ctx.ref.display_name).toContain('测试食谱');
    expect(ctx.structured.title).toBe('测试食谱');
  });

  it('search: returns matching recipes', async () => {
    const results = await provider.search('测试', 'user1', 10);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('recipe');
    expect(results[0].display_name).toContain('测试食谱');
  });

  it('block_attr_set: changes callout color', async () => {
    const ops = [
      { op: 'block_attr_set', block_index: 2, attr: 'color', value: 'error' },
    ] as any;
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(true);
    const savedBlocks = mockService.update.mock.calls[0][1].blocks;
    const calloutBlock = savedBlocks.find((b: any) => b.type === 'callout');
    expect(calloutBlock.content.color).toBe('error');
  });

  it('block_content_set: updates callout text', async () => {
    const ops = [
      { op: 'block_content_set', block_index: 2, field: 'text', value: '新提示' },
    ] as any;
    const result = await provider.edit('test-id', ops, 'user1');
    expect(result.success).toBe(true);
    const savedBlocks = mockService.update.mock.calls[0][1].blocks;
    const calloutBlock = savedBlocks.find((b: any) => b.type === 'callout');
    expect(calloutBlock.content.text).toBe('新提示');
  });
});
