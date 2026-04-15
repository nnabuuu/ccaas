# Eval Report — recipe-book-at-picker v1

## Service Health

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost:5291 | Live (redirects to /recipes) |
| Recipe Backend | http://localhost:3002 | Live (entity-types returns JSON) |
| CCAAS Core | http://localhost:3001 | Live (health: ok) |

## Per-Dimension Scores

### D1 Backend Entity Hierarchy (Weight: 20/100)
**Score: 20/20**

| Check | Pts | Result |
|-------|-----|--------|
| 1.1 recipe_section registered | 3/3 | PASS — `/context/entity-types` returns `types` with `{type:'recipe_section', displayName:'章节', icon:'📑'}` |
| 1.2 Relation tree | 3/3 | PASS — `tree.relations` includes `{parent:'recipe', child:'recipe_section', label:'章节', foreignKey:'recipeId'}` |
| 1.3 Browse recipes hasChildren | 3/3 | PASS — `/context/browse?entity_type=recipe` → all 3 items have `hasChildren: true` |
| 1.4 Drill into sections | 4/4 | PASS — `/context/browse?entity_type=recipe_section&parent_type=recipe&parent_id=e6638abf-...` → 1 item `{displayName:'经典意式甜品'}`. Same for 鱼香肉丝 → `{displayName:'食材准备'}`, 番茄炒蛋 → `{displayName:'简单家常菜'}` |
| 1.5 Search finds sections | 3/3 | PASS — `/context/search?q=食材` → results include `{entityType:'recipe_section', displayName:'食材准备', breadcrumb:[{displayName:'鱼香肉丝'}]}` |
| 1.6 Resolve recipe_section | 2/2 | PASS — `/context/resolve?entity_type=recipe_section&entity_id=e6638abf-...:section:0` → `{displayName:'经典意式甜品', data:{type:'section', content:{heading:'经典意式甜品'}}, breadcrumb:[...]}` |
| 1.7 Backward compat | 2/2 | PASS — `/context/browse?entity_type=recipe` → 3 recipes, all have `entityType`, `entityId`, `displayName`, `hasChildren` |

**Justification**: All 7 backend API checks pass. Entity types, relations, browse, drill-down, search, and resolve all function correctly. The recipe_section entity type is properly registered with parent-child relationship to recipe.

**Suggestion**: Consider adding more sections per recipe (currently 1 each) to better demonstrate hierarchical drill-down value.

---

### D2 Frontend @Picker Integration (Weight: 20/100)
**Score: 10/20**

| Check | Pts | Result |
|-------|-----|--------|
| 2.1 context-layer-react in package.json | 2/2 | PASS — `"@kedge-agentic/context-layer-react": "file:../../../../packages/context-layer-react"` at line 14 |
| 2.2 MentionProvider wraps ChatInterface | 2/2 | PASS — `RecipeDetailPage.tsx:251` `<MentionProvider>` wraps both ChatInterface and MentionPicker |
| 2.3 MentionPicker with contextEntity + autoRef | 3/3 | PASS — `RecipeDetailPage.tsx:265-276` has `<MentionPicker baseUrl={RECIPE_BACKEND_URL} contextEntity={{entityType:'recipe', entityId:id!, displayName:recipe.title, icon:'🍳'}} autoRef={true}/>` |
| 2.4 MentionPicker renders in split view | 3/3 | PASS — After clicking "与 AI 讨论这道菜 →", typing @ opens the picker overlay (search box "🔍 搜索实体..." visible in snapshot) |
| 2.5 "当前上下文" pinned section | 0/3 | FAIL — Picker opens showing only search box + "无结果". No "当前上下文" section visible. Root cause: `baseUrl` is `http://localhost:3002` but ContextLayerClient appends `/entity-types` etc., hitting 404 at `http://localhost:3002/entity-types` instead of `http://localhost:3002/context/entity-types` |
| 2.6 Root entity type in type browse | 0/2 | FAIL — No type browse section visible due to same baseUrl 404 issue |
| 2.7 Drill into pinned context entity | 0/3 | FAIL — Cannot drill — picker data never loads |
| 2.8 MentionPicker on /chat page | 2/2 | PASS — `/chat` page opens picker on @, no "当前上下文" section (correctly absent since no contextEntity), same search-only UI |

**Justification**: The code-level integration is correct (deps, MentionProvider, contextEntity, autoRef props all present). The picker renders and opens on @. However, all data-dependent features (当前上下文 section, type browse, drill-down) fail because `baseUrl='http://localhost:3002'` is missing the `/context` path prefix. The ContextLayerClient builds URLs like `${baseUrl}/entity-types` which resolves to `http://localhost:3002/entity-types` (404), should be `http://localhost:3002/context/entity-types`.

**Suggestion**: Change `baseUrl={RECIPE_BACKEND_URL}` to `baseUrl={RECIPE_BACKEND_URL + '/context'}` in both `RecipeDetailPage.tsx:266` and `ChatPage.tsx:136`, or update the config constant.

