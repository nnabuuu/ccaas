# SPEC.md — Context Layer @ Reference Picker

## 目标

从设计文档（`reference/Jijian-Context-Layer.md`）出发，实现完整的 Context Layer 模块 + @ picker 前端 + mock education solution，使 13 个 Playwright E2E 场景全部通过。

## Artifact 描述

4 个代码包 + 1 个 mock solution + E2E 测试：

| 包 | 路径 | 职责 |
|----|------|------|
| `@kedge-agentic/context-layer` (core) | `packages/context-layer/src/core/` | 纯 TS 实现：EntityRegistry, RelationInferrer, ActivityEmitter, RecommendEngine, ContextInjector, ShortcutManager |
| `@kedge-agentic/context-layer` (nestjs) | `packages/context-layer/src/nestjs/` | NestJS 薄壳：Module, Decorator, Interceptor, Controller |
| `@kedge-agentic/context-layer` (client) | `packages/context-layer/src/client/` | ContextLayerClient SDK：纯 TS，任意环境可用 |
| `@kedge-agentic/context-layer-react` | `packages/context-layer-react/src/` | AtPicker React 组件 + hooks |
| chat-interface 集成 | `packages/chat-interface/src/components/chat/` | MentionPicker.tsx + MentionContext.tsx（仅新增文件） |
| mock solution | `solutions/mock/context-layer-demo/` | TypeORM + SQLite，seed 教育数据，`ContextLayerModule.forRoot()` |
| E2E | `harness-workspace/reference-picker-core-module/e2e/` | 13 个 Playwright 场景 |

## 冻结约束（FROZEN — 不得违反）

1. **core/ 零 NestJS 依赖**: `packages/context-layer/src/core/` 下任何文件**不得 import `@nestjs/*`**
2. **不修改 ChatInterfaceComposer.tsx**: chat-interface 的 `ChatInterfaceComposer.tsx` 现有代码不得修改。@ picker 通过 overlay + `useChatCore()` 实现
3. **mock solution 独立**: `solutions/mock/context-layer-demo/` 不得 import `solutions/business/edu-platform/` 的任何代码
4. **API schema 对齐**: 所有 API response schema 严格对齐设计文档 Section 7.1
5. **Decorator 纯 SetMetadata**: `@Referenceable` 和 `@Tracked` 只调用 `SetMetadata`，零运行时逻辑

## API 契约（来自设计文档 Section 7.1）

| 端点 | 方法 | 返回 |
|------|------|------|
| `/context/entity-types` | GET | `{ types: EntityTypeInfo[], tree: RelationTree }` |
| `/context/suggest` | GET | `{ recents: RecentItem[], recommended: RecommendedItem[] }` |
| `/context/browse?type=X` | GET | `{ items: BrowseItem[], breadcrumb: Breadcrumb[] }` |
| `/context/browse?type=X&parentId=Y` | GET | 子资源列表（drill-down） |
| `/context/search?q=X` | GET | `{ results: SearchResult[] }` |
| `/context/resolve?type=X&id=Y` | GET | `{ entity: ResolvedEntity }` |
| `/context/activity` | POST | 记录活动 |
| `/context/shortcuts` | GET/PUT | 用户快捷入口 |

## 13 个验证场景（摘要）

| # | 场景 | 核心验证点 |
|---|------|-----------|
| 1 | 基本 @ 弹出 | picker 显示 recents + 类型菜单 |
| 2 | 按类型浏览 | 点击教案 → 列表 + ▶ + [选择] |
| 3 | 钻入子资源 | ▶ 进入内容块列表 + 面包屑 |
| 4 | 三级钻入 | 内容块 → 附件列表 |
| 5 | 选中 → pill | 选择附件 → picker 关闭 → pill 显示 |
| 6 | 多实体引用 | 两个 pill 并排 + × |
| 7 | 搜索 | 输入"SAS" → 跨类型搜索结果 |
| 8 | 搜索面包屑 | att_2 显示面包屑 "📝 SSS/SAS教案 › 📦 SAS 概念讲解" |
| 9 | 工具栏快捷入口 | 点击 pill → 直接进入类型列表 |
| 10 | session template shortcuts | 不同 template 不同 shortcuts |
| 11 | 返回导航 | 面包屑逐级返回到首页 |
| 12 | recents 更新 | 选中 att_2 后再次 @ → att_2 在 recents 中 |
| 13 | 自动注入 | autoInject=lesson_plan:lp_1 → pill 已显示 |

详细场景描述见 HARNESS_SPEC.md。

## Mock Seed 数据

10 个实体类型，约 40 条 seed 记录。详见 HARNESS_SPEC.md "Mock Solution Seed Data" 章节。

3 个 session templates: `lesson-prep`, `grading`, `classroom`，各有不同 shortcuts。

## 启动命令

```bash
# Mock solution backend
cd solutions/mock/context-layer-demo && npm run dev   # → :3021

# Chat interface dev server
cd packages/chat-interface && npm run dev              # → :5173
# VITE_CONTEXT_LAYER_URL=http://localhost:3021/context

# E2E tests
cd harness-workspace/reference-picker-core-module && npx playwright test
```

## 设计文档参考

完整设计文档：`reference/Jijian-Context-Layer.md`（约 54KB，v9）

关键 section：
- Section 3: Decorator 设计（@Referenceable, @Tracked）
- Section 4: EntityRegistry + RelationInferrer
- Section 5: Activity Tracker + RecommendEngine
- Section 6: Context Injector
- Section 7: API 契约 + Response Schema
- Section 8: Consumer Layer（ContextLayerClient）
- Section 9: 前端 @ picker
- Section 10: NestJS 接入层
- Section 12: 教育 Solution 产品逻辑（13 个 Gherkin 场景 + mock 数据）
