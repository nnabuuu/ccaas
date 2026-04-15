# Changelog v1

## Changes

### Backend (`solutions/business/recipe-book/backend/src/referenceable/`)

- [referenceable.module.ts] Registered `recipe_section` entity type (displayName: '章节', icon: '📑', color: 'amber') with browse/search/resolve abilities
- [referenceable.module.ts] Added `setRelations` call establishing parent-child relationship: recipe → recipe_section
- [adapters/recipe-browse-provider.ts] Changed `browse('recipe')` to return `hasChildren: true` on each recipe item
- [adapters/recipe-browse-provider.ts] Added `browse('recipe_section', { parentType: 'recipe', parentId })` — extracts `section` blocks from recipe.blocks, returns as BrowseItems with entityId format `{recipeId}:section:{index}`
- [adapters/recipe-browse-provider.ts] Extended `search()` to also search section headings across all recipes when query matches, returning `recipe_section` results
- [adapters/recipe-browse-provider.ts] Added `resolve('recipe_section', entityId)` — parses `{recipeId}:section:{index}`, loads recipe, returns section block data with breadcrumb

### Frontend (`solutions/business/recipe-book/frontend/`)

- [package.json] Added `@kedge-agentic/context-layer-react` dependency
- [vite.config.ts] Added resolve aliases for `@kedge-agentic/context-layer/client`, `@kedge-agentic/context-layer/core`, and `@kedge-agentic/context-layer-react` pointing to source (fixes CJS/ESM interop in Rollup build)
- [src/lib/mention.ts] Created bridge file re-exporting MentionProvider/MentionPicker from chat-interface source (not yet in published exports)
- [src/pages/RecipeDetailPage.tsx] Wrapped chat panel in `MentionProvider`, added `MentionPicker` with `contextEntity` (recipe) + `autoRef={true}`, added `sessionContext` prop to ChatInterface
- [src/pages/ChatPage.tsx] Wrapped ChatInterface in `MentionProvider`, added `MentionPicker` (no contextEntity/autoRef for standalone chat)

## Verification

- Backend tsc: PASS
- Backend tests: 49/49 PASS
- Frontend tsc: PASS
- Frontend vite build: PASS

## Known Issues

- MentionProvider/MentionPicker are not exported from `@kedge-agentic/chat-interface` public API — imported via relative path bridge file
- Section block field name: seed data uses `content.heading`, browse provider checks both `content.heading` and `data.heading` for robustness
