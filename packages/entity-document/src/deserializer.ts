import type { EntityDocument, DocumentMeta, BlockData } from './interfaces.js';
import type { TransformRegistry } from './transform-registry.js';
import { defaultRegistry } from './transform-registry.js';

export function deserialize(text: string, registry?: TransformRegistry): EntityDocument {
  const reg = registry ?? defaultRegistry;
  const { meta, body } = parseFrontmatter(text);
  const blocks = parseBlocks(body, reg);
  return { meta, blocks };
}

function parseFrontmatter(text: string): { meta: DocumentMeta; body: string } {
  const trimmed = text.trim();
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: trimmed };
  }

  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) {
    return { meta: {}, body: trimmed };
  }

  const frontmatterBlock = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trim();

  const meta: DocumentMeta = {};
  for (const line of frontmatterBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();
    meta[key] = parseValue(rawValue);
  }

  return { meta, body };
}

function parseValue(raw: string): string | number | boolean {
  // Unquote escaped strings: "value with \\n and \\"quotes\\""
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;
  return raw;
}

function parseBlocks(body: string, registry: TransformRegistry): BlockData[] {
  if (!body) return [];

  const chunks = splitIntoChunks(body);
  const blocks: BlockData[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const transform = registry.detectTransform(lines);

    const content = transform.deserialize(lines);
    if (content) {
      blocks.push({ type: transform.type, content });
    }
  }

  return blocks;
}

/**
 * Split body text into logical chunks separated by blank lines.
 * Multi-line blocks (table, timeline, list, callout) are kept together.
 */
function splitIntoChunks(body: string): string[] {
  const lines = body.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '') {
      if (current.length > 0) {
        chunks.push(current.join('\n'));
        current = [];
      }
      continue;
    }

    // If current is empty, start new chunk
    if (current.length === 0) {
      current.push(line);
      continue;
    }

    // Determine if this line continues the current chunk
    if (shouldContinueChunk(current, line)) {
      current.push(line);
    } else {
      chunks.push(current.join('\n'));
      current = [line];
    }
  }

  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks;
}

function shouldContinueChunk(current: string[], nextLine: string): boolean {
  const firstLine = current[0];

  // Timeline: HTML comment followed by table
  if (firstLine.includes('<!-- type:timeline -->')) return true;

  // Table: lines starting with |
  if (firstLine.startsWith('|') && nextLine.startsWith('|')) return true;

  // List: all items starting with - or digit.
  if (
    (firstLine.startsWith('- ') || /^\d+\.\s/.test(firstLine)) &&
    (nextLine.startsWith('- ') || /^\d+\.\s/.test(nextLine))
  ) {
    return true;
  }

  // Callout: all lines starting with >
  if (firstLine.startsWith('> ') && nextLine.startsWith('> ')) return true;

  return false;
}
