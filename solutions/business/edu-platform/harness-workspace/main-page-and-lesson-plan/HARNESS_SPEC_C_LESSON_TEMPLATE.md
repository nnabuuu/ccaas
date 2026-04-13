# Harness Specification C: Frontend 教案管理 + 模板管理（v2 设计）

## Task

- **Artifact**: `frontend/src/components/editor/BlockEditor.tsx`（核心共享组件）+ 教案管理 4 文件 + 模板管理 4 文件 + 辅助组件
- **Current state**: 前端已有路由 + 响应式导航（Sidebar + TopNav）+ 首页（Harness B 产出），`/lesson-plans` 和 `/templates` 是 placeholder
- **Target audience**: 教师用户（日常备课工作台）；评估者为 AI Evaluator + 视觉比对
- **Goal**: 实现教案 CRUD（含 Block Editor）和模板管理（含推优），共享 BlockEditor 组件，与 3 个 v2 HTML 原型一致
- **Dependency**: Harness A（Backend API）提供 20 个数据端点；Harness B（路由 + 响应式导航 + 首页）

## Context

本任务是三个 Harness 中最复杂的，核心是 **BlockEditor** — 一个类 Notion 的流式编辑器，支持 7 种内容块类型，同时服务于教案编辑（content 可写）和模板编辑（content 为 placeholder，灰色斜体）两种模式。

v2 设计包的关键变化：
- **导航**：响应式 sidebar（≥1200px）+ top nav（<1200px），教案/模板共享 sidebar 组件
- **布局**：内容左对齐（紧跟 sidebar 右侧），列表页 max-width 860px，编辑器 920px（含 200px 侧边栏），模板编辑器 640px
- **色系**：tinted neutral（不是纯白），变量名 `--bg`/`--surface`/`--border`（不是 v1 的 `--bg1`/`--bg2`/`--b1`）
- **字体**：Plus Jakarta Sans（不是系统字体）
- **边框**：统一 `1px solid var(--border)`
- **组件**：按钮圆角 6px，卡片圆角 10px，卡片 hover 用 `border-color` 变化（不是 shadow）
- **教案/模板切换**：同一模块内用 page-level tab（教案 | 模板），不是独立导航入口

### 参考资料

- HTML 原型 1：`reference/v2/原型/教案管理/教案管理.html`（列表 + 编辑器）
- HTML 原型 2：`reference/v2/原型/教案管理/模板管理.html`（模板列表 + 编辑器 + 推优弹窗）
- PRD：`reference/v2/文档/PRD/PRD-02-教案管理.md`
- 用户故事：`reference/v2/文档/用户故事/教案管理.md`
- 设计规范：`reference/v2/文档/设计规范.md`
- 变更记录：`reference/v2/设计包变更记录.md`

### Backend API 端点（由 Harness A 提供）

**教案**：
| 端点 | 用途 |
|------|------|
| `GET /api/lesson-plans` | 教案列表（分页、筛选） |
| `GET /api/lesson-plans/:id` | 教案详情 + blocks |
| `POST /api/lesson-plans` | 新建（支持 source_template_id fork） |
| `PUT /api/lesson-plans/:id` | 更新元信息 |
| `DELETE /api/lesson-plans/:id` | 软删除 |
| `POST /api/lesson-plans/:id/blocks` | 批量更新 blocks |
| `POST /api/lesson-plans/:id/link-requirement` | 关联学业要求 |
| `GET /api/lesson-plans/:id/requirement-status` | 课标版本检查 |
| `POST /api/lesson-plans/:id/publish` | 发布 |
| `POST /api/lesson-plans/:id/export` | 导出 |
| `POST /api/lesson-plans/:id/save-as-template` | 保存为模板 |

**模板**：
| 端点 | 用途 |
|------|------|
| `GET /api/templates` | 模板列表（按 scope 筛选） |
| `GET /api/templates/:id` | 模板详情 + blocks |
| `POST /api/templates` | 新建 |
| `PUT /api/templates/:id` | 更新 |
| `DELETE /api/templates/:id` | 软删除 |
| `POST /api/templates/:id/promote` | 提交推优 |
| `GET /api/templates/promotions` | 推优列表 |
| `POST /api/templates/promotions/:id/review` | 审核推优 |

## Frozen Constraints

### 不可修改的文件

