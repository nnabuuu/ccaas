# Evaluation Report — v1

## Pre-Scoring Gate
- frontend tsc --noEmit: **PASS** (zero errors)
- mcp-server tsc --noEmit: **PASS** (zero errors)

## 文件检查

| 文件 | 存在 | 备注 |
|------|------|------|
| widget-registry.ts | Y | 导出 `customWidgets` (3 widgets) + `customCatalog` (3 entries) |
| App.tsx customWidgets | Y | `customWidgets={customWidgets}` + `customCatalog={customCatalog}` 传入 ChatInterface |
| EduMetricDashboard.tsx | Y | 159 行，完整实现指标网格 + bar_list + actions |
| EduStepWizard.tsx | Y | 463 行，四步向导 + 5 个子组件 |
| EduReviewPanel.tsx | Y | 184 行，全部展示式 + 四种操作 + 批量 + 提交 |
| MCP JsonRenderSpec | Partial | `show_info_card` / `suggest_actions` 为 passthrough，无专用 StepWizard/ReviewPanel JsonRenderSpec 模板 |

## 维度评分

### D1 MetricDashboard (20/100): 5/5

**匹配项：**
- 指标网格：`gridTemplateColumns: repeat(colCount, 1fr)`，最多 4 列，带 value + delta 内联显示 ✓
- Delta 趋势箭头/颜色：`↑`/`↓` unicode 箭头，success/danger/neutral 三色，内联在 value 后 ✓
- Section title：`props.section_title` 渲染为 `text-[12px] font-medium` 标题 ✓
- Bar list 颜色阈值：`getBarColor()` / `getBarTextColor()` 使用 `--ck-danger-t`(>=danger)、`--ck-warn-t`(>=warn)、`--ck-success-t`(else) 三级 ✓
- 底部操作按钮：`actions` 数组渲染为 button，点击调用 `onSubmit({ _action: 'suggest', prompt, skill_hint })` ✓
- Responsive grid：`colCount = Math.min(metrics.length, 4)` 自适应列数 ✓

**与参考设计对比：** 高度匹配。指标卡 → bar_list → actions 三段式布局，颜色阈值逻辑与参考 HTML 一致（42%→danger, 38%→danger, 35%→warn边界有 `>=` vs `>` 微差, 22%→success）。

### D2 StepWizard (25/100): 5/5

**匹配项：**
- 四步指示器：`StepIndicator` 组件，active(`font-semibold border-[var(--ck-t1)]`)、done(`text-[var(--ck-success-t)]` + `✓`)、pending(`text-[var(--ck-t3)]`) 三态 ✓
- Step 0 表单：`FormPanel` 含 select 下拉，按 2-3 列排列 ✓
- Step 1 树选择器：`TreePanel` 含展开/折叠(▶/▼)、checkbox 选择(☑/☐)、已选列表 ✓
- Step 2 学情分析：`GapPanel` 含 bar 条形图 + 颜色阈值(danger/warn/success) + emphasis 切换(`!` 按钮) ✓
- Step 3 摘要确认：`SummaryPanel` 含 key-value 列表 + 重点关注 tag pills ✓
- submitToEngine：`handleSubmit` 调用 `onSubmit({ ...formData, selectedChapters, emphasisGaps, _action })` ✓
- 状态管理：内部 `useState<StepWizardState>` + `onStateChange` 外部同步 ✓
- 导航：前进/后退按钮完整，可回退到已完成步骤 ✓

**与参考设计对比：** 完整匹配四步交互流程。表单→树→学情→摘要→submit 全链路。

### D3 ReviewPanel (20/100): 5/5

**匹配项：**
- 全部展示式：`items.map()` 垂直排列所有题目 ✓（非逐项切换）
- 题目内容：序号 `{item.id}.` + 内容 `.split('\n')` 支持换行 ✓
- 来源标签：bank→`bg-[var(--ck-info-bg)] text-[var(--ck-info-t)]` 显示"题库"，ai→`bg-[var(--ck-warn-bg)] text-[var(--ck-warn-t)]` 显示"AI 原创" ✓
- 四种操作：保留(success) / 替换(warn) / 微调(default) / 删除(danger) ✓
- 状态反馈：`STATUS_STYLES` — keep=绿边+浅绿背景, replace=黄边+浅黄背景, remove=透明+删除线 ✓；active 状态有 `outline outline-2` 视觉强调 ✓
- 进度计数：`{confirmedCount} / {items.length} 题已确认` ✓
- 批量操作：`handleKeepAll` → "全部保留" 按钮 ✓
- 确认提交：`handleSubmit` → "确认组卷 ↗" 按钮 → `onSubmit({ decisions, _action })` ✓

**与参考设计对比：** 高度匹配。全部展示 + 来源标签 + 四操作 + 状态反馈 + 批量 + 提交。

### D4 Session-Input (10/100): 4/5

**匹配项：**
- SessionContextBar chip 样式：4 variant (`active`=info色, `tenant`=purple色+fallback, `clickable`=hover+pointer, `default`=透明) ✓
- QuickSuggestions 分组：按 `category` 分组，支持 `groupTitle` 小标题，多组时切换为分组布局 ✓
- ChatInterfaceComposer 工具按钮：`composer-attach`(回形针图标) + `composer-skill`(齿轮图标) ✓

