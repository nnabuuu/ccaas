import type { BlockData, ContentToAttrConfig } from '@kedge-agentic/entity-document';
import {
  splitBlockForDocument as genericSplit,
  mergeBlockForStorage as genericMerge,
} from '@kedge-agentic/entity-document';

const RECIPE_CONFIG: ContentToAttrConfig = { callout: ['color'], ingredient: ['category'] };

export function splitBlockForDocument(block: any): BlockData {
  return genericSplit(block, RECIPE_CONFIG);
}

export function mergeBlockForStorage(block: BlockData): Record<string, any> {
  return genericMerge(block, RECIPE_CONFIG);
}
