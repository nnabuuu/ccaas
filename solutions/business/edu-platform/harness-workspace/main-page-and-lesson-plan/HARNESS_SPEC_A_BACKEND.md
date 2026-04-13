# Harness Specification A: Backend API — TypeORM + NestJS Modules

## Task

- **Artifact**: `backend/src/typeorm/` (TypeORM 配置) + `backend/src/lesson-plan/` + `backend/src/template/` + `backend/src/dashboard/` + `backend/src/activity/` (4 个新模块) + `backend/src/app.module.ts` (注册)
- **Current state**: 后端已有 better-sqlite3 (DatabaseModule) + CurriculumModule + UsersModule + AuthModule，运行在 port 3011
- **Target audience**: Harness B/C 的前端开发 agent（API 消费者）；评估者为 AI Evaluator
- **Goal**: 在现有 backend 中新增 TypeORM 集成 + 6 个 Entity + 4 个模块 + 26 个 REST 端点 + seed 数据，现有模块不受影响

## Context

edu-platform 后端当前使用 better-sqlite3 直接操作 SQLite（`backend/data/edu.db`），管理 `curriculum_nodes` 和 `users` 两张表。本任务新增 TypeORM 集成，使用**独立的 .sqlite 文件**（如 `backend/data/edu-typeorm.db`）存储教案、模板、活动等新数据，与现有 better-sqlite3 共存。

### 参考资料

- PRD：`reference/首页+教案设计包/文档/PRD/PRD-02-教案管理.md`
- PRD：`reference/首页+教案设计包/文档/PRD/PRD-04-首页.md`
- 用户故事：`reference/首页+教案设计包/文档/用户故事/教案管理.md`
- 用户故事：`reference/首页+教案设计包/文档/用户故事/首页.md`

### 现有后端结构

```
backend/
├── src/
│   ├── main.ts              # Bootstrap: CORS, /api prefix, port 3011
│   ├── app.module.ts         # DatabaseModule, CurriculumModule, UsersModule, AuthModule
│   ├── database/
│   │   └── database.module.ts  # Global, provides DATABASE_TOKEN (better-sqlite3)
│   ├── curriculum/           # GET /curriculum/subjects, /tree, /nodes/:id/children, /search
│   ├── users/                # User CRUD (better-sqlite3)
│   ├── auth/                 # POST /auth/login, /register, GET /auth/me (JWT)
│   └── seed.ts               # 数据播种脚本
├── data/
│   └── edu.db                # better-sqlite3 数据库（不可修改）
└── package.json              # NestJS, better-sqlite3, JWT, bcrypt
```

## Frozen Constraints

### 不可修改的文件

- `backend/src/database/` — 现有 better-sqlite3 模块冻结
- `backend/src/curriculum/` — 课标模块冻结
- `backend/src/users/` — 用户模块冻结（但可读取 users 表数据）
- `backend/src/auth/` — 认证模块冻结（但新端点可复用 AuthGuard）
- `backend/data/edu.db` — 现有数据库文件冻结
- `solutions/business/edu-platform/frontend/` — 前端冻结
- `solutions/business/edu-platform/mcp-server/` — MCP server 冻结
- `solutions/business/edu-platform/skills/` — Skills 冻结

### 必须遵守的规则

- TypeORM 使用独立 `.sqlite` 文件（如 `backend/data/edu-typeorm.db`），不操作 `edu.db`
- 所有新 Controller 必须有 `@ApiTags` 装饰器
- 使用 NestJS DTO + class-validator 做参数校验
- 端点路径以 `/api` 前缀（已在 main.ts 全局设置）
- 分页接口统一返回 `{ data: T[], total: number, page: number, limit: number }`
- Activity 记录自动写入（在 service 层 hook），不需要前端手动调用
- 现有 `npm run build` 和 `npm run start:dev` 必须继续正常工作
- 现有 `GET /api/curriculum/*` 和 `POST /api/auth/*` 端点行为不变

## Detailed Specification

### 1. TypeORM 集成

在 `backend/src/typeorm/` 下创建 TypeORM 配置模块：

```
backend/src/typeorm/
├── typeorm.module.ts         # TypeOrmModule.forRoot({ type: 'sqlite', database: '../data/edu-typeorm.db', ... })
└── typeorm-config.ts         # DataSource 配置（用于 migration CLI）
```

