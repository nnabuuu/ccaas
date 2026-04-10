# SPEC: Article Analyzer UI/UX Redesign

## Goal

对 `solutions/business/article-analyzer/frontend/` 进行全面 UI/UX 重设计。现有前端功能完整（create article → start run → iterative write/analyze → score/exit），但 UI/UX 品质很差：无加载状态、无错误处理、无空状态引导、无响应式、无暗色模式、可视化简陋、表单无验证。

**目标分数**: 95/100
**最大迭代**: 15 轮

## Architecture

仅修改前端代码，不涉及后端。前端已有 React 18 + Vite + Tailwind + recharts 技术栈。

```
solutions/business/article-analyzer/frontend/
├── package.json                  # 新增依赖 (clsx 等)
├── tailwind.config.js            # 自定义 theme tokens, darkMode
├── index.html
├── vite.config.ts
├── tsconfig.json
├── postcss.config.js
└── src/
    ├── main.tsx                  # ThemeProvider wrapper
    ├── index.css                 # CSS 变量, 动画 keyframes
    ├── App.tsx                   # App shell 重构 (Navbar + Breadcrumb + Dark toggle)
    ├── api.ts                    # 冻结 — 现有导出不可变，可添加新工具类型
    ├── context/
    │   └── ThemeContext.tsx       # 暗色模式 Provider
    ├── hooks/
    │   ├── useTheme.ts           # 暗色模式 hook
    │   └── useFetch.ts           # 通用 fetch hook (loading/error/data)
    ├── utils/
    │   ├── formatters.ts         # 数字/日期/时长格式化
    │   └── diff.ts               # 词级 diff 算法
    ├── pages/
    │   ├── ArticleListPage.tsx   # 全面重设计
    │   ├── ArticleDetailPage.tsx # 全面重设计
    │   └── RunProgressPage.tsx   # 大规模重构 (最复杂)
    └── components/
        ├── ArticleForm.tsx       # 增强：验证、字数统计、图标
        ├── ScoreChart.tsx        # 增强：图例、目标线、渐变、动画
        ├── RadarChart.tsx        # 增强：图例、Tooltip、动态 domain
        ├── ScorecardTable.tsx    # 增强：排序、格式化、颜色编码
        ├── VersionDiff.tsx       # 增强：词级 diff 高亮
        ├── IterationTimeline.tsx # 增强：动画展开、维度迷你条形图
        ├── PipelineStep.tsx      # 新：管道步骤指示器 (write → analyze)
        ├── CompletionSummary.tsx  # 新：完成摘要卡片
        ├── DimensionBreakdown.tsx # 新：维度条形图
        └── ui/
            ├── Card.tsx          # 可复用卡片
            ├── StatusBadge.tsx   # 状态徽章
            ├── Skeleton.tsx      # 骨架屏
            ├── EmptyState.tsx    # 空状态
            ├── ErrorState.tsx    # 错误状态
            ├── SectionHeader.tsx # 区块标题
            ├── Breadcrumb.tsx    # 面包屑
            ├── FilterChips.tsx   # 筛选标签
            ├── ProgressBar.tsx   # 分段进度条
            └── Tabs.tsx          # Tab 导航
```

## Work Items

### W1: App Shell + 视觉层级 (→ D1, 20pts)

**目标**: 建立全局设计系统基础 + App shell

**修改文件**:
- `tailwind.config.js` — 自定义 theme（色板 primary/gray/success/warning/error、排版 fontSize scale、间距 spacing scale、`darkMode: 'class'`）
- `src/index.css` — CSS custom properties (`--color-primary-*`, `--color-surface-*`, `--color-text-*`)、动画 keyframes (fadeIn, slideUp, pulse)
- `src/App.tsx` — 重构：Navbar（Logo + 面包屑 + Dark mode toggle）、全局布局 max-w-7xl

**新建文件**:
- `src/components/ui/Card.tsx` — 统一的卡片容器（padding, shadow, border-radius, dark variant）
- `src/components/ui/StatusBadge.tsx` — 状态徽章（draft=gray, running=blue+pulse, completed=green, failed=red）
- `src/components/ui/SectionHeader.tsx` — 区块标题（标题 + 可选 description + 可选 action slot）
- `src/components/ui/Breadcrumb.tsx` — 面包屑导航
- `src/context/ThemeContext.tsx` — Theme context + provider
- `src/hooks/useTheme.ts` — useTheme hook

