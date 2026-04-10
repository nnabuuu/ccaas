# Harness Specification: Context Layer — @ Reference Picker

## Task
- **Artifact**: `@kedge-agentic/context-layer`（core + nestjs + client）+ `@kedge-agentic/context-layer-react`（AtPicker）+ `chat-interface` 集成 + mock education solution
- **Current state**: 设计文档 v9 完成（`reference/Jijian-Context-Layer.md`），零代码
- **Target audience**: Solution builder（教育、CRM 等场景），使用 NestJS 后端 + React 前端
- **Goal**: 从设计文档出发，实现完整的 Context Layer 模块 + @ picker 前端，13 个 Playwright E2E 场景全部通过

## Frozen Constraints
- `core/` 目录下的任何文件**不得 import `@nestjs/*`**（纯 TS，零框架依赖）
- **不得修改** `chat-interface` 的核心逻辑（ChatInterfaceComposer.tsx 的现有代码不改）；@ picker 通过 overlay 组件 + `useChatCore()` context 实现
- mock solution **不得 import** `solutions/business/edu-platform/` 的任何代码
- 所有 API response schema 必须**严格对齐**设计文档 Section 7.1
- `@Referenceable` 和 `@Tracked` decorator **只做 SetMetadata**，零运行时逻辑

## Code Locations

```
packages/
  context-layer/                    ← @kedge-agentic/context-layer
    src/
      core/                         ← 纯 TS，零框架依赖
        entity-registry.ts
        relation-inferrer.ts
        activity-emitter.ts
        recommend-engine.ts
        context-injector.ts
        shortcut-manager.ts
        interfaces.ts
      client/                       ← ContextLayerClient SDK
        context-layer-client.ts
        types.ts
      nestjs/                       ← NestJS 薄壳
        context-layer.module.ts
        context-layer.decorator.ts
        context-layer.interceptor.ts
        context-layer.controller.ts
        context-layer.constants.ts
    package.json
    tsconfig.json

  context-layer-react/              ← @kedge-agentic/context-layer-react
    src/
      AtPicker.tsx                  ← 独立 @ picker 组件
      AtPickerProvider.tsx          ← Context provider
      hooks/
        useContextLayer.ts          ← ContextLayerClient React wrapper
        useEntityTypes.ts
        useSuggest.ts
        useBrowse.ts
        useSearch.ts
      components/
        RecentsSection.tsx
        TypeBrowseSection.tsx
        DrillDownView.tsx
        SearchResults.tsx
        BreadcrumbNav.tsx
        RefPill.tsx
    package.json

  chat-interface/                   ← 现有包，仅添加文件
    src/components/chat/
      MentionPicker.tsx             ← 新增：overlay 组件，监听 @ 触发 AtPicker
      MentionContext.tsx            ← 新增：引用状态管理

solutions/mock/
  context-layer-demo/               ← mock education solution
    src/
      app.module.ts                 ← NestJS + ContextLayerModule.forRoot()
      entities/                     ← TypeORM 实体（LessonPlan, Block, Attachment, etc.）
      controllers/                  ← @Referenceable 标记的 controllers
      seed/                         ← SQLite seed 数据（对齐设计文档 12.5 mock 数据）
    package.json
    tsconfig.json

harness-workspace/reference-picker-core-module/
  e2e/                              ← Playwright E2E 测试
    at-picker.spec.ts               ← 13 个场景
    playwright.config.ts
  reference/                        ← 设计文档（已存在）
  progress.md                       ← 迭代日志
  changelogs/                       ← 每版变更记录
  eval-reports/                     ← 评估报告
```

## Eval Rubric

### Scoring Dimensions

| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| 1 | 场景通过率 | 35/100 | Playwright E2E: `passed / 13 * 35` |
| 2 | 架构合规性 | 30/100 | 静态分析 import 边界 + 分包结构检查 + decorator 实现审查 |
| 3 | TypeScript 正确性 | 15/100 | `tsc --noEmit` 零错误 + 接口与设计文档对齐检查 |
| 4 | 性能 SLA | 8/100 | suggest 响应时间 < 50ms、search debounce 验证、drill-down < 200ms |
| 5 | 前端交互质量 | 8/100 | @ picker 弹出流畅、面包屑正确渲染、返回导航可用、ref pill 正确显示 |
| 6 | 代码规范 | 4/100 | CCAAS conventions、无冗余代码、ESLint 通过 |

### Dimension Details

#### 1. 场景通过率 (35/100)
- **5/5**: 13/13 场景全部通过
- **3/5**: 10-12/13 场景通过，失败的不涉及核心交互（search/drill-down）
- **1/5**: < 7/13 场景通过，基本交互不可用
- **Detection**: `npx playwright test --reporter=json` → 解析 passed/failed 计数

