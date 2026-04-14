# Eval Report — recipe-book-frontend v1

## Per-Dimension Scores

### D1 App Shell + Navigation (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **1.1 Frontend loads (2/2)**: Navigated to `http://localhost:5291` — page loads, redirects to `/recipes`, title "食谱助手". No errors.
- **1.2 Sidebar content (3/3)**: Snapshot at 1400px shows sidebar (complementary role) with "食谱助手" title, two nav links: "食谱列表" + "AI 对话" with icons.
- **1.3 Active indicator (2/2)**: On `/recipes`, "食谱列表" nav item has class `sb-link act` with `background: rgb(237, 236, 231)` vs "AI 对话" has `rgba(0, 0, 0, 0)`. Clear visual distinction.
- **1.4 TopNav mobile (2/2)**: At 375×812: TopNav visible (navigation role with "食谱助手", "食谱列表", "AI 对话"). At 1400×900: TopNav hidden, Sidebar visible. CSS uses `@media (min-width: 1200px) { .topnav { display: none; } }`.
- **1.5 /recipes route (3/3)**: Navigating to `/recipes` renders RecipeListPage with heading "食谱列表", subtitle "浏览和管理所有食谱", search input. Component renders correctly (data issue is D2).
- **1.6 /recipes/:id route (3/3)**: Navigated to `/recipes/f821aaf7-8546-47f4-8462-e49d1231060c` — renders full detail page with title "鱼香肉丝", metadata, ingredients, tables, callouts, and back button.
- **1.7 /chat route (3/3)**: Navigated to `/chat` — renders ChatInterface with message log, composer textarea (placeholder "问我关于食谱的问题..."), skill selector, send button, and ChatSidebar.
- **1.8 CSS variables (2/2)**: `grep -c "var(--" *.tsx` found 70 occurrences across 6 files (App, RecipeDetailPage, ChatPage, RecipeListPage, Sidebar, TopNav). Well above the 10 threshold.

**Suggestion**: None — D1 is fully passing.

### D2 Recipe List Page (Weight: 20/100)
**Score: 5/20**
**Justification**:
- **2.1 Three recipes displayed (0/4)**: Page shows "未找到食谱". Root cause: `useRecipes.ts:17` does `data.data ?? []` but API returns `{items: [...]}`. The `.items` key is never accessed.
- **2.2 Card fields (0/3)**: No cards render due to the data format mismatch above.
- **2.3 Status badges (0/2)**: No cards visible. Source code at `RecipeListPage.tsx:63-70` has correct badge implementation with `var(--green-bg)`/`var(--green)` for published and `var(--surface2)`/`var(--t3)` for draft. Cannot be verified at runtime.
- **2.4 Search filter (0/3)**: Cannot test — no recipes displayed. Source code passes `search` to `useRecipes(q)` which appends `?q=` param. Logic appears correct but untestable.
- **2.5 Card click navigation (0/3)**: Cannot test — no cards to click. Source: `onClick={() => navigate('/recipes/${recipe.id}')}`
- **2.6 API to :3002 (3/3)**: Network requests confirmed: `[GET] http://localhost:3002/api/recipes => [200] OK` (4 requests observed).
- **2.7 Loading state (2/2)**: Source code at `RecipeListPage.tsx:46-47`: `{loading ? (<p>加载中...</p>) : ...}`. Loading state is implemented correctly — transitions too fast for Playwright snapshot but code is sound.

**Suggestion**: Fix `useRecipes.ts:17` — change `data.data ?? []` to `data.items ?? data.data ?? []`. This single-line fix will unblock all 5 failing checks.

