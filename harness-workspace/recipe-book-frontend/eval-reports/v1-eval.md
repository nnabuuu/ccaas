# Eval Report — recipe-book-frontend v1

## Per-Dimension Scores

### D1 App Shell + Navigation (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **1.1 Frontend loads (2/2)**: `http://localhost:5291` loads, redirects to `/recipes`, page title "食谱助手". No errors.
- **1.2 Sidebar content (3/3)**: Snapshot at 1400px shows `complementary` landmark with "食谱助手" title and 2 nav links: "食谱列表" + "AI 对话".
- **1.3 Active indicator (2/2)**: On `/recipes`, "食谱列表" has class `sb-link act` with `bg: rgb(237, 236, 231)` vs transparent for inactive "AI 对话".
- **1.4 TopNav mobile (2/2)**: At 375×812, TopNav `navigation` element visible with "食谱助手", "食谱列表", "AI 对话". At 1400×900, TopNav hidden, sidebar `complementary` visible.
- **1.5 Route /recipes (3/3)**: Navigating to `/recipes` renders heading "食谱列表", subtitle "管理你的所有食谱", search input, and 3 recipe cards.
- **1.6 Route /recipes/:id (3/3)**: Navigating to `/recipes/2cb3149d-...` renders detail page with "鱼香肉丝" title, metadata, ingredients, tables.
- **1.7 Route /chat (3/3)**: Navigating to `/chat` renders ChatInterface with composer textarea, message area, welcome content, and ChatSidebar.
- **1.8 CSS variables (2/2)**: `grep -c "var(--"` found 92 occurrences across 6 .tsx files (≥10 threshold met).

**Suggestion**: None needed — all checks pass.

### D2 Recipe List Page (Weight: 20/100)
**Score: 18/20**
**Justification**:
- **2.1 Three recipes (4/4)**: Snapshot confirms "提拉米苏", "番茄炒蛋", "鱼香肉丝" all visible as cards.
- **2.2 Card fields (3/3)**: First card text `"提拉米苏已发布西餐困难30+0min4人份"` — has title, cuisine ("西餐"), difficulty ("困难"). All 3 fields present.
- **2.3 Status badges (2/2)**: "已发布" and "草稿" badges visible with distinct styling on each card.
- **2.4 Search filter (3/3)**: Typing "鱼香" in search input filters to only "鱼香肉丝" card. Other recipes hidden.
- **2.5 Card click (3/3)**: Clicking 鱼香肉丝 card navigates to `/recipes/2cb3149d-84bb-41cb-a9b1-72b3e380f5ae`.
- **2.6 API to :3002 (3/3)**: Network requests show `[GET] http://localhost:3002/api/recipes => 200`, `[GET] http://localhost:3002/api/recipes?q=鱼香 => 200`.
- **2.7 Loading state (0/2)**: Source code has `loading ? <p>加载中...</p>` (RecipeListPage.tsx:35-36), but `browser_evaluate` on loaded page found no loading indicators. The loading state exists in code but is transient — it shows "加载中..." text, not a skeleton/spinner. The check is ambiguous since data loads too fast to observe. However, the code does implement a loading state. Giving 0 because runtime detection failed.

**Suggestion**: Use a skeleton loader or add a `data-loading` attribute so the loading state is detectable even when data loads fast.

### D3 Recipe Detail + Block Viewer (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **3.1 Detail metadata (3/3)**: 鱼香肉丝 page shows title "鱼香肉丝" (h1), "川菜", "中等", "准备时间: 20 分钟", "烹饪时间: 15 分钟", "份量: 2 人份".
- **3.2 Document fetch (2/2)**: Network requests show `[GET] http://localhost:3002/context/entity/recipe/2cb3149d-.../document => 200`.
- **3.3 Section headings (2/2)**: `document.querySelectorAll('h2, h3')` returns 3 headings: "食材准备" (h2), "主料" (h3), "调料" (h3). "食材准备" confirmed.
- **3.4 Ingredient blocks (3/3)**: Ingredients visible: "猪里脊 200g · 切丝", "木耳 50g · 泡发", "胡萝卜 1根 · 切丝" under 主料; "郫县豆瓣酱 1勺", "醋 2勺", "糖 1勺" under 调料.
- **3.5 Callout blocks (2/2)**: 2 callouts found with class `block-callout`. Tip callout: bg `rgb(246, 237, 218)`, border `3px solid rgb(122, 77, 14)`. Info callout: bg `rgb(228, 239, 248)`, border `3px solid rgb(26, 95, 160)`.
- **3.6 Table blocks (2/2)**: 2 tables rendered — cooking steps table (步骤/时间/火候 with 3 rows) and nutrition table (营养素/含量 with 3 rows).
- **3.7 Metadata sidebar (2/2)**: Metadata section shows "准备时间: 20 分钟", "烹饪时间: 15 分钟", "份量: 2 人份".
- **3.8 Back navigation (2/2)**: Button "← 返回列表" present. Clicking it navigates back to `/recipes`.
- **3.9 Published indicator (2/2)**: 提拉米苏 detail page shows "已发布" badge (ref=e23) next to the title.

**Suggestion**: None needed — all checks pass.

