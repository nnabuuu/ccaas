import { describe, it, expect } from 'vitest';
import { splitBlockForDocument, mergeBlockForStorage } from '../referenceable/block-utils';

describe('block-utils', () => {
  it('splitBlockForDocument: extracts callout color to attributes', () => {
    const block = { type: 'callout', content: { text: '注意', color: 'warning' } };
    const result = splitBlockForDocument(block);
    expect(result.type).toBe('callout');
    expect(result.content).toEqual({ text: '注意' });
    expect(result.attributes).toEqual({ color: 'warning' });
  });

  it('splitBlockForDocument: extracts ingredient category to attributes', () => {
    const block = {
      type: 'ingredient',
      content: { items: [{ name: '鸡蛋', amount: '3个', note: '' }], category: '主料' },
    };
    const result = splitBlockForDocument(block);
    expect(result.content.category).toBeUndefined();
    expect(result.attributes).toEqual({ category: '主料' });
    expect(result.content.items[0].name).toBe('鸡蛋');
  });

  it('mergeBlockForStorage: merges callout color back', () => {
    const block = {
      type: 'callout',
      content: { text: '注意' },
      attributes: { color: 'warning' },
    };
    const result = mergeBlockForStorage(block);
    expect(result.type).toBe('callout');
    expect(result.content).toEqual({ text: '注意', color: 'warning' });
  });

  it('mergeBlockForStorage: merges ingredient category back', () => {
    const block = {
      type: 'ingredient',
      content: { items: [{ name: '盐', amount: '适量', note: '' }] },
      attributes: { category: '调料' },
    };
    const result = mergeBlockForStorage(block);
    expect(result.content.category).toBe('调料');
    expect(result.content.items[0].name).toBe('盐');
  });

  it('round-trip: split then merge preserves data', () => {
    const original = {
      type: 'ingredient',
      content: { items: [{ name: '猪肉', amount: '200g', note: '切丝' }], category: '主料' },
    };
    const split = splitBlockForDocument(original);
    const merged = mergeBlockForStorage(split);
    expect(merged.type).toBe('ingredient');
    expect(merged.content.category).toBe('主料');
    expect(merged.content.items[0].name).toBe('猪肉');
  });

  it('splitBlockForDocument: text block unchanged', () => {
    const block = { type: 'text', content: { text: 'hello' } };
    const result = splitBlockForDocument(block);
    expect(result.type).toBe('text');
    expect(result.content).toEqual({ text: 'hello' });
    expect(result.attributes).toBeUndefined();
  });
});