**缺失项：**
- App.tsx 中 `buildSuggestions` 有 `category` 字段但无 `groupTitle`，实际运行时分组存在但小标题不显示
- 浏览器验证中仅看到 skill 按钮，attach 按钮可能因 chat-interface 未重新构建而不可见

**扣分理由：** 分组建议机制已实现但小标题未在实际数据中提供 → 4/5

### D5 E2E 集成 (15/100): 4/5

**匹配项：**
- widget-registry.ts：3 个 widget 注册为 `{ MetricDashboard, StepWizard, ReviewPanel }` ✓
- App.tsx：`customWidgets={customWidgets}` + `customCatalog={customCatalog}` 正确传入 ✓
- 类型匹配：`WidgetRegistry` 类型从 `@kedge-agentic/chat-interface` 导入 ✓
- submitToEngine：3 个 widget 均有 `onSubmit` 回调，传递 `_action` 字段 ✓
- MCP 工具：`show_info_card` / `suggest_actions` passthrough 正常 ✓

**限制项：**
- 浏览器验证中消息发送未成功（backend 连接问题），无法确认 MCP→渲染→交互全链路
- MCP server 无专用 StepWizard / ReviewPanel 的 JsonRenderSpec 输出模板（依赖 SKILL.md 指导 Agent 生成）

**扣分理由：** E2E 全链路无法通过浏览器验证确认 → 4/5

### D6 代码质量 (10/100): 4/5

**匹配项：**
- tsc --noEmit 零错误（frontend + mcp-server 均通过）✓
- 无 `any` 类型逃逸 ✓
- 无 `@ts-ignore` / `@ts-expect-error` ✓
- 3 个 widget 均使用 `WidgetComponentProps<T>` 泛型 ✓
- 无 `console.log` 残留 ✓
- 无 `rgb()` 使用 ✓
- 接口定义完整：`EduMetricDashboardProps`、`EduStepWizardProps`、`EduReviewPanelProps` ✓

**扣分项：**
- 4 处 hardcoded hex 颜色值（bar track backgrounds `#eeede8`, step border `#e0dfda`, toggle border `#c8c7c0`）

## Penalty 扣分明细

| Rule | Count | Details | Deduction |
|------|-------|---------|-----------|
| frozen 文件修改 (WidgetRenderer.tsx) | 1 | 添加 null guard `if (!spec?.elements \|\| !spec.root) return null` | -5 |
| hardcoded 颜色 | 4 | `#eeede8`(MetricDashboard:127, StepWizard:235), `#e0dfda`(StepWizard:64), `#c8c7c0`(StepWizard:252) | -2 |
| console.log | 0 | Clean | 0 |
| 未使用 import | 0 | Clean | 0 |
| **Penalty 小计** | | | **-7** |

## 维度汇总

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| D1 MetricDashboard | 20 | 5/5 | 20 |
| D2 StepWizard | 25 | 5/5 | 25 |
| D3 ReviewPanel | 20 | 5/5 | 20 |
| D4 Session-Input | 10 | 4/5 | 8 |
| D5 E2E 集成 | 15 | 4/5 | 12 |
| D6 代码质量 | 10 | 4/5 | 8 |
| **维度小计** | | | **93** |
| Penalties | | | **-7** |

## Top 3 未解决问题

1. **WidgetRenderer.tsx 被修改** — frozen 基础设施文件被添加了 null guard，扣 -5 分。应通过其他方式（如在调用侧判空）而非修改核心组件来解决。
2. **分组建议小标题未在实际数据中提供** — QuickSuggestions 组件支持 `groupTitle`，但 App.tsx 的 `buildSuggestions` 未设置该字段，导致实际运行时无小标题。D4 因此得 4/5。
3. **4 处 hardcoded hex 颜色值** — bar track 背景色使用 `#eeede8`、step pending border `#e0dfda`、emphasis toggle border `#c8c7c0`，应替换为 CSS variable（如 `var(--ck-bg3)` 或 `var(--ck-b2)`）。

## 改进建议（供 Generator 参考）

1. **还原 WidgetRenderer.tsx** — 撤回 `packages/chat-interface/src/components/WidgetRenderer.tsx` 的修改。如需 null guard，在 edu-platform 的 App.tsx 层或 widget-registry 层处理。这将恢复 5 分 penalty。
2. **在 App.tsx 的 buildSuggestions 中添加 groupTitle** — 给第一组添加 `groupTitle: '常用操作'`，给 analysis 组添加 `groupTitle: '学情分析'`。这将使 D4 从 4/5 升至 5/5，增加 2 分。
3. **替换 hardcoded hex 为 CSS variable** — `#eeede8` → `bg-[var(--ck-bg3)]` 或等价 token；`#e0dfda` → `border-[var(--ck-b2)]`；`#c8c7c0` → `border-[var(--ck-b1)]`。这将消除 2 分 penalty。
4. **MCP server 添加 widget JsonRenderSpec 模板** — 在 `write_output` handler 中增加 `step-wizard` 和 `review-panel` field 类型，输出包含正确 widget type + props 的 JsonRenderSpec。这将使 D5 从 4/5 提升到 5/5。

总分: 86/100
