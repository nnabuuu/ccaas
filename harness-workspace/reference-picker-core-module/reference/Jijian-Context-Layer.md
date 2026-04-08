# Jijian Context Layer — `@kedge-agentic/context-layer`

> CCaaS 平台模块。让 AI（Skill / Chat / 实时助手）和人（@ 引用 / 浏览 / 快捷入口）在正确的时机拿到正确的业务实体作为上下文。
>
> 本模块是一个 npm 包（library），不是独立服务。运行在 Solution 进程内，不依赖 CCaaS 核心服务。

---

## 1. 问题定义

每个 B2B solution 都有自己的业务实体（教育有教案/作业/课标，CRM 有线索/商机/客户）。AI 在工作时需要引用这些实体作为上下文。

三个核心问题：

1. **实体发现**：用户（或 AI）怎么快速找到想要的实体？最近使用？搜索？按类型浏览？钻入子资源？
2. **上下文注入**：找到后怎么把实体内容序列化成 AI 能理解的上下文？
3. **Session 感知**：用户在不同工作场景下，"最近使用"和推荐的含义不同

三种访问模式：

| 模式 | 场景 | 数据来源 | 延迟要求 |
|------|------|---------|---------|
| **Recents** | 刚编辑的教案，快速引用 | Activity Tracker（Redis 预计算） | < 50ms |
| **Search** | 找上学期的某份分析结果 | Solution 的 search API | < 200ms |
| **Drill-down** | 定位到教案中第 2 个内容块的附件 | 关系图 + Solution 的 browse API | 逐级 < 200ms |

---

## 2. 架构

### 2.1 部署模式

`@kedge-agentic/context-layer` 是一个 NestJS module，运行在 Solution 进程内。推断、存储、serve 全在 Solution 侧。

```
Solution Backend (NestJS)
┌──────────────────────────────────────────────────────┐
│  ContextLayerModule                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Entity      │  │ Activity    │  │ Shortcut     │ │
│  │ Registry    │  │ Tracker     │  │ Manager      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘ │
│         └────────────────┼────────────────┘          │
│  ┌───────────────────────┴───────────────────────┐   │
│  │            Context Injector                    │   │
│  └───────────────────────┬───────────────────────┘   │
│  ────────────────────────┼──────────────────────────  │
│  Business modules + ORM  │   ← 启动时扫描元数据       │
└──────────────────────────┼────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
      Solution 自己    Jijian Chat     Skill
      的前端           UI (可选)       runtime
```

与 CCaaS 核心服务**无运行时依赖**：
- 不需要调 CCaaS 的 API
- 不需要向 CCaaS 注册
- Redis 是 Solution 自己的

CCaaS 的角色只有两个：
1. **构建时**：提供这个 npm 包
2. **可选消费者**：如果 Solution 接入了 Jijian Chat / Skill，Jijian 作为 client 调 Solution 的 `/context/*` endpoints

> **设计思考**：我们讨论过"向 CCaaS-core 注册"的模式（Solution 启动时 POST 注册信息到中心化服务），但认为当前阶段不需要——ORM 元数据在 Solution 进程内，推断也应该在 Solution 内完成。如果将来有多 Solution 共存的需求，在 Jijian 侧加一个聚合网关（fan-out 到各 Solution 的 `/context/entity-types` 再 merge）即可，不改 Solution 代码。

### 2.2 core / nestjs 分层

核心逻辑是纯 TypeScript，不依赖任何框架。NestJS 只是一种接入方式。

```
@kedge-agentic/context-layer/
  src/
    core/                              ← 纯 TS，零框架依赖
      entity-registry.ts               ← 实体元数据 + 关系图存储
      relation-inferrer.ts             ← ORM 元数据扫描 + 关系推断
      activity-emitter.ts             ← 活动事件发射（CLS context → MQ）
      recommend-engine.ts             ← Redis sorted set 推荐排序
      context-injector.ts             ← 实体解析 + 序列化 + 上下文注入
      shortcut-manager.ts             ← 用户快捷入口偏好
      interfaces.ts                    ← 所有接口定义

    client/                            ← 消费者 SDK（纯 TS，任何环境可用）
      context-layer-client.ts          ← ContextLayerClient 类
      types.ts                         ← Response 类型定义

    nestjs/                            ← NestJS 接入层（薄壳）
      context-layer.module.ts          ← forRoot() + 启动扫描
      context-layer.decorator.ts       ← @Referenceable + @Tracked
      context-layer.interceptor.ts     ← 读元数据 → 调 core services
      context-layer.controller.ts      ← /context/* 标准 endpoints
      context-layer.constants.ts       ← 元数据 key 常量
```

导入方式：

```typescript
// NestJS 用户（默认入口 — Solution 后端）
import { ContextLayerModule, Referenceable, Tracked } from '@kedge-agentic/context-layer';

// 非 NestJS 用户（core 层）
import { EntityRegistry, ActivityEmitter, RecommendEngine } from '@kedge-agentic/context-layer/core';

// 消费者前端 / CLI / 跨进程调用
import { ContextLayerClient } from '@kedge-agentic/context-layer/client';
```

> **设计思考**：这个分层参考了 `@nestjs/throttler` 的模式——在 throttler 中，ThrottlerGuard 是运行时入口，ThrottlerService 是存储后端，@Throttle 只做 SetMetadata。我们的 ContextLayerInterceptor / core services / @Referenceable 完全对齐这个三层分工。分层的好处是 core 的单元测试是纯 TS（不需要起 NestJS 测试容器），并且可以被 Express/Hono 等其他框架接入。

---

## 3. Entity Registry

### 3.1 自动推断 + 最小声明

Solution builder 只需要做一件事：用 `@Referenceable` 标记哪些实体进入 Context Layer。**关系、导航树、label 全部由平台从 ORM 元数据自动推断。**

**Solution builder 声明的（每个实体 1 行）：**

```typescript
interface ReferenceableOptions {
  type: string;              // 实体类型标识（如 "lesson_plan"）
  displayName: string;       // 人类可读名称（如 "教案"）
  icon: string;              // 图标

  // 以下全部可选——不写就自动推断
  abilities?: {
    search?: boolean | { queryParam?: string; endpoint?: string };
    browse?: boolean | { defaultSort?: string; filterFields?: string[] };
    resolve?: boolean | { folderPathField?: string };
    track?: boolean;          // 默认 true，自动追踪 POST/PUT/DELETE
  };
  contextFields?: string[];  // 注入 AI 的字段白名单。不写 = 全量注入
  hideRelations?: string[];  // 隐藏某个自动推断的关系
  relationLabels?: Record<string, string>;  // 自定义关系 label
  recommender?: {            // 自定义推荐权重（高级）
    weights?: Record<string, number>;
    augment?: (base: Recommendation[], ctx: RecommendContext) => Promise<Recommendation[]>;
  };
}
```

**平台自动推断的（零工作量）：**

启动时 `ContextLayerModule.onModuleInit()` 执行：

1. 扫描所有 `@Referenceable` 标记的 Controller → 收集实体类型列表
2. 找到每个 Controller 对应的 ORM Entity class（TypeORM / Prisma）
3. 读取 `@ManyToOne` / `@OneToMany` / `@ManyToMany` 元数据
4. **过滤**：只保留两端都是 `@Referenceable` 的关系（block → user 的 FK 自动忽略）
5. 生成关系图 + 导航树 + 默认 label（"所属" + 对方 displayName）
6. 推断 search / browse / resolve 端点（从 Controller 的路由元数据）
7. 输出推断结果到日志供 Solution builder review

