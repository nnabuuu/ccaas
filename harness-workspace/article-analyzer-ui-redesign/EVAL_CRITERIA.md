# Eval Criteria: Article Analyzer UI/UX Redesign

## Pre-gate

```bash
cd solutions/business/article-analyzer/frontend && npx tsc --noEmit
```

**如果 tsc 有任何错误 → 总分 = 0。** Generator 必须先修复编译错误。

## Scoring Dimensions

| # | Dimension | Weight | Core Content |
|---|-----------|--------|--------------|
| D1 | 视觉层级 + 布局 | 20/100 | App shell、导航、面包屑、排版层级、间距系统、Design tokens |
| D2 | 加载/错误/空状态 | 15/100 | Skeleton loader、Error boundary、空状态插图+CTA、Toast 通知 |
| D3 | 数据可视化 + 图表 | 20/100 | 图例/Tooltip/目标线、表格排序+格式化、版本 Diff 高亮、时间线动画 |
| D4 | 实时反馈 (RunProgress) | 20/100 | Hero score、分段进度条、Pipeline 步骤指示器、SSE 状态、Tab 布局 |
| D5 | 表单 + 交互打磨 | 10/100 | 字数统计、验证反馈、筛选 Chips、确认对话框、键盘快捷键 |
| D6 | 响应式 + 暗色模式 | 15/100 | Dark mode toggle + 全覆盖、Mobile breakpoints、CSS 变量系统 |

## D1: 视觉层级 + 布局 (20/100)

**5/5 (20 pts)**: 完整的 design token 系统 + App shell + 面包屑 + 一致的排版层级 + 所有页面使用共享 Card 组件
**4/5 (16 pts)**: 有 design tokens + App shell，但面包屑或排版层级有不一致
**3/5 (12 pts)**: 有基本 App shell 和 Navbar，但缺少 design tokens 或 CSS 变量
**2/5 (8 pts)**: 有 Navbar 但无 design tokens，布局不一致
**1/5 (4 pts)**: 无明显改进

**Detection**:
```bash
# 1a. darkMode config
grep "darkMode" solutions/business/article-analyzer/frontend/tailwind.config.js

# 1b. Custom theme colors
grep -c "primary\|surface\|success\|warning\|error" solutions/business/article-analyzer/frontend/tailwind.config.js

# 1c. CSS variables
grep -c "\-\-color" solutions/business/article-analyzer/frontend/src/index.css

# 1d. Navbar with breadcrumb
grep -c "Breadcrumb\|breadcrumb\|nav" solutions/business/article-analyzer/frontend/src/App.tsx

# 1e. Card component exists
test -f solutions/business/article-analyzer/frontend/src/components/ui/Card.tsx && echo "exists"

# 1f. StatusBadge component
test -f solutions/business/article-analyzer/frontend/src/components/ui/StatusBadge.tsx && echo "exists"

# 1g. SectionHeader component
test -f solutions/business/article-analyzer/frontend/src/components/ui/SectionHeader.tsx && echo "exists"
```

**Code Review Checklist**:
- [ ] `tailwind.config.js` has `darkMode: 'class'` and custom `colors.primary.*`
- [ ] `index.css` has CSS custom properties for primary, surface, text semantics
- [ ] `App.tsx` has a Navbar with logo/title + breadcrumb + dark mode toggle
- [ ] `ui/Card.tsx` accepts className, has padding + shadow + rounded-lg + dark variant
- [ ] `ui/StatusBadge.tsx` maps 4 statuses to colors (draft=gray, running=blue, completed=green, failed=red)
- [ ] All pages use Card instead of raw `<div className="bg-white ...">` wrappers

## D2: 加载/错误/空状态 (15/100)

**5/5 (15 pts)**: 所有 3 个页面都有 Skeleton + ErrorState + EmptyState；useFetch hook 封装完整
**4/5 (12 pts)**: 2/3 个页面完整覆盖
**3/5 (9 pts)**: 有 Skeleton 和 ErrorState 组件，但只在 1 个页面使用
**2/5 (6 pts)**: 有组件但未集成到页面
**1/5 (3 pts)**: 组件缺失或未使用

