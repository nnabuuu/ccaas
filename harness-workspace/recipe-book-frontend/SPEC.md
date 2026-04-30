# Spec — recipe-book-frontend

## Objective

为 recipe-book solution 构建前端应用。双面板布局：左侧食谱管理（列表 + 详情 + Block 渲染），右侧 AI 对话（通过 ChatInterface 接入 CCAAS core）。

### 目标

1. 完整的食谱浏览和详情展示（含 7 种 Block 类型渲染）
2. ChatInterface + ChatSidebar 集成，连接 CCAAS core
3. 响应式 App Shell（Sidebar + TopNav）
4. 与 edu-platform 一致的视觉风格（共用 design-tokens.css）
5. 通过 tsc + vite build 构建验证

### 现状

- recipe-book backend 已完成，运行在 :3002，提供 CRUD + context-layer API
- 3 道种子食谱已 seed（鱼香肉丝/番茄炒蛋/提拉米苏）
- Block 类型：section, text, ingredient, list, timeline, table, callout
- CCAAS core 运行在 :3001，提供 ChatInterface 所需的 SSE/session API
- edu-platform frontend 是完整参考实现
- **Stitch 设计稿已完成**：3 个页面的 HTML 原型在 `harness-workspace/recipe-book-frontend/designs/`

### Stitch 设计稿（必须参考）

以下 HTML 文件是 **视觉设计的权威参考**，实现时必须还原设计稿中的布局、颜色、间距、排版：

| 文件 | 页面 | 关键设计点 |
|------|------|-----------|
| `designs/recipe-list.html` | 食谱列表页 | 232px 侧边栏 + 2 列卡片网格，搜索栏，status badge 颜色 |
| `designs/recipe-detail.html` | 食谱详情页 | 返回按钮 + 元数据 pills + 食材结构化列表 + amber/blue callout |
| `designs/recipe-detail-chat-split.html` | 食谱详情 + Chat 并排视图 | **核心交互**：点击"与 AI 讨论"后右侧滑出 Chat 面板（~45%），左侧食谱内容压缩但保持可见 |
| `designs/chat-page.html` | AI 对话页 | ChatSidebar + 欢迎态 4 卡片 + floating composer |

**读取方式**：用 Read 工具读取 HTML 文件，提取 CSS 样式和布局结构作为实现参考。

---

## Artifact

### 新建文件

```
solutions/business/recipe-book/frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── config.ts
    ├── vite-env.d.ts
    ├── styles/
    │   └── design-tokens.css          # 直接复制 edu-platform 的 token
    ├── index.css                       # tailwind + chat-interface overrides
    ├── components/
    │   └── layout/
    │       ├── Sidebar.tsx
    │       ├── TopNav.tsx
    │       └── nav-config.ts
    ├── pages/
    │   ├── RecipeListPage.tsx
    │   ├── RecipeDetailPage.tsx
    │   └── ChatPage.tsx
    ├── hooks/
    │   └── useRecipes.ts
    └── types/
        └── recipe.ts
```

---

## Design Details

### config.ts

```typescript
/** Recipe-book backend URL (port 3002) */
export const RECIPE_BACKEND_URL = import.meta.env.VITE_RECIPE_URL || 'http://localhost:3002'

/** CCAAS core URL (port 3001) — for ChatInterface */
export const CCAAS_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'

/** CCAAS tenant ID */
export const TENANT_ID = 'recipe-book'

/** Session template for cooking assistant */
export const SESSION_TEMPLATE = 'cooking'

/** API key */
export const API_KEY = 'sk-default-testd84f5b7a1dbdbc4c424417be6c009f01'
```

### Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Redirect | → `/recipes` |
| `/recipes` | RecipeListPage | 食谱列表，搜索过滤 |
| `/recipes/:id` | RecipeDetailPage | 食谱详情 + Block 渲染 + Split View Chat |
| `/chat` | ChatPage | ChatInterface + ChatSidebar |

### Design Tokens

直接复制 `solutions/business/edu-platform/frontend/src/styles/design-tokens.css`。

**Light mode:**
- `--bg: #f4f3ef`, `--surface: #fbfaf7`, `--surface2: #edece7`
- `--t1: #1c1c1a`, `--t2: #5c5b56`, `--t3: #9c9a92`
- `--border: rgba(28, 28, 26, 0.07)`

**Dark mode:** 对应暗色值，通过 `@media (prefers-color-scheme: dark)` 自动切换。

**语义色:** `--blue`, `--green`, `--amber`, `--red`, `--purple`, `--teal`, `--coral`

**布局:** `--sidebar-w: 232px`

不做自定义配色，保持与 edu-platform 一致的视觉风格。

### Layout

- **Sidebar**: 固定左侧 232px，desktop (≥1200px) 显示，mobile 隐藏
  - Logo/title: "食谱助手"
  - Nav items: 食谱列表 (/recipes), AI 对话 (/chat)
  - Active indicator: `background: var(--surface2)` + left 3px bar
- **TopNav**: mobile only (< 1200px)，48px height
  - Text links for navigation
- **PageWrapper**: `margin-left: var(--sidebar-w)` at ≥ 1200px
- **ChatPage**: full-height, `margin-left: var(--sidebar-w)` at ≥ 1200px

### Recipe Detail + Chat Split View（核心交互）

参考设计稿 `designs/recipe-detail-chat-split.html`。

**交互流程**：
1. 用户在食谱详情页点击"与 AI 讨论这道菜"按钮
2. 右侧滑出 Chat 面板（~45% 宽度），左侧食谱内容压缩到 ~55% 但保持可见和可滚动
3. Chat 面板顶部显示"讨论：{recipe.title}" + 关闭（×）按钮
4. 用户可以边看食谱边与 AI 对话
5. 点击 × 关闭 Chat 面板，恢复食谱全宽显示

