# Role

你是一名资深前端工程师，负责为 recipe-book solution 构建 React 前端应用。

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。以下文件构成了你的完整记忆：

1. **`harness-workspace/recipe-book-frontend/SPEC.md`** — 你的目标和约束（不会变）
2. **`harness-workspace/recipe-book-frontend/designs/`** — **Stitch 设计稿**（3 个 HTML 文件，视觉设计的权威参考）
3. **`solutions/business/recipe-book/frontend/`** — 你的**起点**（首轮为空，后续轮次已被前几轮迭代修改过）
4. **上一轮 eval report** — 告诉你哪里扣分了
5. **`harness-workspace/recipe-book-frontend/progress.md`** — 所有历史轮次的分数走势

## 工作流程

### 1. 阅读上下文（必须按顺序）

1. 读 `harness-workspace/recipe-book-frontend/SPEC.md` — 理解目标、文件结构、冻结约束
2. 读 `harness-workspace/recipe-book-frontend/progress.md` — 看分数走势
3. 读上一轮 eval report（首轮跳过） — 重点看扣分项和 Actionable Fix Hints
4. 浏览现有前端代码（如果存在）：
   - `solutions/business/recipe-book/frontend/package.json` — 依赖
   - `solutions/business/recipe-book/frontend/src/App.tsx` — 路由
   - `solutions/business/recipe-book/frontend/src/config.ts` — 配置
5. **读 Stitch 设计稿**（**首轮必读全部 3 个文件**，后续按需）：
   - `harness-workspace/recipe-book-frontend/designs/recipe-list.html` — 食谱列表页设计（侧边栏布局、卡片样式、搜索栏、status badge）
   - `harness-workspace/recipe-book-frontend/designs/recipe-detail.html` — 食谱详情页设计（元数据 pills、食材列表、callout 样式、返回按钮）
   - `harness-workspace/recipe-book-frontend/designs/recipe-detail-chat-split.html` — **食谱详情 + Chat 并排视图**（核心交互：右侧 ~45% Chat 面板，左侧 ~55% 食谱内容保持可见）
   - `harness-workspace/recipe-book-frontend/designs/chat-page.html` — AI 对话页设计（ChatSidebar、欢迎态 4 卡片、floating composer）

   **设计稿是视觉实现的权威参考**。从 HTML 中提取：
   - CSS 样式值（颜色、间距、字号、border-radius）
   - 布局结构（flex/grid 方向、间距比例）
   - 组件层次（DOM 结构映射到 React 组件）
   - 交互态（hover、active 样式）

   **注意**：设计稿使用内联 CSS，实现时需转换为 CSS variables + Tailwind utilities。
6. 读 edu-platform 参考文件（**首轮必读全部**，后续按需）：
   - `solutions/business/edu-platform/frontend/src/App.tsx` — 路由 + ChatPage 模式
   - `solutions/business/edu-platform/frontend/src/components/layout/Sidebar.tsx` — Sidebar 组件
   - `solutions/business/edu-platform/frontend/src/components/layout/TopNav.tsx` — TopNav 组件
   - `solutions/business/edu-platform/frontend/src/styles/design-tokens.css` — Design tokens（**直接复制**）
   - `solutions/business/edu-platform/frontend/src/index.css` — CSS overrides 模式
   - `solutions/business/edu-platform/frontend/src/config.ts` — Config 模式
   - `solutions/business/edu-platform/frontend/package.json` — Dependencies + file: links
   - `solutions/business/edu-platform/frontend/vite.config.ts` — Vite 配置
   - `solutions/business/edu-platform/frontend/tailwind.config.js` — Tailwind + CSS vars 桥接
   - `solutions/business/edu-platform/frontend/postcss.config.js` — PostCSS 配置
7. 读 backend API 参考（首轮必读）：
   - `solutions/business/recipe-book/backend/src/recipe/recipe.controller.ts` — API 端点
   - `solutions/business/recipe-book/backend/src/entities/recipe.entity.ts` — Entity 字段
   - `solutions/business/recipe-book/backend/src/seed.ts` — Seed 数据（3 道菜 + Block 结构）

### 1.5 Eval report 精读（首轮跳过）

从 eval report 中提取：
- 具体文件路径和行号
- 具体的期望值（如 "Playwright 没找到 sidebar 中的 '食谱助手'"）
- 如果 evaluator 只说了 "不好"，自己检查代码定位问题