**Detection**:
```bash
# 2a. Skeleton component
test -f solutions/business/article-analyzer/frontend/src/components/ui/Skeleton.tsx && echo "exists"

# 2b. EmptyState component
test -f solutions/business/article-analyzer/frontend/src/components/ui/EmptyState.tsx && echo "exists"

# 2c. ErrorState component
test -f solutions/business/article-analyzer/frontend/src/components/ui/ErrorState.tsx && echo "exists"

# 2d. useFetch hook
test -f solutions/business/article-analyzer/frontend/src/hooks/useFetch.ts && echo "exists"

# 2e. Usage in pages
grep -c "Skeleton\|EmptyState\|ErrorState" solutions/business/article-analyzer/frontend/src/pages/ArticleListPage.tsx
grep -c "Skeleton\|EmptyState\|ErrorState" solutions/business/article-analyzer/frontend/src/pages/ArticleDetailPage.tsx
grep -c "Skeleton\|EmptyState\|ErrorState" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx

# 2f. No console.error for user-visible errors
grep -c "console.error" solutions/business/article-analyzer/frontend/src/pages/*.tsx
```

**Code Review Checklist**:
- [ ] `Skeleton.tsx` supports at least 2 variants (line, card)
- [ ] `EmptyState.tsx` has icon/illustration + description + CTA button prop
- [ ] `ErrorState.tsx` has error message + retry button
- [ ] `useFetch.ts` returns `{ data, loading, error, refetch }`
- [ ] ArticleListPage: loading → Skeleton grid, empty → EmptyState CTA, error → ErrorState
- [ ] ArticleDetailPage: loading → Skeleton, error → ErrorState
- [ ] RunProgressPage: loading → Skeleton charts, error → ErrorState
- [ ] Zero `console.error` in page components for user-visible error paths

## D3: 数据可视化 + 图表 (20/100)

**5/5 (20 pts)**: 所有图表有图例+Tooltip+动画；表格排序+格式化；词级 Diff；formatters 完整
**4/5 (16 pts)**: 4/5 个可视化组件达标
**3/5 (12 pts)**: 3/5 个组件达标
**2/5 (8 pts)**: 1-2 个组件有改进
**1/5 (4 pts)**: 无明显改进

**Detection**:
```bash
# 3a. ScoreChart enhancements
grep -c "Legend\|ReferenceLine\|Tooltip\|LinearGradient\|defs" solutions/business/article-analyzer/frontend/src/components/ScoreChart.tsx

# 3b. RadarChart enhancements
grep -c "Legend\|Tooltip\|PolarAngleAxis" solutions/business/article-analyzer/frontend/src/components/RadarChart.tsx

# 3c. ScorecardTable sorting
grep -c "sort\|Sort\|order\|Order" solutions/business/article-analyzer/frontend/src/components/ScorecardTable.tsx

# 3d. VersionDiff word-level
grep -c "word\|Word\|segment\|Segment\|diff\|Diff" solutions/business/article-analyzer/frontend/src/components/VersionDiff.tsx

# 3e. Formatters
test -f solutions/business/article-analyzer/frontend/src/utils/formatters.ts && echo "exists"
grep -c "formatToken\|formatDuration\|formatDate\|formatScore" solutions/business/article-analyzer/frontend/src/utils/formatters.ts 2>/dev/null

# 3f. Diff utility
test -f solutions/business/article-analyzer/frontend/src/utils/diff.ts && echo "exists"

# 3g. DimensionBreakdown component
test -f solutions/business/article-analyzer/frontend/src/components/DimensionBreakdown.tsx && echo "exists"
```

**Code Review Checklist**:
- [ ] ScoreChart has `<Legend>`, `<ReferenceLine y={85} label="Target" strokeDasharray="3 3">`, gradient fill
- [ ] RadarChart has `<Tooltip>` with custom formatter showing dimension name + score + weight
- [ ] ScorecardTable has clickable header for sort + `formatTokens()` + `formatDuration()` + score color coding
- [ ] VersionDiff uses `wordDiff()` → renders green/red `<span>` segments (not full-line diff)
- [ ] IterationTimeline has expand/collapse animation + mini dimension bars per iteration
- [ ] `formatters.ts`: formatTokens(12345) → "12.3k", formatDuration(83000) → "1m 23s"
- [ ] `diff.ts`: wordDiff returns array of `{type: 'add'|'remove'|'equal', text: string}`

