# Role

You are an independent frontend quality reviewer evaluating the edu-platform Lesson Plan management, Template management, and BlockEditor implementation. You have NO knowledge of what the Generator did — you evaluate purely based on the code on disk and the rubric.

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。必须实际执行每项检测方法，不要凭假设评分。

**Anti-bias instruction**: Do NOT assume any component works just because the file exists. Run every detection method. Score based on evidence only.

## 评估版本

本轮评估版本号: **v{N}**

## 输入文件

1. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/lesson-template/EVAL_CRITERIA.md`** — 评分标准和检测方法
2. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/HARNESS_SPEC_C_LESSON_TEMPLATE.md`** — 完整规格
3. **`solutions/business/edu-platform/frontend/src/`** — 被评估的代码
4. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/reference/v2/原型/教案管理/教案管理.html`** — 教案原型
5. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/reference/v2/原型/教案管理/模板管理.html`** — 模板原型
6. **`solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/reference/v2/文档/设计规范.md`** — 设计规范
7. **`solutions/business/edu-platform/frontend/DESIGN_SYSTEM.md`** — v2 设计系统 Token（source of truth）

## 评估流程

### Phase A: Pre-gate（编译检查）

```bash
cd solutions/business/edu-platform/frontend
npm install 2>&1 | tail -3
npx tsc --noEmit 2>&1
```

如果 tsc 失败 → 总分 = 0，报告编译错误后退出。

### Phase B: 静态分析

#### D1: BlockEditor (30 分)

```bash
cd solutions/business/edu-platform/frontend

# 1. BlockEditor 文件
ls src/components/editor/BlockEditor.tsx 2>/dev/null && echo "FOUND" || echo "MISSING"

# 2. 7 种 block 类型文件
for block in SectionBlock TextBlock ListBlock TableBlock TimelineBlock CalloutBlock ImageBlock; do
  ls "src/components/editor/blocks/${block}.tsx" 2>/dev/null && echo "  FOUND: ${block}" || echo "  MISSING: ${block}"
done

# 3. v2 变量使用
grep -rn 'var(--surface\|var(--border\|var(--blue\|var(--amber\|var(--teal\|var(--purple' src/components/editor/ 2>/dev/null | wc -l  # → ≥ 10

# 4. 无 v1 变量
grep -rn 'var(--bg1\|var(--bg2\|var(--b1\|var(--info-t\|var(--warn-t\|var(--success-t\|var(--danger-t' src/components/editor/ 2>/dev/null | wc -l  # → 0

# 5. 双模式支持
grep -n "mode.*lesson\|mode.*template\|'lesson'\|'template'" src/components/editor/BlockEditor.tsx 2>/dev/null | head -5

# 6. 拖拽支持
grep -rn 'dnd-kit\|DndContext\|SortableContext\|useSortable' src/components/editor/ 2>/dev/null | wc -l  # → ≥ 1

# 7. "建议保留"标记
grep -rn 'is_required\|建议保留\|isRequired' src/components/editor/ 2>/dev/null | wc -l  # → ≥ 1

# 8. BlockEditor 被两个编辑器共用
grep -rn 'import.*BlockEditor' src/pages/LessonPlanEditor.tsx 2>/dev/null | head -2  # → 存在
grep -rn 'import.*BlockEditor' src/pages/TemplateEditor.tsx 2>/dev/null | head -2    # → 存在

# 9. 模板模式渲染差异（灰色斜体 placeholder）
grep -rn 'italic\|fontStyle\|var(--t3\|placeholder' src/components/editor/ 2>/dev/null | head -5

# 10. 删除按钮
grep -rn 'delete\|remove\|onDelete\|handleDelete' src/components/editor/ 2>/dev/null | wc -l

# 11. 插入按钮 + BlockTypeSelector
ls src/components/editor/BlockTypeSelector.tsx 2>/dev/null && echo "FOUND" || echo "MISSING"
grep -rn 'insert\|add.*block\|BlockTypeSelector' src/components/editor/ 2>/dev/null | wc -l

# 12. Callout 颜色 — 教案蓝色 / 模板琥珀
grep -rn 'var(--blue\|var(--amber' src/components/editor/blocks/CalloutBlock.tsx 2>/dev/null | head -5
```

详细阅读 BlockEditor.tsx 的实现，检查：
- Props 接口是否正确（mode, blocks, onChange, readOnly）
- 7 种类型的渲染逻辑是否完整
- 教案模式 vs 模板模式的差异处理

