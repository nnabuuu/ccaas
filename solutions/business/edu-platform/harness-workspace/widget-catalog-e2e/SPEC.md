# Spec: Widget Catalog E2E — Edu-Platform

## Context

edu-platform 的 chat-interface 已有 11 个 builtin widget 组件（InfoCard, ActionRow, StepWizard, FormCollect, TreeSelector, BarList, ReviewPanel, MetricDashboard, Summary, MiniOutline, TextSection），通过 `WidgetRenderer` + `JsonRenderSpec` 渲染。

参考设计（`reference/chat-interface-details/`）定义了 7 个 UI 场景。其中 3 个已满足（message-bubbles, file-card-actions, tool-usage-group），**3 个 widget 实现与参考设计严重偏离**，1 个需 polish：

| Widget | 当前状态 | 参考设计差距 |
|--------|---------|-------------|
| MetricDashboard | 基础指标卡 + 分布列表 | 缺：bar_list 颜色阈值（danger/warn/success）、delta 箭头内联、section title、底部 actions |
| StepWizard | 泛用多步骨架 | 缺：edu 特有表单字段、树选择器集成、学情条形图+标记、摘要确认页 |
| ReviewPanel | 逐项卡片式（一次显示一题） | 参考设计为全部展示式、来源标签(题库/AI)、四种操作(保留/替换/微调/删除)+状态反馈、批量操作 |
| Session-Input | 基础 chip + suggestions | 缺：chip 样式区分(active/tenant/clickable)、分组建议+小标题、input 工具按钮 |

## Goal

通过 json-render widget 增强 + MCP 工具集成，使 edu-platform 前端完整匹配 7 个参考设计，6 轮内 harness 达到 **80+**/100 分。

## 架构决策

### 1. Widget 增强路径

**方案**: 在 edu-platform solution 前端通过 `customWidgets` prop 注册增强版 widget，覆盖 builtin 版本。不修改 chat-interface core widget 代码。

```typescript
// solutions/business/edu-platform/frontend/src/App.tsx
import { customWidgets, customCatalog } from './widget-registry'

<ChatInterface
  customWidgets={customWidgets}
  customCatalog={customCatalog}
  ...
/>
```

### 2. Widget 注册

```typescript
// solutions/business/edu-platform/frontend/src/widget-registry.ts
import type { WidgetRegistry, WidgetCatalogEntry } from '@kedge-agentic/chat-interface'
import { EduMetricDashboard } from './widgets/EduMetricDashboard'
import { EduStepWizard } from './widgets/EduStepWizard'
import { EduReviewPanel } from './widgets/EduReviewPanel'

export const customWidgets: WidgetRegistry = {
  MetricDashboard: EduMetricDashboard,
  StepWizard: EduStepWizard,
  ReviewPanel: EduReviewPanel,
}
```

### 3. 数据流

MCP tool → Agent Engine → SSE → chat-interface → WidgetRenderer → registered widget component

- `show_info_card` 的 `metrics` + `bar_list` section → MetricDashboard widget
- `write_output` 推送 `step-wizard` JsonRenderSpec → StepWizard widget tree
- `write_output` 推送 `review-panel` JsonRenderSpec → ReviewPanel widget
- Widget `onSubmit` → `submitToEngine` → Agent Engine 继续处理

### 4. 样式约束

使用 chat-interface 的 CSS variable 体系（`--ck-*`），保持视觉一致。颜色阈值映射：

| 阈值 | CSS Token | 用途 |
|------|-----------|------|
| rate >= 35% | `--ck-danger-t` | 高错误率 |
| rate >= 25% | `--ck-warn-t` | 中错误率 |
| rate < 25% | `--ck-success-t` | 低错误率 |

## 工作项 (W1-W4)

### W1: EduMetricDashboard

增强 MetricDashboard，匹配 `reference/chat-interface-details/metric-dashboard.html`：

1. **指标网格**: 3-4 列，value + delta（内联显示，带趋势箭头和颜色）
2. **Section title**: bar_list 上方的分组标题（如 "薄弱知识点 (错误率 Top 5)"）
3. **Bar list 颜色阈值**: bar fill 和 percentage 文字按 danger/warn/success 三级着色
4. **底部操作按钮**: 通过 `actions` prop（与 ActionRow 相同协议）
5. **MCP 集成**: `show_info_card` 工具返回的 `metrics` + `bar_list` sections

**Props 接口**:
```typescript
interface EduMetricDashboardProps {
  title?: string
  badge?: string
  metrics: Array<{
    label: string
    value: string
    delta?: string
    trend?: 'up' | 'down' | 'neutral'
  }>
  section_title?: string
  bar_list?: Array<{
    label: string
    value: number
    max_value?: number
    color_thresholds?: { danger: number; warn: number }
  }>
  actions?: Array<{
    label: string
    prompt: string
    primary?: boolean
    skill_hint?: string
  }>
}
```

### W2: EduStepWizard + 子组件

增强 StepWizard 及子组件，匹配 `reference/chat-interface-details/step-wizard.html`：

