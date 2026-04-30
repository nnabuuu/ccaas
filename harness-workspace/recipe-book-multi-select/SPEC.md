# SPEC — recipe-book-multi-select

## Objective

Add **multi-select** (Add & Stay) to the existing RecipePicker. When the user types `@`, they can now add multiple recipes in a single picker session using the Space key, then confirm all with Enter. This follows the "三操作模型" from the @ Picker reference design:

| Operation | Key | Intent | Analogy |
|---|---|---|---|
| **Select & Close** | Enter | Confirm current + commit all | Shopping cart "checkout" |
| **Add & Stay** | Space | Add this one, keep browsing | Shopping cart "add to cart" |
| ~~Drill In~~ | ~~→~~ | ~~See children~~ | _(not applicable — recipes are flat)_ |

## Why This Matters

The current RecipePicker is single-select: Enter selects one recipe and closes the picker. To reference 2+ recipes (e.g., "compare 提拉米苏 and 番茄炒蛋"), the user must type `@`, select, then `@` again. The reference design identifies multi-select as a core UX improvement: "不必反复触发 @".

## Current State

RecipePicker v1 (already implemented at `src/components/RecipePicker.tsx`):
- Flat recipe list via `useRecipes()`, search filter
- Full keyboard nav: ↑↓ navigate, Enter select, Escape close
- `selectableIndices` pattern skips already-referenced items
- autoRef on RecipeDetailPage, pills with × remove
- Design-token CSS, dark mode works
- **Single-select only**: Enter → addRef() + closePicker()

## Deliverables

### 1. Modify: `src/components/RecipePicker.tsx`

Add multi-select with local staging:

**Staging State:**
- New `staging: Array<{ id: string; title: string }>` state (local to RecipePicker)
- Staging is separate from `refs` (committed references) — staging items are "pending"
- Staging clears when picker opens (fresh each session)

