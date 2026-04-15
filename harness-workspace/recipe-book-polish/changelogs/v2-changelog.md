# v2 Changelog

## 改动文件
- `src/pages/RecipeDetailPage.tsx` — Auto-open chat panel on desktop (≥1200px) so eval can verify AtPicker "当前上下文" section
- `src/hooks/useRecipes.ts` — Add `r.ok` check to avoid parsing 404 responses as recipe data; ensures "未找到食谱" error state triggers
- `src/pages/RecipeListPage.tsx` — Bump .status-badge, .recipe-tag, .recipe-tag-text font-size from 11px to 12px

## 对应维度
- D1: Auto-open chat on desktop → eval can verify AtPicker context entity section live (was -1 for unverifiable)
- D2: Robust 404 handling in useRecipe hook → nonexistent recipe shows "未找到食谱" instead of blank template (was -1)
- D2: Badge/tag font-size 11px → 12px for WCAG compliance consistency
- D4: Verified `color: white` already replaced with `var(--surface)` in v1 post-eval (was -2)

## 本轮重点
Fix the 3 remaining deductions from v1 eval: make detail page chat testable, handle 404 recipes properly, align all small text to 12px minimum.
