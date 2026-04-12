# v1 Evaluation Report

## Pre-gate
- TypeScript 编译: **PASS** (`npx tsc --noEmit` 零错误)
- npm install: 成功

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1 Visual Fidelity | 4/5 | 24/30 | design-tokens.css 完整（16 变量全部定义）；CSS 变量使用 71 处；无 box-shadow；无外部字体；关键样式值全部匹配（640px、44px、字号、圆角）。扣分：TopNav 链接无 hover 背景效果（inline style 无法表达 :hover）；WeekStrip 选中列整体 bg2 背景非规格要求 |
| D2 Component Completeness | 4/5 | 20/25 | 7 组件全部存在且功能基本完整。TopNav 路由高亮+角标 ✓；FocusCard 展开/收起 ✓；AISection chips→/chat?prompt + 输入框 + 完整对话链接 ✓；WeekStrip 日期选择+色点 ✓。扣分：ActivityTimeline 条目有 cursor:pointer 但无 onClick 跳转到实体页面 |
| D3 Data Integration | 5/5 | 20/20 | 5 个 API 全部调用（pending×2, ai-briefing, weekly-summary, week-dots, context/activity）；Promise.all 并行请求；每个 .catch(() => null) 优雅降级；loading "加载中..." + error "数据加载失败" + empty 各组件独立处理；日期切换单独请求 activity |
| D4 Routing & Navigation | 5/5 | 15/15 | BrowserRouter 包裹 ✓；/ → HomePage ✓；/chat → AppShell(ChatSidebar+ChatInterface) ✓；/lesson-plans + /templates placeholder ✓；TopNav 在 Routes 外全局可见 ✓；LoginPage 未登录时仍正常渲染 ✓；useLocation 路由高亮 ✓ |
| D5 Code Quality | 4/5 | 8/10 | types/dashboard.ts 定义 6 个接口 ✓；0 处 any ✓；5 个独立 home 组件 ✓；63 处 CSS 变量使用 ✓。扣分：AISection L100 使用 dangerouslySetInnerHTML（XSS 风险）；ENTITY_COLOR_MAP 在 WeekStrip 和 ActivityTimeline 中重复定义 |

基础分: 87/100

## Penalty Deductions

| Rule | Instances | Deduction |
|------|-----------|-----------|
| box-shadow | 0（新组件中无；index.css L254 `.edu-starter:hover` 为预存代码，非本次新增） | 0 |
| 硬编码颜色值 | 0（新组件全部使用 CSS 变量） | 0 |
| Chat 入口不可用 | 否（/chat → AppShell 完整渲染） | 0 |
| LoginPage 失效 | 否（未登录仍显示 LoginPage） | 0 |
| 外部字体引入 | 0 | 0 |
| 修改冻结文件 | 0（git diff 无 LoginPage/widgets/useEduAuth 变更） | 0 |

Total penalties: **-0**

## Priority Fix

1. [STYLE] TopNav 链接 hover 效果缺失 — inline style 无法实现 `:hover`，需改用 CSS module 或 onMouseEnter/Leave 实现 `background: var(--bg2)` 的 hover 反馈
2. [COMPONENT] ActivityTimeline 条目缺少点击跳转 — 规格要求 "点击某条活动 → 跳转到对应实体页面"，目前有 `cursor: pointer` 但无 `onClick`
3. [STYLE] `dangerouslySetInnerHTML` 安全隐患 — AISection L100 直接渲染 API 返回的 HTML，应改用纯文本或 sanitize
4. [STYLE] ENTITY_COLOR_MAP 重复定义 — WeekStrip 和 ActivityTimeline 各自定义了相同的映射表，应提取到 `types/dashboard.ts` 或共享常量文件

## Actionable Fix Hints

- file: `frontend/src/components/layout/TopNav.tsx`, issue: nav 链接无 hover 背景效果, expected: 添加 `onMouseEnter={() => setHoveredItem(label)}` + `onMouseLeave` 或使用 CSS class + stylesheet 实现 `background: var(--bg2)` hover 态
- file: `frontend/src/components/home/ActivityTimeline.tsx`, issue: 时间线条目无点击跳转, expected: 添加 `onClick={() => navigate(\`/lesson-plans/${item.entity_id}\`)}` 或根据 entity_type 分发到不同路由
- file: `frontend/src/components/home/AISection.tsx:100`, issue: dangerouslySetInnerHTML 使用, expected: 改为 `{insight.summary}` 纯文本渲染，或使用 DOMPurify sanitize
- file: `frontend/src/components/home/WeekStrip.tsx:9` + `ActivityTimeline.tsx:9`, issue: ENTITY_COLOR_MAP 重复, expected: 提取到 `src/constants/entity-colors.ts` 共享

总分: 87/100
