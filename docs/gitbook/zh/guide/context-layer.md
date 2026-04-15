# Context Layer — @ 引用系统

Context Layer 让聊天用户通过 `@` 引用内联提及业务实体。它提供实体发现（最近使用、搜索、钻入浏览）、AI 上下文注入和基于活动的推荐。

## 架构

三层架构，每层可独立使用：

| 层 | 包 | 职责 |
|---|---|------|
| **core** | `@kedge-agentic/context-layer` | 纯 TypeScript — EntityRegistry、RecommendEngine、ActivityEmitter |
| **nestjs** | `@kedge-agentic/context-layer`（nestjs 子路径） | 薄 NestJS 壳 — 模块、装饰器、控制器、拦截器 |
| **react** | `@kedge-agentic/context-layer-react` | `<AtPicker />` 组件 + `ContextLayerClient` SDK |

该模块作为 npm 包运行在 **Solution 进程内**，不依赖 CCaaS 核心后端。

## 快速开始

### 1. 安装

```bash
npm install @kedge-agentic/context-layer
```

### 2. 导入模块

```typescript
// app.module.ts
import { ContextLayerModule } from '@kedge-agentic/context-layer/nestjs';

@Module({
  imports: [
    ContextLayerModule.forRoot({
      cacheStore: myRedisAdapter,    // 实现 CacheStore 接口
      ormAdapter: myTypeOrmAdapter,  // 实现 OrmAdapter 接口
      browseProvider: myBrowseImpl,  // 实现 EntityBrowseProvider 接口
    }),
  ],
})
export class AppModule {}
```

### 3. 标记实体为可引用

```typescript
import { Referenceable } from '@kedge-agentic/context-layer/nestjs';

@Referenceable({
  type: 'lesson_plan',
  displayName: '教案',
  icon: '📝',
  color: 'purple',
  abilities: { search: true, browse: true, resolve: true, track: true },
  contextFields: ['title', 'subject', 'grade', 'blocks'],
})
@Controller('lesson-plans')
export class LessonPlanController { /* ... */ }
```

### 4. 前端：使用 AtPicker

```tsx
import { AtPicker } from '@kedge-agentic/context-layer-react';

<AtPicker
  baseUrl="http://localhost:3001/api/v1/context"
  sessionId={currentSessionId}
  open={showPicker}
  onClose={() => setShowPicker(false)}
  onSelect={(ref) => addRefPill(ref)}
/>
```

## 装饰器参考

### @Referenceable(options)

将 NestJS 控制器标记为可引用实体类型。应用在类级别。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `string` | 是 | 唯一实体类型标识（如 `'lesson_plan'`） |
| `displayName` | `string` | 是 | 在 picker 中显示的名称 |
| `icon` | `string` | 是 | 实体类型的 emoji 图标 |
| `color` | `string` | 否 | pill 和徽章的主题颜色 |
| `abilities` | `object` | 否 | 能力配置：`search`、`browse`、`resolve`、`track` |
| `contextFields` | `string[]` | 否 | resolve 时包含的字段 |
| `hideRelations` | `string[]` | 否 | 在导航树中隐藏的关系类型 |
| `relationLabels` | `Record<string, string>` | 否 | 自定义推断关系的标签 |
| `recommender` | `object` | 否 | 自定义推荐权重或 augment 函数 |

**abilities** 可以是 `boolean` 或配置对象：

```typescript
abilities: {
  search: { queryParam: 'q', endpoint: '/search' },
  browse: { defaultSort: 'updatedAt', filterFields: ['grade'] },
  resolve: { folderPathField: 'path' },
  track: true,
}
```

### @Tracked(action, opts?)

标记服务方法进行显式活动追踪。

