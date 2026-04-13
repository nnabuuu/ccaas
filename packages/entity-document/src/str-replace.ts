import type { EntityDocument, StrReplaceResult, BlockData } from './interfaces.js';
import { serialize } from './serializer.js';
import { deserialize } from './deserializer.js';

export function strReplace(
  doc: EntityDocument,
  oldString: string,
  newString: string,
): StrReplaceResult {
  const text = serialize(doc);

  // Validate old_string exists
  const idx = text.indexOf(oldString);
  if (idx === -1) {
    return { success: false, error: `old_string not found in document` };
  }

  // Validate old_string is unique
  const secondIdx = text.indexOf(oldString, idx + 1);
  if (secondIdx !== -1) {
    return {
      success: false,
      error: `old_string appears multiple times in document (at positions ${idx} and ${secondIdx})`,
    };
  }

  // Perform replacement
  const newText = text.slice(0, idx) + newString + text.slice(idx + oldString.length);

  // Deserialize back
  const newDoc = deserialize(newText);

  // Preserve attributes from original blocks by index matching
  preserveAttributes(doc.blocks, newDoc.blocks);

  return {
    success: true,
    document: newDoc,
    documentText: newText,
  };
}

/**
 * Attempt to preserve attributes from original blocks onto new blocks
 * using index matching. Blocks whose content hasn't changed keep their
 * original attributes.
 */
function preserveAttributes(
  origBlocks: BlockData[],
  newBlocks: BlockData[],
): void {
  for (let i = 0; i < newBlocks.length; i++) {
    if (i < origBlocks.length) {
      const orig = origBlocks[i];
      const updated = newBlocks[i];

      // If same type and content matches, preserve attributes
      if (
        orig.type === updated.type &&
        JSON.stringify(orig.content) === JSON.stringify(updated.content)
      ) {
        updated.attributes = orig.attributes;
      }
      // If type changed or content changed, attributes reset (left undefined)
    }
    // New blocks beyond original length: no attributes to preserve
  }
}