### D3 Recipe Detail + Block Viewer (Weight: 20/100)
**Score: 18/20**
**Justification**:
- **3.1 Detail metadata (3/3)**: 鱼香肉丝 detail shows: title "鱼香肉丝" (h1), cuisine "川菜", difficulty "中等", prep "20 分钟", cook "15 分钟", servings "2 人份". All metadata present.
- **3.2 Document fetch (0/2)**: Network requests show only `GET http://localhost:3002/api/recipes/{id}`. No call to `/context/entity/recipe/{id}/document`. Blocks are embedded inline in the recipe API response, not fetched from the context-layer document endpoint.
- **3.3 Section headings (2/2)**: `document.querySelectorAll('h2, h3')` confirms headings: h2 "食材准备", h3 "主料", h3 "调料". Section blocks correctly rendered as semantic headings.
- **3.4 Ingredient blocks (3/3)**: Structured ingredient list visible: 猪里脊 200g · 切丝, 木耳 50g · 泡发, 胡萝卜 1根 · 切丝, 郫县豆瓣酱 1勺, 醋 2勺, 糖 1勺. Name, amount, and notes all displayed.
- **3.5 Callout blocks (2/2)**: `.block-callout` element found with `background: rgb(246, 237, 218)`, `borderLeft: 3px solid rgb(122, 77, 14)`, `padding: 12px 16px`. Distinct amber styling. Content: "豆瓣酱要小火炒出红油，这是鱼香味的关键".
- **3.6 Table blocks (2/2)**: Two tables rendered: (1) Cooking steps table with columns 步骤/时间/火候, rows: 腌肉 10分钟, 炒制 8分钟 大火, 收汁 2分钟 中火. (2) Nutrition table with 蛋白质 18g, 碳水 12g, 脂肪 15g.
- **3.7 Metadata sidebar (2/2)**: Metadata section shows 准备时间 20分钟, 烹饪时间 15分钟, 份量 2人份 in a structured layout.
- **3.8 Back navigation (2/2)**: "← 返回列表" button clicked — URL changes from `/recipes/{id}` to `/recipes`. Confirmed.
- **3.9 Published indicator (2/2)**: 提拉米苏 (published recipe) shows "已发布" badge next to title. Draft recipe 鱼香肉丝 does not show the badge.

**Suggestion**: Fetch document from `/context/entity/recipe/{id}/document` via context-layer API instead of relying on inline blocks in `/api/recipes/{id}`.

### D4 Chat Integration (Weight: 20/100)
**Score: 19/20**
**Justification**:
- **4.1 ChatInterface renders (3/3)**: `/chat` renders full chat UI: message log area, h1 "What shall we think through?", textarea with placeholder "问我关于食谱的问题...", "Select skill" button, disabled "Send" button.
- **4.2 serverUrl = :3001 (2/2)**: `config.ts:5`: `export const CCAAS_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'`. Correct.
- **4.3 tenantId = "recipe-book" (2/2)**: `config.ts:8`: `export const TENANT_ID = 'recipe-book'`. Correct.
- **4.4 sessionTemplate = "cooking" (2/2)**: `config.ts:11`: `export const SESSION_TEMPLATE = 'cooking'`. Used in `ChatPage.tsx:58`: `sessionTemplate={SESSION_TEMPLATE}`. Correct.
- **4.5 apiKey present (2/2)**: `config.ts:14`: `export const API_KEY = 'sk-default-testd84f5b7a1dbdbc4c424417be6c009f01'`. Present.
- **4.6 ChatSidebar renders (3/3)**: Chat page sidebar shows: "食谱助手" header, "新会话" button with icon, "搜索会话..." textbox, "暂无会话记录" empty state.
- **4.7 Dual-pane from recipe detail (2/3)**: "与 AI 讨论这道菜 →" button present on recipe detail page and navigates to `/chat`. However, this navigates away from the recipe (not a true side-by-side dual-pane layout).
- **4.8 Welcome message (3/3)**: Chat page shows non-blank welcome state: "What shall we think through?" heading with icon, custom placeholder "问我关于食谱的问题...". Not a blank page.

**Suggestion**: Implement true dual-pane layout on `/recipes/:id` with inline chat panel, or pass recipe context to `/chat` route so the AI knows which recipe is being discussed.

### D5 Build Quality + Design (Weight: 20/100)
**Score: 19/20**
**Justification**:
- **5.1 tsc --noEmit (3/3)**: `npx tsc --noEmit` exits with code 0. Zero type errors.
- **5.2 vite build (3/3)**: `npx vite build` succeeds: "✓ built in 4.66s". Warning about chunk sizes (index.js 1041kB) but build succeeds.
- **5.3 file: links (2/2)**: `package.json` has `file:` links for all @kedge-agentic deps: `chat-interface`, `common`, `react-sdk`.
- **5.4 design-tokens.css (2/2)**: `design-tokens.css:44`: `@media (prefers-color-scheme: dark) {` — dark mode tokens present.
- **5.5 No hardcoded colors (2/2)**: `grep "#[0-9a-fA-F]{3,6}" *.tsx` — 0 matches. All colors use CSS variables.
- **5.6 Border-radius convention (1/2)**: Two inline `borderRadius` values found: `RecipeDetailPage.tsx:184` (4px) and `RecipeListPage.tsx:37` (8px). CSS classes use 10px for cards, 4px for badges. Values are internally consistent but not using CSS variables/design tokens.
- **5.7 No box-shadow (2/2)**: `grep "box-shadow|shadow-" *.tsx` — 0 matches. Clean.
- **5.8 Plus Jakarta Sans (2/2)**: `index.css:32`: `font-family: "Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif;`
- **5.9 config.ts URLs (2/2)**: `:3002` for `RECIPE_BACKEND_URL`, `:3001` for `CCAAS_URL`. Both correct.