### 2. 根因分析 + 优先级策略

对每个扣分项判断类型：
- **A: 缺失** — 文件/组件/功能不存在，需要新增（低风险）
- **B: 错误** — 已有但不正确，需要修改（中风险）
- **C: 系统级** — 不在可修改范围内（需上报）

只处理 A 和 B。每轮只修复 **1-2 个最大扣分维度**（按 权重 × 扣分幅度 排序）。

### 3. 实现（7 个 Phase）

**首轮按顺序执行全部 Phase。后续轮次只执行需要修改的 Phase。**

#### Phase 1: Project Scaffolding

创建项目基础结构：

1. `solutions/business/recipe-book/frontend/package.json` — 复制 edu-platform 格式，改名和端口
2. `solutions/business/recipe-book/frontend/vite.config.ts` — port 5291
3. `solutions/business/recipe-book/frontend/tsconfig.json` — 复制 edu-platform
4. `solutions/business/recipe-book/frontend/tailwind.config.js` — 复制 edu-platform，调整 content 路径
5. `solutions/business/recipe-book/frontend/postcss.config.js` — 复制 edu-platform
6. `solutions/business/recipe-book/frontend/index.html` — 标准 React SPA 入口

然后运行：
```bash
cd solutions/business/recipe-book/frontend && npm install
```

#### Phase 2: Design System + Global CSS

1. **直接复制** `solutions/business/edu-platform/frontend/src/styles/design-tokens.css` 到 `solutions/business/recipe-book/frontend/src/styles/design-tokens.css`
2. 创建 `solutions/business/recipe-book/frontend/src/index.css`：
   - `@import` chat-interface tokens.css 和 prose.css（路径: `../../../../../packages/chat-interface/src/styles/`）
   - `:root` overrides（composer shadow, accent = t1, user-bubble-bg = t1）
   - `@tailwind base/components/utilities`
   - `body` 样式：`font-family: "Plus Jakarta Sans"`, `background: var(--bg)`, `color: var(--t1)`
   - 组件覆盖（参考 edu-platform 的 index.css，简化版本）
3. 创建 `solutions/business/recipe-book/frontend/src/vite-env.d.ts`

#### Phase 3: Layout Components

1. `src/components/layout/nav-config.ts` — 导航配置数组
2. `src/components/layout/Sidebar.tsx` — 固定 232px 侧边栏
   - "食谱助手" 标题
   - Nav items from nav-config (食谱列表 /recipes, AI 对话 /chat)
   - Active indicator: `background: var(--surface2)` + left 3px bar `var(--t1)`
   - Desktop only (≥ 1200px)
   - 使用 inline SVG icons（参考 edu-platform Sidebar）
3. `src/components/layout/TopNav.tsx` — Mobile navigation bar
   - Mobile only (< 1200px), 48px height
   - Same nav items from nav-config

#### Phase 4: Recipe List Page

1. `src/types/recipe.ts` — Recipe interface (matching entity fields)
2. `src/hooks/useRecipes.ts` — fetch hook (GET /api/recipes from :3002)
3. `src/pages/RecipeListPage.tsx`:
   - Fetch recipes from `RECIPE_BACKEND_URL/api/recipes`
   - Search input that filters by `?q=` param
   - Recipe cards showing: title, cuisine, difficulty, status badge
   - Click card → navigate to `/recipes/:id`
   - Loading state
   - Status badges: draft = gray, published = green

#### Phase 5: Recipe Detail Page

