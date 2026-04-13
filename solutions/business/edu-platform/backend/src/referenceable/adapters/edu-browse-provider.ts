import type {
  EntityBrowseProvider,
  BrowseResponse,
  SearchResponse,
  ResolveResponse,
} from '@kedge-agentic/context-layer/core';
import type { LessonPlanService } from '../../lesson-plan/lesson-plan.service';
import type { TemplateService } from '../../template/template.service';
import type { CurriculumService } from '../../curriculum/curriculum.service';
import { LESSON_TYPE_MAP, SUBJECT_MAP } from '../constants';

/**
 * EntityBrowseProvider for edu-platform.
 *
 * Created outside NestJS DI and passed to ContextLayerModule.forRoot().
 * Services are injected later via setServices() in ReferenceableModule.onModuleInit().
 */
export class EduBrowseProvider implements EntityBrowseProvider {
  private lessonPlanService?: LessonPlanService;
  private templateService?: TemplateService;
  private curriculumService?: CurriculumService;

  setServices(
    lpService: LessonPlanService,
    tplService: TemplateService,
    curService: CurriculumService,
  ): void {
    this.lessonPlanService = lpService;
    this.templateService = tplService;
    this.curriculumService = curService;
  }

  async browse(
    entityType: string,
    opts: { parentType?: string; parentId?: string; page?: number },
  ): Promise<BrowseResponse> {
    const page = opts.page ?? 1;

    if (entityType === 'lesson_plan' && this.lessonPlanService) {
      const result = await this.lessonPlanService.findAll({ page, limit: 20 });
      return {
        items: result.items.map((item: any) => ({
          entityType: 'lesson_plan',
          entityId: item.id,
          id: item.id,
          displayName: item.title,
          subtitle: `${item.class_name || ''} ${item.subject || ''} ${item.lesson_type ? (LESSON_TYPE_MAP[item.lesson_type] ?? item.lesson_type) : ''}`.trim(),
          hasChildren: false,
          summary: `${item.class_name || ''} ${item.subject || ''} ${item.lesson_type ? (LESSON_TYPE_MAP[item.lesson_type] ?? item.lesson_type) : ''} 教案`.trim(),
        })),
        total: result.total,
        page: result.page,
      };
    }

    if (entityType === 'template' && this.templateService) {
      const result = await this.templateService.findAll({ page, limit: 20 });
      return {
        items: result.items.map((item: any) => ({
          entityType: 'template',
          entityId: item.id,
          id: item.id,
          displayName: item.name,
          subtitle: `${item.scope || ''} ${item.lesson_type ? (LESSON_TYPE_MAP[item.lesson_type] ?? item.lesson_type) : ''}`.trim(),
          hasChildren: false,
          summary: `${item.name} ${item.scope || ''} ${item.lesson_type ? (LESSON_TYPE_MAP[item.lesson_type] ?? item.lesson_type) : ''}模板`.trim(),
        })),
        total: result.total,
        page: result.page,
      };
    }

    if (entityType === 'requirement' && this.curriculumService) {
      const subjects = this.curriculumService.getSubjects();
      const allNodes: any[] = [];
      for (const { subject } of subjects) {
        const tree = this.curriculumService.getTree(subject);
        allNodes.push(...tree);
      }
      const start = (page - 1) * 20;
      const paged = allNodes.slice(start, start + 20);
      return {
        items: paged.map((node: any) => ({
          entityType: 'requirement',
          entityId: node.id,
          id: node.id,
          displayName: node.name,
          subtitle: `${node.subject ? (SUBJECT_MAP[node.subject] ?? node.subject) : ''} ${node.grade_range || ''}`.trim(),
          hasChildren: false,
          summary: `${node.subject ? (SUBJECT_MAP[node.subject] ?? node.subject) : ''} ${node.name}`.trim(),
        })),
        total: allNodes.length,
        page,
      };
    }

    return { items: [], total: 0, page: 1 };
  }

