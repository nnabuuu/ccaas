# Eval Report — recipe-book-at-picker v2

## Per-Dimension Scores

### D1 Backend Entity Hierarchy (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **1.1 recipe_section registered (3/3)**: GET `/context/entity-types` → `types` array includes `{type:'recipe_section', displayName:'章节', icon:'📑', searchable:true, browsable:true}`. Verified.
- **1.2 Relation tree (3/3)**: `tree.relations` includes `{parent:'recipe', child:'recipe_section', label:'章节', foreignKey:'recipeId'}`. `tree.roots` = `['recipe']`. Verified.
- **1.3 Browse recipes hasChildren (3/3)**: GET `/context/browse?entity_type=recipe` → all 3 items have `hasChildren: true` (提拉米苏, 番茄炒蛋, 鱼香肉丝). Verified.
- **1.4 Drill into recipe sections (4/4)**: GET `/context/browse?entity_type=recipe_section&parent_type=recipe&parent_id=ee2e8f24...` → `items.length === 1`, `displayName: "食材准备"`. items.length > 0 satisfied. Also verified 提拉米苏 ("经典意式甜品") and 番茄炒蛋 ("简单家常菜"). Note: only 1 section per recipe returned — shallow but meets criteria.
- **1.5 Search finds sections (3/3)**: GET `/context/search?q=食材` → `results` includes `{entityType:'recipe_section', entityId:'ee2e8f24...:section:0', displayName:'食材准备', breadcrumb:[{type:'recipe', displayName:'鱼香肉丝'}]}`. Verified.
- **1.6 Resolve recipe_section (2/2)**: GET `/context/resolve?entity_type=recipe_section&entity_id=ee2e8f24...:section:0` → returns `{entityType:'recipe_section', displayName:'食材准备', data:{type:'section', content:{heading:'食材准备'}}, breadcrumb:[...], resolvedAt:'...'}`. Verified.
- **1.7 Backward compat (2/2)**: GET `/context/browse?entity_type=recipe` → 3 recipes returned, all with `entityType`, `entityId`, `displayName`, `subtitle`, `hasChildren`, `summary` fields. Verified.

**Suggestion**: Extract ALL section headings (h2 + h3) from each recipe document. Currently only 1 section per recipe (the first heading) is returned.

---

### D2 Frontend @Picker Integration (Weight: 20/100)
**Score: 12/20**
**Justification**:
- **2.1 context-layer-react in package.json (2/2)**: `package.json:14` has `"@kedge-agentic/context-layer-react": "file:../../../../packages/context-layer-react"`. Note: the package is listed but NOT actually imported in source — code uses `src/lib/mention.ts` bridge importing directly from `packages/chat-interface/src/`.
- **2.2 MentionProvider wraps ChatInterface (2/2)**: `RecipeDetailPage.tsx:251` — `<MentionProvider>` wraps ChatInterface (line 253) and MentionPicker (line 265). `MentionTrigger` at line 252 wires clearRefs.
- **2.3 MentionPicker with contextEntity + autoRef (3/3)**: `RecipeDetailPage.tsx:265-276`: `<MentionPicker baseUrl={CONTEXT_LAYER_URL} contextEntity={{entityType:'recipe', entityId:id!, displayName:recipe.title, icon:'🍳'}} autoRef={true} />`.
- **2.4 MentionPicker renders in split view (3/3)**: Playwright: clicked "与 AI 讨论这道菜 →" button, typed `@` in composer textarea → picker overlay appeared with search input (`🔍 搜索实体...`) and content area. Picker renders and is functional.
- **2.5 "当前上下文" pinned section (0/3)**: Playwright: picker shows only search input and "无结果" when search is empty. NO "当前上下文" section visible in any snapshot. After typing `@`, the `@` character leaks into the search box. After clearing the search input (via React native input setter + event dispatch), the picker STILL shows only search input + "无结果" — no context section, no browse section. The MentionPicker component appears to be search-only.
- **2.6 Root entity type browse (0/2)**: No entity type browse section (食谱) visible in any picker snapshot. Picker has only: search input → results or "无结果". No "按类型浏览" section.
- **2.7 Drill into pinned context entity (0/3)**: Cannot test — no "当前上下文" section or drill button exists in the picker UI. No hierarchical navigation available.
- **2.8 /chat page picker (2/2)**: Playwright: navigated to `/chat`, typed `@`, picker opened. No "当前上下文" section present (correct — `ChatPage.tsx:135-139` has MentionPicker without `contextEntity` prop). Picker opens and functions.