**验收标准**:
- Tailwind config 有 `darkMode: 'class'` 和自定义色板
- CSS 变量覆盖 primary, surface, text 三个语义层
- Navbar 固定在顶部，有 Logo text + 面包屑 + Dark mode 切换按钮
- Card 组件在 light/dark 模式下都有正确样式

### W2: 加载/错误/空状态 (→ D2, 15pts)

**目标**: 所有页面都有正确的加载、错误、空数据状态

**新建文件**:
- `src/components/ui/Skeleton.tsx` — 骨架屏组件（支持 line, card, chart 三种形态）
- `src/components/ui/EmptyState.tsx` — 空状态（SVG 插图 + 描述文本 + CTA 按钮）
- `src/components/ui/ErrorState.tsx` — 错误状态（图标 + 错误信息 + 重试按钮）
- `src/hooks/useFetch.ts` — 通用 fetch hook：`{ data, loading, error, refetch }`

**修改文件**:
- `src/pages/ArticleListPage.tsx` — 替换裸 Loading text → Skeleton 网格；替换空数组 → EmptyState "创建第一篇文章" CTA；替换 console.error → ErrorState
- `src/pages/ArticleDetailPage.tsx` — Skeleton + ErrorState
- `src/pages/RunProgressPage.tsx` — Skeleton 图表 + 进度占位

**验收标准**:
- 每个页面有 3 个状态分支：loading(Skeleton) / error(ErrorState+retry) / empty(EmptyState+CTA)
- 无 console.error 用于用户可见的错误场景
- EmptyState 有图标/描述/CTA 按钮

### W3: 数据可视化 (→ D3, 20pts)

**目标**: 图表和表格达到专业品质

**修改文件**:
- `src/components/ScoreChart.tsx` — 添加图例、目标阈值线（85分 虚线标注）、渐变填充、入场动画、Tooltip 格式化
- `src/components/RadarChart.tsx` — 添加图例、自定义 Tooltip（显示维度名+分数+权重）、动态 domain [0, maxScore]、填充透明度
- `src/components/ScorecardTable.tsx` — 添加列排序（点击表头）、数字格式化（tokens: `12.3k`、duration: `1m 23s`）、分数颜色编码（<60 红、60-80 黄、>80 绿）
- `src/components/VersionDiff.tsx` — 词级 diff 高亮（绿色背景=新增、红色背景=删除、灰色=不变）
- `src/components/IterationTimeline.tsx` — 可折叠动画展开 + 每轮维度迷你条形图

**新建文件**:
- `src/utils/formatters.ts` — `formatTokens(n)`, `formatDuration(ms)`, `formatDate(iso)`, `formatScore(n)`
- `src/utils/diff.ts` — `wordDiff(oldText, newText): DiffSegment[]`
- `src/components/DimensionBreakdown.tsx` — 维度水平条形图（每个维度一个条，宽度=分数百分比，颜色编码）

**验收标准**:
- ScoreChart 有图例和 85 分目标线
- RadarChart 有 Tooltip
- ScorecardTable 至少支持按 score 列排序
- VersionDiff 有词级高亮（不是整行高亮）
- formatTokens(12345) → "12.3k"

### W4: 实时反馈重构 (→ D4, 20pts)

**目标**: RunProgressPage 从简陋变为专业的实时监控面板

**修改文件**:
- `src/pages/RunProgressPage.tsx` — 大规模重构

**新建文件**:
- `src/components/PipelineStep.tsx` — 管道步骤指示器（`write → analyze`，当前步骤高亮 + 动画）
- `src/components/CompletionSummary.tsx` — 完成摘要卡片（最终分数 + 总迭代 + 耗时 + 退出原因）
- `src/components/ui/ProgressBar.tsx` — 分段进度条（N 段，已完成段=填充色，当前段=脉冲动画）
- `src/components/ui/Tabs.tsx` — Tab 导航组件

**RunProgressPage 布局**:
```
┌─────────────────────────────────────────────────────────┐
│ ← Back to article   /   Article Title   /   Run #3     │  Breadcrumb
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  72.5        │  │  Iteration   │  │  Pipeline    │  │
│  │  /100 ↑3.2   │  │  ▓▓▓▓▓░░░░░ │  │  write→anal  │  │
│  │  RUNNING     │  │  5 / 10      │  │  ● SSE ✓     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │  Hero 区域
├─────────────────────────────────────────────────────────┤
│  [Chart] [Timeline] [Scorecard] [Diff]                  │  Tab 导航
├─────────────────────────────────────────────────────────┤
│  (tab content)                                          │  Tab 内容
└─────────────────────────────────────────────────────────┘
```