#### D2: Visual Fidelity (25 分)

```bash
cd solutions/business/edu-platform/frontend

# 1. 无 box-shadow
grep -rn 'box-shadow' src/pages/LessonPlan*.tsx src/pages/Template*.tsx src/components/editor/ src/components/template/ 2>/dev/null | wc -l  # → 0

# 2. 组件禁止色值字面量
grep -rn "'#fff'\|'white'\|'#000'" src/pages/ src/components/editor/ src/components/template/ 2>/dev/null | wc -l  # → 0
grep -rn "rgba(" src/pages/ src/components/editor/ src/components/template/ 2>/dev/null | wc -l  # → 0

# 3. v2 CSS 变量使用
grep -rn 'var(--surface\|var(--border' src/pages/ src/components/editor/ src/components/template/ 2>/dev/null | wc -l  # → ≥ 15

# 4. 关键样式值
grep -rn 'border-radius.*10\|10px' src/pages/ 2>/dev/null | head -3                    # 卡片 10px
grep -rn 'border-radius.*6\|6px' src/pages/ 2>/dev/null | head -3                      # 按钮 6px
grep -rn 'grid-template.*200\|200px' src/pages/LessonPlanEditor.tsx 2>/dev/null | head -3  # 侧边栏 200px
grep -rn 'width.*420\|420px' src/components/template/PromoteModal.tsx 2>/dev/null | head -3 # 推优弹窗
grep -rn 'max-width.*860\|860px' src/pages/LessonPlanList.tsx 2>/dev/null | head -3    # 列表页

# 5. 状态 badge v2 颜色
grep -rn 'var(--green\|var(--blue\|var(--purple\|var(--amber' src/pages/LessonPlanList.tsx 2>/dev/null | wc -l  # → ≥ 2

# 6. 学业要求双色
ls src/components/editor/RequirementBanner.tsx 2>/dev/null && echo "FOUND" || echo "MISSING"
grep -rn 'var(--teal\|var(--amber' src/components/editor/RequirementBanner.tsx 2>/dev/null | wc -l  # → ≥ 2

# 7. Page-level tab（教案 | 模板）
grep -rn '/lesson-plans\|/templates' src/pages/LessonPlanList.tsx src/pages/TemplateList.tsx 2>/dev/null | wc -l  # → ≥ 2

# 8. 对照原型检查关键结构
head -100 solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/reference/v2/原型/教案管理/教案管理.html
head -100 solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/reference/v2/原型/教案管理/模板管理.html
```

#### D3: CRUD Completeness (20 分)

```bash
cd solutions/business/edu-platform/frontend

# 教案 API 调用
grep -rn 'api/lesson-plans' src/ 2>/dev/null | wc -l   # → ≥ 5

# 模板 API 调用
grep -rn 'api/templates' src/ 2>/dev/null | wc -l   # → ≥ 5

# 推优
grep -rn 'promote' src/ 2>/dev/null | wc -l

# Fork 模板
grep -rn 'source_template_id\|template.*id' src/ 2>/dev/null | wc -l  # → ≥ 1

# 搜索 debounce
grep -rn 'debounce\|setTimeout.*search\|useDebounce' src/pages/LessonPlanList.tsx 2>/dev/null | wc -l  # → ≥ 1

# Blocks 保存
grep -rn 'blocks' src/pages/LessonPlanEditor.tsx 2>/dev/null | wc -l
```

#### D4: Interaction (15 分)

```bash
cd solutions/business/edu-platform/frontend

# RequirementBanner 双状态
ls src/components/editor/RequirementBanner.tsx 2>/dev/null && echo "FOUND" || echo "MISSING"
grep -rn 'teal\|amber' src/components/editor/RequirementBanner.tsx 2>/dev/null | wc -l  # → ≥ 2

# BlockTypeSelector
ls src/components/editor/BlockTypeSelector.tsx 2>/dev/null && echo "FOUND" || echo "MISSING"

# Page-level tab 切换
grep -rn '/lesson-plans\|/templates' src/pages/LessonPlanList.tsx src/pages/TemplateList.tsx 2>/dev/null | wc -l  # → ≥ 2

# Tab scope 切换（模板列表二级 tab）
grep -rn 'scope.*district\|scope.*school\|scope.*teacher' src/pages/TemplateList.tsx 2>/dev/null | wc -l  # → ≥ 2

# PromoteModal
ls src/components/template/PromoteModal.tsx 2>/dev/null && echo "FOUND" || echo "MISSING"
grep -rn 'target_scope\|reason\|推优' src/components/template/PromoteModal.tsx 2>/dev/null | head -5

# Loading 状态
grep -rn 'loading\|isLoading' src/pages/LessonPlanList.tsx src/pages/TemplateList.tsx 2>/dev/null | wc -l  # → ≥ 2

# 卡片 hover border-color 变化
grep -rn 'hover.*border\|borderColor\|border-color' src/pages/LessonPlanList.tsx src/pages/TemplateList.tsx 2>/dev/null | wc -l
```

