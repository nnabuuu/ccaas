# Evaluator Prompt — recipe-book-multi-select v{N}

You are an independent evaluator. Score the recipe-book multi-select implementation against the rubric below. You have Playwright MCP tools for browser-based verification.

**App is running at http://localhost:5291** (frontend), http://localhost:3002 (recipe backend).

## Evaluation Protocol

1. Read the eval criteria: `cat harness-workspace/recipe-book-multi-select/EVAL_CRITERIA.md`
2. Run each check using the tools described below
3. Write a detailed eval report to: `harness-workspace/recipe-book-multi-select/eval-reports/v{N}-eval.md`

## Check-by-Check Verification

### D1: Multi-Select Core Flow (25 pts)

**1.1 Space adds active item to staging (4 pts)**
- Navigate to `/recipes` (recipe list page)
- Find a recipe card and click it to go to detail page (e.g., first recipe)
- On detail page, find the composer area
- Press `@` in composer → picker should open
- Note the initial pill count (`[data-testid="ref-pill"]` count — should be 1 from autoRef)
- Press ArrowDown to move to a selectable item
- Press Space
- Verify: picker is STILL OPEN (`recipe-picker-overlay` visible)
- Verify: the item now shows a green badge or `.staged` class
- Verify: a staging pill appeared in the staging area

**1.2 Space toggles (un-stage) (3 pts)**
- With an item staged (from 1.1), move keyboard to that item if not already there
- Press Space again
- Verify: staging pill for that item disappears
- Verify: item no longer has `.staged` class

**1.3 Enter commits all staged + closes (4 pts)**
- Navigate to `/chat` page (no autoRef, clean state)
- Type `@` to open picker
- Press Space on first selectable item → staged
- Press ArrowDown, press Space on second item → staged
- Note staging count should be 2
- Press Enter
- Verify: picker closed (`recipe-picker-overlay` not visible)
- Verify: pill count is 2 (`[data-testid="ref-pill"]` count)
- Verify: pill names match the two staged recipes

**1.4 Escape commits staged + closes (3 pts)**
- Navigate to `/chat` or reload to clear refs
- Type `@`, stage 1 item with Space
- Press Escape
- Verify: picker closed
- Verify: pill count is 1 (staged item was committed)

**1.5 Referenced items cannot be staged (3 pts)**
- Navigate to a recipe detail page (autoRef adds 1 pill)
- Type `@` to open picker
- Find the autoRef'd recipe in the list (should be `.referenced`)
- Use keyboard to navigate to it (it should be skipped by ↑↓)
- Verify: it has `✓ 已引用` text, NOT `✓ 已选`
- Alternative: use `browser_evaluate` to check if referenced items have `disabled` attribute

**1.6 Enter with no staging = single-select (3 pts)**
- On `/chat` page, clear refs
- Type `@`, do NOT press Space on anything
- Press ArrowDown to highlight an item
- Press Enter
- Verify: picker closes, pill count is exactly 1 (not 0, not 2)

**1.7 Staging resets on picker reopen (3 pts)**
- Type `@`, press Space on an item (staged), then press Escape (commits)
- Type `@` again to reopen picker
- Verify: no staging pills visible, no `.staged` items in list
- `browser_evaluate`: check no elements with `.recipe-picker-staging` visible

**1.8 Staged items NOT skipped by keyboard (2 pts)**
- Type `@`, stage an item with Space
- Use ArrowDown/ArrowUp — verify that the staged item still appears in the navigation cycle
- Verify: active highlight can land on the staged item (user can un-stage it)

### D2: Staging Area UI (20 pts)

**2.1 Staging area appears when staging ≥ 1 (3 pts)**
- Type `@`, no staging → verify: no `.recipe-picker-staging` element visible
- Press Space on item → verify: `.recipe-picker-staging` appears

**2.2 Each staging pill shows icon + name + × (3 pts)**
- With a staged item, inspect the staging pill
- `browser_evaluate`: check pill contains 🍳 (or emoji), recipe name text, and a × button

**2.3 × on staging pill removes from staging (3 pts)**
- Click the × button on a staging pill
- Verify: that pill disappears, item in list no longer has `.staged` class

