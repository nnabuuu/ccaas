# v1 Evaluation Report

## Pre-gate
- TypeScript 编译: **PASS** (`npx tsc --noEmit` 零错误)
- npm install: PASS

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1: Visual Fidelity | 4/5 | 24/30 | design-tokens.css 完整且正确（v2 变量名 + 7 对语义色 + dark mode）；组件零色值字面量；零 box-shadow；Plus Jakarta Sans 字体引用；关键尺寸正确（sidebar 232px、topnav 48px、首页 800px）。扣分项：sidebar section label 9px（应为 10px）；AI 输入框背景用 `--bg` 而非 `--surface2`；TopNav pill padding 6px 12px（应为 4px 10px） |
| D2: Component Completeness | 4/5 | 20/25 | 8 组件全部存在且功能完整——Sidebar 激活态（左竖线 + surface2 bg + 图标反色）、TopNav pill 激活态、FocusCard 展开/收起、AISection chips→/chat?prompt 跳转+输入跳转、WeekStrip 日期选择、ActivityTimeline 日期联动。扣分项：pendingCount prop 未从 App 传入 Sidebar/TopNav → 角标永远不渲染 |
| D3: Data Integration | 5/5 | 20/20 | 5 个 API 全部调用（dashboard/pending, dashboard/ai-briefing, activity/weekly-summary, activity/week-dots, context/activity）；Promise.all 并行请求；切换日期单独请求 activity；loading/error/empty 三种状态全部处理 |
| D4: Routing & Navigation | 4/5 | 12/15 | react-router-dom 安装、BrowserRouter 包裹、/→HomePage、/chat→ChatPage(ChatInterface)、/lesson-plans+/templates placeholder；LoginPage 未登录正常渲染；响应式导航正确。扣分项：Chat 页面无 margin-left:var(--sidebar-w)，≥1200px 时全局 Sidebar 覆盖 ChatSidebar 左侧 232px |
| D5: Code Quality | 4/5 | 8/10 | dashboard.ts 类型完整（6 接口）；0 个 any；8 个独立组件文件（5 home + 2 layout + 1 page）；v2 CSS 变量在 home 组件中使用 16 处。扣分项：Sidebar NAV_ITEMS 和 TopNav NAV_LINKS 路由配置重复定义未共享 |

基础分: 84/100

## Penalty Deductions

| Rule | Evidence | Deduction |
|------|----------|-----------|
| box-shadow in index.css:260 | `.edu-starter:hover { box-shadow: 0 2px 8px var(--b2); }` — 此为预存代码（EduEmptyState 相关），不在 components/pages/styles/ 检测路径内 | -0 |
| 硬编码颜色值 | grep 结果：components/ 和 pages/ 中零 hex/rgba/color literal | -0 |
| v1 变量名 | components/ 和 pages/ 中零 v1 变量引用 | -0 |
| Chat 入口 | /chat 路由存在，ChatInterface 正常渲染 | -0 |
| 响应式导航 | Sidebar(≥1200px) + TopNav(<1200px) 双模正确 | -0 |
| dark mode | design-tokens.css 包含完整 @media (prefers-color-scheme: dark) block（含 14 语义色 + focus/chip tokens） | -0 |
| 内容居中 | HomePage 无 margin: 0 auto | -0 |
| 冻结文件 | git diff 未检测到 LoginPage/widgets/useEduAuth 修改 | -0 |

Total penalties: **-0**

## Priority Fix

1. [INTEGRATION] **Chat 页面 sidebar 遮挡** — ≥1200px 时全局 Sidebar(fixed, z-index:100) 覆盖 ChatPage 左侧 232px。ChatPage 缺少 `margin-left: var(--sidebar-w)` 的媒体查询，或应在 /chat 路由隐藏全局 Sidebar
2. [COMPONENT] **角标未连接** — Sidebar 和 TopNav 都接受 `pendingCount` prop，但 App.tsx `<Sidebar />` 和 `<TopNav />` 调用时未传入。需要在 AuthenticatedApp 中获取 pending.total 并传递
3. [STYLE] **Sidebar section label 字号** — `.sb-label` 使用 9px，设计规范要求 10px（DESIGN_SYSTEM.md §3.1）
4. [STYLE] **AI 输入框背景** — `.ai-input input` 使用 `var(--bg)` 但 HARNESS_SPEC 指定 `background: var(--surface2)`
5. [STYLE] **TopNav pill padding** — `.topnav-link` padding 为 6px 12px，设计规范要求 4px 10px
6. [COMPONENT] **路由配置重复** — Sidebar.NAV_ITEMS 和 TopNav.NAV_LINKS 分别定义相同路由，应抽取共享配置

## Actionable Fix Hints

- file: `frontend/src/App.tsx`, issue: ChatPage 无 sidebar offset, expected: 在 ChatPage 样式中添加 `@media (min-width: 1200px) { .chat-page { margin-left: var(--sidebar-w); } }` 或改为 /chat 时不渲染全局 Sidebar
- file: `frontend/src/App.tsx`, issue: pendingCount 未传入导航组件, expected: 在 AuthenticatedApp 中存储 pending 数据并传递 `<Sidebar pendingCount={pendingTotal} />` `<TopNav pendingCount={pendingTotal} />`
- file: `frontend/src/components/layout/Sidebar.tsx:187`, issue: `.sb-label` font-size: 9px, expected: `font-size: 10px`
- file: `frontend/src/components/home/AISection.tsx:194`, issue: `.ai-input input` background: var(--bg), expected: `background: var(--surface2)`
- file: `frontend/src/components/layout/TopNav.tsx:80`, issue: `.topnav-link` padding: 6px 12px, expected: `padding: 4px 10px`

总分: 84/100
