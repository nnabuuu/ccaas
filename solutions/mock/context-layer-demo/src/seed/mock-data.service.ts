import { Injectable } from '@nestjs/common';
import type {
  EntityTypeInfo,
  BreadcrumbItem,
  BrowseItem,
  SearchResult,
} from '@kedge-agentic/context-layer';

@Injectable()
export class MockDataService {
  // Entity types
  private entityTypes: EntityTypeInfo[] = [
    { type: 'lesson_plan', displayName: '教案', icon: '📝', color: 'purple', searchable: true, browsable: true },
    { type: 'block', displayName: '内容块', icon: '📦', color: null, searchable: false, browsable: true },
    { type: 'attachment', displayName: '附件', icon: '📎', color: null, searchable: true, browsable: true },
    { type: 'exercise', displayName: '练习设计', icon: '📐', color: 'blue', searchable: true, browsable: true },
    { type: 'homework', displayName: '作业', icon: '📋', color: 'blue', searchable: true, browsable: true },
    { type: 'submission', displayName: '学生答卷', icon: '📄', color: null, searchable: false, browsable: true },
    { type: 'requirement', displayName: '课标', icon: '📖', color: 'coral', searchable: true, browsable: true },
    { type: 'question', displayName: '题目', icon: '❓', color: 'amber', searchable: true, browsable: true },
    { type: 'session_record', displayName: '课堂记录', icon: '📅', color: 'teal', searchable: true, browsable: true },
    { type: 'analytics', displayName: '学情分析', icon: '📊', color: 'red', searchable: true, browsable: true },
  ];

  // Seed data
  private lessonPlans: BrowseItem[] = [
    { entityType: 'lesson_plan', entityId: 'lp_1', displayName: 'SSS/SAS 新授课教案', subtitle: '八年级 · 数学 · 几何', timestamp: '2025-03-14T10:00:00Z', hasChildren: true },
    { entityType: 'lesson_plan', entityId: 'lp_2', displayName: 'ASA/AAS 判定教案', subtitle: '八年级 · 数学 · 几何', timestamp: '2025-03-10T09:00:00Z', hasChildren: true },
    { entityType: 'lesson_plan', entityId: 'lp_3', displayName: '全等三角形概念导入', subtitle: '八年级 · 数学 · 几何', timestamp: '2025-03-07T14:00:00Z', hasChildren: true },
    { entityType: 'lesson_plan', entityId: 'lp_4', displayName: '复习课：全等三角形判定对比', subtitle: '八年级 · 数学 · 几何', timestamp: '2025-03-01T08:00:00Z', hasChildren: true },
  ];

  private blocks: Record<string, BrowseItem[]> = {
    'lp_1': [
      { entityType: 'block', entityId: 'blk_1', displayName: '引入', subtitle: 'text', hasChildren: false },
      { entityType: 'block', entityId: 'blk_2', displayName: 'SAS 概念讲解', subtitle: 'text + image', hasChildren: true },
      { entityType: 'block', entityId: 'blk_3', displayName: '即时练习', subtitle: 'exercise', hasChildren: false },
      { entityType: 'block', entityId: 'blk_4', displayName: '小结', subtitle: 'text', hasChildren: false },
    ],
    'lp_2': [
      { entityType: 'block', entityId: 'blk_5', displayName: 'ASA 定理导入', subtitle: 'text', hasChildren: false },
      { entityType: 'block', entityId: 'blk_6', displayName: 'AAS 推导', subtitle: 'text + proof', hasChildren: false },
    ],
  };

  private attachments: Record<string, BrowseItem[]> = {
    'blk_1': [
      { entityType: 'attachment', entityId: 'att_3', displayName: '导入PPT.pptx', subtitle: 'application/pptx · 3.5 MB', hasChildren: false },
    ],
    'blk_2': [
      { entityType: 'attachment', entityId: 'att_1', displayName: '板书示意图.png', subtitle: 'image/png · 1.2 MB', hasChildren: false },
      { entityType: 'attachment', entityId: 'att_2', displayName: 'SAS判定条件图.png', subtitle: 'image/png · 2.1 MB', hasChildren: false },
    ],
  };

  private homework: BrowseItem[] = [
    { entityType: 'homework', entityId: 'hw_1', displayName: 'SAS 判定专项练习 · 八(2)班', subtitle: '38/43 已提交', timestamp: '2025-03-14T16:00:00Z', hasChildren: true },
    { entityType: 'homework', entityId: 'hw_2', displayName: 'SSS 判定随堂测验 · 八(2)班', subtitle: '42/43 已提交', timestamp: '2025-03-10T12:00:00Z', hasChildren: true },
  ];