```
[ContextLayer] Scanning ORM metadata...
[ContextLayer] Found 6 referenceable entities: lesson_plan, block, attachment, homework, submission, requirement
[ContextLayer] Inferred relationships:
  lesson_plan ←1:N→ block (via block.lesson_plan_id)
  block ←1:N→ attachment (via attachment.block_id)
  lesson_plan ←1:N→ exercise (via exercise.lesson_plan_id)
  homework ←1:N→ submission (via submission.homework_id)
  [SKIP] block.created_by → user (user is not @Referenceable)
[ContextLayer] Navigation tree:
  lesson_plan → block → attachment
  lesson_plan → exercise
  homework → submission
[ContextLayer] Ready. 6 entities, 4 relationships, 12 endpoints.
```

> **设计思考**：我们经历了从"手动声明 children/belongsTo/relations 三种关系 + 7 个配置字段"到"ORM 自动推断 + 零声明"的演进。核心 insight 是：Solution builder 在 ORM 中已经声明过实体关系了（`@ManyToOne`），平台不应该让他们再写一遍。唯一的过滤规则——只保留两端都是 `@Referenceable` 的关系——就足以排除噪音（如 created_by → user）。

### 3.2 每个实体都是一等公民

子实体（block、attachment）和顶层实体（lesson_plan）地位完全平等：

- 每个都可以被独立搜索（@ picker 的 search）
- 每个都可以独立出现在 recents
- 编辑任何实体都会触发 Activity 事件
- 关系只影响导航方式，不影响实体的独立性

**两种访问路径自动可用：**

```
路径 A（drill-down）：
  @ → 教案(12) → SSS/SAS教案 ▶ → 内容块(4) → 内容块2 ▶ → 附件(2) → 选中

路径 B（直接搜索）：
  @ → "SAS判定条件图" → 搜索结果：
    📎 SAS判定条件图.png
    └ 📝 SSS/SAS教案 › 📦 内容块2  （面包屑，沿 N:1 链向上回溯）

路径 C（从 recents）：
  @ → 最近使用 → 📎 SAS判定条件图.png（刚编辑过）
```

### 3.3 教育 Solution 完整示例

```typescript
// 这就是教育 Solution 接入 Context Layer 的全部 decorator 代码

@Referenceable({ type: 'lesson_plan', displayName: '教案', icon: '📝' })
@Controller('lesson-plans')
export class LessonPlanController {
  @Get('search') search() { ... }
  @Get() list() { ... }
  @Get(':id') findOne() { ... }
  @Post() create() { ... }
  @Post(':id') update() { ... }
}

@Referenceable({ type: 'block', displayName: '内容块', icon: '📦' })
@Controller('blocks')
export class BlockController {
  @Get() list() { ... }       // 平台从推断的 FK 知道支持 ?lesson_plan_id= 过滤
  @Get(':id') findOne() { ... }
}

@Referenceable({ type: 'attachment', displayName: '附件', icon: '📎' })
@Controller('attachments')
export class AttachmentController {
  @Get() list() { ... }       // 支持 ?block_id= 过滤
  @Get(':id') findOne() { ... }
}

@Referenceable({ type: 'homework', displayName: '作业', icon: '📋' })
@Controller('homework')
export class HomeworkController { ... }

@Referenceable({ type: 'submission', displayName: '学生答卷', icon: '📄' })
@Controller('submissions')
export class SubmissionController { ... }

@Referenceable({ type: 'requirement', displayName: '课标', icon: '📖' })
@Controller('requirements')
export class RequirementController { ... }

// ORM 实体（TypeORM）—— 已有代码，不需要为 Context Layer 修改
@Entity()
export class Block {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() title: string;
  @ManyToOne(() => LessonPlan) lessonPlan: LessonPlan;  // ← 平台从这里推断关系
}

@Entity()
export class Attachment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() filename: string;
  @ManyToOne(() => Block) block: Block;                 // ← 平台从这里推断关系
}
```

---

## 4. Activity Tracker

### 4.1 Session-aware 的活动追踪

```typescript
interface ActivityRecord {
  userId: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  entityDisplayName: string;

  // Session 上下文
  sessionId: string;
  sessionTemplateId?: string;     // 如 "备课助手" / "批改助手"

  action: 'referenced' | 'viewed' | 'created' | 'updated' | 'deleted';
  source: 'auto_track' | 'tracked_decorator' | 'manual';
  timestamp: number;
}
```

### 4.2 推荐引擎（三级可插拔）

**默认排序信号：**

| 信号 | 默认权重 | 说明 |
|------|---------|------|
| session_affinity | 40% | 当前 session 中用过的实体排最前 |
| recency | 30% | 最近操作时间，半衰期 6 小时 |
| frequency | 15% | 过去一周的总操作次数 |
| cooccurrence | 15% | 和当前已引用实体的历史共现 |

**Solution 可以在三个层级介入：**

| 层级 | 做什么 | 复杂度 | 性能影响 |
|------|--------|--------|---------|
| 调权重 | `@Referenceable({ recommender: { weights: { session_affinity: 0.5 } } })` | 改配置 | 零 |
| augment hook | 追加自定义信号（如"同学科的实体加分"）| 写一个函数 | < 20ms，异步不阻塞 |
| 完全 override | Solution 自己实现推荐 API | 自负 | 必须满足 50ms SLA |

> **设计思考**：我们讨论过是否让 Solution 完全 override 推荐逻辑。结论是必须支持——因为有些 Solution 可能基于知识图谱做推荐，默认的 4 信号模型不够用。但 override 必须自负 50ms SLA。

### 4.3 性能设计

**核心约束：@ 弹出 < 50ms。不打断用户输入流。**

```
用户按 @
  ├─ Phase 1: Instant（< 50ms）
  │    从 Redis 预计算缓存读取 Top N 推荐
  │    Cache key: ctx:recents:{tenantId}:{userId}:{sessionId}
  │    零 Solution API 调用
  │
  └─ Phase 2: Refined（用户输入搜索词后）
       debounce 200ms → 调 Solution search API
       搜索结果追加到 @ picker 下方
```

**推荐列表不是每次 @ 时实时计算的——它是增量维护的：**

```typescript
// 每次 Activity 事件触发 Redis 增量更新（不是重算）
async onActivity(event: ActivityRecord) {
  const key = `ctx:recents:${event.tenantId}:${event.userId}:${event.sessionId}`;
  const delta = computeScoreDelta(event);
  await redis.zincrby(key, delta, `${event.entityType}:${event.entityId}`);
}
// ZINCRBY < 1ms，ZREVRANGE < 5ms
```

**性能 SLA：**

| 操作 | 延迟要求 | 实现 |
|------|---------|------|
| @ 弹出（Phase 1） | < 50ms | Redis ZREVRANGE |
| 搜索（Phase 2） | < 200ms | Solution search API，debounce 后触发 |
| Activity 记录 | 异步 | 写入 MQ，后台消费 |
| augment hook | < 20ms | 异步不阻塞，超时忽略 |
| Resolve 实体 | < 300ms | 用户选中后触发，不在 @ 弹出路径上 |

### 4.4 后台消费者

Activity Tracker 不仅服务 Chat UI——后台模块也消费它：

| 消费者 | 怎么用 | 举例 |
|--------|--------|------|
| Chat @ picker | Phase 1 缓存 + Phase 2 搜索 | 教师输入 @ 看到最近编辑的教案 |
| Skill runtime | 查询关联实体 → 注入上下文 | "作业综合分析"Skill 自动拉取关联的教案 |
| 实时建议助手 | 订阅 activity stream → 主动推荐 | 教师编辑教案时弹出"要不要关联上次的练习？" |
| 反思系统 | 查询一段时间的 activity → 生成总结 | "本周你在 SAS 判定上花了最多时间" |
| Admin dashboard | 聚合全体 activity → 使用分析 | "全区教师最常引用的课标 Top 10" |

