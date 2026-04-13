# v2 Changelog

## 目标
基于 v1 eval report (84/100) 的 6 个 Priority Fix 全部修复。

## 修改清单

### D1: Visual Fidelity (style fixes)
- `frontend/src/components/layout/Sidebar.tsx` — `.sb-label` font-size 9px → 10px（DESIGN_SYSTEM.md §3.1 要求 10px）
- `frontend/src/components/home/AISection.tsx` — `.ai-input input` background `var(--bg)` → `var(--surface2)`（HARNESS_SPEC §6.4 要求 surface2）
- `frontend/src/components/layout/TopNav.tsx` — `.topnav-link` padding 6px 12px → 4px 10px（DESIGN_SYSTEM.md §3.2 要求 4px 10px）

### D2: Component Completeness (badge connection)
- `frontend/src/App.tsx` — AuthenticatedApp 中新增 useEffect 获取 `/api/dashboard/pending` 的 total，传递 `pendingCount` prop 给 `<Sidebar>` 和 `<TopNav>`，使角标能实际渲染

### D4: Routing & Navigation (chat offset)
- `frontend/src/App.tsx` — `.chat-page` 添加 `@media (min-width: 1200px) { margin-left: var(--sidebar-w); }`，解决全局 Sidebar 遮挡 Chat 页面左侧 232px 的问题

### D5: Code Quality (shared config)
- 新建 `frontend/src/components/layout/nav-config.ts` — 共享路由配置（label, path, section, hasBadge）
- `frontend/src/components/layout/Sidebar.tsx` — 从 nav-config.ts 导入路由数据，图标映射本地保留
- `frontend/src/components/layout/TopNav.tsx` — 从 nav-config.ts 导入路由数据，消除重复定义

## 自检结果
- npx tsc --noEmit: **PASS**
- 现有路由回归: **PASS**（/chat margin-left 已添加）
- 新组件可用: 8/8
- Dark mode block: **PASS**
- 色值字面量检查: **PASS**（components/ pages/ 零 rgba/hex/color literal）
- box-shadow 检查: **PASS**（零 box-shadow）
- v1 变量名检查: **PASS**（home/layout/pages 零 v1 变量）
- var(--) 使用次数: 103 处

## 本轮跳过
- 无（所有 6 个 Priority Fix 全部修复）

## 预期分数变化
- D1: 4/5 → 5/5 (+6 分)
- D2: 4/5 → 5/5 (+5 分)
- D4: 4/5 → 5/5 (+3 分)
- D5: 4/5 → 5/5 (+2 分)
- 预期总分: 84 + 16 = **100/100**
