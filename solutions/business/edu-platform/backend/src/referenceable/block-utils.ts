import type { BlockData } from '@kedge-agentic/entity-document';

/**
 * Non-serializable content fields that should be moved to attributes
 * before markdown serialization, and merged back into content for DB storage.
 */
const CONTENT_TO_ATTR_FIELDS: Record<string, string[]> = {
  callout: ['color'],
};

/**
 * DB block → EntityDocument block.
 * Extracts non-serializable fields (e.g. callout.color) from content into attributes.
 */
export function splitBlockForDocument(block: any): BlockData {
  const type = block.type;
  const content = { ...(block.content ?? {}) };
  const attributes: Record<string, any> = { ...(block.attributes ?? {}) };
  const fieldsToMove = CONTENT_TO_ATTR_FIELDS[type];

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
 * Merges attributes back into content for storage.
 */
export function mergeBlockForStorage(block: BlockData): Record<string, any> {
  const content = { ...block.content };
  const fieldsToMerge = CONTENT_TO_ATTR_FIELDS[block.type];

  if (fieldsToMerge && block.attributes) {
    for (const field of fieldsToMerge) {
      if (field in block.attributes) {
        content[field] = block.attributes[field];
      }
    }
  }

  return { type: block.type, content };
}
