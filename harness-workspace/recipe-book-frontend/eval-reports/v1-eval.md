# Eval Report — recipe-book-frontend v1

## Per-Dimension Scores

### D1 App Shell + Navigation (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **1.1 Frontend loads (2/2)**: Navigated to `http://localhost:5291` — page loads, redirects to `/recipes`, title is "食谱助手". No errors.
- **1.2 Sidebar content (3/3)**: Desktop snapshot (1400px) shows `complementary` role element with "食谱助手" title, nav links "食谱列表" and "AI 对话" with icons.
- **1.3 Active indicator (2/2)**: On `/recipes`, "食谱列表" has class `sb-link act` with `background: rgb(237, 236, 231)` vs transparent `rgba(0, 0, 0, 0)` for "AI 对话". Distinct active styling confirmed.
- **1.4 TopNav mobile (2/2)**: At 375x812, TopNav (`navigation` role) visible with horizontal links; sidebar hidden. At 1400x900, sidebar (`complementary` role) visible; TopNav hidden.
- **1.5 /recipes route (3/3)**: Renders RecipeListPage with heading "食谱列表", search input, and 3 recipe cards.
- **1.6 /recipes/:id route (3/3)**: Navigated to `/recipes/45e8156d-1975-4956-b0a7-67a932520d31` (鱼香肉丝). RecipeDetailPage renders with full metadata, block content, and ingredients.
- **1.7 /chat route (3/3)**: Navigated to `/chat`. ChatInterface renders with message area (log role), composer textarea, ChatSidebar with session list.
- **1.8 CSS variables (2/2)**: `grep "var(--"` found 91 occurrences across 6 .tsx files (Sidebar, TopNav, RecipeListPage, RecipeDetailPage, ChatPage, App). Well above the >=10 threshold.

**Suggestion**: None needed — fully passing.

### D2 Recipe List Page (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **2.1 Three recipes displayed (4/4)**: Snapshot shows all 3 seed recipes as h3 headings: "提拉米苏", "番茄炒蛋", "鱼香肉丝".
- **2.2 Card fields (3/3)**: Each card shows title (h3 heading), cuisine ("川菜"/"家常"/"西餐"), and difficulty ("简单"/"中等"/"困难"). All fields present in DOM snapshot.
- **2.3 Status badges (2/2)**: "已发布" badge on 提拉米苏, "草稿" badge on 番茄炒蛋 and 鱼香肉丝. Distinct text labels confirmed in snapshot.
- **2.4 Search filter (3/3)**: Typed "鱼香" in search input. Snapshot shows only "鱼香肉丝" card remaining; 提拉米苏 and 番茄炒蛋 filtered out. Network log confirms `GET /api/recipes?q=%E9%B1%BC%E9%A6%99`.
- **2.5 Card click navigation (3/3)**: Clicked 鱼香肉丝 card. URL changed to `/recipes/45e8156d-1975-4956-b0a7-67a932520d31`.
- **2.6 API to :3002 (3/3)**: Network requests show all API calls go to `http://localhost:3002` — confirmed `GET /api/recipes`, `/api/recipes?q=...`, `/api/recipes/{id}`, `/context/entity/recipe/{id}/document`.
- **2.7 Loading state (2/2)**: `RecipeListPage.tsx:46-47` shows `{loading ? (<p style={{...}}>加载中...</p>)` conditional rendering with `loading` state from `useRecipes` hook.

**Suggestion**: None needed — fully passing.

### D3 Recipe Detail + Block Viewer (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **3.1 Detail metadata (3/3)**: 鱼香肉丝 detail shows: title "鱼香肉丝" (h1), cuisine "川菜", difficulty "中等". 提拉米苏 shows: "提拉米苏" (h1), "西餐", "困难". All fields present.
- **3.2 Document fetch (2/2)**: Network log confirms `GET http://localhost:3002/context/entity/recipe/45e8156d-.../document => 200 OK`.
- **3.3 Section headings (2/2)**: DOM snapshot shows h2 "食材准备" and h3 "主料"/"调料" for 鱼香肉丝; h2 "经典意式甜品" and h3 "主料"/"辅料" for 提拉米苏.
- **3.4 Ingredient blocks (3/3)**: Structured ingredient items: 猪里脊 200g · 切丝, 木耳 50g · 泡发, 胡萝卜 1根 · 切丝, 郫县豆瓣酱 1勺, 醋 2勺, 糖 1勺. Grouped by category (主料/调料).
- **3.5 Callout blocks (2/2)**: Two callout blocks with class `block-callout`. First: bg `rgb(246, 237, 218)`, border-left `3px solid rgb(122, 77, 14)` (warm/warning). Second: bg `rgb(228, 239, 248)`, border-left `3px solid rgb(26, 95, 160)` (cool/info). Distinct visual styling.
- **3.6 Timeline/table blocks (2/2)**: Two `<table>` elements: (1) cooking steps table (步骤/时间/火候 columns, 3 rows: 腌肉/炒制/收汁), (2) nutrition table (营养素/含量, 3 rows: 蛋白质/碳水/脂肪). Plus ordered list with 6 recipe steps.
- **3.7 Metadata sidebar (2/2)**: Metadata section: "准备时间 20 分钟", "烹饪时间 15 分钟", "份量 2 人份" in structured layout.
- **3.8 Back navigation (2/2)**: Clicked "← 返回列表" button. URL changed to `/recipes`. Confirmed.
- **3.9 Published indicator (2/2)**: 提拉米苏 (published) shows "已发布" badge next to title in header. 鱼香肉丝 (draft) does not show this badge — correct differential behavior.