  private submissions: Record<string, BrowseItem[]> = {
    'hw_1': [
      { entityType: 'submission', entityId: 'sub_1', displayName: '张三 · 92分', subtitle: '已批改', hasChildren: false },
      { entityType: 'submission', entityId: 'sub_2', displayName: '李四 · 78分', subtitle: '已批改', hasChildren: false },
      { entityType: 'submission', entityId: 'sub_3', displayName: '王五 · 85分', subtitle: '已批改', hasChildren: false },
    ],
    'hw_2': [
      { entityType: 'submission', entityId: 'sub_4', displayName: '张三 · 95分', subtitle: '已批改', hasChildren: false },
      { entityType: 'submission', entityId: 'sub_5', displayName: '李四 · 88分', subtitle: '已批改', hasChildren: false },
      { entityType: 'submission', entityId: 'sub_6', displayName: '王五 · 90分', subtitle: '已批改', hasChildren: false },
    ],
  };

  private requirements: BrowseItem[] = [
    { entityType: 'requirement', entityId: 'req_1', displayName: '全等三角形的判定（SAS）', subtitle: '几何 · 八年级', hasChildren: true },
    { entityType: 'requirement', entityId: 'req_2', displayName: '全等三角形的判定（SSS）', subtitle: '几何 · 八年级', hasChildren: true },
    { entityType: 'requirement', entityId: 'req_3', displayName: '全等三角形的性质', subtitle: '几何 · 八年级', hasChildren: true },
  ];

  private questions: Record<string, BrowseItem[]> = {
    'req_1': [
      { entityType: 'question', entityId: 'q_1', displayName: '已知 AB=DE, ∠A=∠D, AC=DF, 求证 △ABC ≌ △DEF (SAS)', subtitle: '证明题', hasChildren: false },
      { entityType: 'question', entityId: 'q_2', displayName: '求证 △ABC ≌ △DEF (SAS)', subtitle: '证明题', hasChildren: false },
    ],
    'req_2': [
      { entityType: 'question', entityId: 'q_3', displayName: '已知三边相等，求证全等 (SSS)', subtitle: '证明题', hasChildren: false },
    ],
  };

  private questionsAll: BrowseItem[] = [
    { entityType: 'question', entityId: 'q_1', displayName: '已知 AB=DE, ∠A=∠D, AC=DF, 求证 △ABC ≌ △DEF (SAS)', subtitle: '证明题', hasChildren: false },
    { entityType: 'question', entityId: 'q_2', displayName: '求证 △ABC ≌ △DEF (SAS)', subtitle: '证明题', hasChildren: false },
    { entityType: 'question', entityId: 'q_3', displayName: '已知三边相等，求证全等 (SSS)', subtitle: '证明题', hasChildren: false },
    { entityType: 'question', entityId: 'q_4', displayName: '利用 SAS 判定三角形全等的应用题', subtitle: '应用题', hasChildren: false },
    { entityType: 'question', entityId: 'q_5', displayName: '综合判定方法选择', subtitle: '综合题', hasChildren: false },
  ];

  private exercises: Record<string, BrowseItem[]> = {
    'lp_1': [
      { entityType: 'exercise', entityId: 'ex_1', displayName: 'SAS 判定随堂练', subtitle: '5道题', hasChildren: false },
      { entityType: 'exercise', entityId: 'ex_2', displayName: 'SAS 概念填空', subtitle: '3道题', hasChildren: false },
    ],
    'lp_2': [
      { entityType: 'exercise', entityId: 'ex_3', displayName: 'ASA 判定练习', subtitle: '4道题', hasChildren: false },
      { entityType: 'exercise', entityId: 'ex_4', displayName: 'AAS 判定练习', subtitle: '4道题', hasChildren: false },
    ],
  };

  private sessionRecords: BrowseItem[] = [
    { entityType: 'session_record', entityId: 'sr_1', displayName: '周三第1节 · SSS/SAS · 八(2)班', subtitle: '2025-03-14', hasChildren: false },
    { entityType: 'session_record', entityId: 'sr_2', displayName: '周一第3节 · ASA/AAS · 八(2)班', subtitle: '2025-03-10', hasChildren: false },
  ];

  private sessionRecordsByLp: Record<string, BrowseItem[]> = {
    'lp_1': [
      { entityType: 'session_record', entityId: 'sr_1', displayName: '周三第1节 · SSS/SAS · 八(2)班', subtitle: '2025-03-14', hasChildren: false },
    ],
  };

