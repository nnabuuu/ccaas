import { describe, it, expect } from 'vitest';
import { ingredientTransform, recipeRegistry } from '../referenceable/recipe-registry';
import { serialize, deserialize } from '@kedge-agentic/entity-document';
import type { EntityDocument } from '@kedge-agentic/entity-document';

describe('ingredientTransform', () => {
  it('detect: returns true for valid ingredient line', () => {
    expect(ingredientTransform.detect(['<!-- type:ingredient 鸡蛋 | 3个 | 常温 -->'])).toBe(true);
  });

  it('detect: returns false for non-ingredient lines', () => {
    expect(ingredientTransform.detect(['some random text'])).toBe(false);
    expect(ingredientTransform.detect(['<!-- type:timeline -->'])).toBe(false);
    expect(ingredientTransform.detect(['<!-- type:ingredient foo -->', 'second line'])).toBe(false);
  });

  it('serialize: formats items correctly', () => {
    const content = {
      items: [
        { name: '鸡蛋', amount: '3个', note: '常温' },
        { name: '面粉', amount: '200g', note: '低筋' },
      ],
    };
    const result = ingredientTransform.serialize(content);
    expect(result).toBe('<!-- type:ingredient 鸡蛋 | 3个 | 常温 ; 面粉 | 200g | 低筋 -->');
  });

  it('serialize: handles items without note', () => {
    const content = {
      items: [{ name: '盐', amount: '适量', note: '' }],
    };
    const result = ingredientTransform.serialize(content);
    expect(result).toBe('<!-- type:ingredient 盐 | 适量 -->');
  });

  it('deserialize: parses items correctly', () => {
    const result = ingredientTransform.deserialize(['<!-- type:ingredient 猪肉 | 200g | 切丝 ; 木耳 | 50g | 泡发 -->']);
    expect(result).toEqual({
      items: [
        { name: '猪肉', amount: '200g', note: '切丝' },
        { name: '木耳', amount: '50g', note: '泡发' },
      ],
    });
  });

  it('deserialize: returns null for non-matching line', () => {
    const result = ingredientTransform.deserialize(['not an ingredient line']);
    expect(result).toBeNull();
  });

  it('round-trip: serialize then deserialize preserves data', () => {
    const content = {
      items: [
        { name: '鸡蛋', amount: '3个', note: '常温' },
        { name: '面粉', amount: '200g', note: '低筋' },
      ],
    };
    const serialized = ingredientTransform.serialize(content);
    const deserialized = ingredientTransform.deserialize([serialized]);
    expect(deserialized).toEqual(content);
  });

  it('recipeRegistry detects ingredient blocks', () => {
    const lines = ['<!-- type:ingredient 盐 | 适量 -->'];
    const transform = recipeRegistry.detectTransform(lines);
    expect(transform.type).toBe('ingredient');
  });

  it('full document round-trip with ingredient blocks', () => {
    const doc: EntityDocument = {
      meta: { title: '测试食谱' },
      blocks: [
        { type: 'text', content: { text: '这是测试' } },
        { type: 'ingredient', content: { items: [{ name: '鸡蛋', amount: '3个', note: '常温' }] } },
      ],
    };
    const text = serialize(doc, recipeRegistry);
    const parsed = deserialize(text, recipeRegistry);
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[1].type).toBe('ingredient');
    expect(parsed.blocks[1].content.items[0].name).toBe('鸡蛋');
  });
});
