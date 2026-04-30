# Eval Criteria — recipe-book-recipe-picker

## 评分体系

5 个维度 × 20 分 = 100 分。每个 Check 有明确的检测方法（Playwright / grep / bash）。

**核心原则：键盘优先。** 用户输入 `@` 后进入键盘流，必须能完全通过键盘完成选择。D2（键盘导航）是本任务的核心维度。

---

### D1: Component Architecture (Weight: 20/100)

验证 RecipePicker 组件创建正确，MentionPicker 被完全替换。

| Check | Points | Detection |
|-------|--------|-----------|
| 1.1 RecipePicker.tsx exists | 2 | `ls solutions/business/recipe-book/frontend/src/components/RecipePicker.tsx` |
| 1.2 RecipePicker uses useMentionContext() | 3 | `grep "useMentionContext" .../RecipePicker.tsx` — must import and call |
| 1.3 RecipePicker uses useRecipes() hook | 2 | `grep "useRecipes" .../RecipePicker.tsx` — fetches recipes directly, not via context-layer browse |
| 1.4 RecipePicker uses ContextLayerClient.resolve() | 3 | `grep "ContextLayerClient\|\.resolve(" .../RecipePicker.tsx` — for entity data injection |
| 1.5 MentionPicker removed from mention.ts | 2 | `grep "MentionPicker" .../lib/mention.ts` — should NOT match |
| 1.6 MentionPicker removed from RecipeDetailPage | 2 | `grep "MentionPicker" .../pages/RecipeDetailPage.tsx` — should NOT match |
| 1.7 MentionPicker removed from ChatPage | 2 | `grep "MentionPicker" .../pages/ChatPage.tsx` — should NOT match |
| 1.8 RecipePicker used in RecipeDetailPage with contextEntity+autoRef | 2 | `grep -A5 "RecipePicker" .../pages/RecipeDetailPage.tsx` — verify contextEntity and autoRef props |
| 1.9 RecipePicker used in ChatPage without contextEntity | 2 | `grep "RecipePicker" .../pages/ChatPage.tsx` — present but no contextEntity/autoRef |

**Penalty P1**: If `packages/context-layer-react/src/` has changes → D1 = 0

### D2: Keyboard Navigation (Weight: 20/100)

**核心维度。** 验证完全的键盘操作体验：打开→搜索→导航→选择→关闭。

| Check | Points | Detection |
|-------|--------|-----------|
| 2.1 @ keypress opens picker | 2 | Playwright: type `@` in composer → picker overlay appears |
| 2.2 Search input auto-focused on open | 2 | Playwright: after @ opens picker, verify input is focused (document.activeElement check) |
| 2.3 ArrowDown moves active highlight | 3 | Playwright: press ArrowDown → verify `.recipe-picker-item.active` moves to next selectable item |
| 2.4 ArrowUp moves active highlight | 2 | Playwright: press ArrowUp → verify `.active` moves backwards, wraps around |
| 2.5 Keyboard skips already-referenced items | 3 | Playwright: with autoRef pill present, press ArrowDown → `.active` never lands on `.referenced` item |
| 2.6 Enter selects active item | 3 | Playwright: navigate to item with ArrowDown, press Enter → picker closes, new ref pill appears |
| 2.7 Escape closes picker | 2 | Playwright: press Escape → picker overlay disappears |
| 2.8 Active item visible highlight | 2 | Playwright: `getComputedStyle()` on `.active` item — background differs from non-active |
| 2.9 Search input retains focus during navigation | 1 | Playwright: after ArrowDown, verify `document.activeElement` is still the search input |

**Penalty P2**: If `packages/chat-interface/src/` has changes → D2 = 0

### D3: Context Integration (Weight: 20/100)

验证 autoRef、resolve、ref pills、@ 触发、send-time 清理。

