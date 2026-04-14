import type { BlockData, ContentToAttrConfig } from './interfaces.js';

/**
 * DB block → EntityDocument block.
 * Extracts non-serializable fields from content into attributes
 * based on the provided config.
 */
export function splitBlockForDocument(
  block: any,
  config: ContentToAttrConfig = {},
): BlockData {
  const type: string = block.type;
  const content = { ...(block.content ?? {}) };
  const attributes: Record<string, any> = { ...(block.attributes ?? {}) };
  const fieldsToMove = config[type];

  if (fieldsToMove) {
    for (const field of fieldsToMove) {
      if (field in content) {
        attributes[field] = content[field];
        delete content[field];
      }
    }
  }

  return {
    type,
    content,
    ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
  };
}

/**
 * EntityDocument block → DB block.
 * Merges attributes back into content for storage
 * based on the provided config.
 */
export function mergeBlockForStorage(
  block: BlockData,
  config: ContentToAttrConfig = {},
): Record<string, any> {
  const content = { ...block.content };
  const fieldsToMerge = config[block.type];

  if (fieldsToMerge && block.attributes) {
    for (const field of fieldsToMerge) {
      if (field in block.attributes) {
        content[field] = block.attributes[field];
      }
    }
  }

  return { type: block.type, content };
}
