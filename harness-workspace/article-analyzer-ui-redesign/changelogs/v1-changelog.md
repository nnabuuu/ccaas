# v1 Changelog

## 改动文件
- `frontend/package.json` — 添加 `clsx` 依赖
- `frontend/tailwind.config.js` — 完整设计系统：darkMode, 自定义色板 (primary/surface), Inter 字体, 动画 (fade-in/slide-up/pulse-slow)
- `frontend/index.html` — 引入 Google Fonts Inter 字体
- `frontend/src/index.css` — CSS custom properties (light/dark), skeleton shimmer 动画, body 基础样式
- `frontend/src/main.tsx` — 包裹 ThemeProvider
- `frontend/src/App.tsx` — 重构：sticky navbar + backdrop-blur, dark mode toggle (sun/moon icon), max-w-7xl 布局, 全局 dark mode 支持
- `frontend/src/pages/ArticleListPage.tsx` — 使用 useFetch hook, 添加 Skeleton/EmptyState/ErrorState 三种状态, StatusBadge 替代手写徽章, SectionHeader 替代手写标题, Card 替代手写卡片
- `frontend/src/pages/ArticleDetailPage.tsx` — 使用 useFetch hook, Breadcrumb 导航, Skeleton/ErrorState/EmptyState, StatusBadge, Card, overline 表头样式
- `frontend/src/pages/RunProgressPage.tsx` — Skeleton 加载态 (card + chart), ErrorState + retry, Breadcrumb, Card, StatusBadge, SSE 状态指示器 (green/yellow/red dot), hero score 放大到 text-4xl
- `frontend/src/components/ArticleForm.tsx` — dark mode 支持, focus ring 样式, accent-primary
- `frontend/src/components/ScoreChart.tsx` — Tooltip 使用 CSS vars, 改进 axis stroke 颜色
- `frontend/src/components/RadarChart.tsx` — 添加 Tooltip, 改进 grid/axis 颜色
- `frontend/src/components/ScorecardTable.tsx` — 使用 Card 组件, score 颜色编码 (green/yellow/red), overline 表头, dark mode
- `frontend/src/components/IterationTimeline.tsx` — dark mode, score 颜色编码, 展开/折叠 chevron 图标 + 动画, slide-up 展开动画
- `frontend/src/components/VersionDiff.tsx` — 使用 Card 组件, dark mode, 响应式 grid

## 新建文件
- `frontend/src/context/ThemeContext.tsx` — Theme provider: localStorage 持久化, prefers-color-scheme 检测, html.dark class 切换
- `frontend/src/hooks/useTheme.ts` — useTheme hook (读取 ThemeContext)
- `frontend/src/hooks/useFetch.ts` — 通用 fetch hook: { data, loading, error, refetch }
- `frontend/src/components/ui/Card.tsx` — 可复用卡片: 3 种 padding (sm/md/lg), light/dark 变体, shadow-sm
- `frontend/src/components/ui/StatusBadge.tsx` — 状态徽章: draft/running/completed/failed, 图标 + 颜色 + running pulse 动画
- `frontend/src/components/ui/Skeleton.tsx` — 骨架屏: line/card/chart 三种形态, shimmer 动画
- `frontend/src/components/ui/EmptyState.tsx` — 空状态: emoji icon + title + description + CTA button
- `frontend/src/components/ui/ErrorState.tsx` — 错误状态: warning icon + message + retry button
- `frontend/src/components/ui/SectionHeader.tsx` — 区块标题: title + description + action slot
- `frontend/src/components/ui/Breadcrumb.tsx` — 面包屑导航: chevron separator, Link 集成

## 对应维度
- D1 (视觉层级, 20pts): 完整设计系统 — Tailwind tokens, CSS vars, Inter 字体, sticky navbar + backdrop-blur, Card/SectionHeader/Breadcrumb 统一视觉层级, 动画系统 (fade-in/slide-up)
- D2 (加载/错误/空状态, 15pts): 所有 3 个页面都有 Skeleton/ErrorState/EmptyState 三种状态分支, useFetch hook 统一管理 loading/error/data, EmptyState 有 CTA button
- D3 (数据可视化, 20pts): ScoreChart/RadarChart 添加 Tooltip 样式化, ScorecardTable score 颜色编码, CSS var 支持暗色模式图表
- D6 (暗色模式+响应式, 15pts): 完整 dark mode 基础设施 — ThemeProvider + localStorage + toggle, 所有组件都有 dark: 变体

## 本轮重点
建立完整设计系统基础设施 + 所有页面的三态处理 (loading/error/empty)，从无到有搭建了 theme context、useFetch hook、7 个共享 UI 组件。

## 本轮跳过
- D4 (实时反馈重构): RunProgressPage 布局未大规模重构，保留原有结构仅添加状态处理和暗色模式 — 计划 v3-5 处理
- D5 (表单+交互打磨): ArticleForm 未添加验证和字数统计，ArticleListPage 仍使用 select 而非 FilterChips — 计划 v6-8 处理
- D3 深度: ScoreChart 未添加图例/目标线/渐变, ScorecardTable 未添加排序, VersionDiff 未添加词级 diff — 计划 v3-5 处理