---

### D3 Context Injection (Weight: 20/100)
**Score: 15/20**

| Check | Pts | Result |
|-------|-----|--------|
| 3.1 sessionContext prop | 3/3 | PASS — `RecipeDetailPage.tsx:260` `sessionContext={{ recipeId: id, recipeName: recipe.title, cuisine: recipe.cuisine }}` |
| 3.2 sessionContext includes recipeId | 2/2 | PASS — `recipeId` and `recipeName` present in sessionContext object |
| 3.3 autoRef auto-adds recipe pill | 4/4 | PASS — On opening split view (before typing @), the composer area shows: `🍳 提拉米苏 × | 1 个实体已引用 · 发送时注入上下文` |
| 3.4 Reference pills display correctly | 3/3 | PASS — Auto-added pill shows icon (🍳), display name (提拉米苏), and × remove button (ref=e183) |
| 3.5 @ keypress triggers picker | 2/2 | PASS — Typing @ in composer opens picker overlay (search box appears) |
| 3.6 Escape closes picker | 1/2 | PARTIAL — Dispatching Escape via `document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))` closed the picker. Could not test native keypress (browser_press_key denied). Score 1/2 due to inability to fully verify native key event. |
| 3.7 Refs cleared after send | 0/2 | FAIL — Unable to fully test: send button is disabled (no message typed), and testing send flow end-to-end requires CCAAS backend session which may not process without a valid skill. Cannot confirm clearRefs fires on actual send. |
| 3.8 baseUrl points to :3002 | 2/2 | PASS — `RecipeDetailPage.tsx:266` uses `baseUrl={RECIPE_BACKEND_URL}` where `RECIPE_BACKEND_URL = 'http://localhost:3002'` (config.ts:2). Points to recipe backend, not core. (Note: missing `/context` prefix is a D2 issue, not D3.) |

**Justification**: sessionContext, autoRef pill injection, reference pill display, @ trigger, and baseUrl target are all correct. The auto-ref pill shows immediately on split view open with correct icon/name/remove. Escape close works via evaluate. Refs-cleared-after-send could not be fully verified.

**Suggestion**: Add a simple integration test that mocks message send and verifies `clearRefsRef.current()` is called in `onMessageSent`.

---

### D4 UX Quality (Weight: 20/100)
**Score: 4/20**

| Check | Pts | Result |
|-------|-----|--------|
| 4.1 Picker home with context | 0/3 | FAIL — Split view picker shows only search box + "无结果" (no "当前上下文" section, no type browse). /chat page shows same. Both fail due to baseUrl 404. |
| 4.2 Picker search | 0/4 | FAIL — Typing "鱼香" in picker search shows "无结果". Console: `GET http://localhost:3002/search?q=鱼香 404`. baseUrl missing `/context`. |
| 4.3 Breadcrumb trail | 0/3 | FAIL — Cannot drill into recipe, so no breadcrumb visible. |
| 4.4 Section display names | 2/3 | PARTIAL (backend-only) — API returns meaningful names ("食材准备", "经典意式甜品", "简单家常菜") not "章节 1". But cannot verify in UI since picker doesn't load data. Score 2/3 for correct backend data, -1 for unverifiable UI. |
| 4.5 Back button | 0/2 | FAIL — Cannot test, drill-down never loads. |
| 4.6 Multiple refs | 0/3 | FAIL — Cannot select entities from picker (always "无结果"), so cannot test adding second ref alongside auto-ref. |
| 4.7 Remove auto-ref pill | 2/2 | PASS — Clicked × on "🍳 提拉米苏" pill. Pill was removed. Snapshot confirmed no ref pills remain and pill did not re-appear. |

**Justification**: Nearly all UX quality checks fail because the picker cannot load any data from the backend (baseUrl missing `/context` prefix → all API calls 404). The only passing checks are remove-auto-ref (client-side only) and partial credit for section display names (verified via API, not UI).

**Suggestion**: Fix `baseUrl` to `http://localhost:3002/context` — this single fix would likely unblock all D4 checks since the backend APIs are fully functional.

---

### D5 Build Quality (Weight: 20/100)
**Score: 20/20**

| Check | Pts | Result |
|-------|-----|--------|
| 5.1 Frontend tsc | 3/3 | PASS — `npx tsc --noEmit` completes with no output (no errors) |
| 5.2 Frontend vite build | 3/3 | PASS — `npx vite build` succeeds: `built in 4.46s`. Chunk size warnings only. |
| 5.3 Backend tsc | 3/3 | PASS — `npx tsc --noEmit` completes with no output (no errors) |
| 5.4 Backend tests | 3/3 | PASS — 7 test files, 49 tests passed. Includes `recipe-provider.test.ts`, `context-api.integration.test.ts`, `edge-cases.integration.test.ts`, etc. |
| 5.5 No frozen package modifications | 3/3 | PASS — `git diff HEAD~1 --name-only` and `git diff --name-only` for all 5 frozen dirs (`packages/context-layer/src/`, `packages/chat-interface/src/`, `packages/context-layer-react/src/`, `packages/entity-document/src/`, `solutions/business/edu-platform/`) return empty. |
| 5.6 file: links correct | 3/3 | PASS — All 4 file: links resolve: `chat-interface`, `common`, `context-layer-react`, `react-sdk` all point to existing directories. |
| 5.7 Existing features work | 2/2 | PASS — `/recipes` loads 3 recipe cards. `/recipes/:id` loads full recipe detail with blocks. `/chat` loads with sidebar, welcome cards, and composer. |