- `frontend/src/components/LoginPage.tsx` — 登录页冻结
- `frontend/src/widgets/` — 所有现有 widget 冻结
- `frontend/src/hooks/useEduAuth.ts` — 认证 hook 冻结
- `frontend/src/styles/design-tokens.css` — v2 CSS 变量已定义（Harness B），只可添加不可删除
- `frontend/src/components/layout/Sidebar.tsx` — Sidebar 冻结（Harness B 产出）
- `frontend/src/components/layout/TopNav.tsx` — TopNav 冻结（Harness B 产出）
- `frontend/src/pages/HomePage.tsx` — 首页冻结（Harness B 产出）
- `frontend/src/components/home/` — 首页组件冻结
- `solutions/business/edu-platform/backend/` — 后端冻结
- `solutions/business/edu-platform/mcp-server/` — MCP server 冻结

### 可修改的文件

- `frontend/src/App.tsx` — 添加教案/模板路由
- `frontend/package.json` — 如需拖拽库（如 @dnd-kit/core）

### 必须遵守的规则（v2 设计规范）

- **参考文档**：`frontend/DESIGN_SYSTEM.md`（设计系统 source of truth）和 `frontend/CLAUDE.md`（Quick Rules）
- **Token 单一来源**：使用 Harness B 定义的 v2 `design-tokens.css` CSS 变量（含 light + dark mode）
- **组件禁止色值字面量**：组件代码中不得出现 `'white'`、`'#fff'`、`'#000'`、`'rgba(...)'`、hex 值等 → 全部使用 `var(--token)`
- **变量名**：`--bg` / `--surface` / `--surface2` / `--border` / `--blue` / `--amber` / `--teal` 等（不是 v1 的 `--bg1` / `--b1` / `--info-t` / `--warn-t`）
- **字体**：继承 Harness B 的 `"Plus Jakarta Sans"` 字体栈
- **边框**：统一 `1px solid var(--border)`
- **按钮圆角**：6px；**卡片圆角**：10px
- **禁止**：box-shadow、渐变、icon font、纯白 `#fff`、纯黑 `#000`、emoji 图标
- **卡片 hover**：`border-color` 变化，不是 shadow
- BlockEditor 必须作为独立组件被两个编辑器共同使用（不复制代码）
- 教案模式 vs 模板模式通过 props 切换（`mode: 'lesson' | 'template'`）
- TypeScript strict，无 any

## Detailed Specification

### 1. BlockEditor — 核心共享组件

**文件**: `frontend/src/components/editor/BlockEditor.tsx`

#### 1.1 Props 接口

```typescript
interface BlockEditorProps {
  mode: 'lesson' | 'template';
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  readOnly?: boolean;
}

interface Block {
  id: string;
  type: 'section' | 'text' | 'list' | 'table' | 'timeline' | 'callout' | 'image';
  content: Record<string, any>;
  sort_order: number;
  placeholder?: string;
  is_required?: boolean;
}
```

#### 1.2 七种 Block 类型渲染

| Block Type | 教案模式渲染 | 模板模式渲染 |
|-----------|-------------|-------------|
| `section` | 灰底粗体标题，`font-weight: 600; font-size: 14px; background: var(--surface2); border-radius: 8px` | 同教案模式 |
| `text` | contenteditable 段落，`font-size: 13px; line-height: 1.7` | 灰色斜体 placeholder，`color: var(--t3); font-style: italic` |
| `list` | 有序/无序列表，`padding-left: 18px` | 灰色斜体 placeholder |
| `table` | HTML 表格，`border-collapse; th: var(--surface2); td: border-bottom var(--border)` | 同教案（结构预览） |
| `timeline` | 每行：时间段(50px) + 时长(46px) + 描述(flex:1)，可增删行 | 灰色斜体提示 |
| `callout` | 左边框 3px（蓝色 `var(--blue)`）+ `var(--blue-bg)` 底，`font-size: 12px` | 左边框琥珀色 `var(--amber)` + `var(--amber-bg)` 底 |
| `image` | 图片占位框（Phase 1 灰底 + "点击上传图片"） | 灰底 + "图片占位" |

#### 1.3 块间交互

