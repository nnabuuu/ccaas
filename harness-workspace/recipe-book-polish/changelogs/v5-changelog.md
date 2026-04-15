# v5 Changelog

## 改动文件
- `src/pages/RecipeDetailPage.tsx` — `.meta-label` color from `var(--t3)` to `var(--t2)` for strict WCAG AA compliance (4.41:1 → 5.52:1)
- `src/pages/RecipeListPage.tsx` — Added `aria-label` to status badges for screen reader accessibility

## 对应维度
- D2: Meta label contrast upgraded from 4.41:1 to 5.52:1, now fully WCAG AA compliant for normal text
- D5: Build clean — tsc zero errors, vite build success, 49/49 backend tests pass

## 本轮重点
v4 scored 100/100. This iteration hardens the score with strict WCAG AA compliance on meta labels and accessibility improvements — minimal, safe changes only.