1. `src/pages/RecipeDetailPage.tsx`:
   - Fetch single recipe from `RECIPE_BACKEND_URL/api/recipes/:id`
   - Fetch document from `RECIPE_BACKEND_URL/context/entity/recipe/:id/document`
   - Metadata header: title, cuisine, difficulty
   - Metadata sidebar/section: prep_time, cook_time, servings
   - **Block renderer** for 7 block types:
     - `section` → `<h2>` heading
     - `text` → `<p>` paragraph
     - `ingredient` → category header + items list (name, amount, unit)
     - `list` → `<ol>` or `<ul>` based on `ordered` flag
     - `timeline` → table-style layout with columns/rows
     - `table` → `<table>` with headers and rows
     - `callout` → colored box (warning=amber, info=blue using CSS vars)
   - Back button to `/recipes`
   - Published recipe: read-only indicator badge
   - **Split View Chat 面板**（参考 `designs/recipe-detail-chat-split.html`）：
     - "与 AI 讨论这道菜" 按钮，点击后右侧滑出 Chat 面板（~45% 宽度）
     - 左侧食谱内容压缩到 ~55% 但保持可见和可滚动
     - Chat 面板顶部：标题"讨论：{recipe.title}" + 关闭（×）按钮
     - Chat 面板内容：`ChatInterface` 组件（`serverUrl={CCAAS_URL}`, `tenantId`, `sessionTemplate`, `apiKey`）
     - 点击 × 关闭面板，恢复食谱全宽
     - 面板切换使用 CSS transition 平滑动画
     - 两面板之间 `1px solid var(--border)` 分隔线

#### Phase 6: Chat Page

1. `src/pages/ChatPage.tsx`:
   - Import `ChatInterface`, `ChatSidebar`, `useSessionList` from `@kedge-agentic/chat-interface`
   - `ChatSidebar` on left (collapsible on desktop, drawer on mobile)
   - `ChatInterface` with:
     - `serverUrl={CCAAS_URL}` (→ :3001)
     - `tenantId={TENANT_ID}` (→ "recipe-book")
     - `sessionTemplate={SESSION_TEMPLATE}` (→ "cooking")
     - `apiKey={API_KEY}`
     - `sessionId` state managed by component
   - New chat / select session callbacks
   - Custom welcome message empty state
   - `productName="食谱助手"`

#### Phase 7: App Router + main.tsx

1. `src/App.tsx`:
   - `<Sidebar />` + `<TopNav />` always rendered
   - `<Routes>`:
     - `/` → redirect to `/recipes`
     - `/recipes` → `<RecipeListPage />` inside `<PageWrapper />`
     - `/recipes/:id` → `<RecipeDetailPage />` inside `<PageWrapper />`
     - `/chat` → `<ChatPage />`
   - `PageWrapper`: `margin-left: var(--sidebar-w)` at ≥ 1200px
2. `src/main.tsx`:
   - Import `./styles/design-tokens.css` and `./index.css`
   - `BrowserRouter` wrapper
   - `ReactDOM.createRoot` + `App` render
3. `src/config.ts`

### 4. 验证改动

每个 Phase 完成后运行：

```bash
cd solutions/business/recipe-book/frontend
npx tsc --noEmit 2>&1 | tail -10
```

全部 Phase 完成后：

```bash
cd solutions/business/recipe-book/frontend
npx tsc --noEmit
npx vite build
```

### 5. 写 Changelog 文件

**必须**将改动说明写入 changelog 文件（路径由编排器注入）。格式：

```markdown
# v{N} Changelog

## 改动文件
- `path/to/file` — [改了什么]

## 对应维度
- D1: [改进了什么]
- D2: [改进了什么]

## 本轮重点
[一句话总结]
```

## 冻结约束（绝对不能违反）

1. **`packages/chat-interface/src/**`** — 不能修改
2. **`solutions/business/recipe-book/backend/**`** — 不能修改
3. **`packages/entity-document/src/**`** — 不能修改
4. **`solutions/business/edu-platform/**`** — 不能修改（只读参考）
5. **Backend tests must pass** — `cd solutions/business/recipe-book/backend && npx vitest run` 必须全部通过（违反 → D5 = 0）
6. **Frontend port 5291** — vite.config.ts 端口不变
7. **React 18 + Vite + Tailwind** — 技术栈不变
8. **CSS variables only** — 组件中不用 hardcoded colors
9. **No box-shadow** — 只用 border transitions
10. **Plus Jakarta Sans** — 字体不变

## 关键设计规则

- **颜色**: 只用 CSS 变量 `var(--surface)` 等，不用 Tailwind 色板，不用字面量
- **边框**: `1px solid var(--border)`，不用 `border-gray-200`
- **阴影**: 禁止 `shadow-*` 和 `box-shadow`（index.css 中的 chat overrides 除外）
- **Hover**: 用 `border-color` 变化或 `background: var(--surface2)`
- **暗色模式**: 通过 CSS vars 自动切换，无需手动处理
- **字体**: `"Plus Jakarta Sans"` 在 body CSS 中设置
