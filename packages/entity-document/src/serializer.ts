import type { EntityDocument } from './interfaces.js';
import type { TransformRegistry } from './transform-registry.js';
import { defaultRegistry } from './transform-registry.js';

export function serialize(doc: EntityDocument, registry?: TransformRegistry): string {
  const reg = registry ?? defaultRegistry;
  const parts: string[] = [];

  // YAML frontmatter
  if (Object.keys(doc.meta).length > 0) {
    parts.push('---');
    for (const [key, value] of Object.entries(doc.meta)) {
      parts.push(`${key}: ${escapeMetaValue(value)}`);
    }
    parts.push('---');
  }

  // Blocks
  for (const block of doc.blocks) {
    const transform = reg.getTransform(block.type);
    const text = transform.serialize(block.content);
    if (text) parts.push(text);
  }

  return parts.join('\n\n');
}

function escapeMetaValue(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  if (value.includes('\n') || value.includes(':') || value.startsWith(' ') || value.startsWith('"')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return value;
}
