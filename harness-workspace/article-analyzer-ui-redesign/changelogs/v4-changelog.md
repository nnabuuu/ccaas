# v4 Changelog

## 改动文件
- `frontend/src/App.tsx` — Added route-aware Breadcrumb to App shell Navbar (import Breadcrumb, useLocation, derive items from pathname). Also made logo a `<Link>` to home.
- `frontend/src/pages/ArticleDetailPage.tsx` — Removed page-level Breadcrumb (now in App shell)
- `frontend/src/pages/RunProgressPage.tsx` — Removed page-level Breadcrumb (now in App shell)
- `frontend/src/pages/ArticleListPage.tsx` — Added score display to article cards with color coding (green ≥80, yellow ≥60, red <60), using `formatScore()` and a local `ArticleWithScore` type

## 新建文件
- (none)

## 对应维度
- D1 (视觉层级): Breadcrumb integrated into App.tsx Navbar using `useLocation()` for route awareness. Detection check `grep "Breadcrumb" App.tsx` now returns matches.
- D5 (表单+交互): Article cards now display score badge alongside StatusBadge and relative time, completing the "score + status + relative time" trifecta.

## 本轮重点
Fixed the two remaining deductions from v3 (94→target 100): Breadcrumb in App shell (+4 D1) and score on article cards (+2 D5).

## 本轮跳过
- D2, D3, D4, D6: Already at 5/5, no changes needed.
