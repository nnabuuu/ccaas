import { TransformRegistry } from '@kedge-agentic/entity-document';
import type { BlockTransform } from '@kedge-agentic/entity-document';

export const ingredientTransform: BlockTransform = {
  type: 'ingredient',

  detect(lines: string[]): boolean {
    return lines.length === 1 && lines[0].startsWith('<!-- type:ingredient ');
  },

  serialize(content: Record<string, any>): string {
    const items = (content.items || [])
      .map((i: any) => [i.name, i.amount, i.note].filter(Boolean).join(' | '))
      .join(' ; ');
    return `<!-- type:ingredient ${items} -->`;
  },

  deserialize(lines: string[]): Record<string, any> | null {
    const line = lines[0];
    const match = line.match(/^<!-- type:ingredient (.+?) -->$/);
    if (!match) return null;
    const items = match[1].split(' ; ').map(part => {
      const [name, amount, note] = part.split(' | ').map(s => s.trim());
      return { name, amount: amount || '', note: note || '' };
    });
    return { items };
  },
};

export const recipeRegistry = TransformRegistry.withDefaults();
recipeRegistry.register('ingredient', ingredientTransform);
