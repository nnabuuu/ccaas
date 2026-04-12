# v2 Evaluation Report

## Pre-gate
- TypeScript 编译: **PASS** (`npx tsc --noEmit` 零错误)

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1: BlockEditor | 5/5 | 30/30 | 7 种块类型全部存在且渲染正确；DndContext + SortableContext 拖拽排序可用；"+" 插入按钮带紫色线 + BlockTypeSelector 7 种选项；删除按钮 hover 显示；教案/模板双模式正确切换；"建议保留" badge 在模板模式可 toggle |
| D2: Visual Fidelity | 5/5 | 25/25 | 0 处 box-shadow；233 处 CSS 变量引用；列表项 border-radius: 10px ✓；侧边栏 240px ✓；推优弹窗 420px + border-radius: 12px ✓；列表页 max-width: 960px ✓；4 种状态 badge 颜色映射 ✓；学业要求 teal/amber 双色 ✓；0 处硬编码颜色 |
| D3: CRUD Completeness | 5/5 | 20/20 | 教案：列表分页+搜索筛选+新建+编辑+删除+blocks 保存+发布+导出+save-as-template。模板：列表按 scope 筛选+新建+编辑+删除+推优提交。Fork 模板→教案通过 template_id query param 实现 |
| D4: Interaction | 4/5 | 12/15 | 块类型选择器 7 种 ✓；侧边栏模板切换 ✓；3 级 scope tab ✓；状态 badge ✓；分页+loading ✓；搜索 debounce 300ms ✓。学业要求关联/更换 UI 完整但使用 mock 数据（非真实选择面板），扣 1 分 |
| D5: Code Quality | 5/5 | 10/10 | BlockEditor 作为独立组件被 LessonPlanEditor + TemplateEditor 共同 import；TypeScript 类型完整（lesson-plan.ts 含 Block/LessonPlan/RequirementInfo 等，template.ts 含 Template/TemplateScope/Promotion）；0 处 `: any`；7 个 block 组件独立文件；全量使用 design-tokens CSS 变量 |

基础分: 97/100

## Penalty Deductions

| Rule | Check | Result |
|------|-------|--------|
| BlockEditor 代码复制 | `grep 'import.*BlockEditor' src/pages/` | 2 处 import（LessonPlanEditor + TemplateEditor），无代码复制 |
| box-shadow | `grep 'box-shadow'` | 0 处 |
| 破坏首页 | Route `/` → HomePage | 正常 |
| 破坏 Chat | Route `/chat` → AppShell | 正常 |
| 缺少 block 类型 | 7 种全部存在 | 无缺失 |
| 硬编码颜色值 | `grep '#[0-9a-fA-F]'` | 0 处 |
| 修改冻结文件 | `git diff --name-only` filter | 0 个冻结文件被修改 |

- Total penalties: **0**

## Detailed Evidence

### D1: BlockEditor 详细分析

**文件结构（全部存在）：**
- `src/components/editor/BlockEditor.tsx` — 核心组件，389 行
- `src/components/editor/BlockTypeSelector.tsx` — 类型选择器，7 种类型
- `src/components/editor/blocks/SectionBlock.tsx` — section 渲染
- `src/components/editor/blocks/TextBlock.tsx` — text 渲染
- `src/components/editor/blocks/ListBlock.tsx` — list 渲染
- `src/components/editor/blocks/TableBlock.tsx` — table 渲染
- `src/components/editor/blocks/TimelineBlock.tsx` — timeline 渲染
- `src/components/editor/blocks/CalloutBlock.tsx` — callout 渲染
- `src/components/editor/blocks/ImageBlock.tsx` — image 渲染

**Props 接口：**
```typescript
interface BlockEditorProps {
  mode: 'lesson' | 'template'
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  readOnly?: boolean
}
```
完全匹配 SPEC 要求。

**7 种 Block 类型渲染验证：**

| Block Type | 教案模式 | 模板模式 | 匹配 SPEC |
|-----------|---------|---------|----------|
| section | bg2 灰底，600 粗体，14px | 同教案模式（不斜体） | ✓ |
| text | contentEditable，13px，lineHeight 1.7 | 灰色斜体 placeholder，color: var(--t3) | ✓ |
| list | ol/ul，paddingLeft: 18px，可增删项 | 灰色斜体 placeholder | ✓ |
| table | borderCollapse，th: bg2，td: border-bottom b1 | 灰色斜体单元格 | ✓ |
| timeline | time 50px + duration 46px + description flex:1，可增删行 | time 正常色，description 灰色斜体 | ✓ |
| callout | 3px 左边框 info-t 蓝色 + info-bg | 3px 左边框 warn-t 琥珀色 + warn-bg + 斜体 | ✓ |
| image | 灰底 + "点击上传图片" | 灰底 + "图片占位" | ✓ |

**交互功能：**
- 拖拽排序：@dnd-kit/core + @dnd-kit/sortable，DndContext + SortableContext + useSortable，PointerSensor 距离 5px 激活 ✓
- "+" 插入按钮：InsertGap 组件，hover 显示紫色线（var(--purple-t)）+ 20px 圆形按钮，点击展开 BlockTypeSelector ✓
- 删除按钮：22×22px，border-radius: 4px，hover 显示 bg2 背景，位于 block-actions 右上角 ✓
- "建议保留"：模板模式下 toggle is_required，teal-bg/teal-t 样式，9px font-size, 2px 6px padding ✓

