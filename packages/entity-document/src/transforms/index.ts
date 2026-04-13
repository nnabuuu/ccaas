import type { BlockTransform } from './base.js';
import { sectionTransform } from './section.js';
import { timelineTransform } from './timeline.js';
import { tableTransform } from './table.js';
import { listTransform } from './list.js';
import { calloutTransform } from './callout.js';
import { imageTransform } from './image.js';
import { textTransform } from './text.js';

// Priority order: more specific transforms first, text (fallback) last
const transforms: BlockTransform[] = [
  sectionTransform,
  timelineTransform,
  tableTransform,
  listTransform,
  calloutTransform,
  imageTransform,
  textTransform,
];

const transformsByType = new Map<string, BlockTransform>(
  transforms.map(t => [t.type, t]),
);

export function getTransform(type: string): BlockTransform {
  return transformsByType.get(type) ?? textTransform;
}

export function detectTransform(lines: string[]): BlockTransform {
  for (const t of transforms) {
    if (t !== textTransform && t.detect(lines)) return t;
  }
  return textTransform;
}

export { transforms, sectionTransform, timelineTransform, tableTransform, listTransform, calloutTransform, imageTransform, textTransform };
export type { BlockTransform } from './base.js';