**Suggestion**: Extract inline `borderRadius` values into CSS variables (e.g., `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 10px`) in design-tokens.css.

## Penalties Applied

| ID | Check | Result | Penalty |
|----|-------|--------|---------|
| P1 | `packages/chat-interface/src/` changes | No committed or uncommitted changes | None |
| P2 | `solutions/business/recipe-book/backend/` changes | Only uncommitted `data/recipe-book.db` (SQLite runtime artifact, not source code). `git diff HEAD~1 HEAD` shows no backend changes in the frontend commit. | None |
| P3 | `packages/entity-document/src/` changes | No committed or uncommitted changes | None |
| P4 | `solutions/business/edu-platform/` changes | Uncommitted change to `context-layer-local.module.ts` — pre-existing from a previous task (CRLF + EditEntityDto refactor). `git diff HEAD~1 HEAD` shows no edu-platform changes in the frontend commit. | None |
| P5 | Backend tests | `npx vitest run`: 7 files, 49 tests, all passed | None |

## Score Summary

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | 20 | 20 | All 8 checks pass. Solid app shell. |
| D2 | 5 | 20 | Critical bug: `data.data` vs `data.items` breaks recipe list. Only API routing (3) + loading state (2) pass. |
| D3 | 18 | 20 | Excellent block rendering. Missing context-layer document fetch (-2). |
| D4 | 19 | 20 | Full chat integration. Navigation to chat exists but not true dual-pane (-1). |
| D5 | 19 | 20 | Build clean, design tokens used well. Minor inline borderRadius (-1). |

Penalties: -0

总分: 81/100

## Bug Classification

| Deduction | Category | Impact |
|-----------|----------|--------|
| D2: `data.data` vs `data.items` mismatch | SYSTEM | 15pts lost — entire recipe list non-functional |
| D3: No document fetch from context-layer | SYSTEM | 2pts — using inline blocks instead of context API |
| D4: Navigation-based chat, not dual-pane | COMPONENT | 1pt — functional but not optimal UX |
| D5: Inline borderRadius values | DESIGN | 1pt — minor token discipline issue |

## Actionable Fix Hints

1. **`useRecipes.ts:17`** — Change `data.data ?? []` to `data.items ?? data.data ?? []`
   - Fix approach: The API returns `{ items: [...], total, page }`. The hook looks for `data.data` which is undefined, falling back to `[]`.

2. **`RecipeDetailPage.tsx`** — Add document fetch from `${RECIPE_BACKEND_URL}/context/entity/recipe/${id}/document`
   - Fix approach: Fetch blocks from context-layer endpoint instead of relying on inline blocks in `/api/recipes/{id}`.

3. **`RecipeDetailPage.tsx` or `ChatPage.tsx`** — Pass recipe context when navigating to chat
   - Fix approach: Use URL params (e.g., `/chat?recipeId=${id}`) or implement inline chat panel on detail page.

4. **`RecipeListPage.tsx:37`, `RecipeDetailPage.tsx:184`** — Replace inline `borderRadius` with CSS variables
   - Fix approach: Add `--radius-sm`, `--radius-md`, `--radius-lg` to design-tokens.css and reference them.

## Top 3 Priority Fixes

1. **Fix `useRecipes.ts:17` data format mismatch** — Single-line fix that unblocks 15 points (D2.1-D2.5). Change `data.data` to `data.items`.
2. **Add context-layer document fetch** — Use `/context/entity/recipe/{id}/document` endpoint for block data on detail page (+2 pts).
3. **Implement dual-pane chat from recipe detail** — Either inline chat panel or pass recipe context to `/chat` route (+1 pt).

## What's Working Well

1. **Block rendering engine** — The RecipeDetailPage renders all block types (section, text, ingredient, list, table, callout) with excellent semantic HTML and visual distinction. Tables have proper headers, ingredients show structured name/amount/note, callouts have distinct amber styling.
2. **Design system discipline** — 70 CSS variable usages, zero hardcoded colors in components, zero box-shadows, Plus Jakarta Sans font, dark mode tokens, clean build with zero type errors. The design foundation is solid.