### D2: 关键样式值匹配

| 样式 | SPEC 值 | 实际值 | 匹配 |
|------|---------|--------|------|
| 列表页 max-width | 960px | `maxWidth: '960px'` (LessonPlanList:75) | ✓ |
| 列表项 border-radius | 10px | `borderRadius: '10px'` (LessonPlanList:178) | ✓ |
| 侧边栏宽度 | 240px | `width: '240px'` (LessonPlanEditor:499) | ✓ |
| 推优弹窗宽度 | 420px | `width: '420px'` (PromoteModal:59) | ✓ |
| 推优弹窗圆角 | 12px | `borderRadius: '12px'` (PromoteModal:58) | ✓ |
| 模板编辑器 max-width | 640px | `maxWidth: '640px'` (TemplateEditor:113) | ✓ |
| 搜索框宽度 | 220px | `width: '220px'` (LessonPlanList:91) | ✓ |
| 标题输入 | 20px 700 | `fontSize: '20px', fontWeight: 700` | ✓ |
| overlay 背景 | rgba(28,28,26,0.15) | `rgba(28,28,26,0.15)` (PromoteModal:47) | ✓ |

### D3: API 端点覆盖

**教案（10/11 端点调用）：**
- `GET /lesson-plans` — LessonPlanList.tsx:42 ✓
- `GET /lesson-plans/:id` — LessonPlanEditor.tsx:45 ✓
- `POST /lesson-plans` — LessonPlanEditor.tsx:74 ✓
- `PUT /lesson-plans/:id` — LessonPlanEditor.tsx:92 ✓
- `DELETE /lesson-plans/:id` — LessonPlanEditor.tsx:168 + LessonPlanList.tsx:63 ✓
- `POST /lesson-plans/:id/blocks` — LessonPlanEditor.tsx:104 ✓
- `POST /lesson-plans/:id/link-requirement` — LessonPlanEditor.tsx:144 ✓
- `POST /lesson-plans/:id/publish` — LessonPlanEditor.tsx:155 ✓
- `POST /lesson-plans/:id/export` — LessonPlanEditor.tsx:122 ✓
- `POST /lesson-plans/:id/save-as-template` — LessonPlanEditor.tsx:180 ✓
- `GET /lesson-plans/:id/requirement-status` — 未调用（minor）

**模板（6/8 端点调用）：**
- `GET /templates` — TemplateList.tsx:50 ✓
- `GET /templates/:id` — TemplateEditor.tsx:34 ✓
- `POST /templates` — TemplateEditor.tsx:53 ✓
- `PUT /templates/:id` — TemplateEditor.tsx:69 ✓
- `DELETE /templates/:id` — TemplateEditor.tsx:93 + TemplateList.tsx:71 ✓
- `POST /templates/:id/promote` — PromoteModal.tsx:28 ✓
- `GET /templates/promotions` — 未调用（审核列表，非核心）
- `POST /templates/promotions/:id/review` — 未调用（审核操作，非核心）

### D4: 交互细节

| 交互 | 实现状态 | 备注 |
|------|---------|------|
| 学业要求关联 | ⚠ 部分 | UI 完整（teal/amber 两态，"更换"按钮），但关联使用 mock 数据而非真实选择面板 |
| BlockTypeSelector | ✓ 完整 | 7 种类型图标+名称，点击 "+" 展开 |
| Tab 切换 | ✓ 完整 | 一级 tab (教案/模板) + 二级 scope tab + 每 tab 计数 |
| 推优弹窗 | ✓ 完整 | target_scope 选择、模板名称、课型（只读）、reason textarea、提交/取消 |
| Loading 状态 | ✓ 完整 | LessonPlanList + TemplateList 均有 loading 状态显示 |
| 搜索 debounce | ✓ 完整 | 300ms setTimeout (LessonPlanList:28, TemplateList:38) |
| 分页 | ✓ 完整 | 上一页/下一页 + 页码显示 |
| 侧边栏模板切换 | ✓ 完整 | 加载教师模板列表，点击替换教案 blocks（带确认） |

## Priority Fix

1. [INTERACTION] 学业要求关联使用 mock 数据 — 实现真实的学业要求选择面板（弹窗列出可用课标，用户选择后关联）
2. [INTEGRATION] 未调用 `GET /lesson-plans/:id/requirement-status` — 编辑器加载时检查课标版本是否最新
3. [INTEGRATION] 未调用 `GET /templates/promotions` 和审核端点 — 如需审核管理功能，需补充

## Actionable Fix Hints

- file: `frontend/src/pages/LessonPlanEditor.tsx`, issue: `handleLinkRequirement` 使用硬编码 mock 数据, expected: 弹出选择面板 → `GET /api/requirements` → 用户选择 → 调用 link-requirement
- file: `frontend/src/pages/LessonPlanEditor.tsx`, issue: 未调用 requirement-status 接口, expected: 加载教案后调用 `GET /api/lesson-plans/:id/requirement-status` 检查课标版本

总分: 97/100
