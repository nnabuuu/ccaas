import { Injectable } from '@nestjs/common';
import type {
  EntityContextProvider,
  EntityContext,
  AtReference,
  ApplyRequest,
  EditOperation,
  EditResult,
} from '@kedge-agentic/context-layer/core';
import { serialize, strReplace, deserialize } from '@kedge-agentic/entity-document';
import type { EntityDocument } from '@kedge-agentic/entity-document';
import { LessonPlanService } from '../../lesson-plan/lesson-plan.service';
import { LESSON_TYPE_MAP } from '../constants';
import { splitBlockForDocument, mergeBlockForStorage } from '../block-utils';

const EDITABLE_FIELDS = new Set(['title', 'subject', 'class_name', 'lesson_type', 'duration']);

@Injectable()
export class LessonPlanProvider implements EntityContextProvider {
  constructor(private lessonPlanService: LessonPlanService) {}

  async getContext(id: string, _userId: string): Promise<EntityContext> {
    const lp = await this.lessonPlanService.findOne(id);

    const summary = this.buildSummary(lp);
    const relations: AtReference[] = [];

    if (lp.requirement) {
      relations.push({
        type: 'requirement',
        id: lp.requirement.id ?? '',
        display_name: `课标:${lp.requirement.code}`,
        summary: lp.requirement.text ?? lp.requirement.code ?? '',
      });
    }

    return {
      ref: {
        type: 'lesson_plan',
        id: lp.id,
        display_name: `教案:${lp.title}`,
        summary,
      },
      structured: {
        title: lp.title,
        class_name: lp.class_name,
        subject: lp.subject,
        lesson_type: lp.lesson_type,
        duration_minutes: lp.duration,
        status: lp.status,
        blocks: lp.blocks,
        source_template_id: lp.source_template_id,
        requirement: lp.requirement,
      },
      relations,
      attachments: [],
    };
  }

  async search(query: string, _userId: string, limit: number): Promise<AtReference[]> {
    const result = await this.lessonPlanService.findAll({ q: query, limit });
    return result.items.map((item: any) => ({
      type: 'lesson_plan',
      id: item.id,
      display_name: `教案:${item.title}`,
      summary: this.buildListSummary(item),
    }));
  }

  /** @deprecated Use edit() instead */
  async apply(
    req: ApplyRequest,
    _userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const lp = await this.lessonPlanService.findOne(req.entity_id);

      if (lp.status === 'published') {
        return {
          success: false,
          error: '已发布的教案不允许通过 Apply 修改，请先取消发布',
        };
      }

      if (!EDITABLE_FIELDS.has(req.field_path)) {
        return { success: false, error: `字段 "${req.field_path}" 不允许修改` };
      }

      const updateDto: Record<string, any> = {};
      updateDto[req.field_path] = req.suggested_value;

      await this.lessonPlanService.update(req.entity_id, updateDto as any);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Apply failed' };
    }
  }

  async serialize(id: string, _userId: string): Promise<string> {
    const lp = await this.lessonPlanService.findOne(id);
    const doc = this.toEntityDocument(lp);
    return serialize(doc);
  }

  async edit(
    id: string,
    ops: EditOperation[],
    _userId: string,
  ): Promise<EditResult> {
    try {
      const lp = await this.lessonPlanService.findOne(id);

      if (lp.status === 'published') {
        return { success: false, error: '已发布的教案不允许修改，请先取消发布' };
      }

      const metaUpdates: Record<string, any> = {};
      let currentDoc = this.toEntityDocument(lp);

      for (const op of ops) {
        if (op.op === 'field_set') {
          if (!EDITABLE_FIELDS.has(op.field)) {
            return { success: false, error: `字段 "${op.field}" 不允许通过 field_set 修改` };
          }
          if (typeof op.value === 'object' && op.value !== null) {
            return { success: false, error: 'field_set value 必须为原始类型（字符串、数字、布尔值）' };
          }
          metaUpdates[op.field] = op.value;
        } else if (op.op === 'str_replace') {
          const result = strReplace(currentDoc, op.old_string, op.new_string);
          if (!result.success) {
            return { success: false, error: result.error };
          }
          currentDoc = result.document!;
        }
      }

      // Apply metadata updates
      if (Object.keys(metaUpdates).length > 0) {
        await this.lessonPlanService.update(id, metaUpdates as any);
      }

      // Apply block updates from str_replace operations
      const hasStrReplace = ops.some(op => op.op === 'str_replace');
      if (hasStrReplace) {
        // Update meta fields that changed via str_replace
        const metaFromDoc: Record<string, any> = {};
        for (const [key, value] of Object.entries(currentDoc.meta)) {
          if (EDITABLE_FIELDS.has(key)) {
            metaFromDoc[key] = value;
          }
        }

        // Update blocks — merge attributes back into content for DB storage
        const blocks = currentDoc.blocks.map(b => mergeBlockForStorage(b));

        await this.lessonPlanService.update(id, {
          ...metaFromDoc,
          blocks,
        } as any);
      }

      // Return updated document
      const updated = await this.lessonPlanService.findOne(id);
      const newDoc = this.toEntityDocument(updated);
      return { success: true, document: serialize(newDoc) };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Edit failed' };
    }
  }

  private toEntityDocument(lp: any): EntityDocument {
    const blocks = Array.isArray(lp.blocks)
      ? lp.blocks.map((b: any) => splitBlockForDocument(b))
      : [];

    return {
      meta: {
        title: lp.title ?? '',
        subject: lp.subject ?? '',
        class_name: lp.class_name ?? '',
        lesson_type: lp.lesson_type ?? '',
        duration: lp.duration ?? 0,
        status: lp.status ?? 'draft',
      },
      blocks,
    };
  }

  private buildSummary(lp: any): string {
    const parts: string[] = [];
    if (lp.class_name) parts.push(lp.class_name);
    if (lp.subject) parts.push(lp.subject);
    if (lp.lesson_type) parts.push(LESSON_TYPE_MAP[lp.lesson_type] ?? lp.lesson_type);
    parts.push('教案');
    if (lp.duration) parts.push(`${lp.duration}分钟`);
    if (lp.requirement) {
      parts.push(`学业要求${lp.requirement.code}`);
    } else {
      parts.push('未关联学业要求');
    }
    const summary = parts.join(' ');
    return summary.length > 100 ? summary.slice(0, 97) + '...' : summary;
  }

  private buildListSummary(item: any): string {
    const parts: string[] = [];
    if (item.class_name) parts.push(item.class_name);
    if (item.subject) parts.push(item.subject);
    if (item.lesson_type) parts.push(LESSON_TYPE_MAP[item.lesson_type] ?? item.lesson_type);
    if (item.status) parts.push(item.status);
    const summary = parts.join(' ');
    return summary.length > 100 ? summary.slice(0, 97) + '...' : summary;
  }
}