1. **四步进度指示器**: active / done / pending 三态，done 显示 checkmark
2. **Step 0 — 选择范围**: FormCollect 表单字段（学科/年级/班级/课型/课时的 select 下拉）
3. **Step 1 — 选择章节**: TreeSelector 章节树（可展开/折叠，checkbox 选择）
4. **Step 2 — 学情分析**: BarList 条形图 + emphasis toggle 标记（`!` 按钮）
5. **Step 3 — 确认生成**: Summary 摘要确认页 + submit 按钮
6. **步骤间导航**: 前进/后退按钮，最后步 submit → `submitToEngine`
7. **状态传递**: `widgetState` + `onStateChange` 管理跨步骤数据

**MCP 集成**: `write_output` 推送完整 JsonRenderSpec，包含 StepWizard 作为 root，FormCollect/TreeSelector/BarList/Summary 作为 children。

### W3: EduReviewPanel

重写 ReviewPanel，匹配 `reference/chat-interface-details/review-panel.html`：

1. **全部展示式**: 所有题目在同一视图中垂直排列（非逐项切换）
2. **题目内容**: 序号 + 题目文本（支持换行）
3. **元信息标签**: 知识点、难度、来源（题库=info色, AI原创=warn色）
4. **四种操作按钮**: 保留(success) / 替换(warn) / 微调(default) / 删除(danger)
5. **操作状态反馈**: 已选操作的 item 边框+背景色变化（kept=绿边, replaced=黄边, removed=灰化+删除线）
6. **进度计数**: 底部 "N / Total 题已确认"
7. **批量操作**: "全部保留" 按钮
8. **确认提交**: "确认组卷" → `submitToEngine` 回传所有决策

**Props 接口**:
```typescript
interface EduReviewPanelProps {
  title: string
  items: Array<{
    id: string
    content: string
    knowledge_point?: string
    difficulty?: number
    source?: 'bank' | 'ai'
  }>
  submit_action: string
}
```

### W4: Session-Input Polish

调整 chat-interface 框架组件，匹配 `reference/chat-interface-details/session-input-suggestions.html`：

1. **SessionContextBar chip 样式**:
   - `active`: info 色背景 (`--ck-info-bg` / `--ck-info-t`)
   - `tenant`: purple 色背景 (`--ck-purple-bg` / `--ck-purple-t`，需定义)
   - `clickable`: default 背景 + hover 效果 + cursor pointer
2. **QuickSuggestions 分组**: 常规建议 + 阶段性推荐，带小标题分隔
3. **Input bar 工具按钮**: 上传文件 + 选择 Skill 图标按钮（input 左侧区域）

## Frozen Constraints

1. **chat-interface core widget 组件不可修改**: `packages/chat-interface/src/widgets/components/*.tsx`
2. **chat-interface core 基础设施不可修改**: `WidgetRenderer.tsx`, `registry.tsx`, `catalog.ts`, `mcp-bridge.ts`, types
3. **MCP 工具接口签名不变**: `show_info_card` 的 5 个 section types 不变
4. **React + Tailwind + json-render 架构不变**
5. **packages/react-sdk/ 不可修改**
6. **packages/backend/ 不可修改**

**W4 例外**: 以下 chat-interface 文件可以修改（仅限 W4 polish 范围）：
- `packages/chat-interface/src/components/SessionContextBar.tsx` — chip 样式
- `packages/chat-interface/src/components/QuickSuggestions.tsx` — 分组支持
- `packages/chat-interface/src/components/chat/ChatInterfaceComposer.tsx` — input 工具按钮

## 可修改文件范围

### Edu-Platform Solution (W1-W3)
- `solutions/business/edu-platform/frontend/src/widgets/` — 新建 widget 组件（W1-W3）
- `solutions/business/edu-platform/frontend/src/widget-registry.ts` — 注册 widgets
- `solutions/business/edu-platform/frontend/src/App.tsx` — 引入 widget registry
- `solutions/business/edu-platform/mcp-server/src/index.ts` — 调整 MCP 工具输出 JsonRenderSpec

### Chat-Interface (W4 only)
- `packages/chat-interface/src/components/SessionContextBar.tsx`
- `packages/chat-interface/src/components/QuickSuggestions.tsx`
- `packages/chat-interface/src/components/chat/ChatInterfaceComposer.tsx`
- `packages/chat-interface/tailwind.config.js` — 如需添加 purple CSS variable

## 参考设计文件

| 文件 | Widget |
|------|--------|
| `reference/chat-interface-details/metric-dashboard.html` | W1 |
| `reference/chat-interface-details/metric-dashboard.png` | W1 截图 |
| `reference/chat-interface-details/step-wizard.html` | W2 |
| `reference/chat-interface-details/step-wizard.png` | W2 截图 |
| `reference/chat-interface-details/review-panel.html` | W3 |
| `reference/chat-interface-details/session-input-suggestions.html` | W4 |

## 验证方式

- **Pre-gate**: `cd solutions/business/edu-platform/frontend && npx tsc --noEmit`
- **Pre-gate**: `cd solutions/business/edu-platform/mcp-server && npx tsc --noEmit`
- **E2E**: 启动 edu-platform 前后端 → 发送消息触发 MCP → 验证 widget 渲染和交互
- **Visual**: 截图对比参考 HTML/PNG
