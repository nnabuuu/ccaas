# v2 Changelog

## 目标

基于 v1 eval report (87/100) 的 4 项 Priority Fix，目标维度：D1 (Visual Fidelity) + D2 (Component Completeness) + D5 (Code Quality)。

## 修改清单

### D1: Visual Fidelity (修复 2 项)

- `frontend/src/components/layout/TopNav.tsx` — 添加 `onMouseEnter`/`onMouseLeave` hover 状态管理，hover 时显示 `background: var(--bg2)` + `color: var(--t2)`。修复了 inline style 无法实现 `:hover` 的问题。
- `frontend/src/components/home/WeekStrip.tsx` — 移除选中列整体 `background: var(--bg2)` 背景。规格要求选中态只体现在日期数字圆形区域（`background: var(--t1); color: white`），不需要整列高亮。

### D2: Component Completeness (修复 1 项)

- `frontend/src/components/home/ActivityTimeline.tsx` — 添加 `useNavigate` + `onClick` 处理器，点击活动条目跳转到对应实体页面（基于 `entity_type` 分发路由）。

### D5: Code Quality (修复 2 项)

- `frontend/src/components/home/AISection.tsx:100` — 移除 `dangerouslySetInnerHTML`，改为纯文本渲染 `{insight.summary}`，消除 XSS 风险。
- `frontend/src/constants/entity-colors.ts` — 新建共享常量文件，提取 `ENTITY_COLOR_MAP` 和 `getEntityRoute()` 函数。WeekStrip 和 ActivityTimeline 改为从此文件导入，消除重复定义。

## 自检结果

- npx tsc --noEmit: PASS
- box-shadow grep: 0 instances (PASS)
- dangerouslySetInnerHTML grep: 0 instances (PASS)
- ENTITY_COLOR_MAP: 定义 1 处 (constants/entity-colors.ts)，引用 2 处 (PASS)
- 现有路由回归: 未变更路由结构 (PASS)
- 新组件可用: 7/7

## 本轮跳过

无跳过项。v1 eval 的 4 项 Priority Fix 全部处理完毕。
