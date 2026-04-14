import type {
  EntityDocument,
  ContentToAttrConfig,
  BlockData,
} from '@kedge-agentic/entity-document';
import {
  serialize,
  strReplace,
  splitBlockForDocument,
  mergeBlockForStorage,
} from '@kedge-agentic/entity-document';
import type { EditOperation, EditResult, EntityContextProvider } from './interfaces.js';

/**
 * Abstract base class that implements the serialize/edit orchestration
 * for EntityContextProviders backed by entity-document.
 *
 * Subclasses implement 5 abstract methods to define entity-specific behavior.
 * The base class handles the common serialize → str_replace → save loop.
 */
export abstract class DocumentEditProvider
  implements Pick<EntityContextProvider, 'serialize' | 'edit'>
{
  abstract loadEntity(id: string, userId: string): Promise<any>;
  abstract saveEntity(id: string, updates: any, userId: string): Promise<void>;
  abstract toEntityDocument(entity: any): EntityDocument;
  abstract getEditableFields(): Set<string>;
  abstract getContentToAttrConfig(): ContentToAttrConfig;

  protected validateEdit?(
    entity: any,
    ops: EditOperation[],
  ): EditResult | null;

  async serialize(id: string, userId: string): Promise<string> {
    const entity = await this.loadEntity(id, userId);
    const doc = this.toEntityDocument(entity);
    return serialize(doc);
  }

  async edit(
    id: string,
    ops: EditOperation[],
    userId: string,
  ): Promise<EditResult> {
    try {
      const entity = await this.loadEntity(id, userId);

      if (this.validateEdit) {
        const rejection = this.validateEdit(entity, ops);
        if (rejection) return rejection;
      }

      const editableFields = this.getEditableFields();
      const config = this.getContentToAttrConfig();
      const metaUpdates: Record<string, any> = {};
      let currentDoc = this.toEntityDocument(entity);

      for (const op of ops) {
        if (op.op === 'field_set') {
          if (!editableFields.has(op.field)) {
            return {
              success: false,
              error: `字段 "${op.field}" 不允许通过 field_set 修改`,
            };
          }
          if (typeof op.value === 'object' && op.value !== null) {
            return {
              success: false,
              error: 'field_set value 必须为原始类型（字符串、数字、布尔值）',
            };
          }
          metaUpdates[op.field] = op.value;
        } else if (op.op === 'str_replace') {
          const result = strReplace(
            currentDoc,
            op.old_string,
            op.new_string,
          );
          if (!result.success) {
            return { success: false, error: result.error };
          }
          currentDoc = result.document!;
        }
      }

      // Build the update payload
      const updates: Record<string, any> = { ...metaUpdates };

      const hasStrReplace = ops.some((op) => op.op === 'str_replace');
      if (hasStrReplace) {
        // Extract meta fields changed via str_replace
        for (const [key, value] of Object.entries(currentDoc.meta)) {
          if (editableFields.has(key)) {
            updates[key] = value;
          }
        }
        // Merge blocks back for storage
        updates.blocks = currentDoc.blocks.map((b: BlockData) =>
          mergeBlockForStorage(b, config),
        );
      }

      if (Object.keys(updates).length > 0) {
        await this.saveEntity(id, updates, userId);
      }

      // Return updated document
      const updated = await this.loadEntity(id, userId);
      const newDoc = this.toEntityDocument(updated);
      return { success: true, document: serialize(newDoc) };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Edit failed' };
    }
  }
}