```typescript
@Tracked('graded', { entityType: 'homework' })
async gradeSubmission(homeworkId: string) { /* ... */ }
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `action` | `string` | 活动动作名（内置或自定义） |
| `opts.entityType` | `string` | 实体类型（服务方法必填；控制器自动推断） |

## 实体注册与关系

模块初始化时，`RelationInferrer` 扫描 ORM 元数据并构建关系树：

- 仅保留**两端都标记了 @Referenceable** 的 `@ManyToOne` 关系
- 根实体类型是在任何关系中从未作为子类型出现的类型
- 通过 `relationLabels` 自定义标签，通过 `hideRelations` 隐藏关系

```
[ContextLayer] 推断出的关系：
  lesson_plan <1:N> block       (via block.lesson_plan_id)
  block <1:N> attachment        (via attachment.block_id)
  homework <1:N> submission     (via submission.homework_id)

[ContextLayer] 导航树：
  roots: [lesson_plan, homework, requirement]
```

## 推荐引擎

推荐引擎使用 Redis sorted set 维护每个用户、每个 session 的实体分数。

### 活动动作

五个内置动作及其分数增量：

| 动作 | 增量 | 说明 |
|------|------|------|
| `referenced` | +10 | 用户显式 @ 引用了实体 |
| `created` | +8 | 实体被创建 |
| `updated` | +5 | 实体被修改 |
| `viewed` | +2 | 实体被查看/打开 |
| `deleted` | -5 | 实体被删除 |

### 可扩展自定义动作

Solution 可以定义超出 5 个内置动作的自定义动作：

```typescript
// 类型安全：CoreActivityAction | (string & {})
type ActivityAction = 'referenced' | 'viewed' | 'created' | 'updated' | 'deleted' | (string & {});
```

自定义动作增量通过 `RecommendEngine` 构造函数的第三个参数传入。手动组装或扩展 `ContextLayerModule` 时提供：

```typescript
const recommend = new RecommendEngine(cacheStore, registry, {
  graded: 7,      // 学生作业被批改
  submitted: 6,   // 作业被提交
  shared: 4,      // 实体被分享给同事
});
```

### 三级可插拔

1. **调权重** — 通过 `recommender.weights` 按实体类型覆盖 `DEFAULT_RECOMMEND_WEIGHTS`
2. **Augment** — 通过 `recommender.augment` 回调后处理推荐结果
3. **Override** — 提供自定义 `RecommendEngine` 替换整个推荐引擎

## Tool-Based 架构

{% hint style="info" %}
**关键设计决策**：Agent 按需通过 MCP tools 获取实体数据，而不是预注入所有引用实体到 prompt 中。
{% endhint %}

用户发送带有 @ 引用的消息时，payload 只包含**轻量级引用**：

```json
{
  "references": [
    { "entityType": "lesson_plan", "entityId": "lp_1", "displayName": "SSS/SAS 新授课教案" },
    { "entityType": "attachment", "entityId": "att_2", "displayName": "SAS判定条件图.png" }
  ]
}
```

Agent 通过 3 个 MCP tools 决定需要完整 resolve 哪些实体：

| 工具 | 用途 |
|------|------|
| `resolve_entity` | 按类型 + ID 获取完整实体数据 |
| `browse_children` | 列出父实体的子实体 |
| `search_entities` | 跨实体类型搜索 |

## Document Edit Provider

`DocumentEditProvider` 抽象基类简化了基于 `@kedge-agentic/entity-document` block 数据的实体 `serialize()` 和 `edit()` 实现。

### 功能

无需为每种实体类型手动实现 serialize → str_replace → save 循环，只需继承 `DocumentEditProvider` 并实现 5 个抽象方法。基类自动处理：

1. **serialize** — 加载实体、转换为 `EntityDocument`、序列化为 Markdown
2. **edit** — 执行编辑操作、将 block 合并回存储格式、保存

### 4 种编辑操作

通过 `POST /context/entity/:type/:id/edit` 端点调用，支持 4 种操作：

| 操作 | 用途 | 处理层 |
|------|------|--------|
| `str_replace` | 在 Markdown 文档中精确替换文本 | 基类 `DocumentEditProvider` |
| `field_set` | 修改元数据字段（frontmatter） | 基类 `DocumentEditProvider` |
| `block_attr_set` | 修改指定 block 的属性（如 callout 的 color） | 需子类实现 |
| `block_content_set` | 修改指定 block 的 content 字段 | 需子类实现 |

{% hint style="warning" %}
`str_replace` 和 `field_set` 由基类 `DocumentEditProvider.edit()` 自动处理。`block_attr_set` 和 `block_content_set` 需要子类 override `edit()` 方法来实现，基类不提供默认处理。
{% endhint %}

### 编辑流程

```
Agent 调用 POST /context/entity/:type/:id/edit
  ↓
