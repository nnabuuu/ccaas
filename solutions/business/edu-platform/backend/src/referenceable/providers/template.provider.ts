import { Injectable } from '@nestjs/common';
import type {
  EntityContext,
  AtReference,
} from '@kedge-agentic/context-layer/core';
import { DocumentEditProvider } from '@kedge-agentic/context-layer/core';
import type { EntityDocument, ContentToAttrConfig } from '@kedge-agentic/entity-document';
import { TemplateService } from '../../template/template.service';
import { LESSON_TYPE_MAP } from '../constants';
import { splitBlockForDocument } from '../block-utils';

@Injectable()
export class TemplateProvider extends DocumentEditProvider {
  constructor(private templateService: TemplateService) {
    super();
  }

  async loadEntity(id: string, _userId: string): Promise<any> {
    return this.templateService.findOne(id);
  }

  async saveEntity(id: string, updates: any, _userId: string): Promise<void> {
    await this.templateService.update(id, updates as any);
  }

  toEntityDocument(tpl: any): EntityDocument {
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

  getEditableFields(): Set<string> {
    // Template doesn't support field_set — return empty set
    return new Set();
  }

  getContentToAttrConfig(): ContentToAttrConfig {
    return { callout: ['color'] };
  }

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
