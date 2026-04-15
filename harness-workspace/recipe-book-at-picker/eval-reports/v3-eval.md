# Eval Report — recipe-book-at-picker v3

## Per-Dimension Scores

### D1 Backend Entity Hierarchy (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **1.1 recipe_section registered (3/3)**: GET /context/entity-types returns `types` array containing `{type: "recipe_section", displayName: "章节", icon: "📑", searchable: true, browsable: true}`.
- **1.2 Relation tree (3/3)**: `tree.relations` includes `{parent: "recipe", child: "recipe_section", label: "章节", foreignKey: "recipeId"}`.
- **1.3 Browse recipes hasChildren (3/3)**: GET /context/browse?entity_type=recipe returns 3 items, all with `hasChildren: true`.
- **1.4 Drill into recipe sections (4/4)**: GET /context/browse?entity_type=recipe_section&parent_type=recipe&parent_id=834c6caa... returns `{items: [{entityType: "recipe_section", displayName: "食材准备", ...}], total: 1}`. Items.length > 0 confirmed for all 3 recipes (提拉米苏: "经典意式甜品", 番茄炒蛋: "简单家常菜", 鱼香肉丝: "食材准备").
- **1.5 Search finds sections (3/3)**: GET /context/search?q=食材 returns `{results: [{entityType: "recipe_section", displayName: "食材准备", subtitle: "鱼香肉丝 / 章节", breadcrumb: [...]}]}`.
- **1.6 Resolve recipe_section (2/2)**: GET /context/resolve?entity_type=recipe_section&entity_id=834c6caa...:section:0 returns `{data: {type: "section", content: {heading: "食材准备"}}, breadcrumb: [{type: "recipe", displayName: "鱼香肉丝", icon: "🍳"}]}`.
- **1.7 Backward compat (2/2)**: Browse recipe returns 3 recipes with all required fields (`entityType`, `entityId`, `displayName`, plus `subtitle`, `hasChildren`, `summary`).

**Suggestion**: Consider extracting more section granularity — each recipe currently yields only 1 section (the first h2 heading). Multiple h2 sections per recipe would make drill-down more useful.

### D2 Frontend @Picker Integration (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **2.1 context-layer-react in package.json (2/2)**: `package.json:14` has `"@kedge-agentic/context-layer-react": "file:../../../../packages/context-layer-react"`.
- **2.2 MentionProvider wraps ChatInterface (2/2)**: `RecipeDetailPage.tsx:251` wraps ChatInterface inside `<MentionProvider>`.
- **2.3 MentionPicker with contextEntity + autoRef (3/3)**: `RecipeDetailPage.tsx:265-276` renders `<MentionPicker baseUrl={CONTEXT_LAYER_URL} contextEntity={{entityType: 'recipe', entityId: id!, displayName: recipe.title, icon: '🍳'}} autoRef={true} />`.
- **2.4 MentionPicker renders in split view (3/3)**: Playwright snapshot after typing `@` shows picker with search box `"🔍 搜索实体..."`, context section, and type browse.
- **2.5 AtPicker shows "当前上下文" (3/3)**: Snapshot shows `"当前上下文"` section header with `🍳 提拉米苏` pinned and `▶` drill button.
- **2.6 AtPicker shows root entity type (2/2)**: `"按类型浏览"` section shows `🍳 食谱 ›`. 章节 is correctly NOT at root level.
- **2.7 Drill into pinned context entity (3/3)**: Clicking `▶` on 提拉米苏 in "当前上下文" shows `📑 章节` breadcrumb and section `"经典意式甜品"` with subtitle `"提拉米苏 / 章节"`.
- **2.8 MentionPicker on /chat page (2/2)**: Navigated to `/chat`, typed `@`. Picker opens with only `"按类型浏览"` section (食谱). No `"当前上下文"` section — correct since no `contextEntity` is passed.

**Suggestion**: None — all checks pass cleanly.

### D3 Context Injection (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **3.1 sessionContext prop (3/3)**: `RecipeDetailPage.tsx:260` passes `sessionContext={{ recipeId: id, recipeName: recipe.title, cuisine: recipe.cuisine }}` to ChatInterface.
- **3.2 sessionContext includes recipeId (2/2)**: Confirmed at line 260 — object contains `recipeId` and `recipeName`.
- **3.3 autoRef auto-adds recipe pill (4/4)**: On opening split view (before typing `@`), snapshot shows pill area with `🍳 提拉米苏 ×` and label `"1 个实体已引用 · 发送时注入上下文"`.
- **3.4 Reference pills display correctly (3/3)**: Auto-added pill shows icon (`🍳`), display name (`提拉米苏`), and remove button (`×` at ref=e184).
- **3.5 @ keypress triggers picker (2/2)**: Typing `@` in composer opens the AtPicker overlay with search and browse sections.
- **3.6 Escape closes picker (2/2)**: Dispatching Escape keydown event closes the picker — snapshot after shows no picker overlay, only the ref pills area.
- **3.7 Refs cleared after send (2/2)**: Code wiring verified: `onMessageSent={() => clearRefsRef.current?.()}` (line 261) calls `clearRefs` from MentionContext via MentionTrigger (mention.ts:22). Code path is correctly wired.
- **3.8 baseUrl points to :3002 (2/2)**: `config.ts:5` defines `CONTEXT_LAYER_URL = RECIPE_BACKEND_URL + '/context'` where `RECIPE_BACKEND_URL = 'http://localhost:3002'`. MentionPicker receives `baseUrl={CONTEXT_LAYER_URL}` at line 266.

**Suggestion**: None — all checks pass.