#### 2. 架构合规性 (30/100)
- **5/5**: core/ 零 NestJS import；nestjs/ 只调 core 接口；client/ 独立；context-layer-react 只依赖 client；chat-interface 只添加新文件，未改现有文件；mock solution 完全独立
- **3/5**: 分层基本正确但有 1-2 处轻微越界（如 core 里用了 NestJS 的 type import）
- **1/5**: 分层混乱，core 直接依赖 NestJS 或 Redis 具体实现
- **Detection**: `grep -r "@nestjs" packages/context-layer/src/core/` 必须为空；`git diff packages/chat-interface/src/components/chat/ChatInterfaceComposer.tsx` 必须无改动（仅允许新增文件）

#### 3. TypeScript 正确性 (15/100)
- **5/5**: `tsc --noEmit` 零错误；所有 interface 与设计文档 Section 3/7 完全对齐（ReferenceableOptions, ActivityRecord, EntityTypesResponse, SuggestResponse, BrowseResponse, SearchResponse, ResolveResponse）
- **3/5**: < 5 个 type 错误且不涉及 public API；interface 基本对齐
- **1/5**: > 10 个 type 错误或 public interface 与设计文档不符
- **Detection**: `npx tsc --noEmit 2>&1 | wc -l`；手动比对 interfaces.ts 与设计文档

#### 4. 性能 SLA (8/100)
- **5/5**: suggest API < 50ms（Playwright 可用 `performance.now()` 测量）；search 有 200ms debounce；drill-down browse < 200ms
- **3/5**: suggest < 100ms；有 debounce 但时间不精确
- **1/5**: suggest > 200ms 或无 debounce
- **Detection**: Playwright E2E 中插入 `performance.mark` 测量 API 响应时间

#### 5. 前端交互质量 (8/100)
- **5/5**: @ picker 弹出有动画过渡；面包屑逐级正确；返回导航到任意层级均可用；ref pill 显示 icon + displayName + ×；多实体引用并排显示
- **3/5**: 功能正确但无动画；面包屑偶有错误
- **1/5**: picker 弹出但交互卡顿或视觉残缺
- **Detection**: Playwright 截图 + 视觉检查；DOM 结构断言

#### 6. 代码规范 (4/100)
- **5/5**: 遵循 CCAAS 命名规范；Controller 有 `@ApiTags`；无 TODO/FIXME；无冗余代码
- **3/5**: 1-2 处规范违反
- **1/5**: 大量规范违反或存在明显冗余
- **Detection**: ESLint + 手动审查

### Penalty Rules
- **P1 (致命)**: core/ 下 import `@nestjs/*` → 架构合规性直接 0/30
- **P2 (致命)**: 修改 ChatInterfaceComposer.tsx 的现有代码 → 架构合规性直接 0/30
- **P3 (致命)**: mock solution import edu-platform 代码 → 架构合规性直接 0/30
- **P4 (严重)**: API response schema 与设计文档不符 → TypeScript 正确性 -5
- **P5 (一般)**: decorator 内含运行时逻辑（不是纯 SetMetadata）→ 架构合规性 -10

### Threshold
- **Pass score**: 65/100（至少 9/13 场景通过 + 架构基本合规 + 零 tsc 错误）
- **Target score**: 90/100（13/13 场景 + 完美架构 + 性能达标）

## 13 个 Playwright E2E 场景

每个场景对应设计文档 Section 12.6 的 Gherkin scenario。

### Scenario 1: 基本 @ 弹出
```
Given: 打开 mock solution 的 chat 页面
When: 在输入框中键入 @
Then: picker 弹出，显示"最近使用"区域和"按类型浏览"菜单
And: 最近使用包含 mockRecents 数据（教案、作业、附件）
And: 按类型浏览包含 tree.roots 中的所有顶层类型
```

### Scenario 2: 按类型浏览 → 顶层列表
```
Given: picker 已弹出
When: 点击"📝 教案"
Then: 显示教案列表（4 条 mockLessonPlans）
And: 每行旁有 ▶ 按钮（lesson_plan 在 tree.relations 中作为 parent）
And: 每行旁有 [选择] 按钮
And: 顶部有"← 返回"和面包屑
```

### Scenario 3: 钻入子资源
```
Given: 在教案列表中
When: 点击"SSS/SAS 新授课教案"旁的 ▶
Then: 显示内容块列表（4 条 mockBlocks_lp1）
And: "SAS 概念讲解"旁有 ▶（hasChildren: true）
And: "即时练习"和"小结"旁没有 ▶（hasChildren: false）
And: 面包屑显示 "← 教案 › SSS/SAS 新授课教案 | 📦 内容块"
```

