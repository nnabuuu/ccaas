# Changelog v2

## Root Cause

The v1 eval lost ~26 points (D2: -10, D4: -16) due to a single bug: `baseUrl={RECIPE_BACKEND_URL}` passed `http://localhost:3002` to MentionPicker, but ContextLayerClient appends `/entity-types`, `/browse`, `/search` directly — so all API calls hit `http://localhost:3002/entity-types` (404) instead of `http://localhost:3002/context/entity-types`.

## Changes

- [config.ts] Added `CONTEXT_LAYER_URL = RECIPE_BACKEND_URL + '/context'` constant
- [RecipeDetailPage.tsx] Changed import from `RECIPE_BACKEND_URL` to `CONTEXT_LAYER_URL`, updated `baseUrl` prop on MentionPicker
- [ChatPage.tsx] Same change: import `CONTEXT_LAYER_URL`, update `baseUrl` prop on MentionPicker

## Verification

- Frontend tsc: PASS
- Frontend vite build: PASS (4.21s, chunk warnings only)
- Backend tsc: PASS
- Backend tests: PASS (7 files, 49 tests)

## Known Issues

- None — this fix should unblock all D2 and D4 data-dependent checks
