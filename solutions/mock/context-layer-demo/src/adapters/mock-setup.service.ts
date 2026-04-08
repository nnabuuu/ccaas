import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityRegistry } from '@kedge-agentic/context-layer';
import { MockCacheStore } from './mock-cache-store';

@Injectable()
export class MockSetupService implements OnModuleInit {
  constructor(
    private registry: EntityRegistry,
    private cache: MockCacheStore,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerEntityTypes();
    this.registerRelations();
    await this.seedRecents();
    await this.seedShortcuts();
  }

  private registerEntityTypes(): void {
    const types = [
      { type: 'lesson_plan', displayName: '教案', icon: '📝', color: 'purple', abilities: { search: true, browse: true } },
      { type: 'block', displayName: '内容块', icon: '📦', abilities: { search: false, browse: true } },
      { type: 'attachment', displayName: '附件', icon: '📎', abilities: { search: true, browse: true } },
      { type: 'exercise', displayName: '练习设计', icon: '📐', color: 'blue', abilities: { search: true, browse: true } },
      { type: 'homework', displayName: '作业', icon: '📋', color: 'blue', abilities: { search: true, browse: true } },
      { type: 'submission', displayName: '学生答卷', icon: '📄', abilities: { search: false, browse: true } },
      { type: 'requirement', displayName: '课标', icon: '📖', color: 'coral', abilities: { search: true, browse: true } },
      { type: 'question', displayName: '题目', icon: '❓', color: 'amber', abilities: { search: true, browse: true } },
      { type: 'session_record', displayName: '课堂记录', icon: '📅', color: 'teal', abilities: { search: true, browse: true } },
      { type: 'analytics', displayName: '学情分析', icon: '📊', color: 'red', abilities: { search: true, browse: true } },
    ];

    for (const t of types) {
      this.registry.register(t);
    }
  }

  private registerRelations(): void {
    this.registry.setRelations([
      { parent: 'lesson_plan', child: 'block', label: '内容块', foreignKey: 'lesson_plan_id' },
      { parent: 'block', child: 'attachment', label: '附件', foreignKey: 'block_id' },
      { parent: 'lesson_plan', child: 'exercise', label: '练习设计', foreignKey: 'lesson_plan_id' },
      { parent: 'lesson_plan', child: 'session_record', label: '课堂记录', foreignKey: 'lesson_plan_id' },
      { parent: 'homework', child: 'submission', label: '学生答卷', foreignKey: 'homework_id' },
      { parent: 'homework', child: 'analytics', label: '学情分析', foreignKey: 'homework_id' },
      { parent: 'requirement', child: 'question', label: '题目', foreignKey: 'requirement_id' },
    ]);
  }

  private async seedRecents(): Promise<void> {
    const tenantId = 'default';
    const userId = 'default-user';
    const sessionId = 'demo';
    const key = `ctx:recents:${tenantId}:${userId}:${sessionId}`;
    const infoKey = `ctx:entity_info:${tenantId}`;

    const recents = [
      { entityType: 'lesson_plan', entityId: 'lp_1', displayName: 'SSS/SAS 新授课教案', score: 95 },
      { entityType: 'homework', entityId: 'hw_1', displayName: 'SAS 判定专项练习 · 八(2)班', score: 82 },
      { entityType: 'attachment', entityId: 'att_2', displayName: 'SAS判定条件图.png', score: 71 },
      { entityType: 'session_record', entityId: 'sr_1', displayName: '周三第1节 · SSS/SAS · 八(2)班', score: 65 },
    ];

    for (const r of recents) {
      const member = `${r.entityType}:${r.entityId}`;
      await this.cache.zincrby(key, r.score, member);
      await this.cache.hset(infoKey, member, JSON.stringify({
        displayName: r.displayName,
        entityType: r.entityType,
        entityId: r.entityId,
      }));
    }

    // Cache parent info for breadcrumb generation
    this.registry.cacheParent('block', 'blk_1', 'lesson_plan', 'lp_1', 'SSS/SAS 新授课教案');
    this.registry.cacheParent('block', 'blk_2', 'lesson_plan', 'lp_1', 'SSS/SAS 新授课教案');
    this.registry.cacheParent('block', 'blk_3', 'lesson_plan', 'lp_1', 'SSS/SAS 新授课教案');
    this.registry.cacheParent('block', 'blk_4', 'lesson_plan', 'lp_1', 'SSS/SAS 新授课教案');
    this.registry.cacheParent('attachment', 'att_1', 'block', 'blk_2', 'SAS 概念讲解');
    this.registry.cacheParent('attachment', 'att_2', 'block', 'blk_2', 'SAS 概念讲解');
    this.registry.cacheParent('attachment', 'att_3', 'block', 'blk_1', '引入');
    this.registry.cacheParent('exercise', 'ex_1', 'lesson_plan', 'lp_1', 'SSS/SAS 新授课教案');
    this.registry.cacheParent('exercise', 'ex_2', 'lesson_plan', 'lp_1', 'SSS/SAS 新授课教案');
    this.registry.cacheParent('submission', 'sub_1', 'homework', 'hw_1', 'SAS 判定专项练习 · 八(2)班');
    this.registry.cacheParent('submission', 'sub_2', 'homework', 'hw_1', 'SAS 判定专项练习 · 八(2)班');
    this.registry.cacheParent('submission', 'sub_3', 'homework', 'hw_1', 'SAS 判定专项练习 · 八(2)班');
    this.registry.cacheParent('question', 'q_1', 'requirement', 'req_1', '全等三角形的判定（SAS）');
    this.registry.cacheParent('question', 'q_2', 'requirement', 'req_1', '全等三角形的判定（SAS）');
    this.registry.cacheParent('question', 'q_3', 'requirement', 'req_2', '全等三角形的判定（SSS）');
    this.registry.cacheParent('analytics', 'ana_1', 'homework', 'hw_1', 'SAS 判定专项练习 · 八(2)班');
    this.registry.cacheParent('analytics', 'ana_2', 'homework', 'hw_2', 'SSS 判定随堂测验 · 八(2)班');
    this.registry.cacheParent('session_record', 'sr_1', 'lesson_plan', 'lp_1', 'SSS/SAS 新授课教案');
  }

  private async seedShortcuts(): Promise<void> {
    const tenantId = 'default';
    const userId = 'default-user';

    await this.cache.set(`ctx:shortcuts:${tenantId}:${userId}:lesson-prep`, {
      pinned: ['lesson_plan', 'requirement', 'question'],
      hidden: [],
    });
    await this.cache.set(`ctx:shortcuts:${tenantId}:${userId}:grading`, {
      pinned: ['homework', 'analytics', 'question'],
      hidden: [],
    });
    await this.cache.set(`ctx:shortcuts:${tenantId}:${userId}:classroom`, {
      pinned: ['lesson_plan', 'exercise', 'session_record'],
      hidden: [],
    });
    // Default (no template specified) = lesson-prep
    await this.cache.set(`ctx:shortcuts:${tenantId}:${userId}`, {
      pinned: ['lesson_plan', 'requirement', 'question'],
      hidden: [],
    });
  }
}
