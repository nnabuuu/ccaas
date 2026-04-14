import { describe, it, expect } from 'vitest';
import { splitBlockForDocument, mergeBlockForStorage } from '../block-utils.js';

describe('block-utils', () => {
  describe('splitBlockForDocument', () => {
    it('splits configured fields from content to attributes', () => {
      const block = { type: 'callout', content: { text: 'hello', color: 'red' } };
      const result = splitBlockForDocument(block, { callout: ['color'] });
      expect(result.content).toEqual({ text: 'hello' });
      expect(result.attributes).toEqual({ color: 'red' });
    });

    it('passes through blocks with no config match', () => {
      const block = { type: 'text', content: { text: 'hello' } };
      const result = splitBlockForDocument(block, { callout: ['color'] });
      expect(result.content).toEqual({ text: 'hello' });
      expect(result.attributes).toBeUndefined();
    });

    it('works with empty config', () => {
      const block = { type: 'callout', content: { text: 'hello', color: 'red' } };
      const result = splitBlockForDocument(block);
      expect(result.content).toEqual({ text: 'hello', color: 'red' });
    });

    it('preserves existing attributes', () => {
      const block = { type: 'callout', content: { text: 'hi', color: 'blue' }, attributes: { id: '123' } };
      const result = splitBlockForDocument(block, { callout: ['color'] });
      expect(result.attributes).toEqual({ id: '123', color: 'blue' });
    });
  });

  describe('mergeBlockForStorage', () => {
    it('merges configured attributes back into content', () => {
      const block = { type: 'callout', content: { text: 'hello' }, attributes: { color: 'red' } };
      const result = mergeBlockForStorage(block, { callout: ['color'] });
      expect(result).toEqual({ type: 'callout', content: { text: 'hello', color: 'red' } });
    });

    it('passes through blocks with no config match', () => {
      const block = { type: 'text', content: { text: 'hello' } };
      const result = mergeBlockForStorage(block, { callout: ['color'] });
      expect(result).toEqual({ type: 'text', content: { text: 'hello' } });
    });

    it('works with empty config', () => {
      const block = { type: 'callout', content: { text: 'hello' }, attributes: { color: 'red' } };
      const result = mergeBlockForStorage(block);
      expect(result).toEqual({ type: 'callout', content: { text: 'hello' } });
    });

    it('round-trips with split correctly', () => {
      const original = { type: 'callout', content: { text: 'hello', color: 'green' } };
      const config = { callout: ['color'] };
      const split = splitBlockForDocument(original, config);
      const merged = mergeBlockForStorage(split, config);
      expect(merged).toEqual({ type: 'callout', content: { text: 'hello', color: 'green' } });
    });
  });
});