**2.4 Staging count text visible (2 pts)**
- Stage 2 items, verify text like "已选 2 个" is visible

**2.5 Staging area hidden when empty (2 pts)**
- Un-stage all items (or have none staged)
- Verify: `.recipe-picker-staging` is not in DOM or not visible

**2.6 Staging pills use design tokens (3 pts)**
- `browser_evaluate` on a staging pill: check computed background/color
- Should use `var(--blue-bg)` / `var(--blue)` or equivalent design tokens
- Cross-check with CSS: `grep 'recipe-picker-staging-pill' index.css | grep 'var(--'` — at least 2 token usages

**2.7 List item shows green ✓ badge when staged (2 pts)**
- Stage an item → verify the item in the list has a ✓ badge element
- Check the badge is NOT the same as the "已引用" badge (different class or different text)

**2.8 Staged badge text is "已选" (2 pts)**
- Staged item: badge text reads `✓ 已选`
- Referenced item: badge text reads `✓ 已引用`
- These must be distinct

### D3: Keyboard & Interaction Quality (20 pts)

**3.1 Space prevents typing in search (3 pts)**
- Open picker, search input is focused
- Press Space
- `browser_evaluate`: check search input value is still empty (no space character)

**3.2 All other keys type normally (2 pts)**
- Type a Chinese character (e.g., type "ti" for 提) into search
- Verify search input shows the typed text, list filters

**3.3 ArrowDown/Up still cycle (3 pts)**
- Open picker, press ArrowDown multiple times → active moves through items
- Verify: already-referenced items are skipped
- Press ArrowUp past first → wraps to last selectable item

**3.4 Focus stays on search after Space (2 pts)**
- Press Space → `browser_evaluate`: `document.activeElement` is the search input (`.recipe-picker-search`)

**3.5 Placeholder updates when staging (3 pts)**
- Open picker, no staging → read placeholder text
- Stage an item → read placeholder text again
- Verify: placeholder text changed (includes staging count or "已选" text)

**3.6 Flash animation on Space-add (3 pts)**
- Press Space to add item → check for flash animation
- `browser_evaluate`: check if `.flash` class or `@keyframes flash-green` is defined
- Visual: item should briefly flash green
- If animation is too fast to catch, check CSS: `grep 'flash-green' index.css`

**3.7 Mouse click on item still works (1 pt)**
- Click on a selectable item (not Space, just mouse click) with NO staged items
- Verify: picker closes, item added as ref (single-select via mouse, unchanged)

**3.8 Overlay click-outside closes (1 pt)**
- Open picker, click on the overlay (outside the dropdown)
- If staging exists: verify staging was committed (pills appear)
- Verify: picker closed

**3.9 Mouse click after staging commits staged items (2 pts)**
- Navigate to `/chat` page (clean state, no autoRef)
- Type `@` to open picker
- Press Space on first selectable item → staged
- Press ArrowDown, press Space on second item → staged (2 items staged)
- Now **click** a third item with the mouse (not Space, not Enter)
- Verify: picker closed
- Verify: pill count is 3 (`[data-testid="ref-pill"]` count)
- Verify: pill names include all 3 recipes (the 2 staged + the 1 clicked)
- This tests that mouse click with existing staging routes through `commitStaging(clickedItem)` rather than `handleSelect(clickedItem)` which would discard staging

### D4: CSS & Design Token Quality (15 pts)

**4.1 No hardcoded hex in new CSS (3 pts)**
- Run: `grep -n 'recipe-picker-staging\|staged-check\|flash-green' solutions/business/recipe-book/frontend/src/index.css`
- Check matched lines for `#[0-9a-fA-F]{3,8}` — should be zero
- Also check for hardcoded `rgb()` values outside of `var(--`

**4.2 Design token count in staging CSS (3 pts)**
- Run: count `var(--` occurrences in staging-related CSS rules
- Need ≥ 5 to get full marks (≥ 3 for partial)

**4.3 Flash animation uses CSS @keyframes (2 pts)**
- `grep '@keyframes' index.css` — should find `flash-green` or similar

