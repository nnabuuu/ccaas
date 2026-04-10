# v3 Changelog

## 新建文件
- `frontend/src/components/ui/ProgressBar.tsx` — Segmented progress bar with N segments; completed segments filled with primary color, current segment pulses, remaining segments are gray. Props: `{ current, max }`.
- `frontend/src/components/ui/Tabs.tsx` — Horizontal tab bar with active indicator (border-bottom). Props: `{ tabs, activeTab, onTabChange }`. Supports overflow scrolling on mobile.
- `frontend/src/components/PipelineStep.tsx` — Visual write→analyze pipeline indicator. Current step shows pulse animation, completed steps show checkmark. Uses pill/chip styling with chevron arrows between steps.
- `frontend/src/components/CompletionSummary.tsx` — Completion summary card with green border/tint. Shows final score (color-coded), iterations count, elapsed duration (via formatDuration), and exit reason in a 4-column grid. Appears when run status is completed or failed.
- `frontend/src/components/ui/FilterChips.tsx` — Clickable status filter pills (All/Draft/Running/Completed/Failed). Active chip is filled primary, inactive chips are gray. Replaces raw `<select>` dropdown.

## 改动文件
- `frontend/src/pages/RunProgressPage.tsx` — Major restructure:
  - Hero section split into 3-card grid (Score, Iteration, Pipeline) that stacks on mobile (`grid-cols-1 sm:grid-cols-3`)
  - Score card now uses `text-5xl` hero number with trend arrow (↑/↓ delta from last 2 trajectory points, green/red color-coded)
  - Iteration card shows progress count + ProgressBar component
  - Pipeline card shows PipelineStep + SSE status indicator with label
  - Content area wrapped in Tabs component (Chart/Timeline/Scorecard/Diff) replacing vertical scroll layout
  - CompletionSummary rendered above hero when run is completed/failed
  - Live activity indicator consolidated with text delta inline

- `frontend/src/components/ArticleForm.tsx` — Form polish:
  - Added visible `<label>` elements for Title and Content fields (with `htmlFor` binding)
  - Added "Type" label above radio buttons
  - Added real-time word count + character count display below textarea
  - Added client-side validation: title required, content required with min 10 chars
  - Inline error messages (red text) on invalid fields with red border styling
  - Error clears on field change

- `frontend/src/pages/ArticleListPage.tsx` — Replaced raw `<select>` dropdown with FilterChips component for status filtering. Moved "New Article" button into SectionHeader action slot alone, moved filter chips below header.

## 对应维度
- D4 (实时反馈): Created 4 missing components (ProgressBar, Tabs, PipelineStep, CompletionSummary), added trend arrow, restructured hero into 3-card layout, added tab navigation — targeting 8/20 → 20/20
- D5 (表单+交互): Added labels, word count, validation with error messages to ArticleForm. Replaced select with FilterChips — targeting 4/10 → 10/10
- D6 (响应式): Hero cards stack on mobile via `sm:grid-cols-3`, CompletionSummary grid uses `grid-cols-2 sm:grid-cols-4`

## 本轮重点
D4 全面补齐: 从 8/20 跳到目标 20/20 — 创建了 ProgressBar、Tabs、PipelineStep、CompletionSummary 四个缺失组件，加入趋势箭头，RunProgressPage 从垂直滚动改为 Tab 导航布局。

## 本轮跳过
- D1 (视觉层级): Breadcrumb 仍在各页面单独渲染而非嵌入 Navbar — 低优先级（仅 4 分差距），留到后续轮次
- D6 (响应式): 375px 极端视口测试和 sm: 字体大小微调留到后续轮次