**"+"插入按钮**：
- 块之间 hover 时显示紫色水平线 + 居中圆形 "+" 按钮
- 线：`background: var(--purple)`，按钮：`width: 20px; height: 20px; border-radius: 50%; background: var(--purple); color: var(--surface)`
- 点击 "+" → 展开块类型选择器：7 种类型图标 + 名称
- 选择后在该位置插入新块

**块操作**（hover 时显示）：
- 左侧 drag handle: `position: absolute; left: -18px; cursor: grab; opacity: 0 → hover: 1`
- 右上角删除按钮: `22px × 22px; border-radius: 4px; background: transparent → hover: var(--surface2)`

**拖拽排序**：
- 抓住 handle 拖动，块可在列表中移动位置
- 释放后更新 `sort_order` 并调用 `onChange`
- 推荐使用 `@dnd-kit/core` + `@dnd-kit/sortable`

#### 1.4 模板模式特殊行为

- Block content 显示为 placeholder（灰色斜体）
- 每个 block 可标记"建议保留"（`is_required`）：
  - 显示为 teal 底 teal 字的 pill badge
  - 样式：`font-size: 9px; padding: 2px 6px; border-radius: 3px; background: var(--teal-bg); color: var(--teal)`
- Section 类型在模板模式中 content 正常显示（不斜体）

### 2. 教案管理页面

#### 2.1 LessonPlanList

**文件**: `frontend/src/pages/LessonPlanList.tsx`
**路由**: `/lesson-plans`

**布局**：内容区 max-width 860px，左对齐（紧跟 sidebar 右侧）。

**结构**（匹配 v2 原型 `教案管理.html` 列表视图）：

```
┌─ 一级 Tab ──────────────────────────────────────┐
│ [教案(active)]  [模板]                              │
├─ 工具栏 ────────────────────────────────────────┤
│ [搜索教案...]  [全部学科▼]  [全部状态▼]  [+ 新建教案] │
├─ 教案列表 ──────────────────────────────────────┤
│ 12.2 三角形全等的判定 — SSS/SAS            [已完成] │
│ 八(2)班 · 数学 · 新授课 · 45 分钟 · 昨天 15:30      │
│ ✓ 课标 12.2 理解并掌握 SSS、SAS 判定方法           │
│─────────────────────────────────────────────────│
│ 12.2 三角形全等 — ASA/AAS                 [草稿]   │
│ 八(2)班 · 数学 · 新授课 · 45 分钟 · 今天            │
│ ⚠ 未关联学业要求                                   │
└─────────────────────────────────────────────────┘
```

**样式要点**（v2）：
- 页面 `max-width: 860px; padding: 28px 0`（左对齐，不居中）
- 一级 Tab：教案 | 模板，tab 切换导航到 `/lesson-plans` 或 `/templates`
  - Tab 样式：`font-size: 13px; font-weight: 500; color: var(--t3); border-bottom: 2px solid transparent`
  - 激活态：`color: var(--t1); border-bottom-color: var(--t1)`
- 列表项：`background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px`
- 列表项 hover：`border-color` 加深（不是 shadow）
- 学业要求标签（已关联）：`background: var(--teal-bg); color: var(--teal); border-radius: 6px; padding: 5px 10px; font-size: 11px` + teal 圆点（checkmark 图标）
- 未关联警告：`background: var(--amber-bg); color: var(--amber)` + amber 圆点
- 状态 badge：`font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 500`
  - draft: `background: var(--surface2); color: var(--t3)`
  - published: `background: var(--green-bg); color: var(--green)`
  - in_use: `background: var(--blue-bg); color: var(--blue)`
  - ai_generated: `background: var(--purple-bg); color: var(--purple)`

**交互**：
- 搜索：输入关键词 → debounce 300ms → `GET /api/lesson-plans?q=keyword`
- 筛选：选择学科/状态 → `GET /api/lesson-plans?subject_id=&status=`
- 点击列表项 → 导航到 `/lesson-plans/:id`
- 点击"+ 新建教案" → 导航到 `/lesson-plans/new`
- Tab "模板" → 导航到 `/templates`

#### 2.2 LessonPlanEditor

**文件**: `frontend/src/pages/LessonPlanEditor.tsx`
**路由**: `/lesson-plans/:id` 和 `/lesson-plans/new`

**布局**：内容区 max-width 920px，左对齐。内部使用 grid 两栏：