  private analyticsData: BrowseItem[] = [
    { entityType: 'analytics', entityId: 'ana_1', displayName: 'SAS 练习综合分析 · 八(2)班', subtitle: '平均分 82', hasChildren: false },
    { entityType: 'analytics', entityId: 'ana_2', displayName: 'SSS 测验分析 · 八(2)班', subtitle: '平均分 87', hasChildren: false },
  ];

  private analyticsByHw: Record<string, BrowseItem[]> = {
    'hw_1': [
      { entityType: 'analytics', entityId: 'ana_1', displayName: 'SAS 练习综合分析 · 八(2)班', subtitle: '平均分 82', hasChildren: false },
    ],
    'hw_2': [
      { entityType: 'analytics', entityId: 'ana_2', displayName: 'SSS 测验分析 · 八(2)班', subtitle: '平均分 87', hasChildren: false },
    ],
  };

  // Parent info for breadcrumb generation
  private parentInfo: Record<string, { parentType: string; parentId: string; parentDisplayName: string }> = {
    'block:blk_1': { parentType: 'lesson_plan', parentId: 'lp_1', parentDisplayName: 'SSS/SAS 新授课教案' },
    'block:blk_2': { parentType: 'lesson_plan', parentId: 'lp_1', parentDisplayName: 'SSS/SAS 新授课教案' },
    'block:blk_3': { parentType: 'lesson_plan', parentId: 'lp_1', parentDisplayName: 'SSS/SAS 新授课教案' },
    'block:blk_4': { parentType: 'lesson_plan', parentId: 'lp_1', parentDisplayName: 'SSS/SAS 新授课教案' },
    'attachment:att_1': { parentType: 'block', parentId: 'blk_2', parentDisplayName: 'SAS 概念讲解' },
    'attachment:att_2': { parentType: 'block', parentId: 'blk_2', parentDisplayName: 'SAS 概念讲解' },
    'attachment:att_3': { parentType: 'block', parentId: 'blk_1', parentDisplayName: '引入' },
    'exercise:ex_1': { parentType: 'lesson_plan', parentId: 'lp_1', parentDisplayName: 'SSS/SAS 新授课教案' },
    'exercise:ex_2': { parentType: 'lesson_plan', parentId: 'lp_1', parentDisplayName: 'SSS/SAS 新授课教案' },
    'submission:sub_1': { parentType: 'homework', parentId: 'hw_1', parentDisplayName: 'SAS 判定专项练习 · 八(2)班' },
    'submission:sub_2': { parentType: 'homework', parentId: 'hw_1', parentDisplayName: 'SAS 判定专项练习 · 八(2)班' },
    'submission:sub_3': { parentType: 'homework', parentId: 'hw_1', parentDisplayName: 'SAS 判定专项练习 · 八(2)班' },
    'question:q_1': { parentType: 'requirement', parentId: 'req_1', parentDisplayName: '全等三角形的判定（SAS）' },
    'question:q_2': { parentType: 'requirement', parentId: 'req_1', parentDisplayName: '全等三角形的判定（SAS）' },
    'question:q_3': { parentType: 'requirement', parentId: 'req_2', parentDisplayName: '全等三角形的判定（SSS）' },
    'analytics:ana_1': { parentType: 'homework', parentId: 'hw_1', parentDisplayName: 'SAS 判定专项练习 · 八(2)班' },
    'analytics:ana_2': { parentType: 'homework', parentId: 'hw_2', parentDisplayName: 'SSS 判定随堂测验 · 八(2)班' },
    'session_record:sr_1': { parentType: 'lesson_plan', parentId: 'lp_1', parentDisplayName: 'SSS/SAS 新授课教案' },
  };

  getBrowse(entityType: string, parentType?: string, parentId?: string, page = 1) {
    let items: BrowseItem[] = [];

    if (parentType && parentId) {
      switch (entityType) {
        case 'block':
          items = this.blocks[parentId] ?? [];
          break;
        case 'attachment':
          items = this.attachments[parentId] ?? [];
          break;
        case 'exercise':
          items = this.exercises[parentId] ?? [];
          break;
        case 'submission':
          items = this.submissions[parentId] ?? [];
          break;
        case 'question':
          items = this.questions[parentId] ?? [];
          break;
        case 'session_record':
          items = this.sessionRecordsByLp[parentId] ?? [];
          break;
        case 'analytics':
          items = this.analyticsByHw[parentId] ?? [];
          break;
        default:
          items = [];
      }
    } else {
      switch (entityType) {
        case 'lesson_plan':
          items = this.lessonPlans;
          break;
        case 'homework':
          items = this.homework;
          break;
        case 'requirement':
          items = this.requirements;
          break;
        case 'question':
          items = this.questionsAll;
          break;
        case 'session_record':
          items = this.sessionRecords;
          break;
        case 'analytics':
          items = this.analyticsData;
          break;
        default:
          items = [];
      }
    }

    return {
      items,
      total: items.length,
      page,
    };
  }

