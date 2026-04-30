# SPEC — recipe-book-recipe-picker

## Objective

Replace the generic AtPicker component with a purpose-built `RecipePicker` component in the recipe-book frontend. AtPicker is a generic enterprise entity browser (645 lines, frozen) designed for multi-entity CRM hierarchies — overkill and broken UX for recipe-book's 3 flat recipes. The replacement must deliver a **keyboard-first** picker experience: when a user types `@`, they are in keyboard-flow and must be able to navigate, select, and dismiss without touching the mouse.

## Why This Matters

AtPicker's UX problems in recipe-book:
- Two mystery buttons per item ("▶" drill-down + "选择" select) for flat entities that have no children
- Developer jargon ("搜索实体...")
- Popup overlay blocks the composer
- ~170 lines of brittle CSS overrides (`[style*="rgb value"]` selectors) fighting inline styles
- **No keyboard navigation** — user types `@` then must grab the mouse

## Current State

- **Backend**: `solutions/business/recipe-book/backend/` — complete, has recipe browse/search/resolve via context-layer. **Do not modify.**
- **Frontend**: `solutions/business/recipe-book/frontend/` — has working chat integration with MentionProvider, MentionPicker (wrapping AtPicker), MentionTrigger, ref pills. CSS index.css has ~170 lines of AtPicker overrides.
- **MentionContext**: `packages/chat-interface/src/components/chat/MentionContext.tsx` — provides `refs`, `addRef`, `removeRef`, `clearRefs`, `pickerOpen`, `openPicker`, `closePicker`. **Frozen, read-only.**
- **ContextLayerClient**: `@kedge-agentic/context-layer/client` — `resolve(entityType, entityId)` returns entity data for LLM context injection. Used by RecipePicker for autoRef and manual selection.

## Deliverables

### 1. Create: `src/components/RecipePicker.tsx` (~120-150 lines)

A self-contained component that replaces both the AtPicker overlay AND MentionPicker's pill rendering.

**Props:**
```typescript
interface RecipePickerProps {
  baseUrl: string           // CONTEXT_LAYER_URL for ContextLayerClient
  contextEntity?: {         // current recipe (on detail page)
    entityType: string
    entityId: string
    displayName: string
    icon?: string
  }
  autoRef?: boolean         // auto-resolve + addRef on mount
}
```

**Picker Overlay (when `pickerOpen` is true):**
- Search input with placeholder `搜索食谱...` and keyboard hint
- Flat list of recipes fetched via `useRecipes(query)` (existing hook at `src/hooks/useRecipes.ts`)
- Already-referenced recipes shown grayed/disabled with "✓ 已引用" badge
- Single click or Enter to select → `ContextLayerClient.resolve()` → `addRef()` → `closePicker()`
- Escape key closes picker
- Click outside (on overlay backdrop) closes picker

