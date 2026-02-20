import type { BillItem } from '../types';

export function generateBrickLinkXml(bom: BillItem[]): string {
  const items = bom
    .map(
      (item) =>
        `  <ITEM>\n    <ITEMTYPE>P</ITEMTYPE>\n    <ITEMID>${item.brickId}</ITEMID>\n    <COLOR>${item.colorId}</COLOR>\n    <MINQTY>${item.quantity}</MINQTY>\n  </ITEM>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<INVENTORY>\n${items}\n</INVENTORY>`;
}

export function generateCsv(bom: BillItem[]): string {
  const header = 'Brick ID,Color ID,Quantity';
  const rows = bom.map((item) => `${item.brickId},${item.colorId},${item.quantity}`);
  return [header, ...rows].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getBrickLinkPartUrl(brickId: string, colorId: number): string {
  return `https://www.bricklink.com/v2/catalog/catalogitem.page?P=${brickId}&C=${colorId}`;
}