Controller 解析 EditOperationDto[]
  ↓
ContextRouter.editEntity() → Provider.edit()
  ↓
DocumentEditProvider.edit():
  1. loadEntity() 加载实体
  2. validateEdit() 检查是否允许编辑
  3. 遍历操作：
     - field_set → 检查 editableFields，收集 metaUpdates
     - str_replace → 调用 strReplace() 更新文档
  4. mergeBlockForStorage() 合并属性回 blocks
  5. saveEntity() 持久化
  6. 返回 { success: true, document: 更新后的 Markdown }
```

### 抽象方法

| 方法 | 返回值 | 用途 |
|------|--------|------|
| `loadEntity(id, userId)` | `Promise<any>` | 从数据存储加载实体 |
| `saveEntity(id, updates, userId)` | `Promise<void>` | 将部分更新持久化到数据存储 |
| `toEntityDocument(entity)` | `EntityDocument` | 将加载的实体转换为 `EntityDocument`（meta + blocks） |
| `getEditableFields()` | `Set<string>` | 哪些 meta 字段允许通过 `field_set` 修改 |
| `getContentToAttrConfig()` | `ContentToAttrConfig` | `splitBlock`/`mergeBlock` 的 attribute 提取配置 |

### 可选 Hook

- `validateEdit(entity, ops)` — 返回 `EditResult` 可在操作执行前拒绝编辑。返回 `null` 表示允许。常用于状态检查（如拒绝已发布的实体编辑）。

### ContentToAttrConfig

控制 block 在序列化和存储之间的属性迁移。某些属性存储在 `content` 中但在文档中表现为 `attributes`：

```typescript
// callout 的 color 存储在 content 中，序列化时提取到 attributes
// ingredient 的 category 同理
const config: ContentToAttrConfig = {
  callout: ['color'],
  ingredient: ['category'],
};
```

- `splitBlockForDocument(block, config)` — 将 content 中的指定字段提取到 attributes（用于序列化前）
- `mergeBlockForStorage(block, config)` — 将 attributes 中的字段合并回 content（用于保存前）

### 使用示例

```typescript
import { DocumentEditProvider } from '@kedge-agentic/context-layer';
import type { EntityDocument, ContentToAttrConfig } from '@kedge-agentic/entity-document';

export class LessonPlanEditProvider extends DocumentEditProvider {
  constructor(private repo: LessonPlanRepository) { super(); }

  async loadEntity(id: string, _userId: string) {
    return this.repo.findOneOrFail(id);
  }

  async saveEntity(id: string, updates: any, _userId: string) {
    await this.repo.update(id, updates);
  }

  toEntityDocument(entity: LessonPlan): EntityDocument {
    return {
      meta: { title: entity.title, subject: entity.subject },
      blocks: entity.blocks.map(b => splitBlockForDocument(b, this.getContentToAttrConfig())),
    };
  }

  getEditableFields() {
    return new Set(['title', 'subject', 'duration']);
  }

  getContentToAttrConfig(): ContentToAttrConfig {
    return { callout: ['color'] };
  }

  // 可选：拒绝已发布实体的编辑
  validateEdit(entity: LessonPlan, ops: EditOperation[]): EditResult | null {
    if (entity.status === 'published') {
      return { success: false, error: '已发布的教案不允许编辑' };
    }
    return null;
  }
}
```

Provider 可直接接入 `EntityContextProvider` — `serialize` 和 `edit` 方法开箱即用。

### 自定义 TransformRegistry

如果实体使用了自定义 block 类型（如 `ingredient`），需要创建自定义 `TransformRegistry` 并在 `serialize()` 和 `edit()` 中使用：

```typescript
import { TransformRegistry } from '@kedge-agentic/entity-document';