```css
.ed-layout {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 24px;
}
@media (max-width: 800px) {
  .ed-layout { grid-template-columns: 1fr; }
}
```

**结构**（匹配 v2 原型编辑器视图）：

```
← 教案列表

┌─ 主编辑区 ──────────────────┐ ┌─ 侧边栏 (200px) ──┐
│                              │ │                    │
│ ┌─ 学业要求区块(teal) ─────┐ │ │ 模板               │
│ │ 标 课标 12.2 理解...      │ │ │ ┌ 新授课模板 ─────┐ │
│ │    能运用判定方法...  [更换]│ │ │ └────────────────┘ │
│ └──────────────────────────┘ │ │                    │
│                              │ │ 关联数据            │
│ [标题输入: 12.2 三角形全等...] │ │ ● 课标: 12.2       │
│ [八(2)班▼] [数学▼] [新授课▼]  │ │ ● 学情: 八(2)班    │
│             自动保存 · 2分钟前 │ │                    │
│                              │ │ 文件               │
│ ─── BlockEditor ──────────── │ │ MD 教案.md    12K   │
│ │ 教学目标 (section)        │ │ │ PPT 课件.pptx 4.5M │
│ │  + (insert)               │ │ │ [上传文件]          │
│ │ · 理解并掌握... (list)    │ │ └────────────────────┘
│ │ 教学过程 (section)        │ │
│ │ 0-5' 5min 复习 (timeline) │ │
│ │ 学情备注 (callout)        │ │
│ └────────────────────────── │ │
│                              │ │
│ ─── 关联练习 ─────────────── │ │
│ SAS 判定专项练习  5 道题     │ │
│ [+ 关联练习]                 │ │
│                              │ │
│ [导出 Word] [导出 PDF] [保存] │ │
└──────────────────────────────┘ └────────────────────┘
```

**学业要求区块（RequirementBanner）**：
- 已关联（teal）：`background: var(--teal-bg); border-radius: 8px; padding: 14px 16px`
  - 左侧图标："标" 字 20×20 方块
  - 课标编号 + 条目文本（600 粗体）
  - 区级解读摘要（opacity 0.8, 11px）
  - 右侧："更换" 按钮（teal 底色）
- 未关联（amber）：`border: 1px dashed var(--amber); border-radius: 8px`
  - 文字："点击关联学业要求"

**标题输入**：`font-size: 20-22px; font-weight: 700; border: none; background: transparent; color: var(--t1)`

**Meta 选择器**：一行 select + 右侧"自动保存 · N 分钟前"

**BlockEditor**：`mode="lesson"`

**操作栏**：
- 按钮样式：`border: 1px solid var(--border); background: var(--surface); color: var(--t2); border-radius: 6px`
- 保存按钮：`background: var(--t1); color: var(--surface)`

**数据流**：
1. 加载：`GET /api/lesson-plans/:id` → 设置 state
2. 保存：收集当前 blocks → `POST /api/lesson-plans/:id/blocks`
3. 更新 meta：`PUT /api/lesson-plans/:id`
4. 新建（`/lesson-plans/new`）：`POST /api/lesson-plans` → 导航到编辑器

### 3. 模板管理页面

#### 3.1 TemplateList

**文件**: `frontend/src/pages/TemplateList.tsx`
**路由**: `/templates`

**布局**：内容区 max-width 860px，左对齐。

**结构**（匹配 v2 原型 `模板管理.html`）：

