import type { BlockTransform } from './base.js';

export const tableTransform: BlockTransform = {
  type: 'table',

  serialize(content: Record<string, any>): string {
    const headers: string[] = content.headers ?? [];
    const rows: string[][] = content.rows ?? [];

    const headerRow = '| ' + headers.join(' | ') + ' |';
    const separator = '| ' + headers.map(() => '---').join(' | ') + ' |';
    const dataRows = rows.map(row => '| ' + row.join(' | ') + ' |');

    return [headerRow, separator, ...dataRows].join('\n');
  },

  deserialize(lines: string[]): Record<string, any> | null {
    if (lines.length < 2) return null;

    // First line: headers
    const headers = parseTableRow(lines[0]);
    if (!headers) return null;

    // Second line: separator (|---|---|)
    if (!isTableSeparator(lines[1])) return null;

    // Remaining lines: data rows
    const rows: string[][] = [];
    for (let i = 2; i < lines.length; i++) {
      const row = parseTableRow(lines[i]);
      if (row) rows.push(row);
    }

    return { headers, rows };
  },

  detect(lines: string[]): boolean {
    if (lines.length < 2) return false;
    return lines[0].startsWith('|') && isTableSeparator(lines[1]);
  },
};

function parseTableRow(line: string): string[] | null {
  if (!line.startsWith('|')) return null;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map(c => c.trim());
  return cells.length > 0 ? cells : null;
}

function isTableSeparator(line: string): boolean {
  if (!line.startsWith('|')) return false;
  return /^\|[\s-|]+\|$/.test(line);
}