**Space Key (Add & Stay):**
- Space on active item → toggles it in/out of staging
- If item not staged: add to staging, item shows green ✓ badge + flash green animation
- If item already staged: remove from staging, badge disappears
- Already-referenced items (in `refs`) cannot be staged — Space is no-op
- Picker stays open after Space (that's the point)
- Focus stays on search input

**Enter (Commit & Close):**
- Enter on active item: adds active item to staging (if not already staged), then commits ALL staged items
- Commit = for each staged item: `ContextLayerClient.resolve()` → `addRef()` (parallel)
- Then `closePicker()`
- If nothing staged and Enter on active item: behaves like current single-select (select + close)

**Escape (Commit & Close — never discard):**
- Esc with staging → commits all staged items + closes (reference: "Esc 永不丢弃已选")
- Esc without staging → just closes (unchanged behavior)
- This is a key design principle: the user's selections are never lost

**Staging Area UI (within picker dropdown):**
- Shown between search input and recipe list (or at bottom of dropdown)
- Each staged item rendered as a small pill: `🍳 {name} ×`
- Click × removes from staging
- Staging count text: `已选 {n} 个`
- Hidden when staging is empty (no layout reserved)

**List Item Visual Changes:**
- Staged items show green ✓ badge (CSS class `.staged`): `✓ 已选`
- Referenced items still show grayed `✓ 已引用` (CSS class `.referenced`)
- Active item still highlighted with `.active` class
- Staged + active item: both `.staged` and `.active` classes

**Keyboard Navigation Updates:**
- ↑↓ still cycle through selectable items (skip referenced AND do NOT skip staged — user may want to un-stage)
- Space is handled in `onKeyDown` alongside ArrowDown/ArrowUp/Enter/Escape
- Space calls `e.preventDefault()` to prevent typing space in search input
- Search input still accepts all other characters normally

**Placeholder Updates:**
- When staging empty: `搜索食谱... ↑↓选择 Space添加 ⏎确认 Esc关闭`
- When staging has items: `已选 {n} 个 · Space继续选 ⏎确认`

### 2. Modify: `src/index.css`

Add CSS for staging-related styles:

- `.recipe-picker-item.staged` — green ✓ badge styling
- `.recipe-picker-item.staged .recipe-picker-item-check` — green color from design tokens
- `.recipe-picker-staging` — staging area container
- `.recipe-picker-staging-pill` — small pill in staging area
- `.recipe-picker-staging-pill-remove` — × button on staging pill
- `.recipe-picker-staging-count` — count text
- `@keyframes flash-green` — flash animation for Space-add (background flash, 400ms)
- `.recipe-picker-item.flash` — applies flash-green animation
- All colors via design tokens: `var(--blue-bg)`, `var(--blue)`, `var(--surface)`, `var(--border)`, `var(--t1)`, `var(--t2)`, `var(--t3)`

### Visual Design

```
┌─────────────────────────────────────────┐
│ 🔍 已选 2 个 · Space继续选 ⏎确认        │  ← placeholder reflects staging
├─────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐          │
│ │ 🍳 番茄炒蛋 ×│ │ 🍳 鱼香肉丝 ×│          │  ← staging pills
│ └────────────┘ └────────────┘          │
│ 已选 2 个                               │
├─────────────────────────────────────────┤
│ 🍳 提拉米苏               ← active     │  ← selectable (not staged)
│ ✓ 番茄炒蛋          (已选)              │  ← staged (green badge)
│ ✓ 鱼香肉丝          (已选)              │  ← staged (green badge)
└─────────────────────────────────────────┘

Ref pills below composer (unchanged):
┌──────────────┐
│ 🍳 提拉米苏 ×│  (autoRef from detail page)
└──────────────┘
1 个食谱已引用 · 发送时注入上下文
```

After Enter (commits staging):
```
Ref pills:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🍳 提拉米苏 ×│ │ 🍳 番茄炒蛋 ×│ │ 🍳 鱼香肉丝 ×│
└──────────────┘ └──────────────┘ └──────────────┘
3 个食谱已引用 · 发送时注入上下文
```

## File Structure

All files in `solutions/business/recipe-book/frontend/`:

| File | Action | Description |
|------|--------|-------------|
| `src/components/RecipePicker.tsx` | MODIFY | Add staging state, Space handler, commit logic, staging UI |
| `src/index.css` | MODIFY | Add staging styles, flash animation, staged badge |

Only 2 files modified. RecipePicker already exists; this is a feature addition.

## Frozen Constraints

| ID | Constraint |
|----|------------|
| FC-1 | `packages/chat-interface/src/` NOT modified |
| FC-2 | `packages/context-layer/src/` NOT modified |
| FC-3 | `packages/context-layer-react/src/` NOT modified |
| FC-4 | `packages/entity-document/src/` NOT modified |
| FC-5 | `solutions/business/edu-platform/` NOT modified |
| FC-6 | `solutions/business/recipe-book/backend/` NOT modified (except .db) |
| FC-7 | Frontend port 5291, backend port 3002 |
| FC-8 | `tsc --noEmit` passes |
| FC-9 | `vite build` succeeds |

## Key Reference Files

| File | Purpose |
|------|---------|
| `src/components/RecipePicker.tsx` | Current implementation to modify |
| `src/index.css` | Current CSS with RecipePicker styles |
| `packages/chat-interface/src/components/chat/MentionContext.tsx` | MentionRef type, addRef, closePicker (frozen) |
| `src/hooks/useRecipes.ts` | useRecipes(query) hook |
| `src/config.ts` | URL constants |
| `packages/context-layer/src/client/index.ts` | ContextLayerClient.resolve() API |

## Key Design Principles (from Reference)

1. **"Esc 永不丢弃已选"** — Escape commits staging then closes. User's work is never lost.
2. **"Space = Add & Stay"** — Space adds without closing. Enter is the final confirm.
3. **Staging is local** — Staging lives within RecipePicker, not in MentionContext. Only committed refs go through `addRef()`.
4. **Referenced items are separate from staged** — Items already in `refs` (committed) are grayed + disabled. Staged items are green + toggleable.

## Exit Conditions

- Score >= 95/100 → success
- Score >= 85/100 → pass
- Max 5 iterations
- Diminishing returns: < 3 pts improvement for 2 consecutive iterations → stop