### Scenario 4: 三级钻入
```
Given: 在 lp_1 的内容块列表中
When: 点击"SAS 概念讲解"旁的 ▶
Then: 显示附件列表（2 条 mockAttachments_blk2）
And: 附件没有 ▶（attachment 不是 parent）
And: 面包屑显示 "← 内容块 › SAS 概念讲解 | 📎 附件"
```

### Scenario 5: 选中实体 → 引用 pill
```
Given: 在附件列表中
When: 点击"SAS判定条件图.png"的 [选择]
Then: picker 关闭
And: 输入框上方出现 pill "[📎 SAS判定条件图.png ×]"
```

### Scenario 6: 多实体引用
```
Given: 已引用 att_2
When: 再次 @ → 选中 lp_1
Then: 输入框上方显示两个 pill
And: 两个 pill 并排显示，各有 × 按钮
```

### Scenario 7: 搜索
```
Given: picker 已弹出
When: 在搜索框输入"SAS"并等待 300ms
Then: 最近使用和类型菜单被搜索结果替换
And: 搜索结果包含多种类型（教案、作业、附件等）
And: 子实体带面包屑，顶层实体不带面包屑
```

### Scenario 8: 搜索结果面包屑
```
Given: 搜索"SAS判定条件图"
Then: 附件 att_2 的结果显示面包屑：
  "📝 SSS/SAS教案 › 📦 SAS 概念讲解"
```

### Scenario 9: 工具栏快捷入口
```
Given: 页面加载完成
When: 点击输入框下方的"📖 课标"pill
Then: picker 弹出并直接进入课标类型列表（跳过最近使用+菜单）
```

### Scenario 10: 不同 session template 的 shortcuts
```
Given: URL 参数指定 sessionTemplate=grading
Then: 工具栏显示 📋 作业 / 📊 学情分析 / ❓ 题目
And: 不显示备课模板的 📝 教案 / 📖 课标
```

### Scenario 11: 返回导航
```
Given: 已钻入到 lp_1 → blk_2 → 附件列表
When: 点击面包屑中的"← 内容块"
Then: 回到 lp_1 的内容块列表
When: 点击"← 教案"
Then: 回到教案列表
When: 点击"← 返回"
Then: 回到 picker 首页（最近使用 + 类型菜单）
```

### Scenario 12: recents 更新（activity tracking）
```
Given: 选中了 attachment att_2
When: 关闭 picker，再次 @
Then: att_2 出现在最近使用列表中（排名靠前）
And: att_2 带面包屑
```

### Scenario 13: 自动注入（session context）
```
Given: URL 参数指定 autoInject=lesson_plan:lp_1
Then: 输入框上方已显示 pill "[📝 SSS/SAS 新授课教案]"（自动注入，无需手动 @）
And: 用户可以直接输入消息，引用实体随消息一起发送
```

## Agent Architecture

### Generator
- **Role**: 从设计文档出发，逐步实现所有包的代码。每轮基于 evaluator 反馈修复问题。
- **Perspective**: 你是一个 TypeScript 全栈工程师，精通 NestJS + React + TypeORM。你正在实现一个平台级 npm 模块。每个包必须严格遵循分层架构——core 是纯 TS，nestjs 是薄壳，client 是消费者 SDK。
- **Input**: `HARNESS_SPEC.md` + `reference/Jijian-Context-Layer.md`（设计文档）+ `eval-reports/v{N-1}-eval.md`（上轮评估）+ `progress.md`
- **Output**: 所有包的代码 + `changelogs/v{N}-changelog.md`
- **Key instructions**:
  1. 第一轮优先实现 mock solution + context-layer core + AtPicker，确保 Scenario 1-5 先通过
  2. 第二轮补全 search + drill-down + breadcrumb，确保 Scenario 6-8 通过
  3. 后续轮次修复 evaluator 指出的具体问题
  4. 每轮只修复 evaluator 报告中最高优先级的 3-5 个问题，不要大范围重写
  5. 新增的 chat-interface 文件放在 `src/components/chat/` 下，不修改现有文件

