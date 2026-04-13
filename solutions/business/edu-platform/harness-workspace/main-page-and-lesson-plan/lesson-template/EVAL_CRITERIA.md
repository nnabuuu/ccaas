# Eval Criteria — Frontend 教案管理 + 模板管理（v2 设计）

## Pre-gate

TypeScript 编译通过是最低要求。如果 `npx tsc --noEmit` 失败，总分 = 0。

## Scoring Dimensions

### D1: BlockEditor (Weight: 30/100)

核心共享组件的完整性和正确性。

| Score | Description |
|-------|-------------|
| 5/5 | 7 种块类型全部渲染正确（使用 v2 变量）；"+"插入按钮带 `var(--purple)` 紫色线+类型选择器；删除按钮 hover `var(--surface2)`；拖拽排序可用；教案模式(content 可编辑)和模板模式(placeholder `var(--t3)` 灰色斜体)正确切换；"建议保留" badge `var(--teal-bg)` + `var(--teal)` 可 toggle；callout 用 `var(--blue)`/`var(--amber)`（不是 v1 `--info-t`/`--warn-t`） |
| 4/5 | 7 种块类型正确但交互缺 1 项 |
| 3/5 | 5-6 种块类型正确 |
| 2/5 | 3-4 种块类型，或模式未区分 |
| 1/5 | BlockEditor 不存在或 < 3 种类型 |

**Detection method**:
```bash
# 1. BlockEditor 文件存在
ls frontend/src/components/editor/BlockEditor.tsx

# 2. 7 种 block 类型组件存在
ls frontend/src/components/editor/blocks/SectionBlock.tsx
ls frontend/src/components/editor/blocks/TextBlock.tsx
ls frontend/src/components/editor/blocks/ListBlock.tsx
ls frontend/src/components/editor/blocks/TableBlock.tsx
ls frontend/src/components/editor/blocks/TimelineBlock.tsx
ls frontend/src/components/editor/blocks/CalloutBlock.tsx
ls frontend/src/components/editor/blocks/ImageBlock.tsx

# 3. v2 变量使用
grep -rn 'var(--surface\|var(--border\|var(--blue\|var(--amber\|var(--teal\|var(--purple' frontend/src/components/editor/ | wc -l  # → ≥ 10

# 4. 无 v1 变量
grep -rn 'var(--bg1\|var(--bg2\|var(--b1\|var(--info-t\|var(--warn-t\|var(--success-t\|var(--danger-t' frontend/src/components/editor/ | wc -l  # → 0

# 5. 双模式支持
grep -n "mode.*lesson\|mode.*template" frontend/src/components/editor/BlockEditor.tsx

# 6. 拖拽支持
grep -rn 'dnd-kit\|DndContext\|SortableContext' frontend/src/components/editor/ | wc -l  # → ≥ 1

# 7. "建议保留"标记
grep -rn 'is_required\|建议保留' frontend/src/components/editor/ | wc -l  # → ≥ 1

# 8. BlockEditor 被两个编辑器共用
grep -rn 'import.*BlockEditor' frontend/src/pages/LessonPlanEditor.tsx  # → 存在
grep -rn 'import.*BlockEditor' frontend/src/pages/TemplateEditor.tsx    # → 存在
```

### D2: Visual Fidelity (Weight: 25/100)

与 3 个 v2 HTML 原型的一致性。

| Score | Description |
|-------|-------------|
| 5/5 | 教案列表与 v2 原型一致（page-level tab、列表项 10px 圆角、`var(--surface)` 底色、hover border-color、学业要求 teal/amber）；编辑器一致（grid 1fr+200px、左对齐）；模板列表一致（双层 tab、block pills 箭头串联）；推优弹窗一致（`var(--overlay)` 遮罩、`var(--surface)` 底） |
| 4/5 | 整体一致但 2-3 处偏差 |
| 3/5 | 布局正确但使用 v1 变量或色值 |
| 2/5 | 只有列表页一致 |
| 1/5 | 与 v2 原型大幅不同 |

**Detection method**:
```bash
# 1. 无 box-shadow
grep -rn 'box-shadow' frontend/src/pages/LessonPlan*.tsx frontend/src/pages/Template*.tsx frontend/src/components/editor/ frontend/src/components/template/ | wc -l  # → 0

# 2. 无纯白/色值字面量（组件禁止色值字面量，全走 var(--token)）
grep -rn "'#fff'\|'white'\|'#000'" frontend/src/pages/ frontend/src/components/editor/ frontend/src/components/template/ | wc -l  # → 0
grep -rn "rgba(" frontend/src/pages/ frontend/src/components/editor/ frontend/src/components/template/ | wc -l  # → 0 (组件禁止 rgba)

# 3. v2 CSS 变量使用
grep -rn 'var(--surface\|var(--border' frontend/src/pages/ frontend/src/components/editor/ frontend/src/components/template/ | wc -l  # → ≥ 15

# 4. 关键样式值
grep -rn 'border-radius.*10\|10px' frontend/src/pages/ | wc -l           # → ≥ 1 (卡片 10px)
grep -rn 'border-radius.*6\|6px' frontend/src/pages/ | wc -l             # → ≥ 1 (按钮 6px)
grep -rn 'grid-template.*200\|200px' frontend/src/pages/LessonPlanEditor.tsx | wc -l  # → 侧边栏 200px
grep -rn 'width.*420\|420px' frontend/src/components/template/PromoteModal.tsx | wc -l # → 推优弹窗

# 5. 状态 badge v2 颜色
grep -rn 'var(--green\|var(--blue\|var(--purple\|var(--amber' frontend/src/pages/LessonPlanList.tsx | wc -l  # → ≥ 2

# 6. 学业要求双色
grep -rn 'var(--teal\|var(--amber' frontend/src/components/editor/RequirementBanner.tsx | wc -l  # → ≥ 2
```