**Suggestion**: The MentionPicker (from `chat-interface/src`) is a search-only widget lacking browse/context features. Either use the `AtPicker` from `@kedge-agentic/context-layer-react` (which has browse + context sections + drill-down), or implement these features in MentionPicker.

---

### D3 Context Injection (Weight: 20/100)
**Score: 19/20**
**Justification**:
- **3.1 sessionContext prop (3/3)**: `RecipeDetailPage.tsx:260` — `sessionContext={{ recipeId: id, recipeName: recipe.title, cuisine: recipe.cuisine }}` passed to ChatInterface.
- **3.2 sessionContext includes recipeId (2/2)**: Object includes `recipeId` and `recipeName` fields. Verified in source.
- **3.3 autoRef auto-adds recipe pill (4/4)**: Playwright: opened split view on 提拉米苏 detail page. WITHOUT typing `@` or any interaction, ref pill immediately visible: `🍳 提拉米苏` with × button (ref=e184). Status: "1 个实体已引用 · 发送时注入上下文" (ref=e185). Verified.
- **3.4 Reference pills display correctly (3/3)**: Playwright: auto-added pill has icon (🍳 at ref=e182), display name ("提拉米苏" at ref=e183), and × remove button (ref=e184). All three elements present. Verified.
- **3.5 @ keypress triggers picker (2/2)**: Playwright: typed `@` in composer textarea → picker overlay appeared with search input. Picker opens on `@`. Verified.
- **3.6 Escape closes picker (2/2)**: Playwright: dispatched `KeyboardEvent('keydown', {key:'Escape'})` on document → subsequent snapshot shows picker overlay removed from DOM. Verified.
- **3.7 Refs cleared after send (1/2)**: Code evidence only: `RecipeDetailPage.tsx:261` → `onMessageSent={() => clearRefsRef.current?.()}`. `MentionTrigger` (mention.ts:22) wires `clearRefsRef.current = clearRefs`. Chain is correct. **-1: Not verified via Playwright — requires sending a message to CCAAS backend which needs active AI session.**
- **3.8 baseUrl points to :3002 (2/2)**: `config.ts:2` → `RECIPE_BACKEND_URL = 'http://localhost:3002'`. `config.ts:5` → `CONTEXT_LAYER_URL = RECIPE_BACKEND_URL + '/context'`. `RecipeDetailPage.tsx:266` → `baseUrl={CONTEXT_LAYER_URL}`. Resolves to `http://localhost:3002/context`. Verified.

**Suggestion**: Add `e.preventDefault()` in `mention.ts:29` keydown handler to prevent `@` from leaking into both the textarea and picker search input.

---