---

## 5. Shortcut Manager

Chat 输入框下方的工具栏每个用户可以自定义。

**两层配置：**
1. Session template 设默认快捷入口（如"批改助手"默认显示作业+学情分析）
2. 用户可 pin/unpin/reorder 个性化

用户首次使用时工具栏显示 Solution 注册的全部实体类型。Session template 的偏好配置不在本模块内——它是 Jijian 平台侧 session 管理的配置项。

---

## 6. Context Injector

统一的实体解析 + 序列化 + 上下文注入。不同消费者对同一实体需要不同粒度：

| 消费者 | 序列化粒度 |
|--------|-----------|
| Chat @ 引用 | 完整实体（contextFields 全部字段） |
| Skill runtime | 按 Skill input_schema 选择字段 |
| 实时助手 | 最小摘要（title + type + key_metrics） |
| @ picker 搜索结果 | 显示字段（title + subtitle + 面包屑） |

---

## 7. API（前端对接契约）

### 7.1 Response Schemas

```typescript
// ============ Entity Registry ============

// 获取所有实体类型 + 关系树（前端启动时拉一次缓存）
GET  /context/entity-types
→ {
  types: [
    { type: 'lesson_plan', displayName: '教案', icon: '📝', color: 'purple',
      searchable: true, browsable: true },
    { type: 'block', displayName: '内容块', icon: '📦',
      searchable: false, browsable: true },
    { type: 'attachment', displayName: '附件', icon: '📎',
      searchable: true, browsable: true },
    // ...
  ],
  // 关系树——前端从这里知道导航结构
  tree: {
    roots: ['lesson_plan', 'homework', 'requirement'],  // 顶层实体
    relations: [
      { parent: 'lesson_plan', child: 'block', label: '内容块', foreignKey: 'lesson_plan_id' },
      { parent: 'block', child: 'attachment', label: '附件', foreignKey: 'block_id' },
      { parent: 'homework', child: 'submission', label: '学生答卷', foreignKey: 'homework_id' },
    ],
  },
}
// 前端用法：
//   const isRoot = tree.roots.includes(type)           → 顶层类型显示在"按类型浏览"菜单
//   const hasChildren = tree.relations.some(r => r.parent === type)  → 列表项显示 ▶
//   const childTypes = tree.relations.filter(r => r.parent === type) → 钻入时知道展示什么

// ============ 按类型浏览 ============

// 前端只传 parent_type + parent_id，Context Layer 自动转换为 Solution 的 foreign key 参数
// 如：parent_type=lesson_plan&parent_id=lp_1 → Solution 收到 ?lesson_plan_id=lp_1
GET  /context/browse?entity_type=block&parent_type=lesson_plan&parent_id=lp_1&page=1
→ {
  items: [
    { entityType: 'block', entityId: 'blk_1', displayName: '引入',
      subtitle: 'text', timestamp: '2025-03-14T10:00:00Z',
      hasChildren: true },     // ← 前端据此显示 ▶
    { entityType: 'block', entityId: 'blk_2', displayName: 'SAS 概念讲解',
      subtitle: 'text + image', timestamp: '2025-03-14T10:05:00Z',
      hasChildren: true },
  ],
  total: 4, page: 1,
}
// hasChildren 由 Context Layer 补充——查 tree.relations 中该 entityType 是否作为 parent 出现
// Solution 的 browse API 不需要返回这个字段

// ============ 搜索 ============

GET  /context/search?q=SAS判定条件图&limit=5
→ {
  results: [
    {
      entityType: 'attachment', entityId: 'att_1',
      displayName: 'SAS判定条件图.png',
      subtitle: 'image/png · 2.1 MB',
      icon: '📎',
      // 面包屑——Context Layer 自动补全（从 entity→parent 缓存回溯）
      breadcrumb: [
        { type: 'lesson_plan', id: 'lp_1', displayName: 'SSS/SAS 新授课教案', icon: '📝' },
        { type: 'block', id: 'blk_2', displayName: 'SAS 概念讲解', icon: '📦' },
      ],
    },
  ],
}
// 面包屑生成：Context Layer 维护 entity→parent 的轻量映射缓存
// 搜到 attachment(block_id=blk_2) → 查缓存 blk_2 的 displayName + parent
// → 查缓存 lp_1 的 displayName → 拼成面包屑数组
// 缓存由 Activity 事件 + browse 请求增量更新

// ============ 推荐 ============

GET  /context/suggest?session_id=sess_1&limit=10
→ {
  recents: [
    {
      entityType: 'lesson_plan', entityId: 'lp_1',
      displayName: 'SSS/SAS 新授课教案',
      icon: '📝', color: 'purple',
      breadcrumb: null,           // 顶层实体，无面包屑
      score: 0.95,
    },
    {
      entityType: 'attachment', entityId: 'att_1',
      displayName: 'SAS判定条件图.png',
      icon: '📎',
      breadcrumb: [               // 子实体，带面包屑
        { type: 'lesson_plan', id: 'lp_1', displayName: 'SSS/SAS教案', icon: '📝' },
        { type: 'block', id: 'blk_2', displayName: 'SAS 概念讲解', icon: '📦' },
      ],
      score: 0.72,
    },
  ],
  cachedAt: '2025-03-15T14:30:00Z',
}
// suggest 返回的每个 item 都带完整的 icon + breadcrumb
// 前端直接渲染，不需要二次查询

// ============ 解析（选中后） ============

GET  /context/resolve?entity_type=attachment&entity_id=att_1
→ {
  entityType: 'attachment', entityId: 'att_1',
  displayName: 'SAS判定条件图.png',
  data: { filename: 'SAS判定条件图.png', mimeType: 'image/png', size: 2100000, url: '...' },
  dataHash: 'abc123',          // 用于 Skill 时效性检测
  resolvedAt: '2025-03-15T14:31:00Z',
  breadcrumb: [
    { type: 'lesson_plan', id: 'lp_1', displayName: 'SSS/SAS教案' },
    { type: 'block', id: 'blk_2', displayName: 'SAS 概念讲解' },
  ],
}

// ============ Activity（异步） ============

POST /context/activity
  { entityType, entityId, entityDisplayName, sessionId, action }

// ============ Shortcuts ============

GET  /context/shortcuts → { pinned: [...], hidden: [...] }
PUT  /context/shortcuts   { pinned: [...], hidden: [...] }
```

### 7.2 前端 @ picker 的完整调用序列

```
应用启动
  └─ GET /context/entity-types → 缓存 types[] + tree（关系图）
     前端据此知道：哪些是顶层类型、哪些类型能展开、展开时用什么 parent 参数

用户按 @
  └─ GET /context/suggest → 推荐列表（< 50ms）
     每个 item 已经带 icon + breadcrumb，直接渲染
  └─ 从缓存的 tree.roots 渲染"按类型浏览"菜单

用户点"教案"类型
  └─ GET /context/browse?entity_type=lesson_plan → 教案列表
     前端查 tree：hasChildren('lesson_plan') = true → 每行显示 ▶

用户点某教案的 ▶
  └─ GET /context/browse?entity_type=block&parent_type=lesson_plan&parent_id=lp_1
     前端查 tree：hasChildren('block') = true → 内容块行也有 ▶

用户点某内容块的 ▶
  └─ GET /context/browse?entity_type=attachment&parent_type=block&parent_id=blk_2
     前端查 tree：hasChildren('attachment') = false → 点击即选中

用户输入搜索词
  └─ debounce 200ms → GET /context/search?q=SAS → 结果带面包屑
     前端直接渲染面包屑路径

用户选中某实体
  └─ GET /context/resolve → 完整数据 → 注入 AI conversation 上下文
  └─ POST /context/activity（Interceptor 自动记录，前端不用管）
```

