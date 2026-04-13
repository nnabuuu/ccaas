import type { BlockTransform } from './base.js';
import { tableTransform } from './table.js';

export const timelineTransform: BlockTransform = {
  type: 'timeline',

  serialize(content: Record<string, any>): string {
    const items: Array<{ time: string; duration: string; desc: string }> =
      content.items ?? [];

    const headers = ['时段', '时长', '内容'];
    const rows = items.map(item => [item.time, item.duration, item.desc]);

    const tableContent = tableTransform.serialize({ headers, rows });
    return `<!-- type:timeline -->\n${tableContent}`;
  },

  deserialize(lines: string[]): Record<string, any> | null {
    if (lines.length < 1 || !lines[0].includes('<!-- type:timeline -->')) {
      return null;
    }

    // Pass table lines (skip the comment marker)
    const tableLines = lines.slice(1);
    const tableData = tableTransform.deserialize(tableLines);
    if (!tableData) return null;

    const items = (tableData.rows as string[][]).map(row => ({
      time: row[0] ?? '',
      duration: row[1] ?? '',
      desc: row[2] ?? '',
    }));

    return { items };
  },

  detect(lines: string[]): boolean {
    return !!lines[0]?.includes('<!-- type:timeline -->');
  },
};