| Check | Points | Detection |
|-------|--------|-----------|
| 3.1 autoRef auto-adds pill on detail page (without user @-ing) | 4 | Playwright: navigate to /recipes/:id, open split view → ref pill visible automatically |
| 3.2 Auto-ref pill shows icon + recipe name + × button | 3 | Playwright: verify pill has 🍳, recipe title, and × button |
| 3.3 Manual selection adds second pill | 3 | Playwright: type @, navigate and select → second pill appears alongside auto-ref pill |
| 3.4 Remove pill via × button works | 2 | Playwright: click × on a pill → pill disappears |
| 3.5 Refs cleared after message send | 2 | Playwright: with ref present, type message and send → ref pills cleared |
| 3.6 baseUrl uses CONTEXT_LAYER_URL | 2 | `grep -n "baseUrl\|CONTEXT_LAYER_URL" .../RecipePicker.tsx .../RecipeDetailPage.tsx .../ChatPage.tsx` |
| 3.7 ChatPage picker works without autoRef | 2 | Playwright: navigate /chat, type @, picker opens with recipe list, no auto-ref pill |
| 3.8 Summary text shows count | 2 | Playwright: with refs present, verify "N 个食谱已引用" text visible |

**Penalty P3**: If `packages/entity-document/src/` has changes → D3 = 0

### D4: Visual & CSS Quality (Weight: 20/100)

验证 AtPicker CSS 清理、RecipePicker 样式质量、design token 使用、暗色模式。

| Check | Points | Detection |
|-------|--------|-----------|
| 4.1 AtPicker CSS overrides removed | 4 | `grep -c "at-picker-overlay\|at-picker" .../index.css` — should be 0 |
| 4.2 No `[style*="rgb"]` selectors remain | 3 | `grep -c 'style\*=' .../index.css` — should be 0 (or only non-AtPicker ones) |
| 4.3 RecipePicker styles use design tokens | 3 | `grep -c "var(--" .../index.css` in RecipePicker section — count >= 10 |
| 4.4 No new hardcoded hex colors in RecipePicker CSS | 2 | `grep "recipe-picker" .../index.css \| grep -E "#[0-9a-fA-F]{3,6}" \| grep -v "var(--"` — should be empty |
| 4.5 Picker dropdown renders correctly | 2 | Playwright: open picker, verify dropdown visible with border, search input, recipe items |
| 4.6 Referenced items visually distinct | 2 | Playwright: `getComputedStyle()` on `.referenced` item — lower opacity or grayed out |
| 4.7 Ref pills use design tokens | 2 | Playwright: `getComputedStyle()` on `[data-testid="ref-pill"]` — background NOT `#e8f0fe` hardcoded |
| 4.8 Dark mode: picker readable | 2 | Playwright: force dark mode, open picker → text and background have sufficient contrast |

**Penalty P4**: If `solutions/business/edu-platform/` has changes → D4 = 0

### D5: Build Quality (Weight: 20/100)

验证构建、类型检查、冻结约束、功能回归。

| Check | Points | Detection |
|-------|--------|-----------|
| 5.1 `tsc --noEmit` passes (frontend) | 3 | `cd .../frontend && npx tsc --noEmit` |
| 5.2 `vite build` succeeds (frontend) | 3 | `cd .../frontend && npx vite build` |
| 5.3 Backend tests pass | 2 | `cd .../backend && npx vitest run` |
| 5.4 No frozen package modifications | 4 | `git diff --name-only -- packages/chat-interface/src/ packages/context-layer/src/ packages/context-layer-react/src/ packages/entity-document/src/ solutions/business/edu-platform/ solutions/business/recipe-book/backend/` — must be empty (except .db files) |
| 5.5 Recipe list page loads | 2 | Playwright: navigate /recipes → recipes visible |
| 5.6 Recipe detail page loads | 2 | Playwright: navigate /recipes/:id → recipe content visible |
| 5.7 Chat page loads | 2 | Playwright: navigate /chat → chat interface visible |
| 5.8 file: links correct | 2 | `grep "file:" .../frontend/package.json` — paths resolve |

---

## Penalties

| ID | Condition | Effect |
|----|-----------|--------|
| P1 | `packages/context-layer-react/src/` modified | D1 = 0 |
| P2 | `packages/chat-interface/src/` modified | D2 = 0 |
| P3 | `packages/entity-document/src/` modified | D3 = 0 |
| P4 | `solutions/business/edu-platform/` modified | D4 = 0 |
| P5 | `solutions/business/recipe-book/backend/` modified (except .db) | D5 = 0 |
| P6 | Frontend tsc or vite build fails | D5 = 0 |
| P7 | Backend tests fail | -5 from D5 |
