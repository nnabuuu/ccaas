# SPEC — recipe-book-at-picker

## Objective

Integrate the @Picker (AtPicker) system into the recipe-book frontend so users can `@` reference specific recipes and their sections/blocks in chat. This gives the AI explicit entity context — when viewing 鱼香肉丝 and asking "木耳可以换成别的吗", the AI knows which recipe they mean.

## Current State

- **Backend**: `solutions/business/recipe-book/backend/src/referenceable/` has a flat `recipe` entity type with browse/search/resolve. No hierarchy — `hasChildren: false` hardcoded, no `recipe_section` entity type.
- **Frontend**: `solutions/business/recipe-book/frontend/` has split view (recipe + chat) but no @Picker integration. No `@kedge-agentic/context-layer-react` dependency, no MentionPicker, no `sessionContext` prop.

## Deliverables

### Backend Changes (`solutions/business/recipe-book/backend/src/referenceable/`)

**1. Register `recipe_section` entity type** in `referenceable.module.ts`:
```typescript
this.registry.register({
  type: 'recipe_section',
  displayName: '章节',
  icon: '📑',
  color: 'amber',
  abilities: { search: true, browse: true, resolve: true },
});
this.registry.setRelations([
  { parent: 'recipe', child: 'recipe_section', label: '章节', foreignKey: 'recipeId' },
]);
```

**2. Extend `recipe-browse-provider.ts`**:
- `browse('recipe')` → set `hasChildren: true` on each item
- `browse('recipe_section', { parentType: 'recipe', parentId })` → extract `section` blocks from recipe.blocks, return as BrowseItems
  - `entityId` format: `{recipeId}:section:{blockIndex}` (e.g. `abc123:section:0`)
  - `displayName` = heading text from the section block
  - Include subtitle with block count info
- `search()` → also search section headings when query matches, return as `recipe_section` results
- `resolve('recipe_section', sectionId)` → parse `{recipeId}:section:{index}`, load recipe, return that section block's data

**3. Session context**: The frontend already creates sessions per recipe. The `sessionContext` prop will pass `recipeId` and `recipeName` so the AI has recipe context.

### Frontend Changes (`solutions/business/recipe-book/frontend/`)

**1. Add dependency** in `package.json`:
```json
"@kedge-agentic/context-layer-react": "file:../../../../packages/context-layer-react"
```

**2. RecipeDetailPage split view** — integrate MentionPicker with `contextEntity` + `autoRef`:
```tsx
import { MentionProvider, MentionPicker } from '@kedge-agentic/chat-interface'

// In the chat panel:
<MentionProvider>
  <ChatInterface
    sessionContext={{ recipeId: id, recipeName: recipe.title, cuisine: recipe.cuisine }}
    // ... existing props
  />
  <MentionPicker
    baseUrl={RECIPE_BACKEND_URL}  // :3002
    sessionId={chatSessionId}     // may be undefined on first message
    sessionTemplate={SESSION_TEMPLATE}
    contextEntity={{
      entityType: 'recipe',
      entityId: id,
      displayName: recipe.title,
      icon: '🍳',
    }}
    autoRef={true}                // auto-inject recipe as ref pill
  />
</MentionProvider>
```

**Key**: `contextEntity` tells the picker which recipe the user is viewing. `autoRef` auto-resolves the recipe and adds it as a ref pill — so the AI receives recipe content on every message without the user manually @-ing.

**3. ChatPage** — also integrate MentionPicker for the standalone chat page (no `contextEntity` or `autoRef` needed here, just basic @Picker).

### UX Flow (Split View @Picker)

1. User opens split view on 鱼香肉丝 — recipe pill **auto-appears** in composer (full entity data resolved via `autoRef`)
2. AtPicker (type `@`) opens showing: **当前上下文** (🍳 鱼香肉丝 pinned at top), **最近使用**, **按类型浏览**
3. User can:
   - Click pinned recipe in "当前上下文" to re-add it
   - Drill into the pinned recipe ▶ → see sections: 食材准备, 主料, 辅料, 调味料, 烹饪步骤, etc.
   - Browse 食谱 → see recipe list → select another recipe
   - Search for other recipes → type "提拉米苏" to find and reference it
4. User can remove the auto-added pill (stays removed until context changes)
5. On send, all referenced entities injected into message → AI receives full entity context

### Composable Context (contextEntity × sessionId)

| Scenario | contextEntity | sessionId | Behavior |
|----------|--------------|-----------|----------|
| Split view, first message | recipe | undefined | Recipe pill auto-added, "当前上下文" pinned, no recents |
| Split view, ongoing | recipe | session123 | Recipe pill auto-added + recents + "当前上下文" |
| /chat page | undefined | session123 | Recents + type browse only |
| /chat page, first msg | undefined | undefined | Type browse only |

## File Structure (files to create/modify)

### Backend (modify existing)
```
solutions/business/recipe-book/backend/src/referenceable/
├── referenceable.module.ts          # Add recipe_section registration + setRelations
└── adapters/
    └── recipe-browse-provider.ts    # Add recipe_section browse/search/resolve
```

### Frontend (modify existing + add dep)
```
solutions/business/recipe-book/frontend/
├── package.json                     # Add @kedge-agentic/context-layer-react dep
└── src/
    ├── pages/RecipeDetailPage.tsx    # Add MentionProvider + MentionPicker + sessionContext
    └── pages/ChatPage.tsx           # Add MentionProvider + MentionPicker (if exists)
```

## Frozen Constraints

| ID | Constraint |
|----|------------|
| FC-1 | `packages/chat-interface/src/` NOT modified |
| FC-2 | `packages/context-layer/src/` NOT modified (only use existing APIs) |
| FC-3 | `packages/context-layer-react/src/` NOT modified |
| FC-4 | `packages/entity-document/src/` NOT modified |
| FC-5 | `solutions/business/edu-platform/` NOT modified |
| FC-6 | Existing recipe-book backend API endpoints unchanged (backward compatible) |
| FC-7 | Frontend port 5291, backend port 3002 |
| FC-8 | `tsc --noEmit` passes for both backend and frontend |
| FC-9 | Backend existing tests pass |

## Key Reference Files

| File | Purpose |
|------|---------|
| `packages/context-layer-react/src/AtPicker.tsx` | AtPicker component (~560 lines) |
| `packages/chat-interface/src/components/chat/MentionPicker.tsx` | Chat ↔ AtPicker bridge |
| `packages/chat-interface/src/components/chat/MentionContext.tsx` | MentionRef state management |
| `packages/context-layer/src/core/entity-registry.ts` | Registry API (register, setRelations) |
| `packages/context-layer/src/core/interfaces.ts` | All type definitions |
| `solutions/business/recipe-book/backend/src/referenceable/` | Existing recipe provider |
| `solutions/business/recipe-book/backend/src/seed.ts` | Block structure of 3 seed recipes |
| `solutions/business/edu-platform/backend/src/referenceable/` | Reference implementation (multi-entity, relations) |
| `docs/design/CCaaS-Referenceable-AtPicker.md` | Full design doc |

## Exit Conditions

- Score ≥ 90/100 → success
- Max 6 iterations
- Diminishing returns: < 3 pts improvement for 2 consecutive iterations → stop