**Suggestion**: None needed — fully passing.

### D4 Chat Integration (Weight: 20/100)
**Score: 0/20 (P4 penalty applied)**

**Raw score before penalty: 20/20** — all 8 checks pass:
- **4.1 ChatInterface renders (3/3)**: `/chat` shows chat UI with message area (log role), composer textarea (placeholder "问我关于食谱的问题..."), "Select skill" button, disabled "Send" button.
- **4.2 serverUrl :3001 (2/2)**: `config.ts:5` — `export const CCAAS_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'`
- **4.3 tenantId "recipe-book" (2/2)**: `config.ts:8` — `export const TENANT_ID = 'recipe-book'`
- **4.4 sessionTemplate "cooking" (2/2)**: `config.ts:11` — `export const SESSION_TEMPLATE = 'cooking'`; `ChatPage.tsx:121` passes `sessionTemplate={SESSION_TEMPLATE}`
- **4.5 apiKey present (2/2)**: `config.ts:14` — `export const API_KEY = 'sk-default-testd84f5b7a1dbdbc4c424417be6c009f01'`
- **4.6 ChatSidebar renders (3/3)**: Sidebar shows "食谱助手" title, "新会话" button, "搜索会话..." textbox, "暂无会话记录" empty state.
- **4.7 Dual-pane from detail (3/3)**: "与 AI 讨论这道菜 →" button on recipe detail navigates to `/chat?recipeId=3d475c4a-...&recipeName=提拉米苏`. Chat placeholder dynamically changes to "讨论「提拉米苏」的做法..."
- **4.8 Welcome message (3/3)**: Custom welcome: heading "你好，厨师！", paragraph "我是你的食谱助手，可以帮你改良菜谱、分析营养、规划菜单。", 4 starter cards (改良菜谱, 营养分析, 菜单规划, 烹饪问答) with emoji icons and descriptions.

**P4 penalty reason**: `solutions/business/edu-platform/backend/src/referenceable/context-layer-local.module.ts` has uncommitted changes (removed `EditEntityDto` import, changed `@Body() body: EditEntityDto` to `@Body() body: any`). Note: `git diff HEAD~5 HEAD` shows NO edu-platform changes were committed in any frontend iteration — this is a pre-existing working tree modification, likely a downstream fix for context-layer export changes. Nevertheless, the rubric requires checking uncommitted changes and the diff is present.

**Suggestion**: Stash or revert the edu-platform uncommitted change (`git checkout -- solutions/business/edu-platform/`) before evaluation to avoid P4.

### D5 Build Quality + Design (Weight: 20/100)
**Score: 19/20**
**Justification**:
- **5.1 tsc --noEmit (3/3)**: Passes with 0 errors (empty output).
- **5.2 vite build (3/3)**: Succeeds — "built in 4.54s". Warning about chunk sizes (index.js 1045kB) but build completes.
- **5.3 file: links (2/2)**: `package.json` has 3 `file:` links: `@kedge-agentic/chat-interface`, `@kedge-agentic/common`, `@kedge-agentic/react-sdk`.
- **5.4 design-tokens.css (2/2)**: `src/styles/design-tokens.css:49` — `@media (prefers-color-scheme: dark) {` present.
- **5.5 No hardcoded colors (2/2)**: `grep "#[0-9a-fA-F]{3,6}"` in .tsx files found 0 matches. All colors via CSS variables.
- **5.6 Border-radius convention (1/2)**: 3 of 4 instances use design tokens (`var(--radius-sm)`, `var(--radius-md)`, `rounded-[var(--radius-md,10px)]`). However, `ChatPage.tsx:24` uses Tailwind `rounded-2xl` (16px) — not a design token. Minor inconsistency.
- **5.7 No box-shadow (2/2)**: `grep "box-shadow|shadow-"` in .tsx files found 0 matches.
- **5.8 Plus Jakarta Sans (2/2)**: `index.css:32` — `font-family: "Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif;`
- **5.9 config.ts URLs (2/2)**: `config.ts:2` — `:3002` for RECIPE_BACKEND_URL, `config.ts:5` — `:3001` for CCAAS_URL. Correct.

