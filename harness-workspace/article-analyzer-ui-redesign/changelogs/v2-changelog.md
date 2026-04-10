# v2 Changelog

## 新建文件
- `frontend/src/utils/formatters.ts` — formatTokens(12345→"12.3k"), formatDuration(83000→"1m 23s"), formatDate(iso→"3 min ago"), formatScore(85.5→"85.5")
- `frontend/src/utils/diff.ts` — wordDiff(oldText, newText) with LCS-based word-level diff algorithm returning DiffSegment[]
- `frontend/src/components/DimensionBreakdown.tsx` — Horizontal bar chart for dimension scores with color coding (green≥80, yellow≥60, red<60) and weight display

## 改动文件
- `frontend/src/components/ScoreChart.tsx` — Switched from LineChart to AreaChart with gradient fill (linearGradient defs), added Legend, added ReferenceLine at y=85 (target line) with dashed stroke, dark-mode aware colors via useTheme
- `frontend/src/components/RadarChart.tsx` — Added Legend, custom Tooltip formatter showing dimension name + score + weight, dynamic domain [0, maxScore], dark-mode aware colors via useTheme
- `frontend/src/components/ScorecardTable.tsx` — Added sort state (sortKey + sortDir) with clickable table headers, sort indicator arrows, useMemo for sorted iterations, uses formatTokens/formatDuration/formatScore from formatters.ts, row hover highlight
- `frontend/src/components/VersionDiff.tsx` — Replaced raw text display with word-level diff using wordDiff() from diff.ts; DiffDisplay subcomponent renders green bg (added), red bg + strikethrough (removed), neutral (equal) spans; labels for each version pane
- `frontend/src/components/IterationTimeline.tsx` — Added MiniDimensionBars subcomponent showing per-iteration dimension scores as horizontal bars with color coding; uses formatScore; dimension bars shown inside expanded panel
- `frontend/src/pages/ArticleListPage.tsx` — Replaced raw styled divs with Card component; added responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3); uses formatDate for relative time; improved card layout with line-clamp
- `frontend/tailwind.config.js` — Added missing primary shades (300, 400, 900); added success/warning/error semantic colors referencing CSS vars

## 对应维度
- D1 (视觉层级): ArticleListPage now uses Card component instead of raw divs; Tailwind config complete with all primary shades + semantic colors
- D3 (数据可视化): All 5 visualization components upgraded (ScoreChart, RadarChart, ScorecardTable, VersionDiff, IterationTimeline); utility files created (formatters.ts, diff.ts); DimensionBreakdown component added
- D6 (响应式): ArticleListPage now has responsive grid breakpoints (1→2→3 columns)

## 本轮重点
D3 数据可视化全面升级 — 从 2/5 分冲击 4-5/5 分：ScoreChart 有 Legend + 目标线 + 渐变；ScorecardTable 可排序 + 格式化；VersionDiff 有词级 diff 高亮

## 本轮跳过
- D4 (实时反馈): ProgressBar, PipelineStep, Tabs, CompletionSummary — 留到 v3 作为交互重构的核心
- D5 (表单+交互): ArticleForm labels/word count/validation, FilterChips — 留到 v3-4
- D1 (面包屑): 面包屑移入 App.tsx navbar — 留到 v3（需要路由检测逻辑）
