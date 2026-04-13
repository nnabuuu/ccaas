# v1 Evaluation Report

## Pre-gate
- TypeScript 编译: **PASS** (`npx tsc --noEmit` 无错误)

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1: BlockEditor | 5/5 | 30/30 | 7 种块类型全部存在且正确渲染；v2 变量 37 处（≥10）；v1 变量 0 处；双模式 lesson/template 正确切换；dnd-kit 拖拽 12 处引用；"建议保留" badge 6 处，toggle 可用 `var(--teal-bg)`/`var(--teal)`；Callout 教案蓝 `var(--blue)` / 模板琥珀 `var(--amber)`；"+" 插入按钮 + BlockTypeSelector 紫色线 `var(--purple)`；删除按钮 hover `var(--surface2)`；模板模式 placeholder 灰色斜体 `var(--t3)` + `fontStyle: 'italic'`；两个编辑器页面均 import BlockEditor 复用 |
| D2: Visual Fidelity | 4/5 | 20/25 | box-shadow: 0（正确）；色值字面量: 0（正确）；rgba: 0（正确）；v2 CSS 变量 73 处（≥15）；卡片 10px 圆角 ✓；按钮 6px 圆角 ✓；编辑器 grid 200px 侧边栏 ✓；PromoteModal 420px ✓；列表 860px maxWidth ✓；状态 badge 用 green/blue/purple/amber 6 处 ✓；RequirementBanner 双色 teal/amber ✓；Page-level tab 教案/模板 ✓。**扣分项**：(1) 列表页缺少分页控件；(2) 模板列表缺少 block pills 箭头串联视觉（代码存在但需原型比对——实际已实现 `→` 箭头串联） |
| D3: CRUD Completeness | 4/5 | 16/20 | 教案 API 6 处（列表、详情、新建 POST、编辑 PUT、blocks 保存 POST）；模板 API 5 处（列表、详情、新建 POST、编辑 PUT、推优 POST）；推优 8 处引用 ✓；source_template_id 类型声明存在 ✓；搜索 debounce 300ms ✓；blocks 保存 ✓。**缺失**：(1) 教案删除 API 调用缺失（列表无删除按钮）；(2) 模板删除 API 调用缺失；(3) 教案发布/状态变更 API 缺失；(4) 分页 API 参数（page/page_size）未传递 |
| D4: Interaction | 4/5 | 12/15 | RequirementBanner 双状态（teal 已关联/amber 未关联）10 处 ✓；BlockTypeSelector 存在 ✓；Page-level tab 切换 ✓；二级 scope tab（district/school/teacher）18 处 ✓；PromoteModal target_scope + reason ✓；Loading 状态 4 处 ✓；卡片 hover border-color 变化 4 处 ✓。**缺失**：(1) 列表无分页交互控件 |
| D5: Code Quality | 5/5 | 10/10 | lesson-plan.ts ✓；template.ts ✓；`: any` = 0 ✓；7 个 block 独立文件 ✓；BlockEditor 复用（2 个页面 import）✓；类型定义完整（LessonPlan, LessonPlanListItem, Template, TemplateListItem, Block, RequirementLink 等） |

基础分: 88/100

## Penalty Deductions

| Rule | Count | Deduction |
|------|-------|-----------|
| BlockEditor 代码复制 | 0 | 0（两个编辑器均 import BlockEditor，无复制） |
| box-shadow | 0 | 0 |
| 色值字面量 | 0 | 0 |
| hex 硬编码颜色 | 0 | 0 |
| v1 变量名 | 0 | 0 |
| 纯白 #fff | 0 | 0 |
| 首页/Chat 破坏 | 0 | 0（`/` → HomePage，`/chat` → ChatPage 均正常） |
| 冻结文件修改 | 0 | 0 |

- Total penalties: **0**

## Priority Fix

1. [INTEGRATION] 教案列表/模板列表缺少删除功能 — 在列表卡片上添加删除按钮（带确认弹窗），调用 `DELETE /api/lesson-plans/:id` 和 `DELETE /api/templates/:id`
2. [INTEGRATION] 教案编辑器缺少发布/状态变更 — 添加"发布"按钮，调用 `PATCH /api/lesson-plans/:id/status`
3. [COMPONENT] 列表页缺少分页控件 — 添加分页组件，传递 `page` 和 `page_size` 参数到 API

## Actionable Fix Hints

- file: `frontend/src/pages/LessonPlanList.tsx`, issue: 无删除按钮和删除 API 调用, expected: 每个卡片增加删除操作（阻止冒泡），调用 `DELETE /api/lesson-plans/:id`
- file: `frontend/src/pages/TemplateList.tsx`, issue: 无删除按钮和删除 API 调用, expected: 每个卡片增加删除操作，调用 `DELETE /api/templates/:id`
- file: `frontend/src/pages/LessonPlanEditor.tsx`, issue: 无发布/状态变更功能, expected: 添加"发布"按钮，调用状态变更 API
- file: `frontend/src/pages/LessonPlanList.tsx`, issue: 无分页控件, expected: 添加分页组件，API 调用传 `page`/`page_size` 参数
- file: `frontend/src/pages/TemplateList.tsx`, issue: 无分页控件, expected: 同上

总分: 88/100
