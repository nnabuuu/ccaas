/**
 * Seed script for TypeORM entities (edu-typeorm.db).
 * Seeds lesson plans, templates, activities, and related data.
 *
 * Usage: npx ts-node src/seed-typeorm.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { LessonPlan } from './entities/lesson-plan.entity';
import { ContentBlock } from './entities/content-block.entity';
import { LessonPlanTemplate } from './entities/lesson-plan-template.entity';
import { TemplateBlock } from './entities/template-block.entity';
import { TemplatePromotion } from './entities/template-promotion.entity';
import { Activity } from './entities/activity.entity';

const DB_PATH = path.resolve(__dirname, '../data/edu-typeorm.db');

const dataSource = new DataSource({
  type: 'sqlite',
  database: DB_PATH,
  entities: [LessonPlan, ContentBlock, LessonPlanTemplate, TemplateBlock, TemplatePromotion, Activity],
  synchronize: true,
  logging: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('TypeORM DataSource initialized');

  const lpRepo = dataSource.getRepository(LessonPlan);
  const blockRepo = dataSource.getRepository(ContentBlock);
  const tplRepo = dataSource.getRepository(LessonPlanTemplate);
  const tplBlockRepo = dataSource.getRepository(TemplateBlock);
  const promotionRepo = dataSource.getRepository(TemplatePromotion);
  const activityRepo = dataSource.getRepository(Activity);

  // Clear existing data
  await activityRepo.clear();
  await promotionRepo.clear();
  await tplBlockRepo.clear();
  await blockRepo.clear();
  await lpRepo.clear();
  await tplRepo.clear();

  const userId = 'teacher_001';

  // ──────────────────────────────────────────
  // Templates (2)
  // ──────────────────────────────────────────

  const tpl1 = await tplRepo.save(tplRepo.create({
    id: randomUUID(),
    name: '新授课标准模板',
    description: '区级标准新授课模板，包含教学目标、重难点、教学过程等完整结构',
    lesson_type: 'new',
    subject_ids: ['math'],
    scope: 'district',
    scope_id: 'district_001',
    visibility: 'public',
    version: 1,
    usage_count: 12,
    user_id: userId,
    promotion_status: 'none',
  }));

  const tpl1Blocks = [
    { type: 'section', placeholder: '教学目标', content: { text: '教学目标' }, is_required: true, sort_order: 0 },
    { type: 'text', placeholder: '请填写知识与技能目标...', content: { text: '请填写知识与技能目标...' }, is_required: true, sort_order: 1 },
    { type: 'section', placeholder: '教学重难点', content: { text: '教学重难点' }, is_required: true, sort_order: 2 },
    { type: 'text', placeholder: '重点：...', content: { text: '重点：... 难点：...' }, is_required: true, sort_order: 3 },
    { type: 'section', placeholder: '教学过程', content: { text: '教学过程' }, is_required: true, sort_order: 4 },
    { type: 'timeline', placeholder: '教学环节时间安排', content: { items: [{ time: '0-5\'', duration: '5 min', desc: '导入新课' }, { time: '5-20\'', duration: '15 min', desc: '新知讲解' }, { time: '20-35\'', duration: '15 min', desc: '课堂练习' }, { time: '35-40\'', duration: '5 min', desc: '课堂小结' }] }, is_required: true, sort_order: 5 },
    { type: 'callout', placeholder: '学情备注', content: { text: '请记录学情相关备注...', color: 'blue' }, is_required: false, sort_order: 6 },
    { type: 'section', placeholder: '课堂练习', content: { text: '课堂练习' }, is_required: false, sort_order: 7 },
    { type: 'text', placeholder: '请设计课堂练习题...', content: { text: '请设计课堂练习题...' }, is_required: false, sort_order: 8 },
    { type: 'section', placeholder: '板书设计', content: { text: '板书设计' }, is_required: false, sort_order: 9 },
    { type: 'text', placeholder: '请设计板书内容...', content: { text: '请设计板书内容...' }, is_required: false, sort_order: 10 },
    { type: 'section', placeholder: '课后反思', content: { text: '课后反思' }, is_required: false, sort_order: 11 },
  ];

  for (const b of tpl1Blocks) {
    await tplBlockRepo.save(tplBlockRepo.create({
      template_id: tpl1.id,
      type: b.type,
      placeholder: b.placeholder,
      content: b.content,
      is_required: b.is_required,
      sort_order: b.sort_order,
    }));
  }

  const tpl2 = await tplRepo.save(tplRepo.create({
    id: randomUUID(),
    name: '几何证明课模板',
    description: '个人几何证明课模板，侧重定理证明和推理训练',
    lesson_type: 'new',
    subject_ids: ['math'],
    scope: 'teacher',
    scope_id: '',
    visibility: 'private',
    version: 1,
    usage_count: 3,
    user_id: userId,
    promotion_status: 'none',
  }));

  const tpl2Blocks = [
    { type: 'section', placeholder: '教学目标', content: { text: '教学目标' }, is_required: true, sort_order: 0 },
    { type: 'text', placeholder: '理解并掌握...定理', content: { text: '理解并掌握...定理' }, is_required: true, sort_order: 1 },
    { type: 'section', placeholder: '定理回顾', content: { text: '定理回顾' }, is_required: true, sort_order: 2 },
    { type: 'text', placeholder: '复习相关定理和性质...', content: { text: '复习相关定理和性质...' }, is_required: true, sort_order: 3 },
    { type: 'section', placeholder: '证明演示', content: { text: '证明演示' }, is_required: true, sort_order: 4 },
    { type: 'text', placeholder: '教师演示完整证明过程...', content: { text: '教师演示完整证明过程...' }, is_required: true, sort_order: 5 },
    { type: 'section', placeholder: '学生练习', content: { text: '学生练习' }, is_required: false, sort_order: 6 },
    { type: 'text', placeholder: '设计由易到难的证明题...', content: { text: '设计由易到难的证明题...' }, is_required: false, sort_order: 7 },
    { type: 'section', placeholder: '总结与拓展', content: { text: '总结与拓展' }, is_required: false, sort_order: 8 },
    { type: 'text', placeholder: '本节课的证明方法总结...', content: { text: '本节课的证明方法总结...' }, is_required: false, sort_order: 9 },
  ];

  for (const b of tpl2Blocks) {
    await tplBlockRepo.save(tplBlockRepo.create({
      template_id: tpl2.id,
      type: b.type,
      placeholder: b.placeholder,
      content: b.content,
      is_required: b.is_required,
      sort_order: b.sort_order,
    }));
  }

  console.log(`✅ Templates seeded: ${tpl1.name} (${tpl1Blocks.length} blocks), ${tpl2.name} (${tpl2Blocks.length} blocks)`);

  // ──────────────────────────────────────────
  // Lesson Plans (3)
  // ──────────────────────────────────────────

  // LP1: published, from template, with requirement
  const lp1 = await lpRepo.save(lpRepo.create({
    id: randomUUID(),
    title: '12.2 三角形全等的判定 — SSS/SAS',
    requirement_id: 'kp:math.triangle.cong.conditions',
    requirement_snapshot: { code: '7.3.2', text: '掌握 SSS、SAS 判定全等三角形的方法', version: 'v2.0' },
    subject_id: 'math',
    class_id: 'class_802',
    lesson_type: 'new',
    duration_minutes: 40,
    status: 'published',
    source_template_id: tpl1.id,
    source: 'template',
    scope: 'teacher',
    user_id: userId,
  }));

  const lp1Blocks = [
    { type: 'section', content: { text: '教学目标' }, sort_order: 0 },
    { type: 'list', content: { ordered: false, items: ['理解并掌握 SSS 和 SAS 两种全等三角形的判定方法', '能运用 SSS、SAS 判定两个三角形全等', '培养逻辑推理能力，体会分类讨论的数学思想'] }, sort_order: 1 },
    { type: 'section', content: { text: '教学过程' }, sort_order: 2 },
    { type: 'timeline', content: { items: [{ time: '0-5\'', duration: '5 min', desc: '复习回顾：全等三角形的定义和性质' }, { time: '5-15\'', duration: '10 min', desc: 'SSS 判定讲解：三角形拼接实验' }, { time: '15-25\'', duration: '10 min', desc: 'SAS 判定讲解：强调"夹角"，对比 SSA 反例' }, { time: '25-35\'', duration: '10 min', desc: '课堂练习：3 道基础 + 1 道综合' }, { time: '35-40\'', duration: '5 min', desc: '课堂小结 + 布置作业' }] }, sort_order: 3 },
    { type: 'callout', content: { text: '学情备注：八(2)班 SSS 判定错误率 42%，本节安排了 15 分钟专项练习。', color: 'amber' }, sort_order: 4 },
    { type: 'section', content: { text: '课堂练习' }, sort_order: 5 },
    { type: 'table', content: { headers: ['题号', '题型', '知识点', '难度', '来源'], rows: [['1', '选择', 'SSS 判定', '0.45', '题库'], ['2', '选择', 'SAS 判定', '0.52', '题库'], ['3', '选择', 'SSS 综合', '0.55', 'AI 原创'], ['4', '证明', 'SSS + SAS', '0.65', '题库']] }, sort_order: 6 },
    { type: 'section', content: { text: '板书设计' }, sort_order: 7 },
  ];

  for (const b of lp1Blocks) {
    await blockRepo.save(blockRepo.create({
      lesson_plan_id: lp1.id,
      type: b.type,
      content: b.content,
      sort_order: b.sort_order,
    }));
  }

  // LP2: draft, manual, with requirement
  const lp2 = await lpRepo.save(lpRepo.create({
    id: randomUUID(),
    title: '12.1 全等三角形',
    requirement_id: 'kp:math.triangle.cong.concept',
    requirement_snapshot: { code: '7.3.1', text: '理解全等三角形的概念和性质', version: 'v2.0' },
    subject_id: 'math',
    class_id: 'class_802',
    lesson_type: 'new',
    duration_minutes: 45,
    status: 'draft',
    source: 'manual',
    scope: 'teacher',
    user_id: userId,
  }));

  const lp2Blocks = [
    { type: 'section', content: { text: '教学目标' }, sort_order: 0 },
    { type: 'text', content: { text: '理解全等三角形的定义，掌握对应顶点、对应边、对应角的关系' }, sort_order: 1 },
    { type: 'section', content: { text: '教学过程' }, sort_order: 2 },
    { type: 'text', content: { text: '通过图形重叠操作引入全等概念，引导学生发现全等三角形的性质' }, sort_order: 3 },
  ];

  for (const b of lp2Blocks) {
    await blockRepo.save(blockRepo.create({
      lesson_plan_id: lp2.id,
      type: b.type,
      content: b.content,
      sort_order: b.sort_order,
    }));
  }

  // LP3: in_use, ai, no requirement
  const lp3 = await lpRepo.save(lpRepo.create({
    id: randomUUID(),
    title: '11.3 多边形内角和 — 复习课',
    subject_id: 'math',
    class_id: 'class_803',
    lesson_type: 'review',
    duration_minutes: 40,
    status: 'in_use',
    source: 'ai',
    scope: 'teacher',
    user_id: userId,
  }));

  const lp3Blocks = [
    { type: 'section', content: { text: '复习目标' }, sort_order: 0 },
    { type: 'text', content: { text: '巩固三角形内角和定理，推导多边形内角和公式' }, sort_order: 1 },
    { type: 'section', content: { text: '复习过程' }, sort_order: 2 },
    { type: 'timeline', content: { items: [{ time: '0-10\'', duration: '10 min', desc: '回顾三角形内角和定理' }, { time: '10-25\'', duration: '15 min', desc: '多边形内角和公式推导' }, { time: '25-35\'', duration: '10 min', desc: '练习与巩固' }, { time: '35-40\'', duration: '5 min', desc: '总结' }] }, sort_order: 3 },
    { type: 'table', content: { headers: ['多边形', '边数', '对角线划分三角形数', '内角和'], rows: [['三角形', '3', '1', '180°'], ['四边形', '4', '2', '360°'], ['五边形', '5', '3', '540°'], ['n边形', 'n', 'n-2', '(n-2)×180°']] }, sort_order: 4 },
  ];

  for (const b of lp3Blocks) {
    await blockRepo.save(blockRepo.create({
      lesson_plan_id: lp3.id,
      type: b.type,
      content: b.content,
      sort_order: b.sort_order,
    }));
  }

  console.log(`✅ Lesson plans seeded: 3 plans (${lp1Blocks.length + lp2Blocks.length + lp3Blocks.length} blocks total)`);

  // ──────────────────────────────────────────
  // Activity Records (20)
  // ──────────────────────────────────────────

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function daysAgo(n: number, hour: number = 10, minute: number = 0): Date {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  const activities = [
    // Today (4+ records)
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp1.id, entity_display_name: '12.2 三角形全等的判定 — SSS/SAS', action: 'updated', detail: { field: 'blocks', desc: '更新了内容块 \'SAS 判定条件\'' }, timestamp: daysAgo(0, 9, 30) },
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp1.id, entity_display_name: '12.2 三角形全等的判定 — SSS/SAS', action: 'published', detail: null, timestamp: daysAgo(0, 10, 15) },
    { user_id: userId, entity_type: 'homework', entity_id: 'hw_001', entity_display_name: '八(2)班 SAS 专项练习', action: 'submitted', detail: { count: 32 }, timestamp: daysAgo(0, 14, 0) },
    { user_id: userId, entity_type: 'session', entity_id: 'session_001', entity_display_name: '已用于八(2)班课堂', action: 'created', detail: { class: '八(2)班' }, timestamp: daysAgo(0, 8, 0) },
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp1.id, entity_display_name: '12.2 三角形全等的判定 — SSS/SAS', action: 'requirement_linked', detail: { requirement_id: 'kp:math.triangle.cong.conditions' }, timestamp: daysAgo(0, 9, 0) },

    // Yesterday (3 records)
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp1.id, entity_display_name: '12.2 三角形全等的判定 — SSS/SAS', action: 'created', detail: { source: 'template' }, timestamp: daysAgo(1, 14, 0) },
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp1.id, entity_display_name: '12.2 三角形全等的判定 — SSS/SAS', action: 'updated', detail: { field: 'timeline' }, timestamp: daysAgo(1, 15, 30) },
    { user_id: userId, entity_type: 'requirement', entity_id: 'req_001', entity_display_name: '区级解读已更新 v2.1', action: 'updated', detail: { version: 'v2.1' }, timestamp: daysAgo(1, 11, 0) },

    // 2 days ago (2 records)
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp2.id, entity_display_name: '12.1 全等三角形', action: 'created', detail: null, timestamp: daysAgo(2, 10, 0) },
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp2.id, entity_display_name: '12.1 全等三角形', action: 'updated', detail: { field: 'content' }, timestamp: daysAgo(2, 16, 0) },

    // 3 days ago (Wednesday — 3 entity_types for multi-color dots)
    { user_id: userId, entity_type: 'template', entity_id: tpl2.id, entity_display_name: '几何证明课模板', action: 'created', detail: null, timestamp: daysAgo(3, 9, 0) },
    { user_id: userId, entity_type: 'homework', entity_id: 'hw_002', entity_display_name: '八(3)班 全等复习作业', action: 'submitted', detail: { count: 35 }, timestamp: daysAgo(3, 14, 0) },
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp3.id, entity_display_name: '11.3 多边形内角和 — 复习课', action: 'updated', detail: { field: 'timeline' }, timestamp: daysAgo(3, 16, 30) },

    // 4 days ago — EMPTY (no records, for empty state)

    // 5 days ago (2 records)
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp3.id, entity_display_name: '11.3 多边形内角和 — 复习课', action: 'updated', detail: { field: 'blocks' }, timestamp: daysAgo(5, 10, 0) },
    { user_id: userId, entity_type: 'session', entity_id: 'session_002', entity_display_name: '已用于八(3)班课堂', action: 'created', detail: { class: '八(3)班' }, timestamp: daysAgo(5, 8, 30) },

    // 6 days ago (3 records)
    { user_id: userId, entity_type: 'requirement', entity_id: 'req_002', entity_display_name: '课标 v2.0 发布', action: 'updated', detail: { version: 'v2.0' }, timestamp: daysAgo(6, 9, 0) },
    { user_id: userId, entity_type: 'proposal', entity_id: 'proposal_001', entity_display_name: '王老师提交推优申请', action: 'created', detail: null, timestamp: daysAgo(6, 11, 0) },
    { user_id: userId, entity_type: 'homework', entity_id: 'hw_003', entity_display_name: '八(2)班 全等入门练习', action: 'submitted', detail: { count: 28 }, timestamp: daysAgo(6, 15, 0) },
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp1.id, entity_display_name: '12.2 三角形全等的判定 — SSS/SAS', action: 'requirement_linked', detail: { requirement_id: 'kp:math.triangle.cong.conditions' }, timestamp: daysAgo(6, 10, 0) },
    { user_id: userId, entity_type: 'lesson_plan', entity_id: lp1.id, entity_display_name: '12.2 三角形全等的判定 — SSS/SAS', action: 'exercise_linked', detail: { exercise_ids: ['ex_001', 'ex_002'] }, timestamp: daysAgo(6, 10, 30) },
  ];

  for (const a of activities) {
    const activity = activityRepo.create({
      user_id: a.user_id,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
      entity_display_name: a.entity_display_name,
      action: a.action,
      detail: a.detail,
    });
    const saved = await activityRepo.save(activity);
    // Manually update timestamp since CreateDateColumn auto-sets
    await activityRepo.update(saved.id, { timestamp: a.timestamp });
  }

  console.log(`✅ Activities seeded: ${activities.length} records across 6 days (day -4 is empty)`);

  // ──────────────────────────────────────────
  // Template Promotion (1 pending)
  // ──────────────────────────────────────────

  await promotionRepo.save(promotionRepo.create({
    template_id: tpl2.id,
    from_scope: 'teacher',
    to_scope: 'school',
    submitter_id: userId,
    status: 'pending',
    reason: '几何证明课模板结构清晰，适合推广到学校层级使用',
  }));

  console.log('✅ Template promotion seeded: 1 pending');

  // Summary
  const lpCount = await lpRepo.count();
  const tplCount = await tplRepo.count();
  const actCount = await activityRepo.count();
  const promoCount = await promotionRepo.count();

  console.log('\n📊 Seed Summary:');
  console.log(`  Lesson Plans: ${lpCount}`);
  console.log(`  Templates: ${tplCount}`);
  console.log(`  Activities: ${actCount}`);
  console.log(`  Promotions: ${promoCount}`);

  await dataSource.destroy();
  console.log('\n✅ Seed complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
