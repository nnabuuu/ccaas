# Generator Prompt — recipe-book-multi-select

You are a frontend engineer adding multi-select capability to an existing RecipePicker component. The RecipePicker currently supports single-select (Enter picks one recipe and closes). You need to add Space-key multi-select with a staging area.

## Spec

Read the full specification:
```
cat harness-workspace/recipe-book-multi-select/SPEC.md
```

Read the evaluation criteria to understand exactly what will be tested:
```
cat harness-workspace/recipe-book-multi-select/EVAL_CRITERIA.md
```

## Files to Modify

All in `solutions/business/recipe-book/frontend/`:

1. **`src/components/RecipePicker.tsx`** — Add staging state, Space handler, commit logic, staging area UI
2. **`src/index.css`** — Add staging CSS styles, flash-green animation

Only these 2 files. Do NOT modify any files in `packages/` or `solutions/business/recipe-book/backend/`.

## Step-by-Step Implementation

### Phase 1: Read Current Code

Read these files to understand the current implementation:
- `solutions/business/recipe-book/frontend/src/components/RecipePicker.tsx`
- `solutions/business/recipe-book/frontend/src/index.css`
- `packages/chat-interface/src/components/chat/MentionContext.tsx` (read-only — understand MentionRef type and addRef/closePicker)

### Phase 2: Add Staging State to RecipePicker

Add to RecipePicker.tsx:

```typescript
// Local staging state — pending selections before commit
const [staging, setStaging] = useState<Array<{ id: string; title: string }>>([])

// Check if a recipe is in staging
const isStaged = useCallback((id: string) => {
  return staging.some(s => s.id === id)
}, [staging])

// Toggle staging
const toggleStaging = useCallback((recipe: { id: string; title: string }) => {
  setStaging(prev => {
    const exists = prev.some(s => s.id === recipe.id)
    if (exists) return prev.filter(s => s.id !== recipe.id)
    return [...prev, recipe]
  })
}, [])

// Remove from staging
const removeFromStaging = useCallback((id: string) => {
  setStaging(prev => prev.filter(s => s.id !== id))
}, [])
```

Clear staging when picker opens:
```typescript
useEffect(() => {
  if (pickerOpen) {
    setQuery('')
    setActiveIndex(0)
    setStaging([])  // <-- clear staging on open
    requestAnimationFrame(() => inputRef.current?.focus())
  }
}, [pickerOpen])
```

### Phase 3: Add Commit Logic

Create a `commitStaging` function that resolves all staged items and calls addRef:

```typescript
const commitStaging = useCallback(async (extraRecipe?: { id: string; title: string }) => {
  const toCommit = [...staging]
  if (extraRecipe && !toCommit.some(s => s.id === extraRecipe.id)) {
    toCommit.push(extraRecipe)
  }
  if (toCommit.length === 0) return

  const client = clientRef.current!
  // Resolve all in parallel
  const results = await Promise.allSettled(
    toCommit.map(async (recipe) => {
      try {
        const resolved = await client.resolve('recipe', recipe.id)
        return { recipe, resolved }
      } catch {
        return { recipe, resolved: null }
      }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { recipe, resolved } = result.value
      addRef({
        entityType: 'recipe',
        entityId: recipe.id,
        displayName: recipe.title,
        icon: '🍳',
        ...(resolved ? { data: resolved.data, summary: resolved.displayName || recipe.title } : {}),
      })
    }
  }

  setStaging([])
  closePicker()
}, [staging, addRef, closePicker])
```

### Phase 4: Update Keyboard Handler

