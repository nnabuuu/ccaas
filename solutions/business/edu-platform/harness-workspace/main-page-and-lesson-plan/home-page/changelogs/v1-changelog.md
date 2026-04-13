# v1 Changelog

## 目标
首轮搭建：安装路由、创建设计系统 token、8 个组件框架、路由改造。重点 D4（路由+Chat不破坏）+ D1（CSS变量+dark mode）+ D5（文件结构）。

## 修改清单

### 新增文件
- `frontend/src/config.ts` — 导出 SERVER_URL 和 TENANT_ID（App.tsx 已依赖但文件缺失）
- `frontend/src/styles/design-tokens.css` — v2 设计系统全部 CSS 变量（light + dark mode），含 7 对语义色、布局变量、focus/chip border token
- `frontend/src/types/dashboard.ts` — PendingItem, AIBriefing, ActivityItem, WeeklySummary, WeekDots 等 TS 类型
- `frontend/src/components/layout/Sidebar.tsx` — 宽屏(≥1200px) 左侧固定 sidebar，232px，导航+管理双分组，激活态左竖线+背景+图标反色，底部用户信息
- `frontend/src/components/layout/TopNav.tsx` — 窄屏(<1200px) 水平导航栏，48px，pill 激活态，红点角标
- `frontend/src/components/home/HeroSection.tsx` — 问候语（时段感知）+ 教师姓名 + 周概要统计
- `frontend/src/components/home/FocusCard.tsx` — 待办卡片，红色竖条，展开/收起交互
- `frontend/src/components/home/AISection.tsx` — AI 洞察列表 + suggestion chips + 输入框，chips/输入跳转 /chat?prompt=
- `frontend/src/components/home/WeekStrip.tsx` — 7 天周视图，实体类型色点映射，选中/今天双态
- `frontend/src/components/home/ActivityTimeline.tsx` — 当日活动时间线，实体色点，loading/empty 状态
- `frontend/src/pages/HomePage.tsx` — 首页容器，并行请求 5 个 API，日期切换联动

### 修改文件
- `frontend/package.json` — 添加 react-router-dom 依赖
- `frontend/src/main.tsx` — 包裹 BrowserRouter + import design-tokens.css
- `frontend/src/App.tsx` — 路由改造：/ → HomePage, /chat → ChatPage（完整 AppShell）, /lesson-plans + /templates → placeholder。已登录后渲染 Sidebar + TopNav + Routes
- `frontend/src/index.css` — body font-family 改为 Plus Jakarta Sans，添加 background: var(--bg) + color: var(--t1)，button/input font-family: inherit

## 自检结果
- npx tsc --noEmit: PASS
- 8 组件文件存在: 8/8
- Dark mode block: PASS (1 个 @media prefers-color-scheme: dark)
- 色值字面量检查: PASS (新组件 0 处)
- box-shadow 检查: PASS (0 处)
- v1 变量名检查: PASS (新组件 0 处，frozen 文件有但不可修改)
- Plus Jakarta Sans: PASS (index.css)
- 响应式断点: PASS (Sidebar + TopNav 均有 1200px 媒体查询)
- var(-- 在新组件中: 103 处引用
- CSS 变量定义: 49 个 token

## 设计决策
- 所有组件样式通过 `<style>` JSX 内联 CSS（而非外部 .css 文件），保持组件自包含
- FocusCard/AISection 完整实现了交互（展开收起、chip跳转、输入跳转）
- WeekStrip 动态计算当前周日期
- ActivityTimeline 支持相对时间格式化（刚刚/X分钟前/X小时前）
- ChatPage 保持完整 AppShell（ChatSidebar + ChatInterface），确保 /chat 不受路由改造影响
- config.ts 使用 VITE_SERVER_URL 环境变量，默认 http://localhost:3011（与 useEduAuth 中 SOLUTION_URL 一致）

## 本轮跳过
- 无（首轮，全部是新增）