### D4 Chat Integration (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **4.1 ChatInterface renders (3/3)**: `/chat` shows chat UI with composer textarea (placeholder "问我关于食谱的问题..."), message area (log), Send button, skill selector.
- **4.2 serverUrl = :3001 (2/2)**: `config.ts:5` — `export const CCAAS_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'`.
- **4.3 tenantId = "recipe-book" (2/2)**: `config.ts:8` — `export const TENANT_ID = 'recipe-book'`.
- **4.4 sessionTemplate = "cooking" (2/2)**: `config.ts:11` — `export const SESSION_TEMPLATE = 'cooking'`. Used in ChatPage.tsx:121 and RecipeDetailPage.tsx:253.
- **4.5 apiKey present (2/2)**: `config.ts:14` — `export const API_KEY = 'sk-default-testd84f5b7a1dbdbc4c424417be6c009f01'`.
- **4.6 ChatSidebar renders (3/3)**: `/chat` snapshot shows sidebar with "食谱助手" header, "新会话" button, "搜索会话..." search input, "暂无会话记录" empty state.
- **4.7 Split View Chat (3/3)**: On recipe detail page, "与 AI 讨论这道菜 →" button present. Chat panel opens alongside recipe content with header "讨论：鱼香肉丝" (or "讨论：提拉米苏") and "关闭聊天" close button. Recipe content remains visible — true split view.
- **4.8 Welcome message (3/3)**: `/chat` shows custom welcome: heading "你好，厨师！", description "我是你的食谱助手，可以帮你改良菜谱、分析营养、规划菜单。" with 4 action buttons (改良菜谱, 营养分析, 菜单规划, 烹饪问答).

**Suggestion**: None needed — all checks pass.

### D5 Build Quality + Design (Weight: 20/100)
**Score: 19/20**
**Justification**:
- **5.1 tsc --noEmit (3/3)**: Passes with 0 errors. No output.
- **5.2 vite build (3/3)**: Succeeds — `✓ built in 4.57s`. Output in `dist/`.
- **5.3 file: links (2/2)**: `package.json` contains `"@kedge-agentic/chat-interface": "file:../../../../packages/chat-interface"`, `"@kedge-agentic/common": "file:../../../../packages/common"`, `"@kedge-agentic/react-sdk": "file:../../../../packages/react-sdk"`.
- **5.4 design-tokens.css (2/2)**: `@media (prefers-color-scheme: dark)` found at line 49 of `design-tokens.css`.
- **5.5 No hardcoded colors (1/2)**: 1 hardcoded color found: `RecipeListPage.tsx:56` — `color: recipe.status === 'published' ? '#fff' : 'var(--t3)'`. Should use `var(--surface)` or similar token instead of `#fff`.
- **5.6 Border-radius (2/2)**: Uses `borderRadius: '50%'` for dots (valid), `rounded-[var(--radius-md)]` and `rounded-[var(--radius-md,10px)]` for cards — properly using CSS variables.
- **5.7 No box-shadow (2/2)**: 0 matches in .tsx files.
- **5.8 Plus Jakarta Sans (2/2)**: `index.css:32` — `font-family: "Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif`.
- **5.9 config.ts URLs (2/2)**: `:3002` for `RECIPE_BACKEND_URL`, `:3001` for `CCAAS_URL`. Both correct.

**Suggestion**: Replace `'#fff'` in RecipeListPage.tsx:56 with `var(--surface)` or `var(--white)` CSS variable.

## Penalties Applied

| ID | Trigger | Result | Impact |
|----|---------|--------|--------|
| P1 | `packages/chat-interface/src/` changes | No changes detected | None |
| P2 | `solutions/business/recipe-book/backend/` changes | Only `data/recipe-book.db` changed (binary runtime database, not source code) | None — runtime artifact |
| P3 | `packages/entity-document/src/` changes | No changes detected | None |
| P4 | `solutions/business/edu-platform/` changes | No changes detected | None |
| P5 | Backend tests fail | All 49 tests pass (7 test files) | None |

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | 20 | 20 | All 8 checks pass |
| D2 | 18 | 20 | Loading state exists in code but undetectable at runtime (-2) |
| D3 | 20 | 20 | All 9 checks pass |
| D4 | 20 | 20 | All 8 checks pass, split view works |
| D5 | 19 | 20 | 1 hardcoded color `#fff` (-1) |

Penalties: -0

总分: 97/100

## Bug Classification

| Deduction | Category | Detail |
|-----------|----------|--------|
| D2 -2 (loading state) | COMPONENT | Loading text `加载中...` too transient to detect; no skeleton/spinner |
| D5 -1 (hardcoded color) | DESIGN | `#fff` in RecipeListPage.tsx:56 instead of CSS variable |

## Actionable Fix Hints

1. **RecipeListPage.tsx:56** — Replace `'#fff'` with `'var(--surface)'` or add `--badge-published-text` token to design-tokens.css. Fix: `color: recipe.status === 'published' ? 'var(--surface)' : 'var(--t3)'`
2. **RecipeListPage.tsx:35-36** — The loading state uses plain text `<p>加载中...</p>`. Consider replacing with a skeleton component or adding `className="loading-state"` for test detectability.

## Top 3 Priority Fixes

1. Replace `#fff` hardcoded color with CSS variable in RecipeListPage.tsx:56 (1 point recovery, easy fix)
2. Add a detectable loading skeleton or `data-loading` attribute to RecipeListPage.tsx (2 point recovery, moderate effort)
3. No other fixes needed — all other checks pass

## What's Working Well

1. **Split View Chat** — The recipe detail → AI discussion flow is excellent. The chat panel opens alongside recipe content with contextual header ("讨论：鱼香肉丝"), maintaining recipe visibility. Close button works. This is a polished feature.
2. **Block Viewer** — Full fidelity rendering of all block types: sections as h2/h3, structured ingredient lists with name/amount/note, callout blocks with distinct visual styles (warm tip vs cool info), ordered list steps, and multi-column tables. The document rendering is comprehensive.