  getSearch(query: string, limit = 20) {
    const q = query.toLowerCase();
    const allItems = this.getAllSearchableItems();
    const filtered = allItems.filter(item =>
      item.displayName.toLowerCase().includes(q)
    );

    return {
      results: filtered.slice(0, limit),
    };
  }

  getResolve(entityType: string, entityId: string) {
    const allItems = this.getAllItems();
    const found = allItems.find(i => i.entityType === entityType && i.entityId === entityId);

    const breadcrumb = this.buildBreadcrumb(entityType, entityId);

    return {
      entityType,
      entityId,
      displayName: found?.displayName ?? entityId,
      data: {
        ...found,
        resolvedData: true,
      },
      dataHash: this.simpleHash(entityType + entityId),
      resolvedAt: new Date().toISOString(),
      breadcrumb,
    };
  }

  private buildBreadcrumb(entityType: string, entityId: string): BreadcrumbItem[] | null {
    const crumbs: BreadcrumbItem[] = [];
    let currentType = entityType;
    let currentId = entityId;

    while (true) {
      const key = `${currentType}:${currentId}`;
      const parent = this.parentInfo[key];
      if (!parent) break;

      const parentEntityDef = this.entityTypes.find(t => t.type === parent.parentType);
      crumbs.unshift({
        type: parent.parentType,
        id: parent.parentId,
        displayName: parent.parentDisplayName,
        icon: parentEntityDef?.icon ?? '📄',
      });

      currentType = parent.parentType;
      currentId = parent.parentId;
    }

    return crumbs.length > 0 ? crumbs : null;
  }

  private getAllSearchableItems(): SearchResult[] {
    const items: SearchResult[] = [];

    for (const lp of this.lessonPlans) {
      items.push({ entityType: lp.entityType, entityId: lp.entityId, displayName: lp.displayName, subtitle: lp.subtitle, icon: '📝', breadcrumb: null });
    }

    for (const hw of this.homework) {
      items.push({ entityType: hw.entityType, entityId: hw.entityId, displayName: hw.displayName, subtitle: hw.subtitle, icon: '📋', breadcrumb: null });
    }

    for (const [, atts] of Object.entries(this.attachments)) {
      for (const att of atts) {
        items.push({
          entityType: att.entityType, entityId: att.entityId, displayName: att.displayName, subtitle: att.subtitle, icon: '📎',
          breadcrumb: this.buildBreadcrumb(att.entityType, att.entityId),
        });
      }
    }

    for (const req of this.requirements) {
      items.push({ entityType: req.entityType, entityId: req.entityId, displayName: req.displayName, subtitle: req.subtitle, icon: '📖', breadcrumb: null });
    }

    for (const q of this.questionsAll) {
      items.push({
        entityType: q.entityType, entityId: q.entityId, displayName: q.displayName, subtitle: q.subtitle, icon: '❓',
        breadcrumb: this.buildBreadcrumb(q.entityType, q.entityId),
      });
    }

    for (const [, exs] of Object.entries(this.exercises)) {
      for (const ex of exs) {
        items.push({
          entityType: ex.entityType, entityId: ex.entityId, displayName: ex.displayName, subtitle: ex.subtitle, icon: '📐',
          breadcrumb: this.buildBreadcrumb(ex.entityType, ex.entityId),
        });
      }
    }

    for (const sr of this.sessionRecords) {
      items.push({ entityType: sr.entityType, entityId: sr.entityId, displayName: sr.displayName, subtitle: sr.subtitle, icon: '📅', breadcrumb: null });
    }

    for (const ana of this.analyticsData) {
      items.push({
        entityType: ana.entityType, entityId: ana.entityId, displayName: ana.displayName, subtitle: ana.subtitle, icon: '📊',
        breadcrumb: this.buildBreadcrumb(ana.entityType, ana.entityId),
      });
    }

    return items;
  }

  private getAllItems(): BrowseItem[] {
    const items: BrowseItem[] = [
      ...this.lessonPlans,
      ...this.homework,
      ...this.requirements,
      ...this.questionsAll,
      ...this.sessionRecords,
      ...this.analyticsData,
    ];
    for (const blocks of Object.values(this.blocks)) items.push(...blocks);
    for (const atts of Object.values(this.attachments)) items.push(...atts);
    for (const subs of Object.values(this.submissions)) items.push(...subs);
    for (const exs of Object.values(this.exercises)) items.push(...exs);
    return items;
  }

  private simpleHash(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}
