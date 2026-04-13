import type { BlockTransform } from './base.js';

export const imageTransform: BlockTransform = {
  type: 'image',

  serialize(content: Record<string, any>): string {
    const src = content.src ?? '';
    if (src) return `![image](${src})`;
    return '![image]()';
  },

  deserialize(lines: string[]): Record<string, any> | null {
    const line = lines[0];
    if (!line) return null;
    const match = line.match(/^!\[.*?\]\((.*?)\)$/);
    if (!match) return null;
    const src = match[1];
    return src ? { src } : {};
  },

  detect(lines: string[]): boolean {
    return !!lines[0]?.match(/^!\[.*?\]\(.*?\)$/);
  },
};
