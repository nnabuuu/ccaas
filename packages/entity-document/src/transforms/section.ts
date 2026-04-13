import type { BlockTransform } from './base.js';

export const sectionTransform: BlockTransform = {
  type: 'section',

  serialize(content: Record<string, any>): string {
    return `## ${content.text ?? ''}`;
  },

  deserialize(lines: string[]): Record<string, any> | null {
    const line = lines[0];
    if (!line || !line.startsWith('## ')) return null;
    return { text: line.slice(3) };
  },

  detect(lines: string[]): boolean {
    return !!lines[0]?.startsWith('## ');
  },
};