**验收标准**:
- Hero score 卡片有大数字 (text-5xl)、趋势箭头 (↑/↓)、StatusBadge
- 分段进度条有 N 个段
- PipelineStep 显示 write/analyze 步骤，当前步骤有动画
- SSE 连接状态指示器（绿=connected, 黄=reconnecting, 红=disconnected）
- Tab 导航切换图表/时间线/评分卡/Diff
- 完成后显示 CompletionSummary

### W5: 表单 + 交互打磨 (→ D5, 10pts)

**目标**: 表单有验证反馈，交互有确认和反馈

**修改文件**:
- `src/components/ArticleForm.tsx` — label+input 对、字数统计（实时更新）、验证消息（title 必填、input 最少 10 字）、inputType 选择器带图标
- `src/pages/ArticleListPage.tsx` — 筛选 Chips 替代裸 select；文章卡片重设计（分数 badge + 预览 + 相对时间 "3 分钟前"）

**新建文件**:
- `src/components/ui/FilterChips.tsx` — 可选筛选标签组（All / Draft / Running / Completed / Failed）

**验收标准**:
- ArticleForm 有字数统计显示
- ArticleForm 提交时有验证（空 title → 错误提示）
- 筛选 Chips 可切换（不是 `<select>`）
- 文章卡片有分数、状态徽章、相对时间

### W6: 响应式 + 暗色模式 (→ D6, 15pts)

**目标**: Dark mode 全覆盖 + Mobile 响应式

**修改文件**:
- `src/context/ThemeContext.tsx` — localStorage 持久化 + `<html>` class 切换
- `tailwind.config.js` — 确保 `darkMode: 'class'`
- 所有组件 — `dark:` 变体（bg, text, border）

**Mobile 断点设计**:
- `<md` (< 768px): 单列布局、图表 100% 宽、Navbar 汉堡菜单、表格横向滚动
- `md-lg` (768-1024px): 两列网格、紧凑间距
- `>lg` (1024px+): 完整桌面布局

**验收标准**:
- Dark mode toggle 切换后，所有页面的 bg/text/border 正确变化
- localStorage 持久化主题选择
- 375px 视口下无水平溢出
- 图表有 ResponsiveContainer 包裹

## Frozen Constraints

### 不可修改

- `solutions/business/article-analyzer/backend/` — 整个后端冻结
- `packages/` — 核心包冻结
- `solutions/` 中 article-analyzer/frontend/ 之外的所有目录

### API 契约 (`frontend/src/api.ts`)

**不可改变**:
- 所有现有 `export interface` 定义
- 所有现有 `export function` 签名和实现
- `apiFetch` 函数

**可以添加**:
- 新的工具类型（如 `export type StatusFilter = ...`）
- 新的非导出辅助类型

## Design System Reference

| Token | Value |
|-------|-------|
| Primary | `#2563eb` (blue-600) |
| Primary Dark | `#3b82f6` (blue-500, for dark mode) |
| Surface Light | `#ffffff` |
| Surface Dark | `#1e293b` (slate-800) |
| Text Primary Light | `#0f172a` (slate-900) |
| Text Primary Dark | `#f1f5f9` (slate-100) |
| Border Light | `#e2e8f0` (slate-200) |
| Border Dark | `#334155` (slate-700) |
| Font Headline | Inter (semibold/bold) |
| Font Body | Inter (regular/medium) |
| Roundness | 8px (rounded-lg) |
| Score Green | `#16a34a` (green-600) |
| Score Yellow | `#ca8a04` (yellow-600) |
| Score Red | `#dc2626` (red-600) |

## Phase Strategy (Generator 参考)

| Phase | Versions | Focus | Target Score |
|-------|----------|-------|-------------|
| 基础设施 | v1-2 | tokens + app shell + 共享组件 + useFetch + 状态处理 | 30-45 |
| 可视化 | v3-5 | 图表增强 + 表格 + Diff + 时间线 + formatters | 55-70 |
| 交互 | v6-8 | 表单 + 筛选 + RunProgress 大重构 + Pipeline | 75-85 |
| 响应式+暗色 | v9-12 | Dark mode 全覆盖 + Mobile breakpoints | 85-93 |
| 打磨 | v13-15 | 微调间距/动画/一致性 + 最终得分 | 93-95+ |