```
┌─ 一级 Tab ───────────────────────────────────────┐
│ [教案]  [模板(active)]                              │
├─ 二级 Tab ───────────────────────────────────────┤
│ [区级模板(5)]  [校本模板(3)]  [我的模板(2)]           │
├─ 工具栏 ────────────────────────────────────────┤
│ [搜索模板...]  [全部课型▼]              [+ 新建模板]   │
├─ 模板卡片列表 ──────────────────────────────────┤
│ ┌───────────────────────────────────────────┐   │
│ │ 新授课标准模板                       [区级]  │   │
│ │ 适用于新概念、新定理的讲授课型               │   │
│ │ [教学目标]→[重难点]→[教学过程]→[课堂练习]→... │   │
│ │ 使用 142 次 · 新授课 · 通用 · v2.0         │   │
│ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**一级 Tab**：教案 | 模板
- "教案" 点击 → 导航到 `/lesson-plans`
- "模板" 当前激活

**二级 Tab**：区级模板 | 校本模板 | 我的模板
- 切换 tab 时 `GET /api/templates?scope=district|school|teacher`
- Tab 样式：`font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent`

**模板卡片**（v2 样式）：
- `background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px`
- hover: `border-color` 加深（不是 shadow）
- 头部：模板名称(14px, 500) + scope badge(`font-size: 10px; padding: 2px 8px; border-radius: 4px`)
  - district = `background: var(--green-bg); color: var(--green)` "区级"
  - school = `background: var(--blue-bg); color: var(--blue)` "校本"
  - teacher = `background: var(--surface2); color: var(--t3)` "个人"
  - pending = `background: var(--amber-bg); color: var(--amber)` "审核中"
- 描述：`font-size: 11px; color: var(--t2)`
- Block pills：结构摘要，每个 pill `padding: 2px 6px; background: var(--surface2); border-radius: 3px; font-size: 10px`，用 "→" 箭头连接（v2 用箭头串联，不是简单罗列）
- 底部统计：使用次数 · 课型 · 学科 · 版本号

**交互**：
- 点击卡片 → 导航到 `/templates/:id`
- "我的模板"中非审核中的个人模板：显示"提交推优"按钮 → 打开 PromoteModal
- "+ 新建模板" → 导航到 `/templates/new`

#### 3.2 TemplateEditor

**文件**: `frontend/src/pages/TemplateEditor.tsx`
**路由**: `/templates/:id` 和 `/templates/new`

**布局**：内容区 max-width 640px，左对齐。

**结构**（匹配 v2 原型编辑器视图）：

```
← 返回模板列表

[标题输入: 新授课标准模板]
[描述输入: 适用于新概念、新定理的讲授课型]
[新授课▼] [通用（全学科）▼] [区级 badge] v2.0

┌─ Info Banner ─────────────────────────────────────┐
│ 模板定义教案的结构框架。每个内容块的文字是提示语...      │
└───────────────────────────────────────────────────┘

─── BlockEditor (mode="template") ───────────────────
│ 教学目标 (section)              [建议保留] [×]     │
│ 在此填写本节课的教学目标...（灰色斜体）               │
│ 教学过程 (section)              [建议保留] [×]     │
│ 0~5' 导入环节 (timeline-tpl)                       │
│ 学情备注 (callout-tpl, amber)                      │
│ + 添加内容块                                        │
─────────────────────────────────────────────────────

              [取消] [保存模板]
