# Harness Specification: Context Layer — Referenceable AT Picker (Phase 1-3)

## Task
- **Artifact**: 演进 `@kedge-agentic/context-layer`（core + nestjs + client）+ `@kedge-agentic/context-layer-react`（AtPicker + RefPill）+ `chat-interface` 集成 + edu-platform entity providers
- **Current state**: context-layer 已有 EntityRegistry, RecommendEngine, AtPicker, browse/search/resolve 端点（前 harness `reference-picker-core-module` 产出，13/13 场景通过）
- **Target audience**: Solution builder（教育场景），使用 NestJS 后端 + React 前端
- **Goal**: 在现有 context-layer 基础上新增 AtReference.summary、EntityContext 分层结构、Apply Action 回写、消息 references 字段、edu-platform entity providers，12 个 Playwright E2E 场景全部通过

## Frozen Constraints
1. `core/` 目录下的任何文件**不得 import `@nestjs/*`**（纯 TS，零框架依赖）— 延续前 harness
2. 现有 7 个 `/context/*` 端点（entity-types, suggest, browse, search, resolve, activity, shortcuts）的 API response **不得变更**（向后兼容）
3. 现有 entity 文件**不得修改**（DB schema 不变）— LessonPlan, ContentBlock, LessonPlanTemplate, TemplateBlock, CurriculumNode 等
4. LessonPlanService / TemplateService / CurriculumService **不修改**（只复用其现有方法）
5. Edu-platform providers 放在 `solutions/business/edu-platform/backend/src/referenceable/` 目录下

## Code Locations

```
packages/
  context-layer/                    ← @kedge-agentic/context-layer（已存在，演进）
    src/
      core/                         ← 纯 TS，零框架依赖
        interfaces.ts               ← 改：+AtReference, +EntityContext, +EntityAttachment, +ApplyAction, +EntityContextProvider, +ApplyRequest
        entity-registry.ts          ← 改：+registerProvider(), +getProvider()
        context-router.ts           ← 新建：EntityContext 路由 + Apply 路由逻辑
        (其他文件保持不变)
      client/                       ← ContextLayerClient SDK
        context-layer-client.ts     ← 改：+getEntityContext(), +apply()
      nestjs/                       ← NestJS 薄壳
        context-layer.controller.ts ← 改：+GET /context/entity/:type/:id, +POST /context/apply

  context-layer-react/              ← @kedge-agentic/context-layer-react（已存在，演进）
    src/
      AtPicker.tsx                  ← 改：summary 显示在 browse/search/recent items 中
      components/
        RefPill.tsx                 ← 改：color prop 支持（使用 EntityRegistry 注册的 color）

  chat-interface/                   ← 现有包
    src/components/chat/
      MentionContext.tsx            ← 改：MentionRef 增加 summary 字段

solutions/business/edu-platform/
  backend/src/
    referenceable/                  ← 新建整个目录
      providers/
        lesson-plan.provider.ts     ← 新建：LessonPlan EntityContextProvider
        template.provider.ts        ← 新建：Template EntityContextProvider
        requirement.provider.ts     ← 新建：Requirement EntityContextProvider
      referenceable.module.ts       ← 新建：注册 providers 到 EntityRegistry
      referenceable.service.ts      ← 新建：Provider 编排服务
    app.module.ts                   ← 改：+import ReferenceableModule

harness-workspace/referenaceable-picker/
  e2e/                              ← Playwright E2E 测试
    referenceable.spec.ts           ← 12 个场景
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
| D1 | 场景通过率 | 35/100 | Playwright E2E: `passed / 12 * 35` |
| D2 | 架构合规性 | 25/100 | 静态分析 import 边界 + provider 分层 + 现有端点向后兼容 |
| D3 | TypeScript 正确性 | 15/100 | `tsc --noEmit` 零错误 + 新增类型与设计文档对齐 |
| D4 | EntityContext 数据质量 | 15/100 | summary ≤100 字、relations 正确、structured 完整 |
| D5 | 前端交互 | 10/100 | summary 显示、apply 按钮渲染、color pill |

### Dimension Details

#### D1: 场景通过率 (35/100)
- **5/5 (35分)**: 12/12 场景全部通过
- **4/5 (28分)**: 10-11/12 场景通过
- **3/5 (21分)**: 8-9/12 场景通过
- **2/5 (14分)**: 6-7/12 场景通过
- **1/5 (7分)**: < 6/12 场景通过
- **Detection**: `npx playwright test --reporter=json` → 解析 passed/failed 计数

#### D2: 架构合规性 (25/100)
- **5/5 (25分)**: 完美分层
  - core/ 零 NestJS import
  - 现有 7 个端点 response 不变
  - provider 注册在 solution 层（ReferenceableModule），不在 core
  - DB schema 零修改
  - LessonPlanService / TemplateService / CurriculumService 未被修改
- **4/5 (20分)**: 基本正确，1 处轻微越界
- **3/5 (15分)**: 1-2 处越界但不影响运行时
- **2/5 (10分)**: 分层有问题但核心思路正确
- **1/5 (5分)**: 分层混乱
- **Detection**:
```bash
# P1: core 不得 import NestJS
grep -r "from '@nestjs" packages/context-layer/src/core/
# 必须为空

