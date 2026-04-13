import type { BlockTransform } from './base.js';

export const textTransform: BlockTransform = {
  type: 'text',

  serialize(content: Record<string, any>): string {
    return content.text ?? '';
  },

  deserialize(lines: string[]): Record<string, any> | null {
    const text = lines.join('\n');
    return { text };
  },

  // text is the fallback — always matches
  detect(_lines: string[]): boolean {
    return true;
  },
};