```

**Info Banner**: `padding: 10px 14px; background: var(--surface2); border-radius: 6px; font-size: 11px; color: var(--t2)`

**BlockEditor**: `mode="template"`

**按钮**：
- 取消：`border: 1px solid var(--border); background: var(--surface); color: var(--t2); border-radius: 6px`
- 保存：`background: var(--t1); color: var(--surface); border-radius: 6px`

#### 3.3 PromoteModal

**文件**: `frontend/src/components/template/PromoteModal.tsx`

**结构**：

```
┌── 提交推优 ──────────────── [×] ──┐
│                                    │
│ 推优目标                           │
│ [提交到校级审核 ▼]                  │
│                                    │
│ 模板名称                           │
│ [几何证明课模板            ]         │
│                                    │
│ 适用课型                           │
│ [新授课 · 数学             ]         │
│                                    │
│ 推荐理由                           │
│ [说明这个模板的特点...      ]         │
│                                    │
│              [取消] [提交]          │
└────────────────────────────────────┘
```

**样式**（v2）：
- Overlay: `background: var(--overlay)`（`rgba(0,0,0,0.4)`）
- Modal: `background: var(--surface); border: 1px solid var(--border); border-radius: 12px; width: 420px`
- Label: `font-size: 11px; color: var(--t2)`
- 输入框: `padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--surface)`
- 只读输入框: `background: var(--surface2); color: var(--t2)`
- Focus: `border-color: rgba(58,49,133,.3)`

**数据流**：提交 → `POST /api/templates/:id/promote { target_scope, reason }`

#### 3.4 RequirementBanner

**文件**: `frontend/src/components/editor/RequirementBanner.tsx`

两种状态：
1. **已关联（teal）**：
   - `background: var(--teal-bg); border-radius: 8px; padding: 14px 16px`
   - 课标编号 + 文本 + 解读 + "更换" 按钮
2. **未关联（amber 虚线框）**：
   - `border: 1px dashed var(--amber); border-radius: 8px`
   - "点击关联学业要求"

### 4. 文件结构总览

```
frontend/src/
├── pages/
│   ├── HomePage.tsx              # Harness B（冻结）
│   ├── LessonPlanList.tsx        # 新增：教案列表
│   ├── LessonPlanEditor.tsx      # 新增：教案编辑器
│   ├── TemplateList.tsx          # 新增：模板列表
│   └── TemplateEditor.tsx        # 新增：模板编辑器
├── components/
│   ├── editor/
│   │   ├── BlockEditor.tsx       # 新增：核心 Block 编辑器
│   │   ├── BlockTypeSelector.tsx # 新增：块类型选择弹出
│   │   ├── blocks/
│   │   │   ├── SectionBlock.tsx  # 新增
│   │   │   ├── TextBlock.tsx     # 新增
│   │   │   ├── ListBlock.tsx     # 新增
│   │   │   ├── TableBlock.tsx    # 新增
│   │   │   ├── TimelineBlock.tsx # 新增
│   │   │   ├── CalloutBlock.tsx  # 新增
│   │   │   └── ImageBlock.tsx    # 新增
│   │   └── RequirementBanner.tsx # 新增
│   ├── template/
│   │   └── PromoteModal.tsx      # 新增
│   ├── layout/
│   │   ├── Sidebar.tsx           # Harness B（冻结）
│   │   └── TopNav.tsx            # Harness B（冻结）
│   └── home/                     # Harness B（冻结）
├── types/
│   ├── dashboard.ts              # Harness B（冻结）
│   ├── lesson-plan.ts            # 新增
│   └── template.ts               # 新增
└── (existing files)
```

### 5. 路由更新

在 `App.tsx` 中添加：

```
/lesson-plans          → LessonPlanList
/lesson-plans/new      → LessonPlanEditor (新建模式)
/lesson-plans/:id      → LessonPlanEditor (编辑模式)
/templates             → TemplateList
/templates/new         → TemplateEditor (新建模式)
/templates/:id         → TemplateEditor (编辑模式)
```

### 6. 反模式检查清单

- [ ] BlockEditor 被两个编辑器共用（不复制代码）
- [ ] 模板模式下 content 为灰色斜体
- [ ] 无 box-shadow
- [ ] 使用 v2 design-tokens CSS 变量（`--surface`, `--border` 而非 `--bg1`, `--b1`）
- [ ] 七种 block 类型全部渲染
- [ ] 拖拽排序实现
- [ ] "+" 插入按钮 hover 显示紫色线
- [ ] 学业要求区块有 teal/amber 两种状态
- [ ] Tab 切换不全页面刷新（SPA 路由）
- [ ] 搜索使用 debounce
- [ ] 无纯白 `#fff`（用 `var(--surface)`）
- [ ] 卡片 hover 用 border-color（不是 shadow）
- [ ] 按钮圆角 6px（不是 8px）
- [ ] 卡片圆角 10px（不是 12px）
- [ ] Block pills 用箭头串联（不是简单罗列）
- [ ] 组件中无色值字面量（`'white'`、`'#fff'`、`rgba()`、hex）→ 全走 `var(--token)`

## Eval Rubric

### Scoring Dimensions (100 pts)

#### D1: BlockEditor (Weight: 30/100)

核心共享组件的完整性和正确性。

| Score | Description |
|-------|-------------|
| 5/5 | 7 种块类型全部渲染正确（匹配 v2 原型样式，使用 v2 变量）；"+" 插入按钮带紫色线 + 类型选择器；删除按钮 hover 显示；拖拽排序可用；教案模式和模板模式正确切换；"建议保留" badge 可 toggle；callout 用 `--blue`/`--amber`（不是 v1 `--info-t`/`--warn-t`） |
| 4/5 | 7 种块类型正确但交互缺 1 项 |
| 3/5 | 5-6 种块类型正确 |
| 2/5 | 3-4 种块类型，或模式未区分 |
| 1/5 | BlockEditor 不存在或 < 3 种类型 |

