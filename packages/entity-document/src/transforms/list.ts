import type { BlockTransform } from './base.js';

export const listTransform: BlockTransform = {
  type: 'list',

  serialize(content: Record<string, any>): string {
    const items: string[] = content.items ?? [];
    const ordered: boolean = content.ordered ?? false;
    return items
      .map((item, i) => (ordered ? `${i + 1}. ${item}` : `- ${item}`))
      .join('\n');
  },

  deserialize(lines: string[]): Record<string, any> | null {
    if (lines.length === 0) return null;

    const first = lines[0];
    const isOrdered = /^\d+\.\s/.test(first);
    const isUnordered = first.startsWith('- ');
    if (!isOrdered && !isUnordered) return null;

    const items: string[] = [];
    for (const line of lines) {
      if (isOrdered) {
        const match = line.match(/^\d+\.\s(.*)$/);
        if (match) items.push(match[1]);
      } else {
        if (line.startsWith('- ')) items.push(line.slice(2));
      }
    }

    return { items, ordered: isOrdered };
  },

  detect(lines: string[]): boolean {
    const first = lines[0];
    if (!first) return false;
    return first.startsWith('- ') || /^\d+\.\s/.test(first);
  },
};
