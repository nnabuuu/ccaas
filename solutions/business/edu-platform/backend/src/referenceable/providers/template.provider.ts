import { Injectable } from '@nestjs/common';
import type {
  EntityContextProvider,
  EntityContext,
  AtReference,
  EditOperation,
  EditResult,
} from '@kedge-agentic/context-layer/core';
import { serialize, strReplace } from '@kedge-agentic/entity-document';
import type { EntityDocument } from '@kedge-agentic/entity-document';
import { TemplateService } from '../../template/template.service';
import { LESSON_TYPE_MAP } from '../constants';
import { splitBlockForDocument, mergeBlockForStorage } from '../block-utils';

@Injectable()
export class TemplateProvider implements EntityContextProvider {
  constructor(private templateService: TemplateService) {}

  async getContext(id: string, _userId: string): Promise<EntityContext> {
    const tpl = await this.templateService.findOne(id);

    const blockSummary = Array.isArray(tpl.blocks)
      ? tpl.blocks
          .filter((b: any) => b.type === 'section')
          .map((b: any) => b.placeholder || b.content?.title || b.type)
      : [];

    return {
      ref: {
        type: 'template',
        id: tpl.id,
        display_name: `模板:${tpl.name}`,
        summary: this.buildSummary(tpl),
      },
      structured: {
        name: tpl.name,
        description: tpl.description,
        scope: tpl.scope,
        lesson_type: tpl.lesson_type,
        version: tpl.version,
        block_summary: blockSummary,
        usage_count: tpl.usage_count,
        subject: tpl.subject,
        blocks: tpl.blocks,
      },
      relations: [],
      attachments: [],
    };
  }

  async search(query: string, _userId: string, limit: number): Promise<AtReference[]> {
    const result = await this.templateService.findAll({ q: query, limit });
    return result.items.map((item: any) => ({
      type: 'template',
      id: item.id,
      display_name: `模板:${item.name}`,
      summary: this.buildListSummary(item),
    }));
  }

  async serialize(id: string, _userId: string): Promise<string> {
    const tpl = await this.templateService.findOne(id);
    const doc = this.toEntityDocument(tpl);
    return serialize(doc);
  }

  async edit(
    id: string,
    ops: EditOperation[],
    _userId: string,
  ): Promise<EditResult> {
    try {
      const tpl = await this.templateService.findOne(id);
      let currentDoc = this.toEntityDocument(tpl);

      for (const op of ops) {
        if (op.op === 'field_set') {
          return { success: false, error: '模板不支持 field_set 操作' };
        } else if (op.op === 'str_replace') {
          const result = strReplace(currentDoc, op.old_string, op.new_string);
          if (!result.success) {
            return { success: false, error: result.error };
          }
          currentDoc = result.document!;
        }
      }

      // Update blocks — merge attributes back into content for DB storage
      const blocks = currentDoc.blocks.map(b => mergeBlockForStorage(b));

      await this.templateService.update(id, { blocks } as any);

      const updated = await this.templateService.findOne(id);
      const newDoc = this.toEntityDocument(updated);
      return { success: true, document: serialize(newDoc) };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Edit failed' };
    }
  }

  private toEntityDocument(tpl: any): EntityDocument {
    const blocks = Array.isArray(tpl.blocks)
      ? tpl.blocks.map((b: any) => splitBlockForDocument(b))
      : [];

    return {
      meta: {
        name: tpl.name ?? '',
        subject: tpl.subject ?? '',
        lesson_type: tpl.lesson_type ?? '',
        scope: tpl.scope ?? '',
        version: tpl.version ?? '',
      },
      blocks,
    };
  }

  private buildSummary(tpl: any): string {
    const parts: string[] = [tpl.name];
    if (tpl.scope) parts.push(`(${tpl.scope}作用域)`);
    if (tpl.lesson_type) parts.push(`${LESSON_TYPE_MAP[tpl.lesson_type] ?? tpl.lesson_type}模板`);
    if (tpl.version) parts.push(tpl.version);
    const summary = parts.join(' ');
    return summary.length > 100 ? summary.slice(0, 97) + '...' : summary;
  }

  private buildListSummary(item: any): string {
    const parts: string[] = [];
    if (item.name) parts.push(item.name);
    if (item.scope) parts.push(item.scope);
    if (item.lesson_type) parts.push(LESSON_TYPE_MAP[item.lesson_type] ?? item.lesson_type);
    const summary = parts.join(' ');
    return summary.length > 100 ? summary.slice(0, 97) + '...' : summary;
  }
}