**Detection method**:
1. 文件存在：`ls frontend/src/components/editor/BlockEditor.tsx`
2. 7 种类型检查：`ls frontend/src/components/editor/blocks/*.tsx | wc -l` → 7
3. v2 变量使用：`grep -rn 'var(--surface\|var(--border\|var(--blue\|var(--amber\|var(--teal\|var(--purple' frontend/src/components/editor/` → 频繁使用
4. 无 v1 变量：`grep -rn 'var(--bg1\|var(--bg2\|var(--b1\|var(--info-t\|var(--warn-t' frontend/src/components/editor/` → 0
5. BlockEditor 被两个编辑器共用：`grep -rn 'import.*BlockEditor' frontend/src/pages/`

#### D2: Visual Fidelity (Weight: 25/100)

与 3 个 v2 HTML 原型的一致性。

| Score | Description |
|-------|-------------|
| 5/5 | 教案列表与 v2 原型一致（page-level tab、列表项 border-radius 10px、学业要求标签 teal/amber、卡片 hover 用 border-color）；编辑器一致（grid 两栏 1fr+200px、学业要求区块）；模板列表一致（双层 tab、block pills 箭头串联）；推优弹窗一致（`var(--overlay)` 遮罩） |
| 4/5 | 整体一致但 2-3 处偏差 |
| 3/5 | 布局正确但使用 v1 变量或色值 |
| 2/5 | 只有列表页一致 |
| 1/5 | 与 v2 原型大幅不同 |

**Detection method**:
1. `grep -rn 'box-shadow' frontend/src/pages/ frontend/src/components/editor/ frontend/src/components/template/` → 0
2. `grep -rn "'#fff'\|'white'" frontend/src/pages/ frontend/src/components/editor/ frontend/src/components/template/` → 0
3. 关键样式值：列表项 `border-radius: 10px`，按钮 `border-radius: 6px`，编辑器侧边栏 `200px`
4. 浏览器截图与 v2 原型并排比对

#### D3: CRUD Completeness (Weight: 20/100)

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
grep -rn 'api/lesson-plans' frontend/src/ | wc -l  # → ≥ 5
grep -rn 'api/templates' frontend/src/ | wc -l      # → ≥ 5
grep -rn 'promote' frontend/src/ | wc -l            # → ≥ 2
grep -rn 'debounce\|setTimeout' frontend/src/pages/LessonPlanList.tsx | wc -l  # → ≥ 1
```

#### D4: Interaction (Weight: 15/100)

交互细节完整性。

| Score | Description |
|-------|-------------|
| 5/5 | 学业要求关联/更换完整；块类型选择器可用；page-level tab 教案/模板切换；状态 badge v2 颜色映射正确；分页+loading；搜索 debounce；卡片 hover border-color 变化 |
| 4/5 | 核心交互完整但缺 1 项 |
| 3/5 | 基本交互可用但缺少状态处理 |
| 2/5 | 只有基础点击交互 |
| 1/5 | 交互严重缺失 |

#### D5: Code Quality (Weight: 10/100)

| Score | Description |
|-------|-------------|
| 5/5 | BlockEditor 独立组件复用；TypeScript 类型完整；无 `any`；CSS 使用 v2 design-tokens 变量；每个 block 类型独立文件 |
| 4/5 | 基本规范但有 1-2 处 any |
| 3/5 | BlockEditor 复用但类型不完整 |
| 2/5 | 代码复制而非复用 |
| 1/5 | 代码结构混乱 |

### Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| BlockEditor 代码复制 | -10 | 教案和模板编辑器各自有独立的 block 渲染代码 |
| 使用 box-shadow | -3/处 | 任何新组件使用 box-shadow |
| 破坏首页 | -15 | `/` 路由不再渲染 HomePage |
| 破坏 Chat | -15 | `/chat` 路由不再渲染 ChatInterface |
| 缺少 block 类型 | -3/类型 | 7 种中缺失的每种 |
| 硬编码颜色值 | -2/处 | 不使用 CSS 变量 |
| 使用 v1 变量名 | -5 | 使用 `--bg1`/`--b1`/`--info-t` 而非 v2 变量 |
| 使用纯白 #fff | -3 | 卡片背景使用 `#fff` 而非 `--surface` |
| 修改冻结文件 | -10/文件 | 修改了 Harness B 产出或其他冻结文件 |
| 组件色值字面量 | -2/处 | 组件代码中出现 `'white'`、`'#fff'`、`rgba()` 等色值字面量 |

### Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 总分 = 基础分 - Penalty 扣分（满分 100）
3. 报告最后一行: `总分: XX/100`

### Thresholds

- **Pass**: 75/100
- **Target**: 90/100

## Agent Architecture

### Generator

- **Role**: React 前端开发者，精通组件设计和设计还原
- **Perspective**: 你的核心交付物是 BlockEditor — 一个在教案和模板间复用的组件。在此基础上构建 4 个页面。注意 v2 设计：变量重命名、左对齐布局、sidebar 导航、新字体、新色值、新圆角值。
- **Input**: 本 HARNESS_SPEC、3 个 v2 HTML 原型、v2 PRD-02、v2 设计规范.md、v2 用户故事/教案管理.md、现有 frontend/src/ 源码（含 Harness B 产出）
- **Output**: 新增/修改 frontend/src/ 下的文件
- **Isolation**: 每轮 fresh context

### Evaluator

- **Role**: 独立前端质量审查员 + 视觉比对审查员
- **Perspective**: 着重检查 BlockEditor 的 7 种类型渲染、教案/模板双模式切换、与 v2 原型的视觉一致性。额外关注 v2 特有要素：tinted neutral 色系、按钮 6px 圆角、卡片 10px 圆角、hover border-color、page-level tab。
- **Input**: EVAL_CRITERIA（本文件 Eval Rubric 部分）、frontend/ 源码、3 个 v2 HTML 原型
- **Output**: eval-reports/vN-eval.md
- **Phase A**: 静态分析（文件存在、grep 复用、v2 变量名检查、grep box-shadow、grep 纯白）
- **Phase B**: 运行时验证（启动前端 → 浏览器截图比对 → 完整 CRUD 流程测试）

## Exit Conditions

- **Score threshold**: ≥ 90/100
- **Max iterations**: 8 轮
- **Diminishing returns**: 连续 2 轮提升 < 3 分
- **Cost cap**: $100
- **Regression**: 分数下降 > 5 分 → 回滚到最高分版本

## Verification Commands

```bash
# 1. 安装依赖（如需拖拽库）
cd solutions/business/edu-platform/frontend && npm install

# 2. 编译检查
npx tsc --noEmit

# 3. 启动前端（需要后端已运行在 3011 + seed 数据）
npm run dev &

# 4. 检查文件存在
ls src/components/editor/BlockEditor.tsx
ls src/components/editor/blocks/{SectionBlock,TextBlock,ListBlock,TableBlock,TimelineBlock,CalloutBlock,ImageBlock}.tsx
ls src/pages/{LessonPlanList,LessonPlanEditor,TemplateList,TemplateEditor}.tsx
ls src/components/template/PromoteModal.tsx
ls src/components/editor/RequirementBanner.tsx
ls src/types/{lesson-plan,template}.ts

# 5. BlockEditor 复用检查
grep -rn 'import.*BlockEditor' src/pages/  # → 应出现在两个编辑器中

# 6. v2 变量名检查
grep -rn 'var(--surface' src/components/editor/ src/pages/ src/components/template/ | wc -l  # → ≥ 5
grep -rn 'var(--border' src/components/editor/ src/pages/ src/components/template/ | wc -l   # → ≥ 5
grep -rn 'var(--bg1\|var(--b1\|var(--info-t' src/components/editor/ src/pages/ | wc -l       # → 0 (无 v1 变量)

# 7. 反模式检查
grep -rn 'box-shadow' src/components/editor/ src/pages/ src/components/template/ | wc -l      # → 0
grep -rn "'#fff'\|'white'\|'#000'" src/components/editor/ src/pages/ src/components/template/ | wc -l  # → 0
grep -rn "rgba(" src/components/editor/ src/pages/ src/components/template/ | wc -l            # → 0 (组件禁止色值字面量)

# 8. 浏览器验证
# 访问 http://localhost:5173/lesson-plans → 教案列表（tinted neutral 底色）
# page-level tab 可切换到 /templates
# 点击教案 → 编辑器渲染，grid 两栏（1fr + 200px）
# 访问 /templates → 模板列表，3 个 scope tab
# 点击模板 → placeholder 灰色斜体
# 确认 / 和 /chat 仍正常工作
```