### 7.3 面包屑缓存

Context Layer 内部维护一个 `entity → parent` 的轻量映射缓存，用于为 suggest 和 search 结果补全面包屑：

```typescript
// Redis Hash: ctx:parents:{tenantId}
// field: "block:blk_2"
// value: JSON { parentType: 'lesson_plan', parentId: 'lp_1', displayName: 'SAS 概念讲解' }

// 缓存更新时机：
// 1. browse 请求到达时——解析 parent_type + parent_id 参数，缓存返回结果中每个 item 的 parent 关系
// 2. Activity 事件中——如果 action='created' 或 'updated'，从返回值提取 FK 更新映射
// 3. resolve 请求到达时——从完整实体数据提取 FK 更新映射

// 面包屑回溯：
// attachment(att_1).block_id = blk_2
//   → 查缓存 block:blk_2 → { parentType: 'lesson_plan', parentId: 'lp_1', displayName: 'SAS 概念讲解' }
//     → 查缓存 lesson_plan:lp_1 → { parentType: null, displayName: 'SSS/SAS 新授课教案' }
//       → 到顶，返回面包屑数组
```

> **设计思考**：面包屑是前端体验的关键——搜索到附件但不知道它属于哪个教案，体验很差。我们选择在 Context Layer 侧自动补全面包屑（而不是要求 Solution search API 返回），因为这是跨实体的关系查询，应该由平台统一处理。轻量 Redis Hash 缓存保证回溯延迟可控（每级一次 HGET）。

---

## 8. Consumer Layer（消费者接入）

### 10.1 三层架构

```
消费者 UI（React / CLI / Slack / 无 UI）
    │
    ▼
ContextLayerClient（TS SDK）         ← @kedge-agentic/context-layer/client
    │
    ▼
/context/* REST API（ContextLayerController）
```

所有消费者通过 **ContextLayerClient** 调 API，不直接发 HTTP。SDK 封装了：认证 header 注入、响应类型解析、错误处理、debounce 策略。

```typescript
// @kedge-agentic/context-layer/client
export class ContextLayerClient {
  constructor(private baseUrl: string, private authProvider: () => string) {}

  async getEntityTypes(): Promise<EntityTypesResponse> { ... }
  async suggest(sessionId: string, limit?: number): Promise<SuggestResponse> { ... }
  async browse(entityType: string, opts?: { parentType?: string; parentId?: string; page?: number }): Promise<BrowseResponse> { ... }
  async search(query: string, opts?: { entityType?: string; limit?: number }): Promise<SearchResponse> { ... }
  async resolve(entityType: string, entityId: string, fields?: string[]): Promise<ResolveResponse> { ... }
  async getShortcuts(): Promise<ShortcutsResponse> { ... }
  async updateShortcuts(config: ShortcutsConfig): Promise<void> { ... }
}
```

client 包也在 `@kedge-agentic/context-layer` 中导出，纯 TS 零框架依赖：

```typescript
import { ContextLayerClient } from '@kedge-agentic/context-layer/client';
```

### 10.2 Web Chat 接入

Solution 的 Chat 前端在输入框中集成 @ picker。两种方式：

**方式 A：用平台提供的 React 组件（推荐）**

```tsx
import { AtPicker } from '@kedge-agentic/context-layer-react';

function ChatInput({ sessionId, onSend }) {
  const [refs, setRefs] = useState<EntityRef[]>([]);

  return (
    <div>
      {/* 引用 pill 展示区 */}
      <RefPills refs={refs} onRemove={(i) => setRefs(r => r.filter((_, j) => j !== i))} />

      {/* 输入框 — 打 @ 触发 picker */}
      <input onKeyDown={(e) => e.key === '@' && setPickerOpen(true)} />

      {/* @ picker 组件 — 封装了全部交互 */}
      <AtPicker
        baseUrl="/context"
        sessionId={sessionId}
        onSelect={(entity) => setRefs(r => [...r, entity])}
        // 内部自动处理：
        //   启动时拉 entity-types + 缓存关系树
        //   打开时调 suggest（< 50ms）
        //   渲染最近使用 + 按类型浏览
        //   drill-down 导航（自动传 parent_type/parent_id）
        //   搜索 debounce 200ms
        //   面包屑展示
        //   快捷入口工具栏
      />

      <button onClick={() => onSend(inputText, refs)}>发送</button>
    </div>
  );
}
```

`@kedge-agentic/context-layer-react` 是独立的 npm 包（依赖 React），内部用 ContextLayerClient 调 API。Solution builder 只需要传 `baseUrl + sessionId + onSelect`。

**方式 B：自己实现 UI，用 client SDK 调数据**

```typescript
const client = new ContextLayerClient('/context', () => getAuthToken());

// 初始化
const { types, tree } = await client.getEntityTypes();

// 用户按 @
const { recents } = await client.suggest(sessionId);
// → 自己渲染推荐列表

// 用户点类型钻入
const { items } = await client.browse('block', { parentType: 'lesson_plan', parentId: 'lp_1' });
// → 自己渲染列表，根据 tree 判断 hasChildren

// 用户搜索
const { results } = await client.search('SAS', { limit: 5 });
// → 自己渲染搜索结果 + 面包屑
```

### 10.3 CLI 接入

CLI 场景没有鼠标、没有弹窗，但数据流完全相同。@ 交互变成 fuzzy finder：

```typescript
import { ContextLayerClient } from '@kedge-agentic/context-layer/client';
import inquirer from 'inquirer';

const client = new ContextLayerClient('http://localhost:3000/context', () => token);

async function pickReference(sessionId: string): Promise<EntityRef> {
  // 1. 拉推荐列表
  const { recents } = await client.suggest(sessionId, 20);

  // 2. 渲染为 inquirer 选项
  const choices = recents.map(r => ({
    name: r.breadcrumb
      ? `${r.icon} ${r.displayName}  (${r.breadcrumb.map(b => b.displayName).join(' › ')})`
      : `${r.icon} ${r.displayName}`,
    value: r,
  }));

  // 3. 加一个"搜索..."选项
  choices.push({ name: '🔍 搜索...', value: '__search__' });

  const { selected } = await inquirer.prompt([{
    type: 'list',
    name: 'selected',
    message: '@ 引用实体：',
    choices,
  }]);

  if (selected === '__search__') {
    const { query } = await inquirer.prompt([{ type: 'input', name: 'query', message: '搜索：' }]);
    const { results } = await client.search(query);
    // ... 同样用 inquirer.list 展示搜索结果
  }

  return selected;
}

// 使用
const ref = await pickReference('session_123');
console.log(`引用了：${ref.displayName}`);
```

**CLI 的 drill-down 用递归 prompt 实现：**

```typescript
async function drillDown(client, entityType, parentType?, parentId?) {
  const { items } = await client.browse(entityType, { parentType, parentId });
  const { types, tree } = await client.getEntityTypes();
  const childRelation = tree.relations.find(r => r.parent === entityType);

  const choices = items.map(item => ({
    name: childRelation
      ? `${item.displayName}  ▶`       // 有子类型，显示 ▶
      : `${item.displayName}`,          // 无子类型，直接选
    value: item,
  }));
  choices.unshift({ name: '← 返回', value: '__back__' });

  const { selected } = await inquirer.prompt([{ type: 'list', name: 'selected', message: `${entityType}：`, choices }]);
  if (selected === '__back__') return null;

  // 如果有子类型，递归钻入
  if (childRelation) {
    const child = await drillDown(client, childRelation.child, entityType, selected.entityId);
    return child || selected;  // 如果用户返回了，就选当前级
  }
  return selected;
}
```

### 10.4 Programmatic 接入（无 UI）

Skill runtime、实时助手等后端消费者不需要 UI，直接用 client 或 core service：