**依赖安装**：`typeorm @nestjs/typeorm sqlite3`

> 注意：现有项目用 `better-sqlite3`（同步驱动），TypeORM 需要 `sqlite3`（异步驱动）。两者共存无冲突。

**配置要点**：
- `synchronize: true`（开发阶段自动同步 schema）
- `entities: [LessonPlan, ContentBlock, LessonPlanTemplate, TemplateBlock, TemplatePromotion, Activity]`
- `logging: false`（生产环境）

### 2. Entity 定义（6 个）

#### 2.1 LessonPlan

```typescript
@Entity('lesson_plans')
class LessonPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  // 学业要求锚点
  @Column({ nullable: true })
  requirement_id: string | null;

  @Column({ type: 'simple-json', nullable: true })
  requirement_snapshot: { code: string; text: string; version: string } | null;

  // 基本信息
  @Column()
  subject_id: string;

  @Column()
  class_id: string;

  @Column({ default: 'new' })
  lesson_type: 'new' | 'review' | 'practice' | 'lab' | 'other';

  @Column({ default: 45 })
  duration_minutes: number;

  // 状态
  @Column({ default: 'draft' })
  status: 'draft' | 'published' | 'in_use' | 'archived';

  // 模板来源
  @Column({ nullable: true })
  source_template_id: string | null;

  @Column({ default: 'manual' })
  source: 'manual' | 'template' | 'ai';

  @Column({ default: 'teacher' })
  scope: string;

  // 软删除
  @Column({ default: false })
  is_deleted: boolean;

  // 关联
  @OneToMany(() => ContentBlock, block => block.lesson_plan, { cascade: true })
  blocks: ContentBlock[];

  // 用户
  @Column()
  user_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 2.2 ContentBlock

```typescript
@Entity('content_blocks')
class ContentBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  lesson_plan_id: string;

  @ManyToOne(() => LessonPlan, lp => lp.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_plan_id' })
  lesson_plan: LessonPlan;

  @Column()
  type: 'section' | 'text' | 'list' | 'table' | 'timeline' | 'callout' | 'image';

  @Column({ type: 'simple-json' })
  content: Record<string, any>;

  @Column({ default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 2.3 LessonPlanTemplate

```typescript
@Entity('lesson_plan_templates')
class LessonPlanTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '' })
  description: string;

  @Column({ default: 'new' })
  lesson_type: string;

  @Column({ type: 'simple-json', default: '[]' })
  subject_ids: string[];

  // 三级作用域
  @Column({ default: 'teacher' })
  scope: 'district' | 'school' | 'teacher';

  @Column({ default: '' })
  scope_id: string;

  @Column({ default: 'public' })
  visibility: 'public' | 'private';

  // 版本
  @Column({ default: 1 })
  version: number;

  @Column({ default: '' })
  changelog: string;

  // 统计
  @Column({ default: 0 })
  usage_count: number;

  // 推优
  @Column({ nullable: true })
  source_template_id: string | null;

  @Column({ default: 'none' })
  promotion_status: 'none' | 'pending' | 'approved' | 'rejected';

  // 用户
  @Column()
  user_id: string;

  // 关联
  @OneToMany(() => TemplateBlock, block => block.template, { cascade: true })
  blocks: TemplateBlock[];

  @Column({ default: false })
  is_deleted: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 2.4 TemplateBlock

```typescript
@Entity('template_blocks')
class TemplateBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  template_id: string;

  @ManyToOne(() => LessonPlanTemplate, tpl => tpl.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: LessonPlanTemplate;

  @Column()
  type: 'section' | 'text' | 'list' | 'table' | 'timeline' | 'callout' | 'image';

  @Column({ default: '' })
  placeholder: string;

  @Column({ type: 'simple-json', default: '{}' })
  content: Record<string, any>;

  @Column({ default: false })
  is_required: boolean;

  @Column({ default: 0 })
  sort_order: number;
}
```

#### 2.5 TemplatePromotion

```typescript
@Entity('template_promotions')
class TemplatePromotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  template_id: string;

  @ManyToOne(() => LessonPlanTemplate)
  @JoinColumn({ name: 'template_id' })
  template: LessonPlanTemplate;

  @Column()
  from_scope: 'teacher' | 'school';

  @Column()
  to_scope: 'school' | 'district';

  @Column()
  submitter_id: string;

  @Column({ nullable: true })
  reviewer_id: string | null;

  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';

  @Column({ default: '' })
  reason: string;

  @Column({ default: '' })
  review_comment: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

#### 2.6 Activity

```typescript
@Entity('activities')
class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  entity_type: string;  // lesson_plan | template | homework | submission | session | requirement | proposal

  @Column()
  entity_id: string;

  @Column()
  entity_display_name: string;

  @Column()
  action: string;  // created | updated | published | viewed | referenced | submitted

  @Column({ type: 'simple-json', nullable: true })
  detail: Record<string, any> | null;

  @CreateDateColumn()
  timestamp: Date;
}
```

### 3. 模块 & 端点

#### 3.1 LessonPlanModule（12 端点）

**Controller**: `@ApiTags('lesson-plans')`

| Method | Path | 功能 | 请求/响应 |
|--------|------|------|----------|
| `GET` | `/lesson-plans` | 教案列表 | Query: `page`, `limit`, `subject_id`, `status`, `class_id`, `has_requirement`, `q`（搜索标题）→ 分页响应 |
| `GET` | `/lesson-plans/:id` | 教案详情 | 返回教案 + blocks（按 sort_order 排序） |
| `POST` | `/lesson-plans` | 新建教案 | Body: `{ title, subject_id, class_id, lesson_type?, duration_minutes?, source_template_id?, requirement_id? }` → 若指定 `source_template_id`，fork 模板 blocks |
| `PUT` | `/lesson-plans/:id` | 更新元信息 | Body: `{ title?, subject_id?, class_id?, lesson_type?, duration_minutes? }` |
| `DELETE` | `/lesson-plans/:id` | 软删除 | 设置 `is_deleted = true` |
| `POST` | `/lesson-plans/:id/blocks` | 批量更新 blocks | Body: `{ blocks: [{ type, content, sort_order }] }` → 全量替换（删旧插新） |
| `POST` | `/lesson-plans/:id/link-requirement` | 关联学业要求 | Body: `{ requirement_id, requirement_snapshot: { code, text, version } }` → 记录快照 |
| `GET` | `/lesson-plans/:id/requirement-status` | 检查课标版本 | 返回 `{ current_version, snapshot_version, has_update, diff_summary }` |
| `POST` | `/lesson-plans/:id/exercises` | 关联练习 | Body: `{ exercise_ids: string[] }` → 存储关联（simple-json 字段） |
| `POST` | `/lesson-plans/:id/publish` | 发布教案 | 将 status 改为 `published`；若无 requirement_id，返回 `{ warning: '未关联学业要求' }` |
| `POST` | `/lesson-plans/:id/export` | 导出 .docx | Body: `{ format: 'docx' }` → 返回文件 URL 或 buffer |
| `POST` | `/lesson-plans/:id/save-as-template` | 保存为模板 | Body: `{ name, description }` → 提取 blocks 结构创建个人模板 |

**Fork 逻辑**（新建教案时 `source_template_id` 非空）：
1. 读取模板 + TemplateBlocks
2. 创建教案，`source = 'template'`，`source_template_id` 记录来源
3. 将 TemplateBlock 转换为 ContentBlock：`type` 不变，`content` = `{ text: block.placeholder }`，保持 `sort_order`
4. Activity 记录：`lesson_plan.created`

**学业要求快照逻辑**（`link-requirement`）：
1. 将 `requirement_id` 和 `requirement_snapshot` 存入教案
2. Activity 记录：`lesson_plan.requirement_linked`

#### 3.2 TemplateModule（8 端点）

**Controller**: `@ApiTags('templates')`

| Method | Path | 功能 | 请求/响应 |
|--------|------|------|----------|
| `GET` | `/templates` | 模板列表 | Query: `scope`（district/school/teacher）, `subject_id`, `lesson_type`, `q`, `page`, `limit` → 分页响应 |
| `GET` | `/templates/:id` | 模板详情 | 返回模板 + blocks（按 sort_order 排序） |
| `POST` | `/templates` | 新建模板 | Body: `{ name, description, lesson_type, subject_ids, scope, blocks: [{ type, placeholder, is_required, sort_order }] }` |
| `PUT` | `/templates/:id` | 更新模板 | Body: `{ name?, description?, lesson_type?, subject_ids?, blocks? }` → 更新 blocks 时全量替换 |
| `DELETE` | `/templates/:id` | 软删除 | 设置 `is_deleted = true` |
| `POST` | `/templates/:id/promote` | 提交推优 | Body: `{ target_scope: 'school' \| 'district', reason }` → 创建 TemplatePromotion |
| `GET` | `/templates/promotions` | 推优列表 | Query: `status`（pending/approved/rejected）→ 返回 TemplatePromotion 列表 |
| `POST` | `/templates/promotions/:id/review` | 审核推优 | Body: `{ action: 'approve' \| 'reject' \| 'revision_requested', comment }` |

**推优逻辑**：
1. `promote`：创建 TemplatePromotion 记录，模板 `promotion_status = 'pending'`
2. `review` approve：创建新的模板（scope = target_scope），原模板保持不变，新模板 `source_template_id` 指向原模板
3. `review` reject：更新 TemplatePromotion status，模板 `promotion_status = 'rejected'`
4. 每步均写 Activity 记录

#### 3.3 DashboardModule（2 端点）

**Controller**: `@ApiTags('dashboard')`

| Method | Path | 功能 | 请求/响应 |
|--------|------|------|----------|
| `GET` | `/dashboard/pending` | 待办事项 | Query: `user_id`, `limit` → 聚合 mock 数据（homework/submission/proposal） |
| `GET` | `/dashboard/ai-briefing` | AI 洞察摘要 | Query: `user_id`, `limit` → 返回 mock insights + suggested_actions + common_actions |

**待办聚合逻辑**（Phase 1 使用 mock 数据 + 真实 TemplatePromotion）：
```typescript
{
  items: [
    // Mock homework pending
    { type: 'grading', title: '八(2)班 SAS 专项练习', count: 32,
      deadline: '2025-03-18', progress: '32/38',
      skill_status: 'analyzed', link: '/homework/hw_1/grade' },
    // Real promotion pending（从 TemplatePromotion 表查询 status = 'pending'）
    ...promotionPendingItems
  ],
  total: number
}
```

**AI Briefing**（Phase 1 返回 mock 洞察）：
```typescript
{
  insights: [
    { summary: '八(2)班 SAS 正确率连续 3 周下降（72%→64%→56%）...',
      source_skill_run_id: 'sr_mock_1',
      suggested_actions: [
        { label: '分析夹角错因', prompt: '详细分析八(2)班 SAS 专项练习中夹角概念混淆的错因' },
        { label: '对齐课标 v2.1', prompt: '帮我检查 SSS/SAS 教案是否符合课标 v2.1 的新要求' }
      ] },
    // ...more insights
  ],
  common_actions: [
    { label: '新建教案', prompt: '帮我新建一份教案' },
    { label: '发布作业', prompt: '帮我发布一份作业' }
  ]
}
```

#### 3.4 ActivityModule（3 端点）

**Controller**: `@ApiTags('activity')`

| Method | Path | 功能 | 请求/响应 |
|--------|------|------|----------|
| `GET` | `/context/activity` | 某日活动时间线 | Query: `user_id`, `date`（YYYY-MM-DD）, `limit` → 返回 Activity 列表（按 timestamp 倒序） |
| `GET` | `/context/activity/weekly-summary` | 本周统计 | Query: `user_id` → `{ lesson_plan_edits: number, submissions_graded: number }` |
| `GET` | `/context/activity/week-dots` | 7 天活动色点 | Query: `user_id`, `week_start`（YYYY-MM-DD）→ `{ days: { [date]: entity_type[] } }` |

**ActivityService** 同时提供写入方法（内部调用，非 HTTP 端点）：
```typescript
class ActivityService {
  async record(params: {
    user_id: string;
    entity_type: string;
    entity_id: string;
    entity_display_name: string;
    action: string;
    detail?: Record<string, any>;
  }): Promise<Activity>;
}
```

LessonPlanService 和 TemplateService 在 CRUD 操作中调用 `ActivityService.record()` 自动记录活动。

### 4. Seed 数据

创建 `backend/src/seed-typeorm.ts`（或扩展现有 `seed.ts`），通过 TypeORM 写入：

#### 4.1 教师用户（复用现有 users 表）

现有 `users` 表中应有至少 2 个教师。seed 脚本可跳过（如已有），或在 README 中说明需要先运行现有 seed。

#### 4.2 教案（3 份）

| # | title | status | requirement | source | blocks 数 |
|---|-------|--------|-------------|--------|----------|
| 1 | 12.2 三角形全等的判定 — SSS/SAS | published | 有（7.3.2 课标快照） | template | 8（section×3 + list×1 + timeline×1 + callout×1 + table×1 + text×1） |
| 2 | 12.1 全等三角形 | draft | 有（7.3.1 课标快照） | manual | 4（section×2 + text×2） |
| 3 | 11.3 多边形内角和 — 复习课 | in_use | 无 | ai | 5（section×2 + text×1 + timeline×1 + table×1） |

**教案 1 的 blocks 示例**：
```json
[
  { "type": "section", "content": { "text": "教学目标" }, "sort_order": 0 },
  { "type": "list", "content": { "ordered": false, "items": ["理解并掌握 SSS 和 SAS 两种全等三角形的判定方法", "能运用 SSS、SAS 判定两个三角形全等", "培养逻辑推理能力，体会分类讨论的数学思想"] }, "sort_order": 1 },
  { "type": "section", "content": { "text": "教学过程" }, "sort_order": 2 },
  { "type": "timeline", "content": { "items": [{ "time": "0-5'", "duration": "5 min", "desc": "复习回顾：全等三角形的定义和性质" }, { "time": "5-15'", "duration": "10 min", "desc": "SSS 判定讲解：三角形拼接实验" }, { "time": "15-25'", "duration": "10 min", "desc": "SAS 判定讲解：强调\"夹角\"，对比 SSA 反例" }, { "time": "25-35'", "duration": "10 min", "desc": "课堂练习：3 道基础 + 1 道综合" }, { "time": "35-40'", "duration": "5 min", "desc": "课堂小结 + 布置作业" }] }, "sort_order": 3 },
  { "type": "callout", "content": { "text": "学情备注：八(2)班 SSS 判定错误率 42%，本节安排了 15 分钟专项练习。", "color": "amber" }, "sort_order": 4 },
  { "type": "section", "content": { "text": "课堂练习" }, "sort_order": 5 },
  { "type": "table", "content": { "headers": ["题号", "题型", "知识点", "难度", "来源"], "rows": [["1", "选择", "SSS 判定", "0.45", "题库"], ["2", "选择", "SAS 判定", "0.52", "题库"], ["3", "选择", "SSS 综合", "0.55", "AI 原创"], ["4", "证明", "SSS + SAS", "0.65", "题库"]] }, "sort_order": 6 },
  { "type": "section", "content": { "text": "板书设计" }, "sort_order": 7 }
]
```

#### 4.3 模板（2 个）

| # | name | scope | lesson_type | blocks 数 |
|---|------|-------|-------------|----------|
| 1 | 新授课标准模板 | district | new | 12（section×6 + text×3 + timeline×1 + callout×1 + text×1） |
| 2 | 几何证明课模板 | teacher | new | 10（section×5 + text×5） |

模板 1 的 blocks 应匹配 HTML 原型中「模板管理.html」编辑器视图的结构：教学目标 → 重难点 → 教学过程(timeline) → 学情备注(callout) → 课堂练习 → 板书设计 → 课后反思。

#### 4.4 Activity 记录（20 条）

覆盖最近 7 天，分布在不同天：

| entity_type | action | 数量 | 示例 |
|-------------|--------|------|------|
| lesson_plan | created | 2 | "创建了 SSS/SAS 新授课教案" |
| lesson_plan | updated | 5 | "更新了内容块 'SAS 判定条件'" |
| lesson_plan | published | 1 | "发布了 SSS/SAS 新授课教案" |
| homework | submitted | 3 | "收到 32 份提交" |
| session | created | 2 | "已用于八(3)班课堂" |
| requirement | updated | 2 | "区级解读已更新 v2.1" |
| template | created | 1 | "创建了几何证明课模板" |
| proposal | created | 1 | "王老师提交推优申请" |
| lesson_plan | requirement_linked | 2 | "关联学业要求 7.3.2" |
| lesson_plan | exercise_linked | 1 | "关联 SAS 判定专项练习" |

确保：
- 今天有 4 条以上记录（匹配首页原型的时间线）
- 周三有 3 种 entity_type（匹配 week-dots 原型中的多色点日）
- 有 1 天没有记录（匹配空状态场景）

#### 4.5 待办 Mock 数据（3 条）

Dashboard pending 端点返回硬编码 mock（Phase 1 不从真实表聚合 homework）：

```json
[
  { "type": "grading", "title": "八(2)班 SAS 专项练习", "count": 32, "deadline": "tomorrow", "progress": "32/38", "skill_status": "analyzed", "link": "/homework/hw_1/grade" },
  { "type": "grading", "title": "八(3)班 全等复习作业", "count": 35, "deadline": "周三", "progress": "35/40", "skill_status": null, "link": "/homework/hw_2/grade" },
  { "type": "review", "title": "王老师推优申请", "count": 1, "deadline": null, "progress": null, "skill_status": null, "link": "/templates/promotions" }
]
```

### 5. app.module.ts 更新

在 `backend/src/app.module.ts` 中注册新模块：

```typescript
@Module({
  imports: [
    DatabaseModule,        // 现有 — better-sqlite3
    TypeOrmConfigModule,   // 新增 — TypeORM with edu-typeorm.db
    CurriculumModule,      // 现有
    UsersModule,           // 现有
    AuthModule,            // 现有
    LessonPlanModule,      // 新增
    TemplateModule,        // 新增
    DashboardModule,       // 新增
    ActivityModule,        // 新增
  ],
  providers: [SolutionRegisterService],
})
export class AppModule {}
```

### 6. 文件结构总览

```
backend/src/
├── typeorm/
│   ├── typeorm.module.ts
│   └── typeorm-config.ts
├── entities/
│   ├── lesson-plan.entity.ts
│   ├── content-block.entity.ts
│   ├── lesson-plan-template.entity.ts
│   ├── template-block.entity.ts
│   ├── template-promotion.entity.ts
│   └── activity.entity.ts
├── lesson-plan/
│   ├── lesson-plan.module.ts
│   ├── lesson-plan.controller.ts
│   ├── lesson-plan.service.ts
│   └── dto/
│       ├── create-lesson-plan.dto.ts
│       ├── update-lesson-plan.dto.ts
│       └── update-blocks.dto.ts
├── template/
│   ├── template.module.ts
│   ├── template.controller.ts
│   ├── template.service.ts
│   └── dto/
│       ├── create-template.dto.ts
│       ├── update-template.dto.ts
│       ├── promote-template.dto.ts
│       └── review-promotion.dto.ts
├── dashboard/
│   ├── dashboard.module.ts
│   ├── dashboard.controller.ts
│   └── dashboard.service.ts
├── activity/
│   ├── activity.module.ts
│   ├── activity.controller.ts
│   └── activity.service.ts
└── seed-typeorm.ts
```

## Eval Rubric

### Scoring Dimensions (100 pts)

#### D1: Entity & Schema (Weight: 20/100)

| Score | Description |
|-------|-------------|
| 5/5 | 6 实体定义完整、字段与 PRD 一致、关系正确（FK、cascade delete）、TypeORM synchronize 可运行创建全部表 |
| 4/5 | 实体完整但 1-2 个字段缺失或类型错误 |
| 3/5 | 实体存在但关系定义有误（如缺少 FK） |
| 2/5 | 只有 3-4 个实体 |
| 1/5 | 实体定义严重不完整 |

**Detection method**:
1. 启动后端 → TypeORM 自动创建 `edu-typeorm.db`
2. 检查 6 张表存在：`sqlite3 edu-typeorm.db ".tables"` → lesson_plans, content_blocks, lesson_plan_templates, template_blocks, template_promotions, activities
3. 检查字段：`sqlite3 edu-typeorm.db ".schema lesson_plans"` → 验证 requirement_id, requirement_snapshot, subject_id, class_id, lesson_type, status, source_template_id, source, scope, is_deleted
4. 检查关系：content_blocks.lesson_plan_id FK → lesson_plans.id

#### D2: API Completeness (Weight: 25/100)

| Score | Description |
|-------|-------------|
| 5/5 | 25 个端点全部可调用（HTTP 200/201），分页参数正确，DTO 参数校验生效 |
| 4/5 | 22-24 个端点可用，1-3 个有小问题 |
| 3/5 | 18-21 个端点可用 |
| 2/5 | 10-17 个端点可用 |
| 1/5 | < 10 个端点可用 |

**Detection method**:
```bash
# 后端启动后
curl http://localhost:3011/api/lesson-plans | jq '.data | length'          # → ≥ 3
curl http://localhost:3011/api/lesson-plans/{id} | jq '.blocks | length'   # → ≥ 4
curl http://localhost:3011/api/templates?scope=district | jq '.data | length'  # → ≥ 1
curl http://localhost:3011/api/dashboard/pending | jq '.items | length'    # → ≥ 2
curl http://localhost:3011/api/context/activity/weekly-summary | jq '.'    # → { lesson_plan_edits, submissions_graded }
curl http://localhost:3011/api/context/activity/week-dots | jq '.days | keys | length'  # → ≥ 5
```

验证所有 25 个端点的完整 curl 测试脚本应在 harness 中自动运行。

#### D3: Business Logic (Weight: 20/100)

| Score | Description |
|-------|-------------|
| 5/5 | Fork 模板→教案正确复制 blocks、学业要求快照正确保存、推优流程完整（submit→review→approve creates new template）、Activity 自动记录所有 CRUD 操作 |
| 4/5 | 核心流程正确但 1 处逻辑缺陷 |
| 3/5 | Fork 或推优有明显问题 |
| 2/5 | 只有基础 CRUD，无业务逻辑 |
| 1/5 | CRUD 也有严重问题 |

**Detection method**:
1. Fork 测试：`POST /lesson-plans { source_template_id: tpl_1 }` → 新教案 blocks 数量 = 模板 blocks 数量
2. 快照测试：`POST /lesson-plans/:id/link-requirement { requirement_id, requirement_snapshot }` → `GET /lesson-plans/:id` → requirement_snapshot 存在
3. 推优测试：`POST /templates/:id/promote` → `GET /templates/promotions` → status = pending → `POST /templates/promotions/:id/review { action: 'approve' }` → 新模板存在（scope = target_scope）
4. Activity 测试：创建教案后 → `GET /context/activity?date=today` → 有 lesson_plan.created 记录

#### D4: Seed Data (Weight: 10/100)

| Score | Description |
|-------|-------------|
| 5/5 | 3 份教案 + 2 个模板 + 20 条 Activity + 3 条待办，数据充分覆盖所有查询场景（分页、筛选、日期过滤、空状态） |
| 4/5 | 数据基本完整但 Activity 不够充分 |
| 3/5 | 教案和模板存在但 Activity 或 seed 不完整 |
| 2/5 | 只有教案没有模板 |
| 1/5 | 无 seed 数据 |

**Detection method**:
```bash
npm run seed  # 或 npx ts-node src/seed-typeorm.ts
curl http://localhost:3011/api/lesson-plans | jq '.total'           # → ≥ 3
curl http://localhost:3011/api/templates | jq '.total'               # → ≥ 2
curl http://localhost:3011/api/context/activity?date=today | jq '.items | length'  # → ≥ 3
curl http://localhost:3011/api/context/activity/week-dots | jq '.days | length'    # → ≥ 5 (days with activity)
```

#### D5: Integration (Weight: 15/100)

| Score | Description |
|-------|-------------|
| 5/5 | TypeORM 与现有 better-sqlite3 完美共存；`npm run build` 零错误；`npm run start:dev` 启动成功；现有 `/api/curriculum/*` 和 `/api/auth/*` 端点行为不变 |
| 4/5 | 共存成功但有 1-2 个 TS warning |
| 3/5 | 共存成功但 build 有 warning |
| 2/5 | 现有端点被影响 |
| 1/5 | 启动失败 |

**Detection method**:
```bash
cd backend && npm run build    # → 零错误
npm run start:dev              # → 启动成功
curl http://localhost:3011/api/curriculum/subjects | jq '.'          # → 现有数据
curl http://localhost:3011/api/auth/login -X POST -d '...' | jq '.' # → JWT token
curl http://localhost:3011/api/lesson-plans | jq '.'                 # → 新端点可用
```

#### D6: Code Quality (Weight: 10/100)

| Score | Description |
|-------|-------------|
| 5/5 | 所有 Controller 有 `@ApiTags`；DTO 使用 class-validator；错误处理（404 for not found, 400 for validation）；TypeScript strict 无 any 泄露；模块间依赖注入正确 |
| 4/5 | 基本规范但缺少 1-2 处错误处理 |
| 3/5 | 有 @ApiTags 但 DTO 校验不完整 |
| 2/5 | 缺少 @ApiTags 或大量 any |
| 1/5 | 代码结构混乱 |

**Detection method**:
1. `grep -rn '@ApiTags' backend/src/lesson-plan/ backend/src/template/ backend/src/dashboard/ backend/src/activity/` → 4 个 controller 全有
2. `grep -rn 'class-validator' backend/src/` → DTO 文件中有 @IsString, @IsOptional 等
3. `curl http://localhost:3011/api/lesson-plans/nonexistent` → 404 响应
4. `curl http://localhost:3011/api/lesson-plans -X POST -d '{}'` → 400 响应 with validation errors

### Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 修改 edu.db | -20 | better-sqlite3 的数据被改动 |
| 现有端点失效 | -15 | `/api/curriculum/*` 或 `/api/auth/*` 返回错误 |
| TypeScript 编译失败 | 总分 0 | `npm run build` 有 TS error |
| 缺少 @ApiTags | -3/controller | 新 Controller 无 @ApiTags |
| Activity 不自动记录 | -5 | CRUD 操作后 Activity 表无新记录 |

### Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 基础分: 6 个维度加权分之和
3. 总分 = 基础分 - Penalty 扣分（满分 100）
4. 报告最后一行: `总分: XX/100`

### Thresholds

- **Pass**: 75/100
- **Target**: 90/100

## Agent Architecture

### Generator

- **Role**: NestJS 后端开发者，精通 TypeORM + SQLite
- **Perspective**: 你在一个已有 better-sqlite3 的后端中集成 TypeORM。最大风险是两者冲突。
- **Input**: 本 HARNESS_SPEC、PRD-02（教案管理）、PRD-04（首页）、现有 backend/ 源码
- **Output**: 修改/新增 backend/src/ 下的文件
- **Isolation**: 每轮 fresh context

### Evaluator

- **Role**: 独立后端质量审查员
- **Perspective**: 基于事实打分，不打曲线
- **Input**: EVAL_CRITERIA（本文件 Eval Rubric 部分）、backend/ 源码
- **Output**: eval-reports/vN-eval.md
- **Phase A**: 静态分析（TypeScript 编译、grep @ApiTags、Entity 字段检查）
- **Phase B**: 运行时验证（启动后端 → curl 所有端点 → 检查响应）

## Exit Conditions

- **Score threshold**: ≥ 90/100
- **Max iterations**: 8 轮
- **Diminishing returns**: 连续 2 轮提升 < 3 分
- **Cost cap**: $100
- **Regression**: 分数下降 > 5 分 → 回滚到最高分版本

## Verification Commands

```bash
# 1. 编译检查
cd solutions/business/edu-platform/backend && npm run build

# 2. 启动后端
npm run start:dev &
sleep 3

# 3. Seed 数据
npm run seed  # 或 npx ts-node src/seed-typeorm.ts

# 4. API smoke test
curl -s http://localhost:3011/api/lesson-plans | jq '.data | length'
curl -s http://localhost:3011/api/lesson-plans | jq '.total'
curl -s http://localhost:3011/api/templates?scope=district | jq '.data | length'
curl -s http://localhost:3011/api/dashboard/pending | jq '.items | length'
curl -s http://localhost:3011/api/dashboard/ai-briefing | jq '.insights | length'
curl -s http://localhost:3011/api/context/activity/weekly-summary | jq '.'
curl -s http://localhost:3011/api/context/activity/week-dots | jq '.days | keys | length'

# 5. 现有端点回归
curl -s http://localhost:3011/api/curriculum/subjects | jq '. | length'
curl -s http://localhost:3011/api/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"teacher1","password":"test123"}' | jq '.access_token'

# 6. 业务逻辑验证（Fork 模板→教案）
TPL_ID=$(curl -s http://localhost:3011/api/templates?scope=district | jq -r '.data[0].id')
NEW_LP=$(curl -s http://localhost:3011/api/lesson-plans -X POST -H "Content-Type: application/json" -d "{\"title\":\"Test Fork\",\"subject_id\":\"math\",\"class_id\":\"class_1\",\"source_template_id\":\"$TPL_ID\"}" | jq -r '.id')
curl -s "http://localhost:3011/api/lesson-plans/$NEW_LP" | jq '.blocks | length'  # → 应 > 0
```