Modify `handleKeyDown` to add Space handling and update Enter/Escape:

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    if (staging.length > 0) {
      commitStaging()  // commit staging, then close
    } else {
      closePicker()
    }
    return
  }

  if (e.key === ' ') {
    e.preventDefault()  // prevent space in search input
    if (selectableIndices.length === 0) return
    const realIdx = selectableIndices[activeIndex]
    if (realIdx != null && recipes[realIdx] && !isReferenced(recipes[realIdx].id)) {
      toggleStaging(recipes[realIdx])
      // trigger flash animation (see Phase 6)
    }
    return
  }

  if (selectableIndices.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    setActiveIndex(prev => (prev + 1) % selectableIndices.length)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    setActiveIndex(prev => (prev - 1 + selectableIndices.length) % selectableIndices.length)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const realIdx = selectableIndices[activeIndex]
    if (realIdx != null && recipes[realIdx]) {
      if (staging.length > 0) {
        // Multi-select commit: add active item + commit all staged
        commitStaging(recipes[realIdx])
      } else {
        // Single-select (backward compat): just select this one
        handleSelect(recipes[realIdx])
      }
    }
  }
}, [closePicker, selectableIndices, activeIndex, recipes, handleSelect, staging, commitStaging, isReferenced, toggleStaging])
```

### Phase 5: Add Staging Area UI

Inside the picker dropdown, between search input and list:

```tsx
{/* Staging area */}
{staging.length > 0 && (
  <div className="recipe-picker-staging">
    <div className="recipe-picker-staging-pills">
      {staging.map(s => (
        <span key={s.id} className="recipe-picker-staging-pill">
          <span>🍳</span>
          <span>{s.title}</span>
          <button className="recipe-picker-staging-pill-remove" onClick={() => removeFromStaging(s.id)}>×</button>
        </span>
      ))}
    </div>
    <div className="recipe-picker-staging-count">已选 {staging.length} 个</div>
  </div>
)}
```

### Phase 6: Update List Items

Add `.staged` class to staged items and update badge text:

```tsx
{!loading && recipes.map((r, i) => {
  const referenced = isReferenced(r.id)
  const staged = isStaged(r.id)
  const isActive = !referenced && selectableIndices[activeIndex] === i
  return (
    <button
      type="button"
      key={r.id}
      id={`recipe-item-${i}`}
      role="option"
      aria-selected={isActive}
      className={`recipe-picker-item${referenced ? ' referenced' : ''}${staged ? ' staged' : ''}${isActive ? ' active' : ''}`}
      onClick={() => !referenced && handleSelect(r)}
      onMouseEnter={() => { /* existing mouse hover logic */ }}
      disabled={referenced}
    >
      <span className="recipe-picker-item-icon">🍳</span>
      <span className="recipe-picker-item-name">{r.title}</span>
      {referenced && <span className="recipe-picker-item-check">✓ 已引用</span>}
      {staged && !referenced && <span className="recipe-picker-item-check staged-check">✓ 已选</span>}
    </button>
  )
})}
```

### Phase 7: Update Placeholder

```tsx
placeholder={staging.length > 0
  ? `已选 ${staging.length} 个 · Space继续选 ⏎确认`
  : '搜索食谱... ↑↓选择 Space添加 ⏎确认 Esc关闭'
}
```

### Phase 8: Add CSS

In `src/index.css`, add after existing RecipePicker styles:

```css
/* Staging area */
.recipe-picker-staging {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
.recipe-picker-staging-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.recipe-picker-staging-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--blue-bg);
  color: var(--blue);
  font-size: 12px;
}
.recipe-picker-staging-pill-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--blue);
  opacity: 0.6;
  font-size: 11px;
  padding: 0 2px;
}
.recipe-picker-staging-pill-remove:hover {
  opacity: 1;
}
.recipe-picker-staging-count {
  font-size: 11px;
  color: var(--t3);
  margin-top: 4px;
}

/* Staged item in list */
.recipe-picker-item.staged {
  background: transparent;
}
.recipe-picker-item .staged-check {
  color: var(--blue);
  font-size: 12px;
  margin-left: auto;
}

/* Flash green animation on Space-add */
@keyframes flash-green {
  0% { background-color: rgba(52, 199, 123, 0.2); }
  100% { background-color: transparent; }
}
.recipe-picker-item.flash {
  animation: flash-green 400ms ease-out;
}
```

### Phase 9: Flash Animation

For the flash effect on Space-add, use a `flashId` state:

```typescript
const [flashId, setFlashId] = useState<string | null>(null)

// In Space handler, after toggleStaging:
if (!isStaged(recipes[realIdx].id)) {
  // Adding (not removing) — trigger flash
  setFlashId(recipes[realIdx].id)
  setTimeout(() => setFlashId(null), 400)
}
```

Add `flash` class to item when `flashId === r.id`.

### Phase 10: Verify

1. Run `npx tsc --noEmit` in frontend dir — must pass
2. Run `npx vite build` — must succeed
3. Check no frozen package files modified: `git diff --name-only -- packages/`

## Critical Constraints

- **DO NOT** modify any files in `packages/` directories
- **DO NOT** modify `solutions/business/recipe-book/backend/` (except .db files auto-touched by seed)
- **DO NOT** remove or break existing functionality (autoRef, single-click select, pill remove, overlay close)
- Use ONLY design tokens for colors — no hardcoded `#hex` values
- All CSS in `src/index.css` — no inline styles for staging

## Changelog

After implementation, save a brief changelog to:
```
harness-workspace/recipe-book-multi-select/changelogs/v{N}-changelog.md
```

Format:
```markdown
# v{N} Changelog

## Changes
- Added staging state to RecipePicker
- Space key toggles staging
- Enter/Esc commit staging
- Staging area UI with pills
- Flash-green animation
- Updated placeholder text
- New CSS with design tokens
```