```typescript
// 方式 A：在 Solution 进程内直接注入 core service
@Injectable()
export class HomeworkAnalysisSkill {
  constructor(
    private contextInjector: ContextInjector,
    private entityRegistry: EntityRegistry,
  ) {}

  async execute(homeworkId: string) {
    // 直接通过 core service 获取上下文——不走 HTTP，零延迟
    const homework = await this.contextInjector.resolve('homework', homeworkId);
    const relatedPlan = await this.contextInjector.resolveRelated('homework', homeworkId, 'lesson_plan');
    // ... 用 homework + relatedPlan 的数据做分析
  }
}

// 方式 B：跨进程调用（Skill 运行在独立进程）
const client = new ContextLayerClient('http://solution:3000/context', () => serviceToken);
const homework = await client.resolve('homework', homeworkId);
```

### 10.5 兼容性总结

| 消费者 | 交互方式 | 用什么 | @ 触发方式 |
|--------|---------|--------|-----------|
| **Web Chat** | 鼠标/触摸 + 弹出层 | React 组件 或 client SDK | 输入 `@` 键 |
| **CLI** | 键盘 + 终端列表 | client SDK + inquirer/fzf | 命令参数或交互 prompt |
| **Slack/IM** | slash command + interactive message | client SDK + Slack API | `/ref` 或 `@jijian` |
| **Skill runtime** | 无 UI，程序化 | core service（同进程）或 client SDK（跨进程） | 代码直接调用 |
| **VS Code 插件** | inline completion | client SDK | `@` 在编辑器中 |