### D4 UX Quality (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **4.1 Picker home with context (3/3)**: Split view picker shows "当前上下文" (with pinned 提拉米苏) + "最近使用" (after selection) + "按类型浏览" (食谱). /chat page shows only "按类型浏览" — no context section.
- **4.2 Picker search (4/4)**: Typing "鱼香" in search box returns `🍳 鱼香肉丝` with subtitle "川菜 中等 食谱" — correct search result.
- **4.3 Breadcrumb trail (3/3)**: Drilling from 食谱 type → 鱼香肉丝 shows breadcrumb: `"← 食谱" › "鱼香肉丝"` + `"📑 章节"` label. Clear navigation path.
- **4.4 Section display names (3/3)**: Sections show actual heading text: "食材准备" (鱼香肉丝), "经典意式甜品" (提拉米苏), "简单家常菜" (番茄炒蛋). Not generic "章节 1" labels.
- **4.5 Back button (2/2)**: Clicking `"← 食谱"` from section drill-down returns to recipe list showing all 3 recipes (提拉米苏, 番茄炒蛋, 鱼香肉丝).
- **4.6 Multiple refs (3/3)**: After selecting 经典意式甜品 section while auto-ref 提拉米苏 was present, snapshot shows 2 pills: `🍳 提拉米苏 ×` and `📑 经典意式甜品 ×`, with label `"2 个实体已引用 · 发送时注入上下文"`.
- **4.7 Remove auto-ref pill (2/2)**: Clicked × on 提拉米苏 pill — it was removed. Only 经典意式甜品 remained with "1 个实体已引用". Re-opening picker (typing @) did NOT re-add 提拉米苏 to pills — it stayed removed.

**Suggestion**: None — all UX checks pass.

### D5 Build Quality (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **5.1 Frontend tsc (3/3)**: `npx tsc --noEmit` in frontend dir completed with no errors (empty output).
- **5.2 Frontend vite build (3/3)**: `npx vite build` succeeded — "built in 4.88s" with proper chunk output.
- **5.3 Backend tsc (3/3)**: `npx tsc --noEmit` in backend dir completed with no errors (empty output).
- **5.4 Backend tests (3/3)**: `npx vitest run` — 7 test files, 49 tests, all passed in 1.28s. Includes integration tests for context-api, agent-workflow, edit-operations, and edge-cases.
- **5.5 No frozen package modifications (3/3)**: `git diff HEAD~1 --name-only` and `git diff --name-only` for all frozen dirs (context-layer/src, chat-interface/src, context-layer-react/src, entity-document/src, edu-platform) returned empty.
- **5.6 file: links correct (3/3)**: package.json has 4 file: links — `chat-interface`, `common`, `context-layer-react`, `react-sdk` — all using `file:../../../../packages/...` pattern resolving correctly.
- **5.7 Existing features work (2/2)**: Playwright verification: `/recipes` loads recipe list (3 cards), `/recipes/:id` loads detail with blocks, `/chat` loads chat page with welcome state and session list.

**Suggestion**: None — clean build across the board.

## Penalties Applied

| ID | Condition | Result | Penalty |
|----|-----------|--------|---------|
| P1 | `packages/context-layer/src/` modified | `git diff HEAD~1` and `git diff` both empty | None |
| P2 | `packages/chat-interface/src/` modified | `git diff HEAD~1` and `git diff` both empty | None |
| P3 | `packages/context-layer-react/src/` modified | `git diff HEAD~1` and `git diff` both empty | None |
| P4 | `packages/entity-document/src/` modified | `git diff HEAD~1` and `git diff` both empty | None |
| P5 | `solutions/business/edu-platform/` modified | `git diff HEAD~1` and `git diff` both empty | None |
| P6 | Backend tests fail | 49/49 tests pass | None |
| P7 | Recipe browse/search broken | 3 recipes returned correctly | None |

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | 20 | 20 | All 7 API checks pass. Entity hierarchy fully functional. |
| D2 | 20 | 20 | All 8 integration checks pass. Picker renders in both split view and /chat. |
| D3 | 20 | 20 | All 8 context injection checks pass. Auto-ref, pills, trigger, escape all work. |
| D4 | 20 | 20 | All 7 UX checks pass. Search, breadcrumb, drill-down, multi-ref, remove all work. |
| D5 | 20 | 20 | All 7 build checks pass. Zero type errors, zero test failures, no frozen pkg changes. |

Penalties: -0

总分: 100/100

## Bug Classification

No bugs found. All checks pass.

## Actionable Fix Hints

No fixes required. Minor architectural observations (non-scoring):

1. **`src/lib/mention.ts`** imports directly from `packages/chat-interface/src/` source paths (not the package's public API). This works but creates fragile coupling. When chat-interface exports these components publicly, switch to package imports.
2. **Single section per recipe**: Each recipe produces only 1 `recipe_section` (the first h2 heading). For recipes with multiple h2 sections, consider emitting multiple sections for richer drill-down.

## Top 3 Priority Fixes

1. (Low priority) Export MentionProvider/MentionPicker from chat-interface public API to eliminate direct source imports
2. (Low priority) Consider multi-section extraction from recipe markdown for richer hierarchy
3. (Low priority) Add loading state to AtPicker search (currently instant due to small dataset, but will matter at scale)

## What's Working Well

1. **Clean architecture boundary**: No frozen packages were modified. The solution uses only the frontend's own `src/lib/mention.ts` bridge and backend `src/referenceable/` module. The context-layer-react package is consumed as-is via file: link.
2. **Full-stack integration quality**: The autoRef → pill → picker → drill-down → select → multi-ref → remove flow works end-to-end with zero hiccups. The "当前上下文" / "按类型浏览" / "最近使用" sections provide excellent navigation structure.