### D3: CRUD Completeness (Weight: 20/100)

教案和模板的完整 CRUD + 推优。

| Score | Description |
|-------|-------------|
| 5/5 | 教案：列表分页+搜索筛选+新建+编辑+删除+blocks 保存+发布。模板：列表按 scope 筛选+新建+编辑+删除+推优提交。Fork 模板→教案正确 |
| 4/5 | 核心 CRUD 完整但缺 1-2 个次要功能 |
| 3/5 | 列表+新建+编辑可用 |
| 2/5 | 只有列表可查看 |
| 1/5 | 页面不渲染 |

**Detection method**:
```bash
# 教案 API 调用
grep -rn 'api/lesson-plans' frontend/src/ | wc -l  # → ≥ 5

# 模板 API 调用
grep -rn 'api/templates' frontend/src/ | wc -l  # → ≥ 5

# 推优
grep -rn 'promote' frontend/src/ | wc -l  # → ≥ 2

# 搜索 debounce
grep -rn 'debounce\|setTimeout\|useDebounce' frontend/src/pages/LessonPlanList.tsx | wc -l  # → ≥ 1

# Fork 模板
grep -rn 'source_template_id\|template.*id' frontend/src/ | wc -l  # → ≥ 1
```

### D4: Interaction (Weight: 15/100)

交互细节完整性。

| Score | Description |
|-------|-------------|
| 5/5 | 学业要求关联/更换完整；块类型选择器可用；page-level tab 教案/模板切换；状态 badge v2 颜色映射正确；分页+loading；搜索 debounce；卡片 hover border-color 变化 |
| 4/5 | 核心交互完整但缺 1 项 |
| 3/5 | 基本交互可用但缺少状态处理 |
| 2/5 | 只有基础点击交互 |
| 1/5 | 交互严重缺失 |

**Detection method**:
```bash
# RequirementBanner 双状态
ls frontend/src/components/editor/RequirementBanner.tsx
grep -rn 'teal\|amber' frontend/src/components/editor/RequirementBanner.tsx | wc -l  # → ≥ 2

# BlockTypeSelector
ls frontend/src/components/editor/BlockTypeSelector.tsx

# Page-level tab 切换
grep -rn '/lesson-plans\|/templates' frontend/src/pages/LessonPlanList.tsx frontend/src/pages/TemplateList.tsx | wc -l  # → ≥ 2

# Tab scope 切换
grep -rn 'scope.*district\|scope.*school\|scope.*teacher' frontend/src/pages/TemplateList.tsx | wc -l  # → ≥ 2

# Loading 状态
grep -rn 'loading\|isLoading' frontend/src/pages/LessonPlanList.tsx frontend/src/pages/TemplateList.tsx | wc -l  # → ≥ 2
```

### D5: Code Quality (Weight: 10/100)

| Score | Description |
|-------|-------------|
| 5/5 | BlockEditor 独立组件复用；TypeScript 类型完整（lesson-plan.ts, template.ts）；无 any；v2 CSS 变量使用；每个 block 类型独立文件 |
| 4/5 | 基本规范但有 1-2 处 any |
| 3/5 | BlockEditor 复用但类型不完整 |
| 2/5 | 代码复制而非复用 |
| 1/5 | 代码结构混乱 |

**Detection method**:
```bash
# 类型文件存在
ls frontend/src/types/lesson-plan.ts
ls frontend/src/types/template.ts

# 无 any
grep -rn ': any' frontend/src/pages/LessonPlan*.tsx frontend/src/pages/Template*.tsx frontend/src/components/editor/ frontend/src/components/template/ | wc -l  # → 0

# 7 个 block 组件独立文件
ls frontend/src/components/editor/blocks/*.tsx | wc -l  # → 7

# BlockEditor 复用
grep -rn 'import.*BlockEditor' frontend/src/pages/ | wc -l  # → 2
```

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| BlockEditor 代码复制 | -10 | 教案和模板编辑器各自有独立的 block 渲染代码 |
| 使用 box-shadow | -3/处 | 任何新组件使用 box-shadow |
| 破坏首页 | -15 | / 路由不再渲染 HomePage |
| 破坏 Chat | -15 | /chat 路由不再渲染 ChatInterface |
| 缺少 block 类型 | -3/类型 | 7 种中缺失的每种 |
| 硬编码颜色值 | -2/处 | 不使用 CSS 变量 |
| 使用 v1 变量名 | -5 | 使用 `--bg1`/`--b1`/`--info-t` 而非 v2 变量 |
| 使用纯白 #fff | -3 | 卡片背景使用 `#fff` 而非 `--surface` |
| 修改冻结文件 | -10/文件 | 修改了 Harness B 产出或其他冻结文件 |
| 组件色值字面量 | -2/处 | 组件代码中出现 `'white'`、`'#fff'`、`rgba()` 等色值字面量 |

## Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 总分 = 基础分 - Penalty 扣分（满分 100）
3. 报告最后一行: `总分: XX/100`

## Report Format

评估报告必须写入 `eval-reports/v{N}-eval.md`，包含：

```markdown
# v{N} Evaluation Report

## Pre-gate
- TypeScript 编译: PASS / FAIL

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1 | X/5 | XX/30 | ... |
| D2 | X/5 | XX/25 | ... |
| D3 | X/5 | XX/20 | ... |
| D4 | X/5 | XX/15 | ... |
| D5 | X/5 | XX/10 | ... |

## Penalty Deductions
(list any penalties)

## Priority Fix
1. [COMPONENT] ...
2. [COMPONENT] ...
3. [COMPONENT] ...

## Actionable Fix Hints
- file: ..., issue: ..., expected: ...

总分: XX/100
```
