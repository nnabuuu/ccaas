# Article Analyzer UI/UX 重设计

基于 Harness 驱动的 Article Analyzer 前端 UI/UX 全面重设计，4 轮迭代达到 100/100（约 62 分钟）。

## 问题

Article Analyzer 前端功能完整（创建文章 → 启动运行 → 迭代写作/分析 → 评分/退出），但 UX 品质很差：

- 无加载状态、错误处理、空状态引导
- 无响应式设计和暗色模式
- 数据可视化简陋（无图例、Tooltip、动画）
- 无表单验证和交互打磨

## 方案

使用 [Harness Engineering](../guide/harness-engineering.md) 模式，以 Stitch 生成的设计原型作为视觉目标。

### 设计系统

运行 Harness 前，在 Stitch 中创建了设计系统：

- **字体**: Inter
- **主色**: `#2563eb` (blue-600)
- **圆角**: ROUND_EIGHT
- **配色变体**: TONAL_SPOT
- **模式**: 浅色（支持完整暗色模式）

生成了 8 个屏幕原型，覆盖空状态、数据视图、表单、移动端和暗色模式。

### 评估维度

| # | 维度 | 权重 | 重点 |
|---|------|------|------|
| D1 | 视觉层级 + 布局 | 20/100 | Design tokens、App shell、面包屑、排版 |
| D2 | 加载/错误/空状态 | 15/100 | 所有页面的 Skeleton、ErrorState、EmptyState |
| D3 | 数据可视化 | 20/100 | 图表图例、Tooltip、表格排序、词级 Diff |
| D4 | 实时反馈 | 20/100 | Hero 分数卡、进度条、Pipeline 指示器、SSE 状态 |
| D5 | 表单 + 交互 | 10/100 | 验证、字数统计、筛选标签 |
| D6 | 响应式 + 暗色模式 | 15/100 | Dark mode toggle、移动端断点、CSS 变量 |

**Pre-gate**: `npx tsc --noEmit` 必须通过（失败则 0 分）。

### 冻结约束

- 整个后端（`article-analyzer/backend/`）冻结
- 所有核心包（`packages/`）冻结
- `api.ts` 现有导出不可变（可添加新工具类型）

## 结果

| 版本 | 分数 | 耗时 | 重点 |
|------|------|------|------|
| v1 | 63/100 | ~13 min | 基础设施：design tokens、app shell、共享 UI 组件、状态处理 |
| v2 | 75/100 | ~13 min | 数据可视化：图表增强、表格排序、词级 diff |
| v3 | 94/100 | ~13 min | 实时反馈：hero 分数、进度条、pipeline 指示器、tabs |
| v4 | 100/100 | ~16 min | 表单打磨、面包屑集成、暗色模式完善 |

**总计**: 4 轮迭代，约 62 分钟，最终 100/100。

## 构建内容

### 新建文件（17 个）

- **UI 组件**: `Card`, `StatusBadge`, `Skeleton`, `EmptyState`, `ErrorState`, `SectionHeader`, `Breadcrumb`, `FilterChips`, `ProgressBar`, `Tabs`
- **功能组件**: `PipelineStep`, `CompletionSummary`
- **基础设施**: `ThemeContext`, `useTheme`, `useFetch`, `formatters`, `diff`

### 修改文件（12 个）

- `tailwind.config.js` — 自定义主题色阶 + darkMode
- `index.css` — CSS 自定义属性和动画关键帧
- `App.tsx` — App shell（导航栏 + 面包屑 + 暗色模式切换）
- 3 个页面 — 全面重设计 + 状态处理
- 6 个现有组件 — 增强图例、Tooltip、动画

### 关键技术决策

1. **LCS 词级 Diff**: `utils/diff.ts` 中的自定义算法，用于版本对比视图
2. **CSS 自定义属性**: Design tokens 作为 CSS 变量实现运行时主题切换
3. **分段进度条**: 每个迭代一个段的可视化进度指示器
4. **SSE 连接状态**: 绿/黄/红指示器 + 自动轮询回退

## Harness 后 Code Review

Harness 完成后，代码审查发现 4 个 HIGH 和 9 个 MEDIUM 问题，全部修复：

- **H-1**: 删除未使用的 `DimensionBreakdown.tsx` 组件
- **H-2**: 将重复的 `scoreColor`/`barColor` 合并到 `utils/colors.ts`
- **H-3**: 修复 `useFetch` 竞态条件（cleanup 模式）
- **H-4**: 添加被吞掉的 API 错误的展示
- **M-2**: 为 `ProgressBar` 添加 `status` 属性（已完成/失败状态）
- **M-5/M-6**: 为昂贵的 diff 计算添加 `useMemo`
- **M-9**: 为 `CompletionSummary` 添加条件红/绿样式

## 经验总结

1. **Stitch 原型加速收敛**: 有视觉目标将迭代次数从预算的 15 轮降至 4 轮
2. **Pre-gate 必不可少**: `tsc --noEmit` 门禁防止 Evaluator 在编译错误的代码上浪费时间
3. **阶段策略有效**: Generator prompt 指定了 基础设施 → 可视化 → 交互 → 打磨 的顺序，产生稳定的分数增长
4. **Harness 后做 Code Review**: AI 生成的代码需要结构化审查来发现死代码、重复工具函数等模式

## 工作空间

完整 Harness 工作空间: `harness-workspace/article-analyzer-ui-redesign/`