**Keyboard Navigation (CRITICAL):**
- `ArrowDown` / `ArrowUp` — cycle through selectable items (skip already-referenced)
- `Enter` — select the currently highlighted item
- `Escape` — close the picker
- Active item has visible highlight (`.active` class with background change)
- Active item auto-scrolls into view when navigating long lists
- Active index resets to 0 when search query changes or list refreshes
- Mouse hover on an item syncs the active index (keyboard and mouse don't fight)
- Focus stays on search input at all times — never leaves keyboard context

**Reference Pills (when `refs.length > 0`):**
- Displays below/near the composer
- Each pill shows: icon + displayName + × remove button
- Uses `data-testid="ref-pill"` for CSS targeting
- Summary text: `{count} 个食谱已引用 · 发送时注入上下文`

**AutoRef (when `autoRef` + `contextEntity`):**
- On mount, resolves `contextEntity` via `ContextLayerClient.resolve()`
- Calls `addRef()` with resolved data (entity data + summary for LLM)
- Uses ref guard to prevent duplicate resolution on re-renders
- Falls back gracefully if resolve fails (adds ref without data)

### 2. Modify: `src/lib/mention.ts`

- Keep re-exports of `MentionProvider`, `useMentionContext`, `MentionRef`, `MentionTrigger`
- **Remove** `MentionPicker` re-export (no longer used)

### 3. Modify: `src/pages/RecipeDetailPage.tsx`

- Import `RecipePicker` from `../components/RecipePicker`
- Remove `MentionPicker` import
- Replace `<MentionPicker baseUrl={...} sessionId={...} sessionTemplate={...} contextEntity={...} autoRef={true} />` with `<RecipePicker baseUrl={CONTEXT_LAYER_URL} contextEntity={...} autoRef={true} />`
- Remove `sessionId` and `sessionTemplate` props (RecipePicker doesn't need them)

### 4. Modify: `src/pages/ChatPage.tsx`

- Same pattern: replace `MentionPicker` with `<RecipePicker baseUrl={CONTEXT_LAYER_URL} />`
- No `contextEntity` or `autoRef` on ChatPage

### 5. Modify: `src/index.css`

- **Delete** all AtPicker CSS overrides:
  - "Area 1: AtPicker Theme Overrides" (~115 lines of `[style*="rgb"]` selectors)
  - "Area 5: AtPicker Dark Mode Overrides" (~55 lines)
- **Add** RecipePicker styles (~80 lines):
  - `.recipe-picker-overlay` — positioning
  - `.recipe-picker-dropdown` — container with design tokens
  - `.recipe-picker-search` — input styling
  - `.recipe-picker-item` — list items with hover + `.active` + `.referenced` states
  - `.recipe-picker-pill` — reference pills using `var(--blue-bg)`, `var(--blue)`
  - All colors via design tokens (`var(--surface)`, `var(--border)`, `var(--t1)`, etc.)
  - Dark mode works automatically via token inheritance (no separate `@media` block needed for picker styles)

### RecipePicker Visual Design

```
┌─────────────────────────────────┐
│ 🔍 搜索食谱... ↑↓选择 ⏎确认    │  ← search input, always focused
├─────────────────────────────────┤
│ 🍳 红烧肉                ← active│  ← highlighted via .active class
│ ✓ 番茄炒蛋        (已引用)       │  ← grayed out, skipped by keyboard
│ 🍳 麻婆豆腐                      │
│ 🍳 鱼香肉丝                      │
└─────────────────────────────────┘

Reference pills near composer:
┌──────────────┐ ┌──────────────┐
│ 🍳 番茄炒蛋 × │ │ 🍳 红烧肉 ×  │
└──────────────┘ └──────────────┘
2 个食谱已引用 · 发送时注入上下文
```

## File Structure

All files in `solutions/business/recipe-book/frontend/`:

| File | Action | Description |
|------|--------|-------------|
| `src/components/RecipePicker.tsx` | CREATE | ~120-150 lines, keyboard-first picker |
| `src/lib/mention.ts` | EDIT | Remove MentionPicker re-export |
| `src/pages/RecipeDetailPage.tsx` | EDIT | Swap MentionPicker → RecipePicker |
| `src/pages/ChatPage.tsx` | EDIT | Swap MentionPicker → RecipePicker |
| `src/index.css` | EDIT | Delete ~170 lines AtPicker CSS, add ~80 lines RecipePicker CSS |

## Frozen Constraints

| ID | Constraint |
|----|------------|
| FC-1 | `packages/chat-interface/src/` NOT modified |
| FC-2 | `packages/context-layer/src/` NOT modified |
| FC-3 | `packages/context-layer-react/src/` NOT modified |
| FC-4 | `packages/entity-document/src/` NOT modified |
| FC-5 | `solutions/business/edu-platform/` NOT modified |
| FC-6 | `solutions/business/recipe-book/backend/` NOT modified |
| FC-7 | Frontend port 5291, backend port 3002 |
| FC-8 | `tsc --noEmit` passes for frontend |
| FC-9 | `vite build` succeeds |

## Key Reference Files

| File | Purpose |
|------|---------|
| `packages/chat-interface/src/components/chat/MentionContext.tsx` | MentionRef type, Provider, useMentionContext hook |
| `packages/chat-interface/src/components/chat/MentionPicker.tsx` | Old implementation (reference for what to replace) |
| `solutions/business/recipe-book/frontend/src/hooks/useRecipes.ts` | useRecipes(query) hook |
| `solutions/business/recipe-book/frontend/src/config.ts` | URL constants |
| `packages/context-layer/src/client/index.ts` | ContextLayerClient.resolve() API |

## Exit Conditions

- Score >= 95/100 → success
- Score >= 85/100 → pass
- Max 5 iterations
- Diminishing returns: < 3 pts improvement for 2 consecutive iterations → stop
