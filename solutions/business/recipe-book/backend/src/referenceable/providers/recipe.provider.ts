import { Injectable } from '@nestjs/common';
import type {
  EntityContext,
  AtReference,
  ApplyRequest,
  EditOperation,
  EditResult,
} from '@kedge-agentic/context-layer/core';
import { DocumentEditProvider } from '@kedge-agentic/context-layer/core';
import type { EntityDocument, ContentToAttrConfig, BlockData } from '@kedge-agentic/entity-document';
import { serialize, strReplace, mergeBlockForStorage } from '@kedge-agentic/entity-document';
import { RecipeService } from '../../recipe/recipe.service';
import { recipeRegistry } from '../recipe-registry';
import { splitBlockForDocument } from '../block-utils';
import { CUISINE_MAP, DIFFICULTY_MAP } from '../constants';

const EDITABLE_FIELDS = new Set(['title', 'cuisine', 'difficulty', 'prep_time', 'cook_time', 'servings']);
const RECIPE_CONFIG: ContentToAttrConfig = { callout: ['color'], ingredient: ['category'] };

function truncate(s: string, max = 100): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

@Injectable()
export class RecipeProvider extends DocumentEditProvider {
  constructor(private recipeService: RecipeService) { super(); }

  async loadEntity(id: string, _userId?: string): Promise<any> { return this.recipeService.findOne(id); }
  async saveEntity(id: string, updates: any, _userId?: string): Promise<void> { await this.recipeService.update(id, updates as any); }
  getEditableFields(): Set<string> { return EDITABLE_FIELDS; }
  getContentToAttrConfig(): ContentToAttrConfig { return RECIPE_CONFIG; }

  toEntityDocument(recipe: any): EntityDocument {
    return {
      meta: {
        title: recipe.title ?? '',
        cuisine: recipe.cuisine ?? '',
        difficulty: recipe.difficulty ?? '',
        prep_time: recipe.prep_time ?? 0,
        cook_time: recipe.cook_time ?? 0,
        servings: recipe.servings ?? 1,
        status: recipe.status ?? 'draft',
      },
      blocks: Array.isArray(recipe.blocks)
        ? recipe.blocks.map((b: any) => splitBlockForDocument(b))
        : [],
    };
  }

  /**
   * Override serialize to use recipeRegistry (with ingredient transform).
   * The base class calls serialize(doc) without registry — ingredient blocks
   * would be serialized as text by defaultRegistry and break round-trip.
   */
  async serialize(id: string, userId: string): Promise<string> {
    const entity = await this.loadEntity(id, userId);
    const doc = this.toEntityDocument(entity);
    return serialize(doc, recipeRegistry);
  }

  /**
   * Override edit to pass recipeRegistry to strReplace.
   * This is the CORE requirement — without this, str_replace would use
   * defaultRegistry and ingredient blocks would round-trip as text blocks.
   */
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
            return { success: false, error: `字段 "${op.field}" 不允许通过 field_set 修改` };
          }
          if (typeof op.value === 'object' && op.value !== null) {
            return { success: false, error: 'field_set value 必须为原始类型（字符串、数字、布尔值）' };
          }
          metaUpdates[op.field] = op.value;
        } else if (op.op === 'str_replace') {
          // KEY: pass recipeRegistry so ingredient blocks round-trip correctly
          const result = strReplace(currentDoc, op.old_string, op.new_string, recipeRegistry);
          if (!result.success) {
            return { success: false, error: result.error };
          }
          currentDoc = result.document!;
        } else if ((op as any).op === 'block_attr_set') {
          const { block_index, attr, value } = op as any;
          const block = currentDoc.blocks[block_index];
          if (!block) return { success: false, error: `Block index ${block_index} out of range` };
          if (!block.attributes) block.attributes = {};
          block.attributes[attr] = value;
        } else if ((op as any).op === 'block_content_set') {
          const { block_index, field, value } = op as any;
          const block = currentDoc.blocks[block_index];
          if (!block) return { success: false, error: `Block index ${block_index} out of range` };
          block.content[field] = value;
        }
      }

      const updates: Record<string, any> = { ...metaUpdates };
      const hasBlockOps = ops.some(op => (op as any).op === 'block_attr_set' || (op as any).op === 'block_content_set');
      const hasStrReplace = ops.some(op => op.op === 'str_replace');
      if (hasStrReplace || hasBlockOps) {
        for (const [key, value] of Object.entries(currentDoc.meta)) {
          if (editableFields.has(key)) {
            updates[key] = value;
          }
        }
        updates.blocks = currentDoc.blocks.map((b: BlockData) =>
          mergeBlockForStorage(b, config),
        );
      }

      if (Object.keys(updates).length > 0) {
        await this.saveEntity(id, updates, userId);
      }

      const updated = await this.loadEntity(id, userId);
      const newDoc = this.toEntityDocument(updated);
      return { success: true, document: serialize(newDoc, recipeRegistry) };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Edit failed' };
    }
  }

  protected validateEdit(entity: any, _ops: EditOperation[]): EditResult | null {
    return entity.status === 'published'
      ? { success: false, error: '已发布的食谱不允许修改，请先取消发布' }
      : null;
  }

  async getContext(id: string, _userId: string): Promise<EntityContext> {
    const recipe = await this.recipeService.findOne(id);
    return {
      ref: {
        type: 'recipe',
        id: recipe.id,
        display_name: `食谱:${recipe.title}`,
        summary: this.buildSummary(recipe),
      },
      structured: {
        title: recipe.title,
        cuisine: recipe.cuisine,
        difficulty: recipe.difficulty,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        status: recipe.status,
        blocks: recipe.blocks,
      },
      relations: [],
      attachments: [],
    };
  }

  async search(query: string, _userId: string, limit: number): Promise<AtReference[]> {
    const result = await this.recipeService.findAll({ q: query, limit });
    return result.items.map((item: any) => ({
      type: 'recipe',
      id: item.id,
      display_name: `食谱:${item.title}`,
      summary: truncate(
        [item.cuisine, DIFFICULTY_MAP[item.difficulty] ?? item.difficulty, item.status]
          .filter(Boolean)
          .join(' '),
      ),
    }));
  }

  async apply(req: ApplyRequest, _userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const recipe = await this.recipeService.findOne(req.entity_id);
      if (recipe.status === 'published') return { success: false, error: '已发布的食谱不允许修改' };
      if (!EDITABLE_FIELDS.has(req.field_path)) return { success: false, error: `字段 "${req.field_path}" 不允许修改` };
      await this.recipeService.update(req.entity_id, { [req.field_path]: req.suggested_value } as any);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Apply failed' };
    }
  }

  private buildSummary(recipe: any): string {
    const parts: string[] = [];
    if (recipe.cuisine) parts.push(recipe.cuisine);
    if (recipe.difficulty) parts.push(DIFFICULTY_MAP[recipe.difficulty] ?? recipe.difficulty);
    parts.push('食谱');
    if (recipe.prep_time) parts.push(`备料${recipe.prep_time}分钟`);
    if (recipe.cook_time) parts.push(`烹饪${recipe.cook_time}分钟`);
    return truncate(parts.join(' '));
  }
}