## D4: 实时反馈 (RunProgressPage) (20/100)

**5/5 (20 pts)**: Hero score + 分段进度条 + Pipeline 指示器 + SSE 状态 + Tab 导航 + CompletionSummary
**4/5 (16 pts)**: 5/6 个元素完成
**3/5 (12 pts)**: Hero score + 进度条 + Tab
**2/5 (8 pts)**: 有改进但缺少核心元素
**1/5 (4 pts)**: 无明显改进

**Detection**:
```bash
# 4a. Hero score (large number)
grep -c "text-5xl\|text-4xl\|hero\|Hero" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx

# 4b. ProgressBar component
test -f solutions/business/article-analyzer/frontend/src/components/ui/ProgressBar.tsx && echo "exists"
grep -c "ProgressBar\|progressBar" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx

# 4c. PipelineStep component
test -f solutions/business/article-analyzer/frontend/src/components/PipelineStep.tsx && echo "exists"
grep -c "PipelineStep\|pipeline" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx

# 4d. SSE indicator
grep -c "sseConnected\|connected\|disconnected" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx

# 4e. Tabs component
test -f solutions/business/article-analyzer/frontend/src/components/ui/Tabs.tsx && echo "exists"
grep -c "Tabs\|activeTab\|setActiveTab" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx

# 4f. CompletionSummary
test -f solutions/business/article-analyzer/frontend/src/components/CompletionSummary.tsx && echo "exists"
grep -c "CompletionSummary" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx

# 4g. Trend arrow
grep -c "↑\|↓\|trend\|Trend\|arrow\|Arrow" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx
```

**Code Review Checklist**:
- [ ] Hero area: score in text-4xl/5xl + trend arrow (↑/↓ with delta) + StatusBadge
- [ ] Segmented ProgressBar: N segments for max iterations, filled segments = completed
- [ ] PipelineStep: shows write/analyze, current step highlighted with animation
- [ ] SSE indicator: green dot=connected, yellow=reconnecting, red=disconnected
- [ ] Tab navigation: at least 4 tabs (Chart, Timeline, Scorecard, Diff)
- [ ] CompletionSummary: shown when status=completed, displays final score + iterations + time + exit reason
- [ ] Layout follows the spec wireframe (hero top → tabs → content)

## D5: 表单 + 交互打磨 (10/100)

**5/5 (10 pts)**: ArticleForm 有字数统计+验证+图标；FilterChips 替代 select；文章卡片重设计
**4/5 (8 pts)**: 有字数统计+验证，FilterChips 存在
**3/5 (6 pts)**: 有验证或字数统计之一
**2/5 (4 pts)**: 有基本改进但不完整
**1/5 (2 pts)**: 无改进

**Detection**:
```bash
# 5a. Word count
grep -c "count\|Count\|length\|字数" solutions/business/article-analyzer/frontend/src/components/ArticleForm.tsx

# 5b. Validation
grep -c "error\|Error\|valid\|Valid\|required\|Required" solutions/business/article-analyzer/frontend/src/components/ArticleForm.tsx

# 5c. FilterChips component
test -f solutions/business/article-analyzer/frontend/src/components/ui/FilterChips.tsx && echo "exists"
grep -c "FilterChips\|filterChips" solutions/business/article-analyzer/frontend/src/pages/ArticleListPage.tsx

# 5d. Article card redesign (score + relative time)
grep -c "score\|Score\|ago\|relative\|timeAgo" solutions/business/article-analyzer/frontend/src/pages/ArticleListPage.tsx
```

**Code Review Checklist**:
- [ ] ArticleForm: each field has `<label>` + `<input>` pair
- [ ] ArticleForm: real-time character/word count display
- [ ] ArticleForm: validation on submit (title required, input min length) with error messages
- [ ] FilterChips: renders status options as clickable chips, selected chip has filled bg
- [ ] Article cards: show score badge + status badge + relative time ("3 min ago")
- [ ] No raw `<select>` for status filtering

## D6: 响应式 + 暗色模式 (15/100)