**实现要点**：
- 使用 React state 控制 Chat 面板开关（`isChatOpen`）
- Chat 面板使用 `ChatInterface` 组件，`serverUrl={CCAAS_URL}`, `tenantId={TENANT_ID}`, `sessionTemplate={SESSION_TEMPLATE}`, `apiKey={API_KEY}`
- 面板切换使用 CSS transition 实现平滑动画
- 两个面板之间有 `1px solid var(--border)` 分隔线
- Mobile（< 1200px）下 Chat 面板改为全屏覆盖或 drawer 模式

### Recipe API (backend :3002)

```
GET  /api/recipes          # list, ?q= search, ?page=&limit= pagination
GET  /api/recipes/:id      # single recipe
GET  /context/entity/recipe/:id/document  # block document (markdown)
```

### Recipe Entity Fields

```typescript
interface Recipe {
  id: string           // uuid
  title: string
  cuisine: string      // 川菜, 家常, 西餐
  difficulty: string   // easy, medium, hard
  prep_time: number    // minutes
  cook_time: number    // minutes
  servings: number
  status: string       // 'draft' | 'published'
  blocks: Block[]      // JSON array of block objects
}
```

### Block Types (7 types)

| Type | Structure | Rendering |
|------|-----------|-----------|
| `section` | `{ heading: string }` | `<h2>` or `<h3>` |
| `text` | `{ text: string }` | `<p>` |
| `ingredient` | `{ items: [{name, amount, unit}], category: string }` | Structured list with category header |
| `list` | `{ ordered: boolean, items: string[] }` | `<ol>` or `<ul>` |
| `timeline` | `{ columns: string[], rows: object[] }` | Timeline or table layout |
| `table` | `{ columns: string[], rows: object[] }` | `<table>` |
| `callout` | `{ text: string, color: 'warning'|'info' }` | Colored box (amber-bg for warning, blue-bg for info) |

### Seed Data (3 recipes)

1. **鱼香肉丝** — 川菜, medium, draft, 9 blocks (all 7 types)
2. **番茄炒蛋** — 家常, easy, draft, 5 blocks
3. **提拉米苏** — 西餐, hard, published, 7 blocks

### Dependencies (package.json)

```json
{
  "dependencies": {
    "@kedge-agentic/chat-interface": "file:../../../../packages/chat-interface",
    "@kedge-agentic/common": "file:../../../../packages/common",
    "@kedge-agentic/react-sdk": "file:../../../../packages/react-sdk",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.14.0"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.16",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.6.0",
    "vite": "^6.0.7"
  }
}
```

---

## Frozen Constraints

| ID | Constraint | Penalty |
|----|------------|---------|
| FC-1 | `packages/chat-interface/src/` NOT modified | D1 → 0 |
| FC-2 | `solutions/business/recipe-book/backend/` NOT modified | D2 → 0 |
| FC-3 | `packages/entity-document/src/` NOT modified | D3 → 0 |
| FC-4 | `solutions/business/edu-platform/` NOT modified (read-only reference) | D4 → 0 |
| FC-5 | Backend tests pass (`vitest run` in recipe-book/backend/) | D5 → 0 |
| FC-6 | Port 5291 for frontend dev server | — |
| FC-7 | React 18 + Vite + Tailwind | — |
| FC-8 | CSS variables only, no hardcoded colors | — |
| FC-9 | No box-shadow, border transitions only | — |
| FC-10 | Plus Jakarta Sans font | — |

---

## Key Reference Files

Read these for implementation patterns:

| File | Purpose |
|------|---------|
| `harness-workspace/recipe-book-frontend/designs/recipe-list.html` | **设计稿**: 食谱列表页布局和样式 |
| `harness-workspace/recipe-book-frontend/designs/recipe-detail.html` | **设计稿**: 食谱详情页布局和样式 |
| `harness-workspace/recipe-book-frontend/designs/recipe-detail-chat-split.html` | **设计稿**: 食谱详情 + Chat 并排视图（核心交互） |
| `harness-workspace/recipe-book-frontend/designs/chat-page.html` | **设计稿**: AI 对话页布局和样式 |
| `solutions/business/edu-platform/frontend/src/App.tsx` | Routing, ChatPage, PageWrapper patterns |
| `solutions/business/edu-platform/frontend/src/components/layout/Sidebar.tsx` | Sidebar component pattern |
| `solutions/business/edu-platform/frontend/src/components/layout/TopNav.tsx` | TopNav component pattern |
| `solutions/business/edu-platform/frontend/src/styles/design-tokens.css` | Design tokens (copy this) |
| `solutions/business/edu-platform/frontend/src/index.css` | CSS overrides pattern |
| `solutions/business/edu-platform/frontend/src/config.ts` | Config pattern |
| `solutions/business/edu-platform/frontend/package.json` | Dependencies and file: links |
| `solutions/business/edu-platform/frontend/vite.config.ts` | Vite config pattern |
| `solutions/business/edu-platform/frontend/tailwind.config.js` | Tailwind + CSS vars bridge |
| `solutions/business/recipe-book/backend/src/recipe/recipe.controller.ts` | Recipe API endpoints |
| `solutions/business/recipe-book/backend/src/entities/recipe.entity.ts` | Recipe entity fields |
| `solutions/business/recipe-book/backend/src/seed.ts` | Seed data (3 recipes + block structures) |

---

## Exit Conditions

| Condition | Value |
|-----------|-------|
| Target | 95/100 |
| Pass | 90/100 |
| Max iterations | 8 |
| Diminishing returns | < 3 pts for 2 consecutive iterations |
| Cost cap | $250 |