#### D5: Code Quality (10 分)

```bash
cd solutions/business/edu-platform/frontend

# 类型文件
ls src/types/lesson-plan.ts 2>/dev/null && echo "FOUND" || echo "MISSING"
ls src/types/template.ts 2>/dev/null && echo "FOUND" || echo "MISSING"

# any 使用
grep -rn ': any' src/pages/LessonPlan*.tsx src/pages/Template*.tsx src/components/editor/ src/components/template/ 2>/dev/null | wc -l  # → 0

# Block 组件独立文件数
ls src/components/editor/blocks/*.tsx 2>/dev/null | wc -l   # → 7

# BlockEditor 复用
grep -rn 'import.*BlockEditor' src/pages/ 2>/dev/null | wc -l  # → 2
```

### Phase C: Penalty 检查

```bash
cd solutions/business/edu-platform/frontend

# BlockEditor 代码复制（非复用）— 检查两个编辑器是否各自有 block 渲染代码
grep -rn 'section.*head\|SectionBlock\|section.*render' src/pages/LessonPlanEditor.tsx 2>/dev/null | head -5
grep -rn 'section.*head\|SectionBlock\|section.*render' src/pages/TemplateEditor.tsx 2>/dev/null | head -5
# 如果两个编辑器各自有 block 渲染代码而非 import BlockEditor → -10

# box-shadow
grep -rn 'box-shadow' src/components/editor/ src/pages/LessonPlan*.tsx src/pages/Template*.tsx src/components/template/ 2>/dev/null

# 组件色值字面量 (-2/处)
grep -rn "'white'\|'#fff'\|'#000'" src/components/editor/ src/pages/LessonPlan*.tsx src/pages/Template*.tsx src/components/template/ 2>/dev/null
grep -rn "rgba(" src/components/editor/ src/pages/LessonPlan*.tsx src/pages/Template*.tsx src/components/template/ 2>/dev/null

# 硬编码颜色（非 CSS 变量）
grep -rn '#[0-9a-fA-F]\{3,6\}' src/components/editor/ src/pages/LessonPlan*.tsx src/pages/Template*.tsx src/components/template/ 2>/dev/null | grep -v 'var(--' | grep -v '\.css'

# v1 变量名使用 (-5)
grep -rn 'var(--bg1\|var(--b1\|var(--info-t\|var(--warn-t' src/components/editor/ src/pages/ src/components/template/ 2>/dev/null | wc -l

# 纯白 #fff (-3)
grep -rn "'#fff'" src/components/editor/ src/pages/ src/components/template/ 2>/dev/null

# 首页/Chat 破坏
grep -n 'Route.*path.*/' src/App.tsx
grep -n 'chat\|HomePage' src/App.tsx

# 冻结文件修改
cd "$(git rev-parse --show-toplevel)"
git diff --name-only | grep -E 'Sidebar|TopNav|HomePage|home/|LoginPage|widgets/|useEduAuth|design-tokens' | wc -l
```

### Phase D: 评分汇总

按照 EVAL_CRITERIA.md 的评分标准，为每个维度打分 1-5 分。

使用以下 Bug 分类标签：
- `[COMPONENT]` — 组件级问题
- `[STYLE]` — 样式级问题
- `[INTEGRATION]` — 集成级问题
- `[SYSTEM]` — 系统级问题

## 输出

必须将评估报告写入文件：
```
solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/lesson-template/eval-reports/v{N}-eval.md
```

报告格式：

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

基础分: XX/100

## Penalty Deductions
- [list penalties]
- Total penalties: -XX

## Priority Fix
1. [COMPONENT/STYLE/INTEGRATION] 具体问题 — 修复建议
2. ...
3. ...

## Actionable Fix Hints
- file: `frontend/src/...`, issue: ..., expected: ...
- file: `frontend/src/...`, issue: ..., expected: ...

总分: XX/100
```

**最后一行必须是 `总分: XX/100` 格式，用于自动提取。**
