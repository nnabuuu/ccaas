import type { BlockTransform } from './base.js';
import { sectionTransform } from './section.js';
import { timelineTransform } from './timeline.js';
import { tableTransform } from './table.js';
import { listTransform } from './list.js';
import { calloutTransform } from './callout.js';
import { imageTransform } from './image.js';
import { textTransform } from './text.js';
import { defaultRegistry } from '../transform-registry.js';

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

export function getTransform(type: string): BlockTransform {
  return defaultRegistry.getTransform(type);
}

export function detectTransform(lines: string[]): BlockTransform {
  return defaultRegistry.detectTransform(lines);
}

export { transforms, sectionTransform, timelineTransform, tableTransform, listTransform, calloutTransform, imageTransform, textTransform };
export type { BlockTransform } from './base.js';
