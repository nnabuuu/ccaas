# Eval Criteria — Frontend 首页 + 全局导航（v2 设计）

## Pre-gate

TypeScript 编译通过是最低要求。如果 `npx tsc --noEmit` 失败，总分 = 0。

## Scoring Dimensions

### D1: Visual Fidelity (Weight: 30/100)

与 v2 HTML 原型 `首页.html` 和 v2 设计规范一致。

| Score | Description |
|-------|-------------|
| 5/5 | v2 CSS 变量全部定义并使用（`--bg/surface/surface2/t1/t2/t3/border` + 7 对语义色）；Sidebar 激活态（左竖线+背景+图标反色）与原型一致；TopNav 响应切换正确（≥1200px sidebar / <1200px topnav）；首页四区块排列正确；Plus Jakarta Sans 字体；页面底色 `#f4f3ef`；卡片背景 `#fbfaf7`；边框 `1px solid rgba(28,28,26,.07)`；按钮 6px 圆角；卡片 10px 圆角 |
| 4/5 | 整体一致但 1-2 处间距/字号偏差 |
| 3/5 | 布局正确但使用 v1 变量名或遗漏颜色映射 |
| 2/5 | 只有基本布局，视觉差异明显 |
| 1/5 | 与 v2 原型大幅不同 |

**Detection method**:
```bash
# 1. design-tokens.css 存在且使用 v2 变量名
ls frontend/src/styles/design-tokens.css
grep -c '\-\-bg:' frontend/src/styles/design-tokens.css       # → ≥ 1
grep -c '\-\-surface:' frontend/src/styles/design-tokens.css   # → ≥ 1
grep -c '\-\-border:' frontend/src/styles/design-tokens.css    # → ≥ 1

# 2. 无 v1 变量名残留
grep 'bg1\|bg2\|bg3\|\-\-b1' frontend/src/styles/design-tokens.css | wc -l  # → 0

# 3. CSS 变量被频繁使用
grep -rn 'var(--' frontend/src/components/home/ frontend/src/components/layout/ | wc -l  # → ≥ 20

# 4. 无 box-shadow
grep -rn 'box-shadow' frontend/src/components/ frontend/src/pages/ frontend/src/styles/ | grep -v 'focus' | wc -l  # → 0

# 5. Plus Jakarta Sans 字体
grep -rn 'Plus Jakarta Sans' frontend/src/ | wc -l  # → ≥ 1

# 6. 无纯白/纯黑/色值字面量（组件禁止色值字面量，全走 var(--token)）
grep -rn "'#fff'\|\"#fff\"\|'white'\|'#000'" frontend/src/components/ frontend/src/pages/ | wc -l  # → 0
grep -rn "rgba(" frontend/src/components/ frontend/src/pages/ | wc -l  # → 0 (组件禁止 rgba)

# 6b. Dark mode block 存在
grep -c 'prefers-color-scheme.*dark' frontend/src/styles/design-tokens.css  # → ≥ 1

# 7. 响应式断点
grep -rn '1200' frontend/src/components/layout/ | wc -l  # → ≥ 2

# 8. 关键样式值
grep -rn 'max-width.*800' frontend/src/pages/HomePage.tsx  # → 首页 800px（v2）
grep -rn 'width.*232\|sidebar-w' frontend/src/components/layout/Sidebar.tsx  # → sidebar 232px
```

### D2: Component Completeness (Weight: 25/100)

8 个组件全部实现，交互完整。

| Score | Description |
|-------|-------------|
| 5/5 | 8 组件全部存在且功能完整：Sidebar 激活态+用户信息+响应式显隐；TopNav 响应式+pill 激活态；FocusCard 展开/收起；AISection chips 跳转+输入跳转+focus 紫色边框；WeekStrip 日期选择；Timeline 按日切换 |
| 4/5 | 8 组件存在但 1-2 个交互不完整 |
| 3/5 | 6-7 个组件存在 |
| 2/5 | 3-5 个组件 |
| 1/5 | < 3 个组件 |

**Detection method**:
```bash
# 文件存在检查
ls frontend/src/components/layout/Sidebar.tsx
ls frontend/src/components/layout/TopNav.tsx
ls frontend/src/pages/HomePage.tsx
ls frontend/src/components/home/HeroSection.tsx
ls frontend/src/components/home/FocusCard.tsx
ls frontend/src/components/home/AISection.tsx
ls frontend/src/components/home/WeekStrip.tsx
ls frontend/src/components/home/ActivityTimeline.tsx

# Sidebar 交互检查
grep -n 'useLocation\|NavLink\|Link' frontend/src/components/layout/Sidebar.tsx

# 响应式切换
grep -rn 'min-width.*1200\|max-width.*1200' frontend/src/components/layout/

# FocusCard 展开/收起
grep -n 'useState\|expanded\|toggle' frontend/src/components/home/FocusCard.tsx

# AISection chip 跳转和输入框
grep -n 'navigate\|/chat\?prompt' frontend/src/components/home/AISection.tsx

# WeekStrip 日期选择
grep -n 'onSelectDate\|onClick\|selectedDate' frontend/src/components/home/WeekStrip.tsx
```

### D3: Data Integration (Weight: 20/100)

正确调用 5 个 API，处理 loading/empty/error 状态。