### Evaluator
- **Role**: 独立评估 Generator 的输出，产出详细评分报告。
- **Perspective**: 你是一个严格的代码审查者 + QA 工程师。你**没有参与代码编写**，只关心结果是否满足 HARNESS_SPEC.md 的标准。对架构违规零容忍。
- **Input**: `HARNESS_SPEC.md` + Generator 输出的代码 + `reference/Jijian-Context-Layer.md`
- **Output**: `eval-reports/v{N}-eval.md`
- **Isolation**: 独立上下文（mandatory）——不得复用 Generator 的 context window
- **Evaluation steps**:
  1. **tsc 检查**: `cd packages/context-layer && npx tsc --noEmit` + 同理 context-layer-react + mock solution
  2. **架构合规检查**:
     - `grep -r "from '@nestjs" packages/context-layer/src/core/` 必须为空
     - `git diff --name-only packages/chat-interface/src/components/chat/ChatInterfaceComposer.tsx` 必须无改动
     - `grep -r "from '.*edu-platform" solutions/mock/context-layer-demo/` 必须为空
     - 检查 decorator 实现：`@Referenceable` 和 `@Tracked` 只调用 `SetMetadata`
  3. **Playwright E2E**: 启动 mock solution + chat-interface dev server → `npx playwright test`
  4. **性能测量**: E2E 中 suggest API 响应时间检查
  5. **接口对齐检查**: 比对 `interfaces.ts` 与设计文档 Section 7.1 的 response schema
  6. **评分**: 按 rubric 打分，写入 eval report

### Harness Orchestrator
- **Role**: 管理 Generator-Evaluator 循环。读 progress.md，决定下一轮 focus。
- **Perspective**: 你是项目经理。根据 eval report 决定优先级——先修红线违规，再修失败场景，最后优化性能和交互。
- **Input**: `progress.md` + latest `eval-reports/v{N}-eval.md`
- **Output**: 更新 `progress.md` + 决定是否继续或终止

## Exit Conditions
- **成功退出**: 总分 ≥ 90/100 且 13/13 场景通过
- **合格退出**: 总分 ≥ 75/100 且 11/13 场景通过 且无 P1/P2/P3 致命 penalty
- **最大轮次**: 12 轮
- **递减退出**: 连续 3 轮总分提升 < 3 分 → 退出并报告瓶颈
- **致命错误**: 如果连续 2 轮存在 P1/P2/P3 penalty → 暂停，需要人工介入

## Progress Tracking
- **Log file**: `progress.md`
- **Per-iteration record**:
  - Version number (v1, v2, ...)
  - Timestamp
  - Total score (XX/100)
  - Per-dimension scores
  - Scenarios passed: X/13 (list which passed/failed)
  - Key changes summary
  - Evaluator's top 3 unresolved issues
  - Generator's next focus

## Mock Solution Seed Data

mock solution 使用 TypeORM + SQLite（内存模式），启动时自动 seed 以下数据（对齐设计文档 Section 12.5）：

### 实体类型 (10 个)
```
lesson_plan, block, attachment, exercise, homework,
submission, requirement, question, session_record, analytics
```

### Seed 数据量
| 实体 | 数量 | 关键 mock 数据 |
|------|------|---------------|
| lesson_plan | 4 | lp_1 ~ lp_4（设计文档 mockLessonPlans） |
| block | 4 per lp_1 | blk_1 ~ blk_4（mockBlocks_lp1） |
| attachment | 2 per blk_2 | att_1, att_2（mockAttachments_blk2） |
| homework | 2 | hw_1, hw_2（mockHomework） |
| submission | 3 per hw | sub_1 ~ sub_6 |
| requirement | 3 | req_1 ~ req_3 |
| question | 5 | q_1 ~ q_5（含 SAS 相关） |
| exercise | 2 per lp | ex_1 ~ ex_8 |
| session_record | 2 | sr_1 ~ sr_2 |
| analytics | 2 | ana_1 ~ ana_2 |

### Session Templates
```typescript
{
  'lesson-prep': { shortcuts: ['lesson_plan', 'requirement', 'question'] },
  'grading': { shortcuts: ['homework', 'analytics', 'question'] },
  'classroom': { shortcuts: ['lesson_plan', 'exercise', 'session_record'] },
}
```

## Startup Commands

```bash
# Mock solution backend（含 context-layer module）
cd solutions/mock/context-layer-demo && npm run dev   # → :3021

# Chat interface dev server（含 @ picker 集成）
cd packages/chat-interface && npm run dev              # → :5173
# 需要环境变量：VITE_CONTEXT_LAYER_URL=http://localhost:3021/context

# E2E tests
cd harness-workspace/reference-picker-core-module && npx playwright test
```

## Estimated Resource Usage
- **Iterations**: ~8-12 expected（前 3 轮建立基础结构，后续轮次修复场景）
- **Tokens per iteration**: ~80K (generator) + ~30K (evaluator)
- **Total estimated**: ~1.3M tokens (~$15-20)
