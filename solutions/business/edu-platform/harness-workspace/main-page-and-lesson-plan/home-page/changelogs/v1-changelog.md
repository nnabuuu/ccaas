# v1 Changelog

## 目标
v1 基础搭建：路由系统、设计系统 CSS 变量、全部 7 组件、TypeScript 类型定义。

## 修改清单

### 新增文件
- `frontend/src/styles/design-tokens.css` — 16 个 CSS 变量（bg1-3, t1-3, b1, 语义色, 品牌色, 圆角）
- `frontend/src/types/dashboard.ts` — PendingItem, PendingData, AIBriefing, ActivityItem, WeeklySummary, WeekDots 完整类型定义
- `frontend/src/components/layout/TopNav.tsx` — 44px 全局导航栏，7 链接（首页/教案有路由，其余占位），useLocation 高亮，待办角标
- `frontend/src/pages/HomePage.tsx` — 单栏 640px 容器，useEffect 并行请求 5 个 API，管理 loading/error 状态
- `frontend/src/components/home/HeroSection.tsx` — 时间问候语 + 教师姓名(useEduAuth) + 周统计
- `frontend/src/components/home/FocusCard.tsx` — 红色竖条主卡片 + 展开/收起次级待办列表
- `frontend/src/components/home/AISection.tsx` — AI 图标 + insight 列表 + suggestion chips(跳转/chat?prompt=) + 输入框
- `frontend/src/components/home/WeekStrip.tsx` — 7 天条带 + 实体类型色点 + 日期选中/今天高亮
- `frontend/src/components/home/ActivityTimeline.tsx` — 活动时间线 + 色点 + 实体名粗体 + 相对时间

### 修改文件
- `frontend/package.json` — 添加 react-router-dom 依赖
- `frontend/src/main.tsx` — 包裹 BrowserRouter，import design-tokens.css
- `frontend/src/App.tsx` — 已登录后渲染 TopNav + Routes（/ → HomePage, /chat → AppShell, /lesson-plans → placeholder, /templates → placeholder）

## 自检结果
- npx tsc --noEmit: PASS (exit 0)
- box-shadow 反模式: 0 occurrences in components/pages/styles
- CSS 变量使用: 69 次（home 63 + layout 6）
- `: any` 类型: 0 occurrences
- 文件存在: 9/9 (design-tokens, TopNav, HomePage, HeroSection, FocusCard, AISection, WeekStrip, ActivityTimeline, dashboard.ts)
- /chat 路由: 保持 AppShell 渲染（ChatSidebar + ChatInterface）
- LoginPage: 未登录时仍显示（未修改 LoginPage.tsx）

## 本轮跳过
- 无（v1 为首轮全量搭建）

## 设计决策
1. 所有组件使用 inline styles + CSS 变量 var(--) 引用，不引入额外 CSS 文件
2. AppShell 从 `h-dvh flex` 改为 `height: 100%` 以适配 TopNav + Routes 容器布局
3. design-tokens.css 在 main.tsx 中 import（先于 index.css），确保变量全局可用
4. TopNav 待办角标调用 /api/dashboard/pending 独立获取
5. WeekStrip 以周一为周首日，自动计算当前周日期范围
