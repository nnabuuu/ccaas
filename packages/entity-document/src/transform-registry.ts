import type { BlockTransform } from './interfaces.js';
import { sectionTransform } from './transforms/section.js';
import { timelineTransform } from './transforms/timeline.js';
import { tableTransform } from './transforms/table.js';
import { listTransform } from './transforms/list.js';
import { calloutTransform } from './transforms/callout.js';
import { imageTransform } from './transforms/image.js';
import { textTransform } from './transforms/text.js';

export class TransformRegistry {
  private transforms = new Map<string, BlockTransform>();
  private priorityOrder: BlockTransform[] = [];

  register(type: string, transform: BlockTransform): void {
    this.transforms.set(type, transform);
    // Insert before text (fallback) — text always stays last
    const textIdx = this.priorityOrder.findIndex(t => t.type === 'text');
    if (textIdx >= 0) {
      this.priorityOrder.splice(textIdx, 0, transform);
    } else {
      this.priorityOrder.push(transform);
    }
  }

  unregister(type: string): boolean {
    if (!this.transforms.has(type) || type === 'text') return false;
    this.transforms.delete(type);
    this.priorityOrder = this.priorityOrder.filter(t => t.type !== type);
    return true;
  }

  getTransform(type: string): BlockTransform {
    return this.transforms.get(type) ?? textTransform;
  }

  detectTransform(lines: string[]): BlockTransform {
    for (const t of this.priorityOrder) {
      if (t.type !== 'text' && t.detect(lines)) return t;
    }
    return textTransform;
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.transforms.keys());
  }

  static withDefaults(): TransformRegistry {
    const registry = new TransformRegistry();
    const builtins: BlockTransform[] = [
      sectionTransform,
      timelineTransform,
      tableTransform,
      listTransform,
      calloutTransform,
      imageTransform,
      textTransform,
    ];
    for (const t of builtins) {
      registry.transforms.set(t.type, t);
    }
    registry.priorityOrder = [...builtins];
    return registry;
  }
}

export const defaultRegistry = TransformRegistry.withDefaults();