**Suggestion**: Replace `rounded-2xl` in `ChatPage.tsx:24` with `style={{ borderRadius: 'var(--radius-md)' }}` or Tailwind `rounded-[var(--radius-md)]`.

## Penalties Applied
| ID | Check | Result | Applied? |
|----|-------|--------|----------|
| P1 | `packages/chat-interface/src/` changes | `git diff HEAD~5 HEAD` and `git diff`: no changes | No |
| P2 | `solutions/business/recipe-book/backend/` changes | `git diff HEAD~5 HEAD`: no committed changes. `git diff`: only `data/recipe-book.db` binary (SQLite runtime artifact, not source code) | No |
| P3 | `packages/entity-document/src/` changes | `git diff HEAD~5 HEAD` and `git diff`: no changes | No |
| P4 | `solutions/business/edu-platform/` changes | `git diff HEAD~5 HEAD`: no committed changes. `git diff`: `context-layer-local.module.ts` has uncommitted code changes (EditEntityDto removal). Pre-existing, not from frontend work. | **Yes: D4 = 0** |
| P5 | Backend tests | `npx vitest run`: 7 files, 49 tests, all passed | No |

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | 20 | 20 | All 8 checks pass |
| D2 | 20 | 20 | All 7 checks pass |
| D3 | 20 | 20 | All 9 checks pass |
| D4 | 0 | 20 | Raw 20/20, but P4 penalty (edu-platform uncommitted change) zeros it |
| D5 | 19 | 20 | -1pt for `rounded-2xl` Tailwind class not using design token |

Penalties: -20 (P4 applied)

总分: 79/100

## Bug Classification
| Deduction | Category | Detail |
|-----------|----------|--------|
| D4 -20 (P4) | SYSTEM | Pre-existing uncommitted change in `solutions/business/edu-platform/backend/src/referenceable/context-layer-local.module.ts` — removed EditEntityDto import, changed body type to `any` |
| D5 -1 | DESIGN | `ChatPage.tsx:24` uses `rounded-2xl` Tailwind class instead of design token `var(--radius-*)` |

## Actionable Fix Hints
1. **P4 fix** — `solutions/business/edu-platform/backend/src/referenceable/context-layer-local.module.ts` — revert uncommitted change with `git checkout -- solutions/business/edu-platform/`. This restores D4 from 0 to 20 (+20 pts).
2. **D5.6 fix** — `solutions/business/recipe-book/frontend/src/pages/ChatPage.tsx:24` — replace `rounded-2xl` with `rounded-[var(--radius-md)]` or inline `style={{ borderRadius: 'var(--radius-md)' }}` (+1 pt).

## Top 3 Priority Fixes
1. **Revert edu-platform uncommitted change** — `git checkout -- solutions/business/edu-platform/` recovers 20 points by removing the P4 penalty trigger. The change is unrelated to the frontend work.
2. **Replace `rounded-2xl` with design token** — `ChatPage.tsx:24`, change to `rounded-[var(--radius-md)]` to maintain token consistency (+1 pt).
3. **Consider code-splitting** — vite build warns about index.js chunk (1045kB). Use `React.lazy()` + dynamic `import()` for mermaid/cytoscape to improve initial load time (no point impact, but good practice).

## What's Working Well
1. **Block rendering is excellent** — RecipeDetailPage handles all block types (section, text, ingredient, list, table, callout) with proper semantic HTML and strong visual distinction. Callouts use color-coded backgrounds with border-left accents. Tables have proper column headers. Ingredients are grouped by category with structured name/amount/note display.
2. **Chat integration is thoughtfully designed** — Context-aware placeholder changes to "讨论「提拉米苏」的做法..." when entering from a recipe detail. Custom welcome screen with "你好，厨师！" heading and 4 domain-specific starter cards. ChatSidebar with session management (new session, search, empty state). The dual-pane entry from recipe detail via "与 AI 讨论这道菜 →" passes recipeId and recipeName as URL params.
