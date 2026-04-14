import { Injectable } from '@nestjs/common';
import type { EntityContext, AtReference, ApplyRequest, EditOperation, EditResult } from '@kedge-agentic/context-layer/core';
import { DocumentEditProvider } from '@kedge-agentic/context-layer/core';
import type { EntityDocument, ContentToAttrConfig } from '@kedge-agentic/entity-document';
import { LessonPlanService } from '../../lesson-plan/lesson-plan.service';
import { LESSON_TYPE_MAP } from '../constants';
import { splitBlockForDocument } from '../block-utils';

const EDITABLE_FIELDS = new Set(['title', 'subject', 'class_name', 'lesson_type', 'duration']);

function truncate(s: string, max = 100): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

@Injectable()
export class LessonPlanProvider extends DocumentEditProvider {
  constructor(private lessonPlanService: LessonPlanService) { super(); }

  async loadEntity(id: string): Promise<any> { return this.lessonPlanService.findOne(id); }
  async saveEntity(id: string, updates: any): Promise<void> { await this.lessonPlanService.update(id, updates as any); }
  getEditableFields(): Set<string> { return EDITABLE_FIELDS; }
  getContentToAttrConfig(): ContentToAttrConfig { return { callout: ['color'] }; }

  toEntityDocument(lp: any): EntityDocument {
    return {
      meta: {
        title: lp.title ?? '', subject: lp.subject ?? '',
        class_name: lp.class_name ?? '', lesson_type: lp.lesson_type ?? '',
        duration: lp.duration ?? 0, status: lp.status ?? 'draft',
      },
      blocks: Array.isArray(lp.blocks) ? lp.blocks.map((b: any) => splitBlockForDocument(b)) : [],
    };
  }

  protected validateEdit(entity: any, _ops: EditOperation[]): EditResult | null {
    return entity.status === 'published'
      ? { success: false, error: '已发布的教案不允许修改，请先取消发布' }
      : null;
  }

  async getContext(id: string, _userId: string): Promise<EntityContext> {
    const lp = await this.lessonPlanService.findOne(id);
    const relations: AtReference[] = [];
    if (lp.requirement) {
      relations.push({
        type: 'requirement', id: lp.requirement.id ?? '',
        display_name: `课标:${lp.requirement.code}`,
        summary: lp.requirement.text ?? lp.requirement.code ?? '',
      });
    }
    return {
      ref: { type: 'lesson_plan', id: lp.id, display_name: `教案:${lp.title}`, summary: this.buildSummary(lp) },
      structured: {
        title: lp.title, class_name: lp.class_name, subject: lp.subject,
        lesson_type: lp.lesson_type, duration_minutes: lp.duration,
        status: lp.status, blocks: lp.blocks,
        source_template_id: lp.source_template_id, requirement: lp.requirement,
      },
      relations, attachments: [],
    };
  }

  async search(query: string, _userId: string, limit: number): Promise<AtReference[]> {
    const result = await this.lessonPlanService.findAll({ q: query, limit });
    return result.items.map((item: any) => ({
      type: 'lesson_plan', id: item.id, display_name: `教案:${item.title}`,
      summary: truncate([item.class_name, item.subject, item.lesson_type && (LESSON_TYPE_MAP[item.lesson_type] ?? item.lesson_type), item.status].filter(Boolean).join(' ')),
    }));
  }

  /** @deprecated Use edit() instead */
  async apply(req: ApplyRequest, _userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const lp = await this.lessonPlanService.findOne(req.entity_id);
      if (lp.status === 'published') return { success: false, error: '已发布的教案不允许通过 Apply 修改，请先取消发布' };
      if (!EDITABLE_FIELDS.has(req.field_path)) return { success: false, error: `字段 "${req.field_path}" 不允许修改` };
      await this.lessonPlanService.update(req.entity_id, { [req.field_path]: req.suggested_value } as any);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Apply failed' };
    }
  }

  private buildSummary(lp: any): string {
    const parts: string[] = [];
    if (lp.class_name) parts.push(lp.class_name);
    if (lp.subject) parts.push(lp.subject);
    if (lp.lesson_type) parts.push(LESSON_TYPE_MAP[lp.lesson_type] ?? lp.lesson_type);
    parts.push('教案');
    if (lp.duration) parts.push(`${lp.duration}分钟`);
    parts.push(lp.requirement ? `学业要求${lp.requirement.code}` : '未关联学业要求');
    return truncate(parts.join(' '));
  }
}
