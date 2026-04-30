# Evaluation Criteria — recipe-book-multi-select

Total: 100 points across 5 dimensions.

---

## D1: Multi-Select Core Flow (Weight: 25/100)

The core feature: Space adds to staging, Enter/Esc commits.

| # | Check | Points | How to verify |
|---|-------|--------|---------------|
| 1.1 | Space adds active item to staging | 4 | Navigate to a recipe → press Space → item stays in list with green badge, picker stays open |
| 1.2 | Space toggles (un-stage) | 3 | Press Space on already-staged item → removes from staging, badge disappears |
| 1.3 | Enter commits all staged + closes | 4 | Stage 2 items → press Enter → pill count increases by 2, picker closes |
| 1.4 | Escape commits staged + closes | 3 | Stage 2 items → press Esc → pill count increases by 2, picker closes |
| 1.5 | Referenced items cannot be staged | 3 | Item already in refs → press Space → no change (still `✓ 已引用`) |
| 1.6 | Enter with no staging = single-select | 3 | Don't stage anything → press Enter on active → pill count +1, picker closes (backward compat) |
| 1.7 | Staging resets on picker reopen | 3 | Stage item → close → reopen → no staged items visible |
| 1.8 | Staged items skipped only by referenced check | 2 | Stage item A → ArrowDown/Up still lands on item A (user can un-stage) |

---

## D2: Staging Area UI (Weight: 20/100)

Visual display of staging state within the picker.

| # | Check | Points | How to verify |
|---|-------|--------|---------------|
| 2.1 | Staging area appears when staging ≥ 1 | 3 | Space on item → staging area becomes visible with pill(s) |
| 2.2 | Each staging pill shows icon + name + × | 3 | Inspect staging pill: has 🍳, recipe name, × button |
| 2.3 | × on staging pill removes from staging | 3 | Click × on staging pill → pill disappears, item's green badge removed |
| 2.4 | Staging count text visible | 2 | "已选 {n} 个" text visible within picker |
| 2.5 | Staging area hidden when empty | 2 | Remove all staging → staging area hidden (no empty container) |
| 2.6 | Staging pills use design tokens | 3 | Inspect staging pill — no hardcoded hex, uses `var(--*)` |
| 2.7 | List item shows green ✓ badge when staged | 2 | `.recipe-picker-item.staged` has `.recipe-picker-item-check` with green color |
| 2.8 | Staged badge text is "已选" (not "已引用") | 2 | Staged item's badge text reads `✓ 已选`, referenced item reads `✓ 已引用` |

---

## D3: Keyboard & Interaction Quality (Weight: 20/100)

Keyboard navigation still works perfectly with multi-select additions.

| # | Check | Points | How to verify |
|---|-------|--------|---------------|
| 3.1 | Space prevents typing in search | 3 | Press Space while search focused → no space character appears in input |
| 3.2 | All other keys type normally in search | 2 | Type "提" → search input shows "提", list filters |
| 3.3 | ArrowDown/Up still cycle selectable items | 3 | Same behavior as v1: skip referenced, wrap around |
| 3.4 | Focus stays on search input after Space | 2 | Press Space → `document.activeElement` is still search input |
| 3.5 | Placeholder updates when staging | 3 | Empty staging: "搜索食谱..." → with staging: different text reflecting staging count |
| 3.6 | Flash animation on Space-add | 3 | Press Space → item briefly flashes green background |
| 3.7 | Mouse click on item still works (single-select) | 1 | Click item with no staging → adds to refs directly + closes (unchanged) |
| 3.8 | Overlay click-outside still closes | 1 | Click overlay backdrop → picker closes (with staging commit if any) |
| 3.9 | Mouse click after staging commits staged items | 2 | Stage 2 items with Space, then click a third with mouse → all 3 committed as pills |

---

## D4: CSS & Design Token Quality (Weight: 15/100)

All new styling uses the design token system.

| # | Check | Points | How to verify |
|---|-------|--------|---------------|
| 4.1 | No hardcoded hex in new/changed CSS | 3 | `grep` new staging-related CSS rules — no `#hex` values |
| 4.2 | Design token count in staging CSS | 3 | ≥ 5 `var(--` usages in staging-related styles |
| 4.3 | Flash animation uses CSS @keyframes | 2 | `@keyframes` defined in index.css for flash effect |
| 4.4 | Dark mode: staging area readable | 3 | Force dark tokens → staging pills bg/text have sufficient contrast |
| 4.5 | No layout shift on staging appear/disappear | 2 | Stage item → unstage → no jumpy visual shifts |
| 4.6 | Existing RecipePicker styles preserved | 2 | `.recipe-picker-overlay`, `.recipe-picker-dropdown` etc. still present and functional |

---

## D5: Build Quality & Regression (Weight: 20/100)

Nothing breaks.

| # | Check | Points | How to verify |
|---|-------|--------|---------------|
| 5.1 | `tsc --noEmit` passes | 3 | Zero type errors |
| 5.2 | `vite build` succeeds | 3 | Clean build output |
| 5.3 | `vitest run` passes | 2 | All existing tests pass |
| 5.4 | Frozen packages untouched | 4 | `git diff --name-only -- packages/ solutions/business/edu-platform/ solutions/business/recipe-book/backend/` → empty (except .db) |
| 5.5 | Recipe list page functional | 2 | Navigate to `/recipes` → 3 recipe cards visible |
| 5.6 | Recipe detail page functional | 2 | Navigate to `/recipes/{id}` → content visible, autoRef pill present |
| 5.7 | Chat page functional | 2 | Navigate to `/chat` → welcome screen + composer visible |
| 5.8 | Pill remove (×) still works | 2 | Click × on committed ref pill → pill disappears, count decreases |

---

## Penalties

| ID | Check | Penalty |
|----|-------|---------|
| P1 | `packages/context-layer-react/src/` modified | -10 |
| P2 | `packages/chat-interface/src/` modified | -10 |
| P3 | `packages/entity-document/src/` modified | -10 |
| P4 | `solutions/business/edu-platform/` modified | -10 |
| P5 | `solutions/business/recipe-book/backend/` modified (except .db) | -10 |
| P6 | Frontend tsc or vite build fails | -15 |
| P7 | Backend tests fail | -5 |

---

## Score Summary Template

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 Multi-Select Core Flow | ?/25 | 25 | |
| D2 Staging Area UI | ?/20 | 20 | |
| D3 Keyboard & Interaction | ?/20 | 20 | |
| D4 CSS & Design Token | ?/15 | 15 | |
| D5 Build & Regression | ?/20 | 20 | |

Penalties: ?

**总分: ?/100**
