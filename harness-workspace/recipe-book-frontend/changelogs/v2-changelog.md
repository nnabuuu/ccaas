# v2 Changelog

## 改动文件
- `frontend/src/hooks/useRecipes.ts` — Fix `data.data` → `data.items` mismatch; add parallel document fetch via context-layer API
- `frontend/src/pages/RecipeDetailPage.tsx` — Use `document` from hook; pass recipeId+recipeName to chat route; replace all inline borderRadius with CSS vars
- `frontend/src/pages/RecipeListPage.tsx` — Replace inline borderRadius (8px) and CSS border-radius values with CSS vars
- `frontend/src/pages/ChatPage.tsx` — Read recipeId/recipeName from URL params; dynamic composer placeholder
- `frontend/src/styles/design-tokens.css` — Add `--radius-sm`, `--radius-md`, `--radius-lg` tokens

## 对应维度
- D2: Fixed critical `data.data` vs `data.items` mismatch — recipe list now renders all 3 recipes (+15 pts)
- D3: Added context-layer document fetch from `/context/entity/recipe/:id/document` (+2 pts)
- D4: Pass recipe context (recipeId, recipeName) to chat via URL params; dynamic placeholder (+1 pt)
- D5: Replaced all inline borderRadius values with CSS variable tokens (+1 pt)

## 本轮重点
Fix the critical D2 data format mismatch (single-line fix unlocking 15 pts) plus 3 smaller fixes across D3/D4/D5 for a projected score of ~100/100.
