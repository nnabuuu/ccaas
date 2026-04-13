# SPEC — Frontend 首页 + 全局导航（v2 设计）

## 目标

在现有 edu-platform `frontend/` 中新增首页及全局导航（响应式 sidebar + top nav），保持 Chat Interface 入口不变，与 v2 HTML 原型像素级一致。

## 范围

在已有的 React + Vite 前端（当前只有 ChatInterface + LoginPage）中添加：
1. react-router-dom 路由系统
2. 响应式双模导航（宽屏 Sidebar + 窄屏 TopNav）
3. 首页四区块（问候、待办、AI 洞察、周视图+时间线）
4. v2 设计系统 CSS 变量
5. TypeScript 类型定义

## Work Items

### W1: v2 设计系统 CSS 变量
- 创建 `frontend/src/styles/design-tokens.css`
- v2 变量命名：`--bg` / `--surface` / `--surface2` / `--t1` / `--t2` / `--t3` / `--border`
- 语义色：`--blue` / `--green` / `--amber` / `--red` / `--purple` / `--teal` / `--coral`（每色一对 text + bg）
- 布局变量：`--sidebar-w: 232px`
- **必须包含 `@media (prefers-color-scheme: dark)` block**，所有 token 都要有 dark 值
- 字体：`"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif`
- 在 main.tsx 或 index.css 中 import
- body 设置 `background: var(--bg)` 和 `color: var(--t1)`
- **组件禁止色值字面量**：所有颜色通过 `var(--token)` 引用，不在组件中写 `'white'`/`'#fff'`/`rgba()`

### W2: 路由系统
- 安装 react-router-dom
- main.tsx 包裹 BrowserRouter
- App.tsx 中已登录后渲染 Sidebar + TopNav + Routes（响应式显隐）
- 路由：`/` → HomePage, `/chat` → ChatInterface, `/lesson-plans` → placeholder, `/templates` → placeholder
- 未登录仍渲染 LoginPage

### W3: Sidebar 导航（宽屏 ≥ 1200px）
- 创建 `frontend/src/components/layout/Sidebar.tsx`
- 232px 宽，固定左侧，`background: var(--surface)`
- Logo "精准教学" 14px 700 + 两个 section（导航 + 管理）
- 导航项 36px 高，Lucide 风格 SVG 图标
- 激活态：左侧 3px 黑竖线 + `var(--surface2)` 背景 + 图标反色
- 底部用户信息区（头像首字方块 + 姓名 + 角色）
- `@media (min-width: 1200px)` 可见，否则隐藏

### W4: TopNav 导航（窄屏 < 1200px）
- 创建 `frontend/src/components/layout/TopNav.tsx`
- 48px 高度，`background: var(--surface); border-bottom: 1px solid var(--border)`
- Logo 14px 700 + 7 个链接 13px 500
- 非激活色 `var(--t2)`，激活态 `var(--t1)` + `var(--surface2)` pill 背景
- `@media (min-width: 1200px)` 隐藏
- 红点角标从 /api/dashboard/pending 获取

### W5: HomePage 页面容器
- 创建 `frontend/src/pages/HomePage.tsx`
- 单栏 max-width 800px，左对齐（不居中）
- useEffect 并行请求 5 个 API
- 管理 loading/error 状态

### W6: HeroSection 问候组件
- 创建 `frontend/src/components/home/HeroSection.tsx`
- 问候语（早上好/下午好/晚上好）+ 教师姓名
- 周概要统计融入副标题

### W7: FocusCard 待办组件
- 创建 `frontend/src/components/home/FocusCard.tsx`
- 卡片 `var(--surface)` 底色，`1px solid var(--border)`，10px 圆角
- 红色竖条 `var(--red)` + 展开/收起
- 按钮 6px 圆角

### W8: AISection AI 洞察组件
- 创建 `frontend/src/components/home/AISection.tsx`
- 紫色 AI 图标 + insight 列表 + suggestion chips + 输入框
- Chips `var(--purple-bg)` + `var(--purple)` 边框
- 输入框 focus `rgba(58,49,133,.3)` 紫色半透明 border

### W9: WeekStrip 周视图组件
- 创建 `frontend/src/components/home/WeekStrip.tsx`
- 7 天一行，选中 `var(--t1)` 底 `var(--surface)` 字
- 活动色点使用 v2 语义色变量

### W10: ActivityTimeline 时间线组件
- 创建 `frontend/src/components/home/ActivityTimeline.tsx`
- section label 样式：10px uppercase letter-spacing .5px
- 色点颜色与 WeekStrip 一致

### W11: TypeScript 类型定义
- 创建 `frontend/src/types/dashboard.ts`
- 定义 PendingItem, AIBriefing, ActivityItem, WeeklySummary 等类型

## Frozen Constraints

### 不可修改的文件
- `frontend/src/components/LoginPage.tsx`
- `frontend/src/widgets/` 目录
- `frontend/src/hooks/useEduAuth.ts`（但可导入使用）
- `solutions/business/edu-platform/backend/` 整个目录
- `solutions/business/edu-platform/mcp-server/` 整个目录
- `solutions/business/edu-platform/skills/` 整个目录

### 可修改的文件
- `frontend/src/App.tsx` — 添加路由
- `frontend/src/main.tsx` — 添加 BrowserRouter
- `frontend/src/index.css` — 可添加全局样式
- `frontend/package.json` — 添加 react-router-dom

### 设计规范约束（v2）
- **参考文档**：`frontend/DESIGN_SYSTEM.md`（source of truth）和 `frontend/CLAUDE.md`
- **Token 单一来源**：所有 CSS 变量定义在 `design-tokens.css`（含 light + dark mode）
- **组件禁止色值字面量**：`'white'`/`'#fff'`/`rgba()`/hex → 全走 `var(--token)`
- CSS 变量命名：`--bg` / `--surface` / `--border`（不是 v1 的 `--bg1` / `--b1`）
- 无 box-shadow、无渐变、无 icon font、无纯白 `#fff`、无纯黑 `#000`
- 字体：`"Plus Jakarta Sans"` 品牌字体
- 圆角：按钮 6px，卡片 10px
- 边框：统一 `1px solid var(--border)`
- 首页 max-width 800px，左对齐
- 响应式导航：≥1200px sidebar / <1200px top nav
- Chat 入口（/chat）必须仍然可用
- loading/empty/error 状态必须处理
- Dark mode：`design-tokens.css` 必须包含 `@media (prefers-color-scheme: dark)` block

## 评分维度

| # | Dimension | Weight |
|---|-----------|--------|
| D1 | Visual Fidelity (v2 设计) | 30 |
| D2 | Component Completeness (8 components) | 25 |
| D3 | Data Integration (5 API calls) | 20 |
| D4 | Routing & Navigation (responsive) | 15 |
| D5 | Code Quality | 10 |
