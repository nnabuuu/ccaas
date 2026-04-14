import { describe, it, expect } from 'vitest';
import { TransformRegistry, defaultRegistry } from '../transform-registry.js';
import type { BlockTransform } from '../interfaces.js';

const customTransform: BlockTransform = {
  type: 'custom',
  serialize: (content) => `[custom] ${content.text}`,
  deserialize: (lines) => lines[0]?.startsWith('[custom]') ? { text: lines[0].slice(9) } : null,
  detect: (lines) => lines[0]?.startsWith('[custom]') ?? false,
};

describe('TransformRegistry', () => {
  it('withDefaults() creates registry with 7 built-in types', () => {
    const reg = TransformRegistry.withDefaults();
    const types = reg.getRegisteredTypes();
    expect(types).toHaveLength(7);
    expect(types).toContain('text');
    expect(types).toContain('section');
    expect(types).toContain('table');
    expect(types).toContain('list');
    expect(types).toContain('timeline');
    expect(types).toContain('callout');
    expect(types).toContain('image');
  });

  it('getTransform returns text fallback for unknown type', () => {
    const reg = TransformRegistry.withDefaults();
    const t = reg.getTransform('nonexistent');
    expect(t.type).toBe('text');
  });

  it('getTransform returns correct transform for known type', () => {
    const reg = TransformRegistry.withDefaults();
    const t = reg.getTransform('section');
    expect(t.type).toBe('section');
  });

  it('register adds a custom transform', () => {
    const reg = TransformRegistry.withDefaults();
    reg.register('custom', customTransform);
    expect(reg.getRegisteredTypes()).toContain('custom');
    expect(reg.getTransform('custom').type).toBe('custom');
  });

  it('detectTransform finds custom transform after registration', () => {
    const reg = TransformRegistry.withDefaults();
    reg.register('custom', customTransform);
    const found = reg.detectTransform(['[custom] hello']);
    expect(found.type).toBe('custom');
  });

  it('unregister removes a transform', () => {
    const reg = TransformRegistry.withDefaults();
    reg.register('custom', customTransform);
    expect(reg.unregister('custom')).toBe(true);
    expect(reg.getRegisteredTypes()).not.toContain('custom');
    // Falls back to text
    expect(reg.getTransform('custom').type).toBe('text');
  });

  it('unregister returns false for non-existent type', () => {
    const reg = TransformRegistry.withDefaults();
    expect(reg.unregister('nonexistent')).toBe(false);
  });

  it('unregister refuses to remove text (fallback)', () => {
    const reg = TransformRegistry.withDefaults();
    expect(reg.unregister('text')).toBe(false);
    expect(reg.getRegisteredTypes()).toContain('text');
  });

  it('detectTransform falls back to text when no match', () => {
    const reg = TransformRegistry.withDefaults();
    const t = reg.detectTransform(['just some plain text']);
    expect(t.type).toBe('text');
  });

  it('defaultRegistry is a singleton with 7 built-ins', () => {
    expect(defaultRegistry.getRegisteredTypes()).toHaveLength(7);
  });

  it('custom registry works with serialize/deserialize', async () => {
    const { serialize } = await import('../serializer.js');
    const { deserialize } = await import('../deserializer.js');

    const reg = TransformRegistry.withDefaults();
    reg.register('custom', customTransform);

    const doc = { meta: {}, blocks: [{ type: 'custom', content: { text: 'hello' } }] };
    const text = serialize(doc, reg);
    expect(text).toBe('[custom] hello');

    const parsed = deserialize(text, reg);
    expect(parsed.blocks[0].type).toBe('custom');
    expect(parsed.blocks[0].content).toEqual({ text: 'hello' });
  });
});
