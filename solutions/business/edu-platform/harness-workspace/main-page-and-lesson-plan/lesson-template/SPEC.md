# SPEC — Frontend 教案管理 + 模板管理（v2 设计）

## 目标

在现有 edu-platform `frontend/` 中实现教案 CRUD（含 Block Editor）和模板管理（含推优），共享 BlockEditor 组件，与 3 个 v2 HTML 原型一致。

## 范围

在已有的 React 前端（含路由 + 响应式导航 + 首页，Harness B 产出）中添加：
1. BlockEditor 核心共享组件（7 种块类型，教案/模板双模式）
2. 教案管理页面（列表 + 编辑器）
3. 模板管理页面（列表 + 编辑器 + 推优弹窗）
4. TypeScript 类型定义
5. 路由扩展

## Work Items

### W1: BlockEditor 核心组件
- 创建 `frontend/src/components/editor/BlockEditor.tsx`
- Props: mode('lesson'|'template'), blocks, onChange, readOnly
- 7 种 block 类型：section, text, list, table, timeline, callout, image
- 块间 "+" 插入按钮（紫色 `var(--purple)` 线 + 圆形按钮）
- 块操作：drag handle + 删除按钮（hover `var(--surface2)`）
- 拖拽排序（@dnd-kit/core + @dnd-kit/sortable）

### W2: Block 类型组件（7 个）
- 每种 block 独立文件在 `frontend/src/components/editor/blocks/`
- SectionBlock: `var(--surface2)` 底粗体标题
- TextBlock: 教案模式可编辑 / 模板模式 `var(--t3)` 灰色斜体
- ListBlock: 有序/无序列表
- TableBlock: HTML 表格，th `var(--surface2)`，td `border-bottom var(--border)`
- TimelineBlock: 时间段+时长+描述
- CalloutBlock: 教案蓝色 `var(--blue)` / 模板琥珀 `var(--amber)` 左边框
- ImageBlock: 图片占位

### W3: 模板模式特殊行为
- Block content 灰色斜体 placeholder
- "建议保留"标记：`var(--teal-bg)` + `var(--teal)` pill badge
- Section 类型内容正常显示

### W4: LessonPlanList 教案列表
- 路由 `/lesson-plans`，max-width 860px，左对齐
- Page-level tab（教案/模板）切换导航
- 搜索 + 学科/状态筛选 + 新建按钮
- 列表项：`var(--surface)` 底，`1px solid var(--border)`，10px 圆角
- 学业要求标签 `var(--teal-bg)` / 未关联 `var(--amber-bg)`
- 状态 badge 使用 v2 语义色

### W5: LessonPlanEditor 教案编辑器
- 路由 `/lesson-plans/:id` 和 `/lesson-plans/new`
- max-width 920px，grid 两栏 `1fr 200px`
- RequirementBanner（teal/amber）
- 标题 20-22px 700 + meta 选择器 + 自动保存
- BlockEditor mode="lesson"
- 操作栏按钮 6px 圆角

### W6: TemplateList 模板列表
- 路由 `/templates`，max-width 860px
- 一级 Tab（教案/模板）+ 二级 Tab（区级/校本/我的）
- 模板卡片：`var(--surface)` 底，hover border-color 变化
- Block pills 箭头串联结构摘要
- Scope badge 使用 v2 语义色

### W7: TemplateEditor 模板编辑器
- 路由 `/templates/:id` 和 `/templates/new`
- max-width 640px，左对齐
- Info banner `var(--surface2)` 底
- BlockEditor mode="template"

### W8: PromoteModal 推优弹窗
- 420px 宽，12px 圆角
- Overlay `var(--overlay)`
- 输入框 `var(--surface)` 底，6px 圆角
- Focus `rgba(58,49,133,.3)` 紫色边框

### W9: RequirementBanner 学业要求组件
- 已关联（teal）：`var(--teal-bg)` 底，8px 圆角，14px 内边距
- 未关联（amber 虚线框）：`1px dashed var(--amber)`

### W10: 路由扩展 + 类型定义
- App.tsx 添加 6 个路由
- 创建 `frontend/src/types/lesson-plan.ts` 和 `template.ts`

## Frozen Constraints

### 不可修改的文件
- `frontend/src/components/LoginPage.tsx`
- `frontend/src/widgets/` 目录
- `frontend/src/hooks/useEduAuth.ts`
- `frontend/src/styles/design-tokens.css` — 只可添加变量，不可删除
- `frontend/src/components/layout/Sidebar.tsx` — Harness B 产出，冻结
- `frontend/src/components/layout/TopNav.tsx` — Harness B 产出，冻结
- `frontend/src/pages/HomePage.tsx` — Harness B 产出，冻结
- `frontend/src/components/home/` — Harness B 产出，冻结
- `solutions/business/edu-platform/backend/` 整个目录
- `solutions/business/edu-platform/mcp-server/` 整个目录

### 可修改的文件
- `frontend/src/App.tsx` — 添加教案/模板路由
- `frontend/package.json` — 添加拖拽库依赖

### 设计规范约束（v2）
- **参考文档**：`frontend/DESIGN_SYSTEM.md`（source of truth）和 `frontend/CLAUDE.md`
- **Token 单一来源**：使用 Harness B 定义的 `design-tokens.css`（含 light + dark mode）
- **组件禁止色值字面量**：`'white'`/`'#fff'`/`rgba()`/hex → 全走 `var(--token)`
- 变量名：`--surface` / `--border` / `--blue` / `--amber`（不是 v1 `--bg1` / `--b1` / `--info-t`）
- 无 box-shadow、无渐变、无 icon font、无纯白 `#fff`
- 按钮 6px 圆角，卡片 10px 圆角
- 边框统一 `1px solid var(--border)`
- 卡片 hover 用 border-color 变化（不是 shadow）
- BlockEditor 必须作为独立组件共用
- TypeScript strict，无 any

## 评分维度

| # | Dimension | Weight |
|---|-----------|--------|
| D1 | BlockEditor (7 block types + dual mode) | 30 |
| D2 | Visual Fidelity (3 v2 HTML prototypes) | 25 |
| D3 | CRUD Completeness | 20 |
| D4 | Interaction | 15 |
| D5 | Code Quality | 10 |
