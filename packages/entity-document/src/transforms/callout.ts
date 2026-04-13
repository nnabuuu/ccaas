import type { BlockTransform } from './base.js';

export const calloutTransform: BlockTransform = {
  type: 'callout',

  serialize(content: Record<string, any>): string {
    const text: string = content.text ?? '';
    return text
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
  },

  deserialize(lines: string[]): Record<string, any> | null {
    if (lines.length === 0 || !lines[0].startsWith('> ')) return null;
    const text = lines.map(line => (line.startsWith('> ') ? line.slice(2) : line)).join('\n');
    return { text };
  },

  detect(lines: string[]): boolean {
    return !!lines[0]?.startsWith('> ');
  },
};