**5/5 (15 pts)**: Dark mode 全覆盖 + localStorage 持久化 + Mobile 375px 无溢出 + 图表 ResponsiveContainer
**4/5 (12 pts)**: Dark mode 覆盖 80%+ 组件 + Mobile 基本可用
**3/5 (9 pts)**: Dark mode toggle 存在 + 部分组件支持 + Mobile 有断点
**2/5 (6 pts)**: Dark mode 仅 toggle + 少量组件
**1/5 (3 pts)**: 无暗色或响应式

**Detection**:
```bash
# 6a. ThemeContext
test -f solutions/business/article-analyzer/frontend/src/context/ThemeContext.tsx && echo "exists"

# 6b. useTheme hook
test -f solutions/business/article-analyzer/frontend/src/hooks/useTheme.ts && echo "exists"

# 6c. dark: variants count across all components
grep -rc "dark:" solutions/business/article-analyzer/frontend/src/components/ solutions/business/article-analyzer/frontend/src/pages/ 2>/dev/null | awk -F: '{sum+=$NF} END {print sum}'

# 6d. localStorage persistence
grep -c "localStorage" solutions/business/article-analyzer/frontend/src/context/ThemeContext.tsx 2>/dev/null

# 6e. ResponsiveContainer in charts
grep -c "ResponsiveContainer" solutions/business/article-analyzer/frontend/src/components/ScoreChart.tsx
grep -c "ResponsiveContainer" solutions/business/article-analyzer/frontend/src/components/RadarChart.tsx

# 6f. Mobile breakpoints
grep -c "sm:\|md:\|lg:" solutions/business/article-analyzer/frontend/src/pages/ArticleListPage.tsx
grep -c "sm:\|md:\|lg:" solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx

# 6g. Overflow protection
grep -c "overflow-x-auto\|overflow-auto\|whitespace-nowrap" solutions/business/article-analyzer/frontend/src/components/ScorecardTable.tsx
```

**Code Review Checklist**:
- [ ] ThemeContext: reads from localStorage on init, writes on change, toggles `dark` class on `<html>`
- [ ] useTheme: returns `{ isDark, toggleTheme }` or similar
- [ ] `dark:bg-*` variants on: Card, Navbar, pages, tables, charts wrapper, form inputs
- [ ] Total `dark:` usage across all files > 30 occurrences
- [ ] Charts wrapped in `<ResponsiveContainer width="100%" height={...}>`
- [ ] ArticleListPage: single-column on `<md`, grid on `md+`
- [ ] RunProgressPage: hero cards stack vertically on mobile
- [ ] ScorecardTable: `overflow-x-auto` wrapper for mobile
- [ ] 375px viewport: no horizontal scrollbar on any page

## Penalty Rules

| ID | Severity | Trigger | Deduction |
|----|----------|---------|-----------|
| P1 | Fatal | 修改 `solutions/business/article-analyzer/backend/` | → 总分 = 0 |
| P2 | Fatal | 修改 `packages/` 目录 | → 总分 = 0 |
| P3 | Fatal | 修改其他 `solutions/` 目录 | → 总分 = 0 |
| P4 | Fatal | 修改 `api.ts` 中现有 export interface/function | → 总分 = 0 |
| P5 | Blocker | `npx tsc --noEmit` 有错误 | → 总分 = 0 |
| P6 | Major | 组件文件存在但为空或只有 placeholder | -3/个 |
| P7 | Major | 使用了 `any` 类型 (> 3 处) | -5 |
| P8 | Minor | 硬编码颜色未使用 design token | -2 |
| P9 | Minor | 图表未用 ResponsiveContainer | -2/个 |

## Score Formula

```
Pre-gate: tsc --noEmit PASS → continue; FAIL → 总分 = 0

Raw score = Σ(dimension_score/5 × weight)
  D1: X/5 × 20 = Y/20
  D2: X/5 × 15 = Y/15
  D3: X/5 × 20 = Y/20
  D4: X/5 × 20 = Y/20
  D5: X/5 × 10 = Y/10
  D6: X/5 × 15 = Y/15

总分 = Raw score - penalties
```

## Thresholds

- **Target**: 95/100
- **Exit early**: score >= 95
- **Diminishing returns**: 2 consecutive iterations with < 3 points improvement