### D4 UX Quality (Weight: 20/100)
**Score: 9/20**
**Justification**:
- **4.1 Picker home with/without context (0/3)**: Playwright: in split view, picker home shows only search input + "无结果" when empty. No "当前上下文" section. No entity type browse. On /chat page, same result — search only. Neither page shows browse categories. Both pages have identical picker structure.
- **4.2 Picker search works (4/4)**: Playwright: typed "鱼香" in search input → result item appeared: `🍳 鱼香肉丝` with subtitle "川菜 中等 食谱" (ref=e196). Clickable (cursor=pointer). Verified.
- **4.3 Breadcrumb trail (0/3)**: No drill-down navigation exists in picker. No breadcrumb UI rendered. (Backend supports breadcrumbs in search/resolve responses, but picker doesn't surface them.)
- **4.4 Section display names (0/3)**: Cannot verify in picker — no drill-down view. Backend returns meaningful names ("食材准备", "经典意式甜品") but the picker has no way to display them.
- **4.5 Back button (0/2)**: No drill-down UI → no back button.
- **4.6 Multiple refs (3/3)**: Playwright: with auto-ref 提拉米苏 pill present, opened picker, searched "鱼香", clicked 鱼香肉丝 result → 2 pills visible: `🍳 提拉米苏` (ref=e181) and `🍳 鱼香肉丝` (ref=e208). Status: "2 个实体已引用 · 发送时注入上下文". Verified.
- **4.7 Remove auto-ref pill (2/2)**: Playwright: clicked × on 提拉米苏 auto-ref pill (ref=e184) → pill removed, only 鱼香肉丝 pill remains (ref=e208). Status changed to "1 个实体已引用". 提拉米苏 did NOT re-appear. Verified.

**Suggestion**: Replace MentionPicker with a full AtPicker component that supports browse mode, "当前上下文" pinning, entity type navigation, drill-down, and breadcrumbs.

---

### D5 Build Quality (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **5.1 Frontend tsc (3/3)**: `cd solutions/business/recipe-book/frontend && npx tsc --noEmit` — completes with zero errors, no output.
- **5.2 Frontend vite build (3/3)**: `npx vite build` — succeeds: "built in 4.69s". Output includes index chunk (1068.70 kB). Chunk size warnings are informational only.
- **5.3 Backend tsc (3/3)**: `cd solutions/business/recipe-book/backend && npx tsc --noEmit` — completes with zero errors, no output.
- **5.4 Backend tests (3/3)**: `npx vitest run` — 7 test files, 49 tests, all pass. Duration: 1.49s. Files: `block-utils.test.ts` (6), `ingredient-transform.test.ts` (9), `recipe-provider.test.ts` (13), `context-api.integration.test.ts` (6), `agent-workflow.integration.test.ts` (4), `edit-operations.integration.test.ts` (4), `edge-cases.integration.test.ts` (7).
- **5.5 No frozen package modifications (3/3)**: `git diff HEAD~1 --name-only` and `git diff --name-only` for all 5 frozen directories: `packages/context-layer/src/`, `packages/chat-interface/src/`, `packages/context-layer-react/src/`, `packages/entity-document/src/`, `solutions/business/edu-platform/` — all empty. No modifications.
- **5.6 file: links correct (3/3)**: `package.json` has 4 `file:` links: `chat-interface` (line 12), `common` (line 13), `context-layer-react` (line 14), `react-sdk` (line 15). All resolve to `../../../../packages/...`. Paths verified to exist.
- **5.7 Existing features work (2/2)**: Playwright: `/recipes` loads with 3 recipe cards. `/recipes/:id` loads with full recipe detail (headings, ingredients, steps, nutrition table, tips). `/chat` loads with sidebar, session list, welcome screen, starter cards. All functional.

**Suggestion**: Add frontend unit tests (currently none — vitest found no test files in frontend dir).

---

## Penalties Applied

| ID | Condition | git diff HEAD~1 | git diff (uncommitted) | Penalty |
|----|-----------|-----------------|----------------------|---------|
| P1 | `packages/context-layer/src/` modified | No changes | No changes | None |
| P2 | `packages/chat-interface/src/` modified | No changes | No changes | None |
| P3 | `packages/context-layer-react/src/` modified | No changes | No changes | None |
| P4 | `packages/entity-document/src/` modified | No changes | No changes | None |
| P5 | `solutions/business/edu-platform/` modified | No changes | No changes | None |
| P6 | Backend tests fail | N/A — 49/49 pass | N/A | None |
| P7 | Existing browse/search broken | N/A — 3 recipes, all fields | N/A | None |

## Score Summary

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | 20 | 20 | All 7 checks pass. Backend entity hierarchy fully functional. |
| D2 | 12 | 20 | Picker is search-only — missing "当前上下文", type browse, drill-down (-8). |
| D3 | 19 | 20 | Clear-after-send not Playwright-verified (-1). All other checks pass. |
| D4 | 9 | 20 | No browse/drill UI → no breadcrumb, section names, back button (-11). Search + refs work. |
| D5 | 20 | 20 | Clean builds, all tests pass, no frozen dir violations. |

Penalties: -0

总分: 80/100

## Bug Classification

| Deduction | Points Lost | Category | Description |
|-----------|------------|----------|-------------|
| D2.5 "当前上下文" missing | -3 | DESIGN | MentionPicker has no context section — search-only component |
| D2.6 Type browse missing | -2 | DESIGN | MentionPicker has no entity type browse mode |
| D2.7 Drill-down missing | -3 | DESIGN | MentionPicker has no hierarchical navigation |
| D3.7 Clear-after-send unverified | -1 | SYSTEM | Requires live AI backend to test message send flow |
| D4.1 Picker home empty | -3 | DESIGN | No home view with browse categories or context pin |
| D4.3 No breadcrumb | -3 | DESIGN | No drill navigation → no breadcrumb trail |
| D4.4 Sections not shown in picker | -3 | DESIGN | Backend has section data but picker can't display it |
| D4.5 No back button | -2 | DESIGN | No drill navigation → no back button |

Root cause: The `MentionPicker` from `packages/chat-interface/src/` is a **search-only** widget. It does not implement the full AtPicker UX (browse, context pinning, drill-down, breadcrumbs) that `@kedge-agentic/context-layer-react` provides. The `mention.ts` bridge imports MentionPicker from chat-interface source instead of using AtPicker from context-layer-react.

## Actionable Fix Hints

1. **`src/lib/mention.ts:8`** — Replace `MentionPicker` import from `chat-interface/src/components/chat/MentionPicker` with `AtPicker` from `@kedge-agentic/context-layer-react`. The AtPicker component has built-in browse mode, "当前上下文" section, entity type navigation, drill-down with breadcrumbs, and back button. Expected change:
   ```ts
   // Before:
   export { MentionPicker } from '../../../../../../packages/chat-interface/src/components/chat/MentionPicker'
   // After:
   export { AtPicker as MentionPicker } from '@kedge-agentic/context-layer-react'
   ```

2. **`src/lib/mention.ts:29`** — Add `e.preventDefault()` to prevent `@` from leaking into picker search:
   ```ts
   if (e.key === '@') { e.preventDefault(); openPicker(); }
   ```

3. **Backend section provider** — Extract ALL heading blocks from recipe documents, not just the first one. Each recipe currently returns only 1 section. Modify the provider to parse all h2/h3 headings as separate browsable sections.

## Top 3 Priority Fixes

1. **Switch from MentionPicker to AtPicker** — This single change would recover D2.5 (+3), D2.6 (+2), D2.7 (+3), D4.1 (+3), D4.3 (+3), D4.4 (+3), D4.5 (+2) = **+19 points**. File: `src/lib/mention.ts:8`. Import AtPicker from `@kedge-agentic/context-layer-react` instead of MentionPicker from `chat-interface/src`.

2. **Fix `@` leak in MentionTrigger** — Add `e.preventDefault()` at `mention.ts:29`. Prevents `@` from appearing in both textarea and picker search box. One-line fix.

3. **Extract multiple sections per recipe** — Backend returns only 1 section per recipe (first heading). Modify section provider to extract all h2/h3 headings. Improves drill-down richness for future AtPicker integration.

## What's Working Well

1. **Backend entity hierarchy is clean and complete** — recipe_section registration, relation tree, browse/search/resolve all work correctly. The API returns breadcrumbs, icons, and meaningful display names. All 7 D1 checks pass with full marks. The design is extensible.

2. **Auto-ref injection and pill management are polished** — `autoRef={true}` + `contextEntity` auto-adds a reference pill immediately on split view open. Multiple refs accumulate correctly. Remove × works and auto-ref stays removed (no re-injection). The pill UI has proper icon, name, and remove button with clear status messaging ("N 个实体已引用 · 发送时注入上下文").
