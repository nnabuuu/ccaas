# Changelog v1

## Changes

### Backend (`solutions/business/recipe-book/backend/src/referenceable/`)
- [adapters/recipe-browse-provider.ts] **Fixed resolve('recipe_section') bug**: was using `sectionBlocks[index]` (section-array index) but entityId encodes block-array index from browse. Now directly indexes `blocks[index]` and validates `target.type === 'section'`.
- [adapters/recipe-browse-provider.ts] **Added breadcrumb to search results**: recipe results get `breadcrumb: null`, recipe_section results get proper breadcrumb with parent recipe info. Matches `SearchResult` interface contract.

### Frontend (`solutions/business/recipe-book/frontend/`)
- [src/lib/mention.ts] **Added MentionTrigger component**: Listens for `@` keydown on composer textarea (`textarea[aria-label="Message input"]`) to call `openPicker()`. Exposes `clearRefs` via ref pattern so parent can call it on message sent.
- [src/pages/RecipeDetailPage.tsx] **Wired MentionTrigger + clearRefs**: Added `<MentionTrigger clearRefsRef={clearRefsRef} />` inside MentionProvider. Added `onMessageSent` callback to ChatInterface that calls `clearRefsRef.current?.()`.
- [src/pages/ChatPage.tsx] **Wired MentionTrigger + clearRefs**: Added MentionTrigger inside MentionProvider. Updated `handleMessageSent` to call `clearRefsRef.current?.()` before refreshing session list.

## Pre-existing (already implemented before v1)
- Backend: `recipe_section` entity registered in referenceable.module.ts
- Backend: `setRelations` with recipe→recipe_section
- Backend: browse/search/resolve for recipe_section in browse provider
- Frontend: `@kedge-agentic/context-layer-react` dependency in package.json
- Frontend: MentionProvider + MentionPicker in both pages
- Frontend: contextEntity + autoRef in RecipeDetailPage
- Frontend: sessionContext passed to ChatInterface

## Verification
- tsc (backend): PASS
- tsc (frontend): PASS
- vite build (frontend): PASS
- backend tests: PASS (49/49)

## Known Issues
- None identified