**4.4 Dark mode: staging area readable (3 pts)**
- Navigate to detail page with picker open
- `browser_evaluate`: inject dark mode tokens (same method as recipe-picker eval):
  ```js
  document.documentElement.style.setProperty('--surface', '#262624')
  document.documentElement.style.setProperty('--border', 'rgba(232,230,225,0.07)')
  document.documentElement.style.setProperty('--t1', '#e8e6e1')
  document.documentElement.style.setProperty('--t2', '#b8b5ad')
  document.documentElement.style.setProperty('--t3', '#8a8780')
  document.documentElement.style.setProperty('--blue-bg', '#1a3a52')
  document.documentElement.style.setProperty('--blue', '#5ba3d9')
  ```
- Stage an item, check staging pill visibility (bg vs text contrast)
- Check dropdown overall appearance

**4.5 No layout shift on staging appear/disappear (2 pts)**
- Stage and un-stage → the list items should not jump dramatically
- Visual inspection: the staging area should appear/disappear smoothly

**4.6 Existing RecipePicker styles preserved (2 pts)**
- `grep -c 'recipe-picker-overlay\|recipe-picker-dropdown\|recipe-picker-search\|recipe-picker-item' index.css` — verify key selectors still exist

### D5: Build Quality & Regression (20 pts)

**5.1 tsc (3 pts)**
- Run: `cd solutions/business/recipe-book/frontend && npx tsc --noEmit`
- Must exit 0 with no errors

**5.2 vite build (3 pts)**
- Run: `cd solutions/business/recipe-book/frontend && npx vite build`
- Must succeed ("✓ built in Xs")

**5.3 vitest (2 pts)**
- Run: `cd solutions/business/recipe-book/backend && npx vitest run`
- All tests pass

**5.4 Frozen packages (4 pts)**
- Run: `git diff --name-only -- packages/chat-interface/src/ packages/context-layer/src/ packages/context-layer-react/src/ packages/entity-document/src/ solutions/business/edu-platform/`
- Must be empty
- Run: `git diff --name-only -- solutions/business/recipe-book/backend/ | grep -v '.db$'`
- Must be empty

**5.5 Recipe list page (2 pts)**
- Navigate to `/recipes` → 3 recipe cards visible with titles, metadata

**5.6 Recipe detail page (2 pts)**
- Navigate to `/recipes/{first-recipe-id}` → full recipe visible, autoRef pill present

**5.7 Chat page (2 pts)**
- Navigate to `/chat` → welcome screen, starter cards, composer visible

**5.8 Pill remove still works (2 pts)**
- On detail page, find ref pill × button → click → pill disappears, count decreases

## Penalty Checks

| ID | Command | Expected |
|----|---------|----------|
| P1 | `git diff --name-only -- packages/context-layer-react/src/` | empty |
| P2 | `git diff --name-only -- packages/chat-interface/src/` | empty |
| P3 | `git diff --name-only -- packages/entity-document/src/` | empty |
| P4 | `git diff --name-only -- solutions/business/edu-platform/` | empty |
| P5 | `git diff --name-only -- solutions/business/recipe-book/backend/ \| grep -v '.db$'` | empty |
| P6 | `cd solutions/business/recipe-book/frontend && npx tsc --noEmit && npx vite build` | success |
| P7 | `cd solutions/business/recipe-book/backend && npx vitest run` | pass |

## Report Format

Save to: `harness-workspace/recipe-book-multi-select/eval-reports/v{N}-eval.md`

```markdown
# Eval Report — recipe-book-multi-select v{N}

## Per-Dimension Scores

### D1 Multi-Select Core Flow (Weight: 25/100)
**Score: ?/25**
**Justification**:
- 1.1 (?/4): [evidence]
...

### D2 Staging Area UI (Weight: 20/100)
...

### D3 Keyboard & Interaction Quality (Weight: 20/100)
...

### D4 CSS & Design Token Quality (Weight: 15/100)
...

### D5 Build Quality & Regression (Weight: 20/100)
...

## Penalties Applied
| ID | Check | Result |
|----|-------|--------|
...

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
...

Penalties: ?
**总分: ?/100**

## Bug Classification
...

## Actionable Fix Hints
...

## Top 3 Priority Fixes
...

## What's Working Well
...
```

Be thorough and evidence-based. Include specific values from `browser_evaluate` calls in your justifications.