const recipeRegistry = TransformRegistry.withDefaults();
recipeRegistry.register('ingredient', ingredientTransform);

export class RecipeProvider extends DocumentEditProvider {
  // override serialize 以使用自定义 registry
  async serialize(id: string, userId: string): Promise<string> {
    const entity = await this.loadEntity(id, userId);
    const doc = this.toEntityDocument(entity);
    return serialize(doc, recipeRegistry);
  }

  // override edit 以确保 str_replace 使用相同 registry
  async edit(id: string, ops: EditOperation[], userId: string): Promise<EditResult> {
    // ... 调用 strReplace(doc, old, new, recipeRegistry)
  }
}
```

{% hint style="warning" %}
**重要**：如果使用了自定义 registry，必须同时 override `serialize()` 和 `edit()` 方法。基类的 `strReplace()` 默认使用 `defaultRegistry`，自定义 block 类型会在 round-trip 中丢失属性。
{% endhint %}

## 前端集成

### AtPicker 组件

`<AtPicker />` 组件提供：

- **当前上下文** — 当提供 `contextEntity` 时，home 视图顶部展示固定的"当前上下文"区域，支持钻入浏览
- **最近使用** — 基于活动评分的最近实体（需要 `sessionId`）
- **搜索** — 防抖跨类型搜索（200ms）
- **钻入浏览** — 通过关系树从父级导航到子级
- **面包屑** — 展示嵌套实体的路径
- **键盘导航** — 方向键、Enter 选中、Escape 关闭、ArrowRight 钻入

#### 实体上下文感知

`contextEntity`（当前正在查看的实体）和 `sessionId`（活动历史）是**两个可组合的独立概念**：

| 场景 | contextEntity | sessionId | Picker 行为 |
|------|--------------|-----------|-------------|
| 分屏视图，首条消息 | recipe | undefined | 置顶显示食谱，无最近使用 |
| 分屏视图，持续对话 | recipe | session123 | 置顶食谱 + 最近使用 |
| 独立 /chat 页 | undefined | session123 | 最近使用 + 类型浏览 |
| 独立 /chat，首条消息 | undefined | undefined | 仅类型浏览 |

`@kedge-agentic/chat-interface` 中的 `MentionPicker` 封装组件额外支持：
- `contextEntity` — 透传给 AtPicker，用于顶部固定区域
- `autoRef` — 为 `true` 时，自动解析实体并添加为引用 pill，使 Agent 在每条消息中都能接收到实体内容

### 内联引用 Pills

选中的实体以**内联 pill 形式显示在 composer 输入框内**（flex-wrap 布局），与 Slack/Discord 的 UX 模式一致。每个 pill 显示实体图标和名称，带移除按钮。

### ContextLayerClient

框架无关的 TypeScript SDK，用于调用 Context Layer API：

```typescript
import { ContextLayerClient } from '@kedge-agentic/context-layer/client';

const client = new ContextLayerClient(
  'http://localhost:3001/api/v1/context',
  () => getAccessToken(),  // 可选：为请求添加 Bearer token
);

const types = await client.getEntityTypes();
const { recents } = await client.suggest(sessionId);
const items = await client.browse('lesson_plan');
const results = await client.search('SAS');
const data = await client.resolve('lesson_plan', 'lp_1');
```

## 配置

### Session Template 快捷入口

Session 模板可以配置工具栏显示哪些实体类型快捷方式以及哪些自动注入：

```typescript
const sessionTemplate = {
  name: '备课助手',
  shortcuts: ['lesson_plan', 'requirement', 'question'],
  autoInject: [
    { entityType: 'lesson_plan', strategy: 'from_trigger' },
  ],
};
```

### 自定义动作权重

按实体类型覆盖默认推荐权重：

```typescript
@Referenceable({
  type: 'lesson_plan',
  // ...
  recommender: {
    weights: {
      session_affinity: 0.5,
      recency: 0.25,
      frequency: 0.1,
      cooccurrence: 0.15,
    },
  },
})
```

完整的 API 端点文档请参阅 [Context Layer API 参考](../api/context-layer.md)。