**关键原则：/context/* API 是消费者无关的。** 同一个 API 支撑 Web、CLI、Slack、programmatic 四种完全不同的交互模式。差别只在 UI 层如何渲染 API 返回的数据。

> **设计思考**：我们一开始只考虑了 Web Chat 的 @ picker，但 Solution 完全可能是一个 CLI 工具（比如 Jijian 的 Claude Code 集成）。通过在 API 和 UI 之间插入 ContextLayerClient SDK，确保数据流和交互逻辑在所有消费者中一致，只有渲染层不同。React 组件是一个独立包（`@kedge-agentic/context-layer-react`），不绑定在核心包里——因为不是所有 Solution 都用 React。

---

## 9. Decorator 设计

### 10.1 设计原则

参考 `@nestjs/throttler` 的分层模式：

| 层 | throttler | context-layer | 职责 |
|---|---|---|---|
| Decorator | `@Throttle()` `@SkipThrottle()` | `@Referenceable()` `@Tracked()` | **只做 SetMetadata**，零逻辑 |
| Interceptor | `ThrottlerGuard` | `ContextLayerInterceptor` | 运行时入口，读元数据 → 调 Service |
| Service | `ThrottlerService` | `ActivityEmitter` 等 | 纯业务逻辑，可替换 |

> **设计思考**：我们从最初的 8 个 decorator（@ContextEntity / @Searchable / @Browsable / @Resolvable / @ContextField / @TrackActivity / @ContextRecommender / @SessionContext）收敛到 2 个。收敛过程：
> 1. @Searchable / @Browsable / @Resolvable → 从 REST 惯例自动推断，折叠进 `@Referenceable` 的 abilities 参数
> 2. @ContextField → 和 @Resolvable 的 contextFields 重复，删除
> 3. @ContextRecommender → 折叠进 `@Referenceable` 的 recommender 参数
> 4. @SessionContext → 不是 context-layer 的事，移到 Jijian session 管理
> 5. @TrackActivity → 改名 `@Tracked`，仅 Service 层需要（Controller 层由 abilities.track 自动覆盖）
> 6. @ContextEntity → 改名 `@Referenceable`（"ContextEntity"太学术，这个模块做的就是让实体可被 @ 引用）
>
> 命名参考 NestJS 的潜规则：类级别用名词或形容词（@Controller / @Injectable / @Global），方法级别用动词（@Get / @Post）。`@Referenceable` 和 `@Injectable` 同一模式——"-able 形容词描述特性"。`@Tracked` 是过去分词形容词——"这个方法是被追踪的"。

### 10.2 @Referenceable

```typescript
// 实现：纯 SetMetadata
export function Referenceable(options: ReferenceableOptions): ClassDecorator {
  return SetMetadata(REFERENCEABLE_KEY, options);
}
```

三种使用姿势：

```typescript
// 90% 场景：一行搞定
@Referenceable({ type: 'lesson_plan', displayName: '教案', icon: '📝' })

// 限制注入字段
@Referenceable({
  type: 'lesson_plan', displayName: '教案', icon: '📝',
  contextFields: ['title', 'blocks', 'knowledge_points'],
})

// 覆盖某些默认行为
@Referenceable({
  type: 'lesson_plan', displayName: '教案', icon: '📝',
  abilities: {
    search: { queryParam: 'keyword' },   // 搜索参数不是默认的 q
    browse: { defaultSort: 'created_at:desc' },
    track: false,                         // 不自动追踪（自己用 @Tracked 精细控制）
  },
  recommender: { weights: { session_affinity: 0.5 } },
})
```

### 10.3 @Tracked

仅 Service 层需要——Controller 层的 POST/PUT/DELETE 已被 `abilities.track` 自动覆盖。

```typescript
// 实现：SetMetadata + AOP wrapper
export function Tracked(action: string, opts?: { entityType: string }): MethodDecorator {
  return applyDecorators(
    SetMetadata(TRACKED_KEY, { action, ...opts }),
  );
}
```

使用场景：

```typescript
@Injectable()
export class LessonPlanService {
  // Service 层：必须显式声明 entityType（因为 Service 没有 @Referenceable）
  @Tracked('created', { entityType: 'lesson_plan' })
  async createFromTemplate(templateId: string): Promise<LessonPlan> {
    const plan = await this.repo.save(this.forkTemplate(template));
    // 级联操作：exerciseService 有自己的 @Tracked
    await this.exerciseService.createDefault(plan.id);
    return plan;
  }
}

@Injectable()
export class ExerciseService {
  @Tracked('created', { entityType: 'exercise' })
  async createDefault(lessonPlanId: string): Promise<Exercise> {
    return this.repo.save({ lessonPlanId, status: 'draft' });
  }
}
```

> **设计思考**：我们讨论过"Service 层能不能用 AOP decorator"的问题。结论：可以，通过 NestJS CLS（AsyncLocalStorage）实现。HTTP 请求、Skill runtime、MQ consumer、Cron job 各自在入口处往 CLS 写入 `{ userId, tenantId, sessionId }`，`@Tracked` 的 AOP wrapper 从 CLS 读取上下文。Controller 上的 `@Tracked` 可以省略 entityType（从 `@Referenceable` 元数据推断），Service 上必须显式声明。

### 10.4 CLS 上下文

```typescript
interface ClsContext {
  userId: string;
  tenantId: string;
  sessionId?: string;
  sessionTemplateId?: string;
  source: 'http' | 'skill' | 'mq' | 'cron' | 'internal';
}

// HTTP 请求 → ClsInterceptor 写入（从 auth token 解析）
// Skill runtime → SkillRunner 写入
// MQ consumer → MqHandler 写入
// Cron job → CronRunner 写入
```

---

## 10. Internal Architecture

### 10.1 core 层（纯 TS）

6 个类，各自单一职责：

| 类 | 职责 | 依赖（接口） |
|---|---|---|
| `EntityRegistry` | 存储实体元数据 + 关系图 | 无 |
| `RelationInferrer` | 启动时扫描 ORM 元数据 → 推断关系 | ORM adapter 接口 |
| `ActivityEmitter` | 从 CLS 读上下文 → 异步写 MQ | ActivityQueue 接口 |
| `RecommendEngine` | Redis sorted set 增量维护 + 排序 | CacheStore 接口 |
| `ContextInjector` | 调 Solution resolve 端点 → 序列化 | EntityRegistry |
| `ShortcutManager` | 用户快捷入口偏好 CRUD | CacheStore 接口 |

core 类是纯 TS，构造函数接收接口依赖：

```typescript
// core/activity-emitter.ts — 不 import 任何 NestJS 的东西
export class ActivityEmitter {
  constructor(
    private queue: ActivityQueue,        // 接口
    private recommend: RecommendEngine,  // 接口
  ) {}

  async emit(ctx: ClsContext, params: EmitParams): Promise<void> {
    await this.queue.add({ ...ctx, ...params, timestamp: Date.now() });
    await this.recommend.incrementScore(ctx.tenantId, ctx.userId, ctx.sessionId, params);
  }
}
```

### 10.2 nestjs 层（薄壳）

NestJS 层做三件事：
1. 用 DI 组装 core 类
2. 用 Interceptor 连接 decorator 元数据和 core 逻辑
3. 用 Controller 暴露 HTTP endpoints

```typescript
// nestjs/context-layer.module.ts
@Module({})
export class ContextLayerModule implements OnModuleInit {
  static forRoot(options: { redis: RedisOptions }): DynamicModule {
    return {
      module: ContextLayerModule,
      providers: [
        { provide: ActivityEmitter, useFactory: (q, e) => new ActivityEmitter(q, e), inject: [ActivityQueue, RecommendEngine] },
        // ... 其他 core 类同理
      ],
      controllers: [ContextLayerController],
      exports: [EntityRegistry, ActivityEmitter, RecommendEngine, ContextInjector],
    };
  }

  async onModuleInit() {
    // 启动时：扫描 @Referenceable + ORM → 注册到 EntityRegistry
    const inferrer = this.moduleRef.get(RelationInferrer);
    await inferrer.scanAndRegister();
  }
}
```

### 10.3 内部数据流

```
启动时：
  Module.onModuleInit()
    → RelationInferrer.scan()       读 ORM 元数据
    → EntityRegistry.register()     存储推断结果
    → Interceptor 绑定              全局拦截 @Referenceable Controller

运行时（用户按 @）：
  ContextController.suggest()
    → RecommendEngine.getTopN()     Redis ZREVRANGE < 50ms

运行时（用户操作实体）：
  HTTP Request → ContextLayerInterceptor
    → Reflector.get(REFERENCEABLE_KEY)    读元数据
    → ActivityEmitter.emit()              异步 MQ → Redis ZINCRBY

运行时（@Tracked 在 Service 上）：
  Service.method() → AOP wrapper
    → ActivityEmitter.emit()              和 Interceptor 调的是同一个实例
```

**核心共享类：`ActivityEmitter`。** `@Referenceable` 的 auto-track 和 `@Tracked` 的显式调用最终都走 `ActivityEmitter.emit()` 同一个方法。

---

## 11. 关键设计决策

| 问题 | 决策 | 理由 |
|------|------|------|
| 实体关系怎么来 | **从 ORM 自动推断**，只保留两端都是 @Referenceable 的 | 零额外声明，ORM 已经写过 |
| 每个子实体是否一等公民 | **是** | 独立搜索、独立出现在 recents、独立被追踪 |
| 部署模式 | **npm 包，运行在 Solution 进程内** | 不依赖 CCaaS 核心服务 |
| core 是否依赖 NestJS | **否，纯 TS** | 可测试、可移植 |
| Decorator 数量 | **2 个**（@Referenceable + @Tracked） | 其余折叠进参数或自动推断 |
| Decorator 是否含逻辑 | **否，只 SetMetadata** | 遵循 NestJS 模式 |
| @ 弹出延迟 | **< 50ms**（Redis 缓存，零 Solution API 调用） | 不打断输入流 |
| 推荐算法 | **三级可插拔**（调权重 / augment / override） | 默认够用，高级场景可替换 |
| Activity 是否带 session | **是** | 不同 session 中同一实体的相关性不同 |
| @Tracked 的 entityType | **Controller 自动推断，Service 显式声明** | Service 没有 @Referenceable 元数据 |
| 推荐何时计算 | **增量维护**（Activity 事件触发 ZINCRBY） | 不是每次 @ 时重算 |
| Session 偏好配置 | **不在本模块内**，属于 Jijian session 管理 | 关注点分离 |

---

## 12. 成都教育 Solution — @ 引用产品逻辑（Implementation Harness）

> 本章是 Context Layer 在教育精准教学平台中的具体产品规格。作为 long-term harness 使用：实现者可以先 mock 产品功能，逐步替换为真实后端，每步都有可验证的行为。

### 12.1 实体清单与 ORM 关系

```
Entity Types（全部标 @Referenceable）：

lesson_plan    教案    📝  purple   ← 顶层
  └─ block     内容块  📦           ← block.lesson_plan_id FK
      └─ attachment  附件  📎       ← attachment.block_id FK
exercise       练习设计 📐  blue     ← exercise.lesson_plan_id FK（也属于 lesson_plan）
homework       作业    📋  blue     ← 顶层
  └─ submission  学生答卷 📄        ← submission.homework_id FK
requirement    课标    📖  coral    ← 顶层
question       题目    ❓  amber    ← 顶层
  └─ question.requirement_id FK → requirement（题目关联课标）
session_record 课堂记录 📅  teal    ← 顶层
  └─ session_record.lesson_plan_id FK → lesson_plan（课堂记录关联教案）
analytics      学情分析 📊  red     ← 顶层
  └─ analytics.homework_id FK → homework（分析关联作业）
```

**预期推断出的关系树：**

```
[ContextLayer] Inferred relationships:
  lesson_plan ←1:N→ block          (via block.lesson_plan_id)
  block ←1:N→ attachment           (via attachment.block_id)
  lesson_plan ←1:N→ exercise       (via exercise.lesson_plan_id)
  homework ←1:N→ submission        (via submission.homework_id)
  requirement ←1:N→ question       (via question.requirement_id)
  lesson_plan ←1:N→ session_record (via session_record.lesson_plan_id)
  homework ←1:N→ analytics         (via analytics.homework_id)

[ContextLayer] Navigation tree:
  roots: [lesson_plan, homework, requirement, question, session_record, analytics]
  drill-down paths:
    lesson_plan → block → attachment
    lesson_plan → exercise
    lesson_plan → session_record
    homework → submission
    homework → analytics
    requirement → question
```

注意：`question` 既是顶层（可独立搜索/浏览）也是 `requirement` 的子类型（可从课标钻入）。`session_record` 和 `analytics` 同理——顶层可独立访问，也可从 lesson_plan / homework 钻入。

### 12.2 Session Template 与 @ picker 行为

三个 session template，每个有不同的 @ picker 默认行为：

```typescript
// 这些配置在 Jijian 平台侧，不在 context-layer 模块内
const sessionTemplates = {
  'lesson-prep': {
    name: '备课助手',
    // @ 工具栏默认显示的类型
    shortcuts: ['lesson_plan', 'requirement', 'question'],
    // 推荐排序权重调整
    recommenderWeights: {
      session_affinity: 0.5,   // 备课时当前 session 内的实体更重要
      recency: 0.25,
      frequency: 0.1,
      cooccurrence: 0.15,
    },
    // 进入 session 时自动注入的实体
    autoInject: [
      { entityType: 'lesson_plan', strategy: 'from_trigger' },
      // 教师从某份教案点"AI 备课助手"进来 → 该教案自动注入上下文
    ],
  },

  'grading': {
    name: '批改助手',
    shortcuts: ['homework', 'analytics', 'question'],
    recommenderWeights: {
      session_affinity: 0.5,
      recency: 0.3,
      frequency: 0.1,
      cooccurrence: 0.1,
    },
    autoInject: [
      { entityType: 'homework', strategy: 'from_trigger' },
    ],
  },

  'classroom': {
    name: '课堂执行助手',
    shortcuts: ['lesson_plan', 'exercise', 'session_record'],
    autoInject: [
      { entityType: 'lesson_plan', strategy: 'from_trigger' },
      { entityType: 'session_record', strategy: 'most_recent' },
    ],
  },
};
```

### 12.3 @ picker 交互规格

**触发方式（三种）：**

| 触发 | 行为 |
|------|------|
| 输入框中键入 `@` | 弹出 picker，光标在搜索框 |
| 点击工具栏的 `@ 引用` pill | 弹出 picker |
| 点击工具栏的某个实体类型 pill（如 📝 教案） | 弹出 picker 并自动钻入该类型的列表 |

**picker 布局（两列）：**

```
┌──────────────────────────────────────────┐
│ [🔍 搜索实体...]                          │
├──────────────────────────────────────────┤
│ 最近使用                                  │
│ 📝 SSS/SAS 新授课教案          10分钟前    │
│ 📋 SAS 判定专项练习 · 八(2)班   昨天       │
│ 📎 SAS判定条件图.png                      │
│    └ 📝 SSS/SAS教案 › 📦 内容块2          │
├──────────────────────────────────────────┤
│ 按类型浏览                                │
│ 📝 教案 (12)                        ›    │
│ 📋 作业 (8)                         ›    │
│ 📖 课标 (42)                        ›    │
│ ❓ 题目 (186)                       ›    │
│ 📅 课堂记录 (24)                     ›    │
│ 📊 学情分析 (5)                      ›    │
└──────────────────────────────────────────┘
```

**钻入交互：**

```
点击 "📝 教案 (12) ›"
  ┌──────────────────────────────────────────┐
  │ ← 返回                     📝 教案       │
  │ [🔍 搜索教案...]                          │
  ├──────────────────────────────────────────┤
  │ SSS/SAS 新授课教案           ▶  [选择]    │
  │ ASA/AAS 判定教案             ▶  [选择]    │
  │ 全等三角形概念导入            ▶  [选择]    │
  │ 复习课：全等判定对比           ▶  [选择]    │
  └──────────────────────────────────────────┘
  // ▶ = 可展开（有子实体 block）
  // [选择] = 点击选中整个教案
  // 用户可以选整个教案，也可以点 ▶ 钻入看内容块

点击 "SSS/SAS 新授课教案" 旁的 ▶
  ┌──────────────────────────────────────────┐
  │ ← 教案 › SSS/SAS 新授课教案   📦 内容块  │
  ├──────────────────────────────────────────┤
  │ 📦 引入                      ▶  [选择]   │
  │ 📦 SAS 概念讲解              ▶  [选择]   │
  │ 📦 即时练习                       [选择]   │
  │ 📦 小结                           [选择]   │
  └──────────────────────────────────────────┘
  // "引入" 和 "SAS 概念讲解" 有附件 → 显示 ▶
  // "即时练习" 和 "小结" 没有附件 → 只有 [选择]

点击 "SAS 概念讲解" 旁的 ▶
  ┌──────────────────────────────────────────┐
  │ ← 内容块 › SAS 概念讲解        📎 附件   │
  ├──────────────────────────────────────────┤
  │ 📎 板书示意图.png                 [选择]   │
  │ 📎 SAS判定条件图.png              [选择]   │
  └──────────────────────────────────────────┘
  // 附件没有子资源 → 只有 [选择]，没有 ▶
```

**选中后的行为：**

```
用户选中一个实体 → 三件事发生：

1. 输入框上方出现引用 pill
   ┌──────────────────────────────────────────┐
   │ [📎 SAS判定条件图.png ×] [📝 SSS/SAS教案 ×] │
   ├──────────────────────────────────────────┤
   │ [输入消息... 比如「帮我基于这张图设计一个互动」]   │
   └──────────────────────────────────────────┘
   // 可以选多个实体，pill 并排显示
   // × 可以移除某个引用

2. Context Layer 调 resolve → 获取完整数据 → 注入 conversation 上下文
   // Skill 或 LLM 在处理消息时可以读取引用实体的内容

3. Context Layer 自动记录 activity（'referenced'）
   // 下次 @ 时这些实体排在最近使用前面
```

### 12.4 搜索行为规格

```
用户输入 "SAS"（debounce 200ms 后触发搜索）

搜索结果合并多个实体类型（不限于当前 session 的偏好类型）：
  ┌──────────────────────────────────────────┐
  │ [🔍 SAS]                                 │
  ├──────────────────────────────────────────┤
  │ 📝 SSS/SAS 新授课教案                     │
  │                                          │
  │ 📋 SAS 判定专项练习 · 八(2)班              │
  │                                          │
  │ 📎 SAS判定条件图.png                       │
  │    └ 📝 SSS/SAS教案 › 📦 内容块2          │
  │                                          │
  │ ❓ qb_2041 · 求证 △ABC ≌ △DEF (SAS)       │
  │                                          │
  │ 📊 SAS 练习综合分析 · 八(2)班              │
  │    └ 📋 SAS 判定专项练习                   │
  │                                          │
  │ 📖 全等三角形的判定（SAS）                   │
  └──────────────────────────────────────────┘

规则：
- 搜索全量数据，不限时间范围
- 所有 @Referenceable 的实体类型都参与搜索
- 子实体（attachment, submission 等）搜索结果带面包屑
- 顶层实体（lesson_plan, homework 等）不带面包屑
- 搜索结果按相关度排序（由 Solution 的 search API 决定）
- 每种类型最多显示 3 条，底部有"查看全部 N 条教案结果"
```

### 12.5 Mock 数据规格

实现者可以用以下 mock 数据来验证完整的 @ 交互流程：

```typescript
const mockEntityTypes = {
  types: [
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
  ],
  tree: {
    roots: ['lesson_plan', 'homework', 'requirement', 'question', 'session_record', 'analytics'],
    relations: [
      { parent: 'lesson_plan', child: 'block', label: '内容块', foreignKey: 'lesson_plan_id' },
      { parent: 'block', child: 'attachment', label: '附件', foreignKey: 'block_id' },
      { parent: 'lesson_plan', child: 'exercise', label: '练习设计', foreignKey: 'lesson_plan_id' },
      { parent: 'lesson_plan', child: 'session_record', label: '课堂记录', foreignKey: 'lesson_plan_id' },
      { parent: 'homework', child: 'submission', label: '学生答卷', foreignKey: 'homework_id' },
      { parent: 'homework', child: 'analytics', label: '学情分析', foreignKey: 'homework_id' },
      { parent: 'requirement', child: 'question', label: '题目', foreignKey: 'requirement_id' },
    ],
  },
};

const mockLessonPlans = [
  { entityId: 'lp_1', displayName: '12.2 SSS/SAS 新授课教案', subtitle: '八年级 · 数学 · 几何', timestamp: '2025-03-14T10:00:00Z' },
  { entityId: 'lp_2', displayName: '12.3 ASA/AAS 判定教案', subtitle: '八年级 · 数学 · 几何', timestamp: '2025-03-10T09:00:00Z' },
  { entityId: 'lp_3', displayName: '12.1 全等三角形概念导入', subtitle: '八年级 · 数学 · 几何', timestamp: '2025-03-07T14:00:00Z' },
  { entityId: 'lp_4', displayName: '复习课：全等三角形判定对比', subtitle: '八年级 · 数学 · 几何', timestamp: '2025-03-01T08:00:00Z' },
];

const mockBlocks_lp1 = [
  { entityId: 'blk_1', displayName: '引入', subtitle: 'text', hasChildren: false },
  { entityId: 'blk_2', displayName: 'SAS 概念讲解', subtitle: 'text + image', hasChildren: true },
  { entityId: 'blk_3', displayName: '即时练习', subtitle: 'exercise', hasChildren: false },
  { entityId: 'blk_4', displayName: '小结', subtitle: 'text', hasChildren: false },
];

const mockAttachments_blk2 = [
  { entityId: 'att_1', displayName: '板书示意图.png', subtitle: 'image/png · 1.2 MB' },
  { entityId: 'att_2', displayName: 'SAS判定条件图.png', subtitle: 'image/png · 2.1 MB' },
];

const mockHomework = [
  { entityId: 'hw_1', displayName: 'SAS 判定专项练习 · 八(2)班', subtitle: '38/43 已提交', timestamp: '2025-03-14T16:00:00Z' },
  { entityId: 'hw_2', displayName: 'SSS 判定随堂测验 · 八(2)班', subtitle: '42/43 已提交', timestamp: '2025-03-10T12:00:00Z' },
];

const mockRecents_lessonPrep = [
  { entityType: 'lesson_plan', entityId: 'lp_1', displayName: '12.2 SSS/SAS 新授课教案', icon: '📝', color: 'purple', breadcrumb: null, score: 0.95 },
  { entityType: 'homework', entityId: 'hw_1', displayName: 'SAS 判定专项练习 · 八(2)班', icon: '📋', color: 'blue', breadcrumb: null, score: 0.82 },
  { entityType: 'attachment', entityId: 'att_2', displayName: 'SAS判定条件图.png', icon: '📎', color: null, breadcrumb: [
    { type: 'lesson_plan', id: 'lp_1', displayName: '12.2 SSS/SAS 新授课教案', icon: '📝' },
    { type: 'block', id: 'blk_2', displayName: 'SAS 概念讲解', icon: '📦' },
  ], score: 0.71 },
  { entityType: 'session_record', entityId: 'sr_1', displayName: '周三第1节 · 12.2 SSS/SAS · 八(2)班', icon: '📅', color: 'teal', breadcrumb: null, score: 0.65 },
];
```

### 12.6 验证场景（Acceptance Criteria）

实现者按以下场景逐个验证：

```gherkin
Scenario 1: 基本 @ 弹出
  Given: 教师在备课助手 session 中
  When: 输入框中键入 @
  Then: 弹出 picker，显示最近使用（mockRecents_lessonPrep）+ 按类型浏览菜单（tree.roots）
  And: 工具栏显示备课助手的默认 shortcuts：📝 教案 / 📖 课标 / ❓ 题目

Scenario 2: 按类型浏览 → 顶层列表
  Given: picker 已弹出
  When: 点击"📝 教案 (12) ›"
  Then: 显示教案列表（mockLessonPlans）
  And: 每行教案旁有 ▶ 按钮（因为 tree.relations 中 lesson_plan 作为 parent 出现过）
  And: 每行教案旁有 [选择] 按钮（可以直接选整个教案）
  And: 顶部显示"← 返回"按钮和面包屑"📝 教案"

Scenario 3: 钻入子资源
  Given: 在教案列表中
  When: 点击"SSS/SAS 新授课教案"旁的 ▶
  Then: 显示内容块列表（mockBlocks_lp1）
  And: "SAS 概念讲解"旁有 ▶（hasChildren: true）
  And: "即时练习"和"小结"旁没有 ▶（hasChildren: false）
  And: 面包屑显示"← 教案 › SSS/SAS 新授课教案 | 📦 内容块"

Scenario 4: 三级钻入
  Given: 在 lp_1 的内容块列表中
  When: 点击"SAS 概念讲解"旁的 ▶
  Then: 显示附件列表（mockAttachments_blk2）
  And: 附件没有 ▶（hasChildren: false，attachment 在 tree 中不作为 parent）
  And: 面包屑显示"← 内容块 › SAS 概念讲解 | 📎 附件"

Scenario 5: 选中实体 → 引用 pill
  Given: 在附件列表中
  When: 点击"SAS判定条件图.png"的 [选择]
  Then: picker 关闭
  And: 输入框上方出现 pill "[📎 SAS判定条件图.png ×]"
  And: 底部显示"1 个实体已引用 · 发送时注入上下文"

Scenario 6: 多实体引用
  Given: 已引用 att_2
  When: 再次 @ → 选中 lp_1
  Then: 输入框上方显示两个 pill：[📎 SAS判定条件图.png ×] [📝 SSS/SAS教案 ×]
  And: 底部显示"2 个实体已引用"

Scenario 7: 搜索
  Given: picker 已弹出
  When: 输入"SAS"并等待 200ms
  Then: 最近使用和类型菜单被搜索结果替换
  And: 搜索结果包含教案、作业、附件、题目、学情分析、课标（多种类型）
  And: 附件 (att_2) 和学情分析结果带面包屑
  And: 顶层实体不带面包屑

Scenario 8: 搜索结果中的面包屑
  Given: 搜索"SAS判定条件图"
  Then: 结果中 att_2 显示为：
    📎 SAS判定条件图.png
    └ 📝 SSS/SAS教案 › 📦 SAS 概念讲解

Scenario 9: 工具栏快捷入口
  Given: 教师在备课助手 session 中
  When: 点击工具栏的"📖 课标"pill
  Then: picker 弹出并自动钻入课标类型的列表（跳过最近使用+菜单）

Scenario 10: 不同 session template 的 shortcuts
  Given: 教师在批改助手 session 中
  Then: 工具栏显示 📋 作业 / 📊 学情分析 / ❓ 题目（不是备课的 📝/📖/❓）

Scenario 11: 返回导航
  Given: 已钻入到 lp_1 → blk_2 → 附件列表
  When: 点击面包屑中的"← 内容块"
  Then: 回到 lp_1 的内容块列表
  When: 点击"← 教案"
  Then: 回到教案列表
  When: 点击"← 返回"
  Then: 回到最近使用 + 类型菜单（picker 首页）

Scenario 12: recents 更新
  Given: 教师刚编辑了 attachment att_2
  When: 再次 @ 弹出 picker
  Then: att_2 出现在最近使用的第一条（session_affinity 最高分）
  And: att_2 带面包屑（📝 SSS/SAS教案 › 📦 内容块2）

Scenario 13: 自动注入
  Given: 教师从教案 lp_1 的页面点击"AI 备课助手"进入 session
  Then: session 创建时自动注入 lp_1 的完整数据到上下文
  And: 教师无需手动 @ 引用 lp_1，直接可以说"帮我基于这份教案设计课堂互动"
```

### 12.7 实现路径

```
Phase 1: Mock 全部 API，验证前端交互
  - mock /context/entity-types → 返回 mockEntityTypes
  - mock /context/suggest → 返回 mockRecents
  - mock /context/browse → 根据 entity_type + parent 返回 mock 列表
  - mock /context/search → 全文匹配 mock 数据
  - mock /context/resolve → 返回 mock 实体详情
  - 验证 Scenario 1-13

Phase 2: 接入 Context Layer core（纯 TS）
  - EntityRegistry 真实注册
  - RelationInferrer 扫描 ORM
  - RecommendEngine 接入 Redis
  - 替换 mock /context/suggest 和 /context/browse

Phase 3: 接入 NestJS 接入层
  - @Referenceable 标记所有 Controller
  - ContextLayerModule.forRoot()
  - Interceptor 自动 track
  - 替换所有 mock API

Phase 4: Session template 配置
  - 备课/批改/课堂三个 template 的 shortcuts + autoInject
  - 验证 Scenario 10, 13
```