  async search(
    query: string,
    opts?: { entityType?: string; limit?: number },
  ): Promise<SearchResponse> {
    const limit = opts?.limit ?? 20;
    const results: any[] = [];

    if ((!opts?.entityType || opts.entityType === 'lesson_plan') && this.lessonPlanService) {
      const lpResult = await this.lessonPlanService.findAll({ q: query, limit });
      for (const item of lpResult.items) {
        results.push({
          entityType: 'lesson_plan',
          entityId: item.id,
          displayName: item.title,
          subtitle: `${(item as any).class_name || ''} ${(item as any).subject || ''}`.trim(),
          icon: '📋',
          summary: `${(item as any).class_name || ''} ${(item as any).subject || ''} ${(item as any).lesson_type ? (LESSON_TYPE_MAP[(item as any).lesson_type] ?? (item as any).lesson_type) : ''} 教案`.trim(),
        });
      }
    }

    if ((!opts?.entityType || opts.entityType === 'template') && this.templateService) {
      const tplResult = await this.templateService.findAll({ q: query, limit });
      for (const item of tplResult.items) {
        results.push({
          entityType: 'template',
          entityId: item.id,
          displayName: item.name,
          subtitle: `${(item as any).scope || ''} ${(item as any).lesson_type ? (LESSON_TYPE_MAP[(item as any).lesson_type] ?? (item as any).lesson_type) : ''}`.trim(),
          icon: '📝',
          summary: `${item.name} ${(item as any).scope || ''} ${(item as any).lesson_type ? (LESSON_TYPE_MAP[(item as any).lesson_type] ?? (item as any).lesson_type) : ''}模板`.trim(),
        });
      }
    }

    if ((!opts?.entityType || opts.entityType === 'requirement') && this.curriculumService) {
      const nodes = this.curriculumService.search(query);
      for (const node of nodes.slice(0, limit)) {
        results.push({
          entityType: 'requirement',
          entityId: node.id,
          displayName: node.name,
          subtitle: `${node.subject || ''} ${node.grade_range || ''}`.trim(),
          icon: '📖',
          summary: `${node.subject ? (SUBJECT_MAP[node.subject] ?? node.subject) : ''} ${node.name}`.trim(),
        });
      }
    }

    return { results: results.slice(0, limit) };
  }

  async resolve(
    entityType: string,
    entityId: string,
  ): Promise<ResolveResponse> {
    if (entityType === 'lesson_plan' && this.lessonPlanService) {
      const lp = await this.lessonPlanService.findOne(entityId);
      return {
        entityType: 'lesson_plan',
        entityId: lp.id,
        displayName: lp.title,
        data: lp as any,
        dataHash: '',
        resolvedAt: new Date().toISOString(),
        breadcrumb: null,
      };
    }

    if (entityType === 'template' && this.templateService) {
      const tpl = await this.templateService.findOne(entityId);
      return {
        entityType: 'template',
        entityId: tpl.id,
        displayName: tpl.name,
        data: tpl as any,
        dataHash: '',
        resolvedAt: new Date().toISOString(),
        breadcrumb: null,
      };
    }

    if (entityType === 'requirement' && this.curriculumService) {
      const subjects = this.curriculumService.getSubjects();
      for (const { subject } of subjects) {
        const tree = this.curriculumService.getTree(subject);
        const node = this.findInNodes(tree, entityId);
        if (node) {
          return {
            entityType: 'requirement',
            entityId: node.id,
            displayName: node.name,
            data: node as any,
            dataHash: '',
            resolvedAt: new Date().toISOString(),
            breadcrumb: null,
          };
        }
      }
    }

    throw new Error(`Cannot resolve entity: ${entityType}/${entityId}`);
  }

  private findInNodes(nodes: any[], id: string): any | null {
    for (const node of nodes) {
      if (node.id === id) return node;
    }
    return null;
  }
}