# P2: 现有端点 response 不变
# curl 验证 entity-types, suggest, browse, search, resolve, shortcuts 返回格式不变

# P3: 现有 entity/service 文件不变
git diff --name-only solutions/business/edu-platform/backend/src/lesson-plan/
git diff --name-only solutions/business/edu-platform/backend/src/template/
git diff --name-only solutions/business/edu-platform/backend/src/curriculum/
# 必须无输出

# P4: Provider 在 solution 层
ls solutions/business/edu-platform/backend/src/referenceable/providers/
# 应有 lesson-plan.provider.ts, template.provider.ts, requirement.provider.ts
```

#### D3: TypeScript 正确性 (15/100)
- **5/5 (15分)**: `tsc --noEmit` 零错误；新增 interface 与设计文档完全对齐
  - AtReference（type, id, display_name, summary）
  - EntityContext（ref, structured, relations, attachments）
  - EntityAttachment（name, path, mime_type, size_bytes）
  - ApplyAction（id, target, field_path, suggested_value, description, status, applied_at?）
  - EntityContextProvider（getContext, search, apply?）
  - ApplyRequest（entity_id, field_path, suggested_value, action_description, session_id）
- **4/5 (12分)**: 零 tsc 错误；interface 基本对齐但 1-2 处字段差异
- **3/5 (9分)**: < 5 个 tsc 错误且不涉及 public API
- **2/5 (6分)**: 5-10 个 tsc 错误
- **1/5 (3分)**: > 10 个 tsc 错误或 public interface 与设计文档严重不符
- **Detection**:
```bash
cd packages/context-layer && npx tsc --noEmit 2>&1 | wc -l
cd packages/context-layer-react && npx tsc --noEmit 2>&1 | wc -l
cd solutions/business/edu-platform/backend && npx tsc --noEmit 2>&1 | wc -l
```

#### D4: EntityContext 数据质量 (15/100)
- **5/5 (15分)**:
  - LessonPlan summary ≤100 字，包含 class_name + subject + lesson_type
  - LessonPlan relations 包含关联的 requirement AtRef（如果 requirement_id 存在）
  - Template structured 包含 block_summary
  - Requirement structured 包含层级路径信息
- **4/5 (12分)**: summary 正确但 relations 缺漏 1-2 个
- **3/5 (9分)**: summary 存在但超过 100 字或信息不全
- **2/5 (6分)**: EntityContext 返回但结构不完整
- **1/5 (3分)**: EntityContext 端点不可用
- **Detection**: curl 调用 + JSON 结构验证

#### D5: 前端交互 (10/100)
- **5/5 (10分)**: summary 在 picker 列表中正确显示；apply 按钮可渲染；RefPill 使用注册的 color
- **4/5 (8分)**: summary 显示正确但 apply 按钮缺失
- **3/5 (6分)**: 功能基本正确但样式有瑕疵
- **2/5 (4分)**: 部分功能可用
- **1/5 (2分)**: 前端改动不可用
- **Detection**: Playwright DOM 断言 + 截图

### Penalty Rules
| ID | 级别 | 触发条件 | 影响 |
|----|------|---------|------|
| P1 | 致命 | core/ 下 import `@nestjs/*` | D2 直接 0/25 |
| P2 | 致命 | 现有 7 个端点 response 格式改变（向后不兼容） | D2 直接 0/25 |
| P3 | 严重 | 修改现有 entity 文件或 service 文件 | D2 -15 |
| P4 | 严重 | API response schema 与设计文档不符 | D3 -5 |
| P5 | 一般 | Provider 实现放在 core/ 而非 solution 层 | D2 -10 |

### Threshold
- **Pass score**: 65/100（至少 8/12 场景通过 + 架构基本合规 + 零 tsc 错误）
- **Target score**: 90/100（12/12 场景 + 完美架构 + 数据质量达标）

## 12 个 Playwright E2E 场景

基于 edu-platform 真实后端（非 mock solution），测试新增的 EntityContext / Apply / Summary 功能。

### Scenario 1: EntityContext 获取 — LessonPlan
```
Given: edu-platform backend 启动在 :3001
When: GET /context/entity/lesson_plan/{id}
Then: 返回 EntityContext JSON
And: 包含 ref（type, id, display_name, summary）
And: 包含 structured（title, class_id, subject, lesson_type, duration_minutes, blocks, status）
And: 包含 relations（AtReference[]）
And: 包含 attachments（EntityAttachment[]，可以为空数组）
```

### Scenario 2: AtReference summary — LessonPlan
```
Given: 获取 lesson_plan 的 EntityContext
Then: ref.summary ≤ 100 字
And: summary 包含 class 信息（resolved class name）
And: summary 包含 subject 信息
And: summary 包含 lesson_type
```

### Scenario 3: Relations 正确 — LessonPlan
```
Given: 获取一个关联了 requirement 的 lesson_plan 的 EntityContext
Then: relations 中包含至少一个 type='requirement' 的 AtReference
And: 该 AtReference 有 display_name 和 summary
```

### Scenario 4: Template EntityContext
```
Given: GET /context/entity/template/{id}
Then: 返回 EntityContext JSON
And: ref.summary 包含模板名称和作用域
And: structured 包含 block_summary（section 类型的 block 名称列表）
And: structured 包含 scope, version, lesson_type
```

### Scenario 5: Requirement EntityContext
```
Given: GET /context/entity/requirement/{id}
Then: 返回 EntityContext JSON
And: ref.summary 包含课标编号和名称
And: structured 包含 name, level, subject, grade_range
And: relations 可包含 parent requirement（如果有 parent_id）
```

### Scenario 6: Provider search 返回 AtReference with summary
```
Given: GET /context/search?q=SAS
Then: 返回 AtReference[]
And: 每个 AtReference 都有 summary 字段
And: summary 不为空且 ≤ 100 字
```

### Scenario 7: Apply Action — 成功更新
```
Given: POST /context/apply
Body: { target_type: 'lesson_plan', target_id: '{id}', field_path: 'title', suggested_value: '新标题', action_description: '更新教案标题' }
Then: 返回 { success: true }
And: 再次 GET /context/entity/lesson_plan/{id}，title 已更新
```

### Scenario 8: Apply Action — 业务规则处理
```
Given: 一个 status='published' 的 lesson_plan
When: POST /context/apply 尝试修改其 title
Then: 返回合理的业务响应（success: false + error 说明，或按业务规则允许修改）
```

### Scenario 9: @ Picker summary 显示
```
Given: 打开 chat 页面，@ 弹出 picker
When: 查看 recent items 列表
Then: 每个 item 下方显示 summary 文本
And: summary 使用较小字号、灰色文字
```

### Scenario 10: 消息 references 字段
```
Given: 通过 @ picker 选中一个实体
When: 查看 MentionContext 中的 ref 数据
Then: ref 对象包含 summary 字段
And: summary 与 EntityContext.ref.summary 一致
```

### Scenario 11: Apply 按钮渲染
```
Given: 消息中包含 apply_action block
Then: 渲染为可点击的按钮
And: 按钮文案为 action description
And: 点击后调用 POST /context/apply
```

### Scenario 12: 向后兼容 — 现有端点正常工作
```
Given: edu-platform backend 启动
Then: GET /context/entity-types 返回 { types: [...], tree: {...} }
And: GET /context/suggest 返回 { recents: [...] }
And: GET /context/browse?type=lesson_plan 返回 { items: [...] }
And: GET /context/search?q=SAS 返回 { results: [...] }
And: GET /context/resolve?type=lesson_plan&id={id} 返回 { entity: {...} }
And: 所有 response 格式与前 harness 完全一致
```

## Agent Architecture

### Generator
- **Role**: 在现有 context-layer 代码基础上，逐步演进实现 Phase 1-3 功能。每轮基于 evaluator 反馈修复问题。
- **Perspective**: 你是一个 TypeScript 全栈工程师，精通 NestJS + React + TypeORM。你正在**演进**已有的 `@kedge-agentic/context-layer` 平台模块——现有代码已经通过 13/13 场景，你的修改不能破坏它们。
- **Input**: `HARNESS_SPEC.md` + `reference/CCaaS-Referenceable-AtPicker.md`（设计文档）+ `eval-reports/v{N-1}-eval.md`（上轮评估）+ `progress.md`
- **Output**: 演进后的代码 + `changelogs/v{N}-changelog.md`
- **Key instructions**:
  1. 第一轮实现 Phase 1：core types（AtReference, EntityContext, ApplyAction, EntityContextProvider）+ EntityRegistry provider 注册 + ContextRouter + 新端点（GET /context/entity/:type/:id, POST /context/apply）
  2. 第二轮实现 Phase 2：edu-platform providers（LessonPlan, Template, Requirement）+ ReferenceableModule + summary 生成逻辑
  3. 第三轮实现 Phase 3：前端 summary 显示 + apply 按钮 + RefPill color + MentionContext summary
  4. 后续轮次修复 evaluator 指出的具体问题
  5. 每轮只修复最高优先级的 1-2 个问题，不要大范围重写
  6. 复用 LessonPlanService.findOne()、TemplateService.findOne()、CurriculumService.search() 等现有方法
  7. Provider 注册在 ReferenceableModule.onModuleInit() 中调用 EntityRegistry.registerProvider()

### Evaluator
- **Role**: 独立评估 Generator 的输出，产出详细评分报告。
- **Perspective**: 你是一个严格的代码审查者 + QA 工程师。你**没有参与代码编写**，只关心结果是否满足 HARNESS_SPEC.md 的标准。对架构违规和向后兼容零容忍。
- **Input**: `HARNESS_SPEC.md` + Generator 输出的代码 + `reference/CCaaS-Referenceable-AtPicker.md`
- **Output**: `eval-reports/v{N}-eval.md`
- **Isolation**: 独立上下文（mandatory）——不得复用 Generator 的 context window
- **Evaluation steps**:
  1. **架构合规检查**: P1-P5 检查（致命 penalty 先查）
  2. **向后兼容检查**: curl 验证现有 7 个端点 response 格式不变
  3. **tsc 检查**: context-layer + context-layer-react + edu-platform backend
  4. **Playwright E2E**: 启动 edu-platform backend → `npx playwright test`
  5. **EntityContext 数据质量**: curl 调用新端点，验证 summary 长度、relations 正确性、structured 完整性
  6. **前端交互**: 代码分析验证 summary 显示、apply 按钮、color pill
  7. **评分**: 按 rubric 打分，写入 eval report

### Harness Orchestrator
- **Role**: 管理 Generator-Evaluator 循环。读 progress.md，决定下一轮 focus。
- **Perspective**: 你是项目经理。根据 eval report 决定优先级——先修红线违规，再修失败场景，最后优化数据质量和前端交互。
- **Input**: `progress.md` + latest `eval-reports/v{N}-eval.md`
- **Output**: 更新 `progress.md` + 决定是否继续或终止

## Exit Conditions
- **成功退出**: 总分 >= 90/100 且 12/12 场景通过
- **合格退出**: 总分 >= 75/100 且 10/12 场景通过 且无 P1/P2 致命 penalty
- **最大轮次**: 12 轮
- **递减退出**: 连续 3 轮总分提升 < 3 分 → 退出并报告瓶颈
- **致命错误**: 如果连续 2 轮存在 P1/P2 penalty → 暂停，需要人工介入

## Progress Tracking
- **Log file**: `progress.md`
- **Per-iteration record**:
  - Version number (v1, v2, ...)
  - Timestamp
  - Total score (XX/100)
  - Per-dimension scores
  - Scenarios passed: X/12 (list which passed/failed)
  - Key changes summary
  - Evaluator's top 3 unresolved issues
  - Generator's next focus

## Edu-Platform Provider 详情

Provider 利用 edu-platform 已有 service 的方法，不新建 DB 查询：

### LessonPlan Provider
- **getContext(id)**: 调用 `LessonPlanService.findOne(id)` → 转换为 EntityContext
  - summary: `${class_name} ${subject} ${lesson_type} 教案 ${duration}分钟`（+ requirement info if linked）
  - structured: title, class_id, subject, lesson_type, duration_minutes, blocks, status, source
  - relations: requirement AtRef（if requirement_id exists）
  - attachments: []（暂无文件系统）
- **search(query)**: 调用 `LessonPlanService.findAll({ q: query })` → 转换为 AtReference[]（含 summary）
- **apply(req)**: 调用 `LessonPlanService.update(id, { [field]: value })` → 返回 success/failure

### Template Provider
- **getContext(id)**: 调用 `TemplateService.findOne(id)` → 转换为 EntityContext
  - summary: `${name} (${scope}作用域) ${lesson_type}模板 v${version}`
  - structured: name, description, scope, lesson_type, version, block_summary, usage_count
  - relations: []（模板无外部关联）
  - attachments: []
- **search(query)**: 调用 `TemplateService.findAll({ q: query })` → 转换为 AtReference[]

### Requirement Provider
- **getContext(id)**: 调用 `CurriculumService.getChildren(parentId)` 或直接查询节点 → 转换为 EntityContext
  - summary: `${subject} ${name}` (+ grade_range if available)
  - structured: name, level, subject, grade_range, cognitive, sort_order
  - relations: parent requirement AtRef（if parent_id exists）
  - attachments: []
- **search(query)**: 调用 `CurriculumService.search(query)` → 转换为 AtReference[]

## Startup Commands

```bash
# Edu-platform backend（含 context-layer module + referenceable providers）
cd solutions/business/edu-platform/backend && npm run dev   # → :3001

# E2E tests
cd harness-workspace/referenaceable-picker/e2e && npx playwright test
```

## Estimated Resource Usage
- **Iterations**: ~6-10 expected（Phase 1-3 各 1-2 轮 + 修复轮次）
- **Tokens per iteration**: ~80K (generator) + ~30K (evaluator)
- **Total estimated**: ~1M tokens (~$12-18)