| Score | Description |
|-------|-------------|
| 5/5 | 5 个 API 全部调用、数据正确渲染；loading 显示加载状态；empty 显示空状态；API 错误 graceful degrade |
| 4/5 | API 调用正确但缺少 1 种状态处理 |
| 3/5 | 3-4 个 API 调用正确 |
| 2/5 | 使用硬编码数据 |
| 1/5 | 无 API 调用 |

**Detection method**:
```bash
# 5 个 API 端点调用
grep -rn 'dashboard/pending' frontend/src/ | wc -l     # → ≥ 1
grep -rn 'dashboard/ai-briefing' frontend/src/ | wc -l  # → ≥ 1
grep -rn 'activity/weekly-summary' frontend/src/ | wc -l # → ≥ 1
grep -rn 'activity/week-dots' frontend/src/ | wc -l      # → ≥ 1
grep -rn 'context/activity' frontend/src/ | wc -l        # → ≥ 2

# 状态处理
grep -rn 'loading\|isLoading' frontend/src/pages/HomePage.tsx | wc -l  # → ≥ 1
grep -rn 'error\|catch' frontend/src/pages/HomePage.tsx | wc -l         # → ≥ 1
grep -rn '暂无\|没有活动\|null' frontend/src/components/home/ | wc -l   # → ≥ 1
```

### D4: Routing & Navigation (Weight: 15/100)

响应式导航正常，Chat 入口保持可用。

| Score | Description |
|-------|-------------|
| 5/5 | / → 首页；/chat → ChatInterface 完整可用；Sidebar(≥1200px) 和 TopNav(<1200px) 在所有页面响应式切换；当前路由高亮正确（sidebar 左竖线 + topnav pill） |
| 4/5 | 路由基本正确但 Chat 有小问题 |
| 3/5 | Chat 入口可用但导航有问题 |
| 2/5 | 路由存在但 Chat 不可用 |
| 1/5 | 无路由 |

**Detection method**:
```bash
# react-router-dom 安装
grep -n 'react-router-dom' frontend/package.json

# BrowserRouter 包裹
grep -n 'BrowserRouter' frontend/src/main.tsx

# Routes 定义
grep -n 'Route.*path.*/' frontend/src/App.tsx
grep -n 'Route.*chat' frontend/src/App.tsx

# Sidebar + TopNav 在 App 层渲染
grep -n 'Sidebar\|TopNav' frontend/src/App.tsx

# Chat 入口保留
grep -rn 'ChatInterface\|AppShell' frontend/src/App.tsx | wc -l  # → ≥ 1
```

### D5: Code Quality (Weight: 10/100)

| Score | Description |
|-------|-------------|
| 5/5 | 8 个独立组件；TypeScript 类型完整（dashboard.ts）；无 any；v2 CSS 变量使用；Sidebar 和 TopNav 共享路由配置 |
| 4/5 | 基本规范但有 1-2 处 any |
| 3/5 | TypeScript 但类型不完整 |
| 2/5 | 大量 any |
| 1/5 | 代码结构混乱 |

**Detection method**:
```bash
# 类型文件存在
ls frontend/src/types/dashboard.ts

# 无 any
grep -rn ': any' frontend/src/pages/ frontend/src/components/home/ frontend/src/components/layout/ | wc -l  # → 0

# v2 CSS 变量使用
grep -rn 'var(--surface\|var(--border\|var(--bg)' frontend/src/components/home/ | wc -l  # → ≥ 5

# 组件独立性
ls frontend/src/components/home/*.tsx | wc -l  # → 5
ls frontend/src/components/layout/*.tsx | wc -l  # → 2
```

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 使用 box-shadow | -3/处 | 任何组件使用 box-shadow |
| 硬编码颜色值 | -2/处 | 不使用 CSS 变量直接写色值 |
| Chat 入口不可用 | -15 | /chat 路由无法渲染 ChatInterface |
| LoginPage 失效 | -10 | 未登录状态下不显示 LoginPage |
| 使用 v1 变量名 | -5 | 使用 `--bg1`/`--b1` 而非 v2 变量 |
| 使用纯白 #fff | -3 | 卡片背景使用 `#fff` 而非 `--surface` |
| 无响应式导航 | -10 | 只有 top nav 或只有 sidebar |
| 内容居中 | -3 | 使用 `margin: 0 auto` 居中首页内容 |
| 修改冻结文件 | -10/文件 | 修改了 LoginPage/widgets/useEduAuth |
| 缺少 dark mode | -10 | `design-tokens.css` 无 `@media (prefers-color-scheme: dark)` block |
| 组件色值字面量 | -2/处 | 组件代码中出现 `'white'`、`'#fff'`、`rgba()` 等色值字面量 |

## Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 总分 = 基础分 - Penalty 扣分（满分 100）
3. 报告最后一行: `总分: XX/100`

## Report Format

评估报告必须写入 `eval-reports/v{N}-eval.md`，包含：

```markdown
# v{N} Evaluation Report

## Pre-gate
- TypeScript 编译: PASS / FAIL

## Dimension Scores

| Dimension | Score | Weighted | Notes |
|-----------|-------|----------|-------|
| D1 | X/5 | XX/30 | ... |
| D2 | X/5 | XX/25 | ... |
| D3 | X/5 | XX/20 | ... |
| D4 | X/5 | XX/15 | ... |
| D5 | X/5 | XX/10 | ... |

## Penalty Deductions
(list any penalties)

## Priority Fix
1. [COMPONENT] ...
2. [COMPONENT] ...
3. [COMPONENT] ...

## Actionable Fix Hints
- file: ..., issue: ..., expected: ...

总分: XX/100
```