**Justification**: All builds pass clean. All 49 backend tests pass. No frozen packages modified. File links resolve. All 3 core pages load correctly.

**Suggestion**: Add frontend unit/integration tests for the MentionPicker integration to catch baseUrl issues at build time.

---

## Penalties Applied

| ID | Condition | Check | Result |
|----|-----------|-------|--------|
| P1 | `packages/context-layer/src/` modified | `git diff HEAD~1` + `git diff` | No changes — **No penalty** |
| P2 | `packages/chat-interface/src/` modified | `git diff HEAD~1` + `git diff` | No changes — **No penalty** |
| P3 | `packages/context-layer-react/src/` modified | `git diff HEAD~1` + `git diff` | No changes — **No penalty** |
| P4 | `packages/entity-document/src/` modified | `git diff HEAD~1` + `git diff` | No changes — **No penalty** |
| P5 | `solutions/business/edu-platform/` modified | `git diff HEAD~1` + `git diff` | No changes — **No penalty** |
| P6 | Backend existing tests fail | `npx vitest run` | 49/49 pass — **No penalty** |
| P7 | Existing recipe browse/search broken | API checks | All return correct data — **No penalty** |

## Score Summary

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 Backend Entity Hierarchy | 20 | 20 | All API endpoints work correctly |
| D2 Frontend @Picker Integration | 10 | 20 | Code-level correct; picker data fails (baseUrl missing /context) |
| D3 Context Injection | 15 | 20 | autoRef, sessionContext, pills all work; send-clear untestable |
| D4 UX Quality | 4 | 20 | Picker non-functional in UI due to 404s; only pill-remove works |
| D5 Build Quality | 20 | 20 | All builds, tests, frozen checks pass |

Penalties: -0

总分: 69/100

## Bug Classification

| Deduction | Component | Category | Impact |
|-----------|-----------|----------|--------|
| D2: -10 (当前上下文, type browse, drill-down) | SYSTEM | baseUrl configuration | Picker cannot load any server data |
| D3: -5 (Escape partial, send-clear untested) | COMPONENT | Event handling / test coverage | Minor gaps |
| D4: -16 (search, breadcrumb, back, multi-ref) | SYSTEM | Same baseUrl root cause | All data-dependent UX broken |

## Actionable Fix Hints

1. **`solutions/business/recipe-book/frontend/src/config.ts:2`** — Change `RECIPE_BACKEND_URL` export or add a separate `CONTEXT_LAYER_URL`:
   - Current: `export const RECIPE_BACKEND_URL = import.meta.env.VITE_RECIPE_URL || 'http://localhost:3002'`
   - Fix option A: Add `export const CONTEXT_LAYER_URL = RECIPE_BACKEND_URL + '/context'`
   - Then update `RecipeDetailPage.tsx:266` and `ChatPage.tsx:136` to use `baseUrl={CONTEXT_LAYER_URL}`

2. **`solutions/business/recipe-book/frontend/src/pages/RecipeDetailPage.tsx:266`** — `baseUrl={RECIPE_BACKEND_URL}` → `baseUrl={RECIPE_BACKEND_URL + '/context'}`

3. **`solutions/business/recipe-book/frontend/src/pages/ChatPage.tsx:136`** — Same fix: `baseUrl={RECIPE_BACKEND_URL}` → `baseUrl={RECIPE_BACKEND_URL + '/context'}`

## Top 3 Priority Fixes

1. **[CRITICAL] Fix baseUrl to include `/context` prefix** — This single change (2 lines in config or 2 lines in page files) would unblock ~26 points across D2 and D4. The backend APIs are fully functional; only the client URL prefix is wrong.
2. **Add frontend integration test for MentionPicker API connectivity** — A smoke test that verifies the picker can reach `/entity-types` would catch this class of bug before manual QA.
3. **Add more sections per recipe in seed data** — Each recipe currently has only 1 section, limiting drill-down demonstration value.

## What's Working Well

1. **Backend entity hierarchy is excellent** — The recipe_section registration, parent-child relations, browse/search/resolve all work flawlessly. The 49-test suite with integration tests provides strong coverage. Do NOT change the backend.
2. **Auto-ref pill injection** — The `autoRef={true}` + `contextEntity` integration works perfectly: pill appears automatically on split-view open with correct icon/name/remove. The `MentionTrigger` bridge pattern for wiring @ keydown is clean. Do NOT change the pill/ref mechanism.
