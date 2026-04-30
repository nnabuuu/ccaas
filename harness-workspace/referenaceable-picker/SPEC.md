# SPEC.md — Context Layer Referenceable AT Picker (Phase 1-3)

## 目标

在现有 context-layer 模块基础上（已通过 13/13 前 harness 场景），演进实现 AtReference.summary、EntityContext 分层结构、Apply Action 回写、消息 references 字段、edu-platform entity providers，使 12 个 Playwright E2E 场景全部通过。

## Artifact 描述

在已有代码上演进 3 个包 + 1 个 solution module + E2E 测试：

| 包 | 路径 | 职责 |
|----|------|------|
| `@kedge-agentic/context-layer` (core) | `packages/context-layer/src/core/` | +AtReference, +EntityContext, +ApplyAction, +EntityContextProvider, +ContextRouter |
| `@kedge-agentic/context-layer` (nestjs) | `packages/context-layer/src/nestjs/` | +GET /context/entity/:type/:id, +POST /context/apply |
| `@kedge-agentic/context-layer` (client) | `packages/context-layer/src/client/` | +getEntityContext(), +apply() |
| `@kedge-agentic/context-layer-react` | `packages/context-layer-react/src/` | AtPicker summary 显示 + RefPill color prop |
| chat-interface 集成 | `packages/chat-interface/src/components/chat/` | MentionContext.tsx → MentionRef + summary |
| edu-platform providers | `solutions/business/edu-platform/backend/src/referenceable/` | LessonPlan, Template, Requirement providers |
| E2E | `harness-workspace/referenaceable-picker/e2e/` | 12 个 Playwright 场景 |

## 冻结约束（FROZEN — 不得违反）

1. **core/ 零 NestJS 依赖**: `packages/context-layer/src/core/` 下任何文件**不得 import `@nestjs/*`**
2. **现有端点向后兼容**: 7 个已有 `/context/*` 端点的 response 格式不得改变
3. **现有 entity/service 不修改**: LessonPlan entity, ContentBlock entity, LessonPlanTemplate entity, TemplateBlock entity, CurriculumNode, LessonPlanService, TemplateService, CurriculumService 的源文件不得修改
4. **DB schema 不变**: 不得新增或修改数据库表/列
5. **Provider 在 solution 层**: EntityContextProvider 实现放在 `solutions/business/edu-platform/backend/src/referenceable/`，不在 core

## 新增 API 契约

| 端点 | 方法 | 请求 | 返回 |
|------|------|------|------|
| `/context/entity/:type/:id` | GET | URL params: type, id | `EntityContext { ref, structured, relations, attachments }` |
| `/context/apply` | POST | `{ target_type, target_id, field_path, suggested_value, action_description, session_id? }` | `{ success: boolean, error?: string }` |

## 现有端点（必须向后兼容）

| 端点 | 方法 | 返回格式（不得改变） |
|------|------|---------------------|
| `/context/entity-types` | GET | `{ types: EntityTypeInfo[], tree: RelationTree }` |
| `/context/suggest` | GET | `{ recents: RecentItem[], recommended: RecommendedItem[] }` |
| `/context/browse?type=X` | GET | `{ items: BrowseItem[], breadcrumb: Breadcrumb[] }` |
| `/context/search?q=X` | GET | `{ results: SearchResult[] }` |
| `/context/resolve?type=X&id=Y` | GET | `{ entity: ResolvedEntity }` |
| `/context/activity` | POST | 记录活动 |
| `/context/shortcuts` | GET/PUT | 用户快捷入口 |

## 新增类型定义（来自设计文档）

```typescript
interface AtReference {
  type: string;
  id: string;
  display_name: string;
  summary: string;        // ≤100 字，由 solution 层 provider 定义
}

interface EntityContext {
  ref: AtReference;
  structured: Record<string, any>;
  relations: AtReference[];
  attachments: EntityAttachment[];
}

interface EntityAttachment {
  name: string;
  path: string;
  mime_type: string;
  size_bytes: number;
}

interface ApplyAction {
  id: string;
  target: AtReference;
  field_path: string;
  suggested_value: any;
  description: string;
  status: 'pending' | 'applied' | 'outdated';
  applied_at?: string;
}

interface ApplyRequest {
  entity_id: string;
  field_path: string;
  suggested_value: any;
  action_description: string;
  session_id: string;
}

interface EntityContextProvider {
  getContext(id: string, userId: string): Promise<EntityContext>;
  search(query: string, userId: string, limit: number): Promise<AtReference[]>;
  apply?(req: ApplyRequest, userId: string): Promise<{ success: boolean; error?: string }>;
}
```

## 12 个验证场景（摘要）

| # | 场景 | 核心验证点 |
|---|------|-----------|
| 1 | EntityContext 获取 | GET /context/entity/lesson_plan/{id} 返回完整 EntityContext |
| 2 | AtReference summary | ref.summary ≤100 字，含 class + subject + lesson_type |
| 3 | Relations 正确 | lesson_plan relations 包含 requirement AtRef |
| 4 | Template EntityContext | structured 含 block_summary |
| 5 | Requirement EntityContext | structured 含 name, level, subject |
| 6 | Provider search + summary | search 返回 AtReference[] 含 summary |
| 7 | Apply Action 成功 | POST /context/apply → 字段更新成功 |
| 8 | Apply 业务规则 | 已发布教案的 apply 处理 |
| 9 | Picker summary 显示 | recent items 显示 summary |
| 10 | 消息 references | MentionRef 含 summary |
| 11 | Apply 按钮渲染 | apply_action block 渲染为按钮 |
| 12 | 向后兼容 | 现有 browse/search/suggest/resolve 端点正常 |

详细场景描述见 HARNESS_SPEC.md。

## Edu-Platform Provider 概要

| Provider | Service 方法 | summary 格式 |
|----------|-------------|-------------|
| LessonPlan | `LessonPlanService.findOne()`, `.findAll()`, `.update()` | `{class} {subject} {lesson_type} 教案 {duration}分钟` |
| Template | `TemplateService.findOne()`, `.findAll()` | `{name} ({scope}作用域) {lesson_type}模板 v{version}` |
| Requirement | `CurriculumService.search()`, 直接查询 | `{subject} {name}` (+ grade_range) |

## 启动命令

```bash
# Edu-platform backend
cd solutions/business/edu-platform/backend && npm run dev   # → :3001

# E2E tests
cd harness-workspace/referenaceable-picker/e2e && npx playwright test
```

## 设计文档参考

完整设计文档：`reference/CCaaS-Referenceable-AtPicker.md`

关键内容：
- AtReference 类型定义（含 summary 字段）
- EntityContext 分层结构
- ApplyAction 回写机制
- EntityContextProvider 接口
- Edu-platform provider 实现示例
