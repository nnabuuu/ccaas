# Evaluation Criteria — Widget Catalog E2E

> 你是一位独立的前端质量审查员。你没有参与代码编写，只评估最终实现。
> 按照以下标准严格评分。

## Pre-Scoring Gate

**两个 tsc --noEmit 必须通过。** 任一失败则直接 0 分，跳过所有维度评估。

```bash
cd solutions/business/edu-platform/frontend && npx tsc --noEmit
cd solutions/business/edu-platform/mcp-server && npx tsc --noEmit
```

## Scoring Dimensions

### D1: MetricDashboard 视觉与功能 (Weight: 20/100)

**What to evaluate**: 指标网格、bar_list、操作按钮是否完整匹配参考设计。

| Score | Description |
|-------|-------------|
| 5/5 | 指标网格 + bar_list + 操作按钮完整渲染；delta 趋势箭头/颜色内联显示；bar_list 颜色按阈值变化（danger > 35%, warn > 25%, success ≤ 25%）；section title 存在；responsive grid |
| 4/5 | 主要元素齐全，颜色阈值基本正确，缺少 delta 内联或 section title |
| 3/5 | 指标网格或 bar_list 其中一个正确，另一个有明显问题（如 bar 全同色） |
| 2/5 | widget 能渲染但样式严重偏离参考设计（无颜色区分、无 actions） |
| 1/5 | widget 无法渲染或空白 |

**Detection method**:
1. 检查 `solutions/business/edu-platform/frontend/src/widgets/EduMetricDashboard.tsx` 是否存在
2. Grep Tailwind classes：`ck-danger-t`, `ck-warn-t`, `ck-success-t` 是否用于 bar fill
3. 检查是否有 `section_title` / `section-title` 渲染
4. 检查是否有 `actions` prop 处理和按钮渲染
5. 浏览器截图对比 `reference/chat-interface-details/metric-dashboard.png`

---

### D2: StepWizard 视觉与功能 (Weight: 25/100)

**What to evaluate**: 四步向导完整可交互，表单→树选择→学情图→摘要确认→submitToEngine。

| Score | Description |
|-------|-------------|
| 5/5 | 四步完整可交互：表单输入 → 树选择 → 学情条形图+标记 → 摘要确认 → submitToEngine 成功 |
| 4/5 | 四步可导航，大部分交互正常，submitToEngine 可工作但参数不完整 |
| 3/5 | 步骤导航正常但部分面板（树选择器或摘要）缺失或空白 |
| 2/5 | 只有第一步可用，后续步骤空白或报错 |
| 1/5 | widget 无法渲染 |

**Hard cap**: 如果 submitToEngine 不触发 → max 3/5

**Detection method**:
1. 检查 StepWizard 相关组件是否在 widget-registry 注册
2. 检查 MCP `write_output` 是否输出 step-wizard JsonRenderSpec
3. 浏览器中逐步点击四步，验证每步内容渲染
4. 在最后一步点击提交，检查 console/network 中 submitToEngine 是否触发
5. 截图对比 `reference/chat-interface-details/step-wizard.png`

---

### D3: ReviewPanel 视觉与功能 (Weight: 20/100)

**What to evaluate**: 全部展示式布局、来源标签、四种操作+状态反馈、进度计数、批量操作、确认提交。

| Score | Description |
|-------|-------------|
| 5/5 | 全部展示 + 来源标签(题库/AI不同色) + 四种操作(含状态反馈) + 进度计数 + 批量操作 + 确认提交 |
| 4/5 | 主要功能齐全，缺少来源标签颜色区分或批量操作 |
| 3/5 | 项目列表和基本操作可用，缺少状态反馈（边框/背景变化）或进度计数 |
| 2/5 | 只能展示列表，无交互操作，或仍为逐项切换式 |
| 1/5 | widget 无法渲染 |

**Detection method**:
1. 检查 `EduReviewPanel.tsx` 是否存在且已注册
2. Grep `src-bank`, `src-ai` 或等价的来源样式区分
3. Grep `kept`, `replaced`, `removed` 或等价的状态 CSS classes
4. 检查是否有 "全部保留" 批量操作按钮
5. 检查是否有 "确认组卷" 或等价的 submit 按钮调用 `onSubmit`
6. 浏览器中点击操作按钮，验证 item 视觉状态变化
7. 截图对比 `reference/chat-interface-details/review-panel.html`

---

### D4: Session-Input Polish (Weight: 10/100)

**What to evaluate**: chip 样式区分、分组建议、input 工具按钮。

| Score | Description |
|-------|-------------|
| 5/5 | 三种 chip 样式正确(active=info/tenant=purple/clickable=hover) + 分组建议带小标题 + input 工具按钮(上传+Skill) |
| 4/5 | chip 样式正确，缺少分组建议小标题或工具按钮其中一个 |
| 3/5 | 基本 chip 可用但 active/tenant 样式未区分 |
| 2/5 | 组件渲染但样式无变化 |
| 1/5 | 组件报错或不渲染 |

**Detection method**:
1. 读 `SessionContextBar.tsx` 检查 chip 是否有 `active`/`tenant`/`clickable` 样式分支
2. Grep `ck-info-bg`, `purple` 相关 CSS token
3. 读 `QuickSuggestions.tsx` 检查是否支持 `groups` prop 或分组渲染
4. 读 `ChatInterfaceComposer.tsx` 检查是否有工具按钮（upload icon, skill icon）
5. 截图对比 `reference/chat-interface-details/session-input-suggestions.html`

---

### D5: E2E 集成 & Widget Registry (Weight: 15/100)

**What to evaluate**: widget 注册正确性、MCP→渲染→交互→submitToEngine 全链路。

**Runtime hard cap**: If browser verification shows no custom widget rendering → D5 max 1/5. Browser screenshots MUST be referenced in the eval report.

| Score | Description |
|-------|-------------|
| 5/5 | 三个 widget 通过 customWidgets 注册；MCP 数据→渲染→交互→submitToEngine 全链路通；console 无 "unknown widget type" 错误；browser verification confirms rendering |
| 4/5 | 注册正确，大部分 E2E 链路通，1 个 widget 的 submitToEngine 有问题 |
| 3/5 | 注册正确，widget 能渲染，但 submitToEngine 普遍不工作 |
| 2/5 | 部分 widget 未注册，或 MCP 数据格式不匹配导致渲染失败 |
| 1/5 | widget-registry 未配置或 ChatInterface 未传入 customWidgets，或zero widgets render at runtime |

**Detection method**:
1. `grep -rn 'customWidgets\|widget-registry\|registerWidget' solutions/business/edu-platform/frontend/src/`
2. 检查 `App.tsx` 是否将 `customWidgets` 传入 `<ChatInterface>`
3. 检查 `widget-registry.ts` 是否导出正确类型的 WidgetRegistry
4. **MANDATORY browser verification**: 启动 edu-platform，通过对话触发各 widget，检查渲染（截图必须包含在 eval report 中）
5. 检查 browser console 无 "unknown widget type" 或 React 错误

---

### D6: 代码质量 & TypeScript (Weight: 10/100)

**What to evaluate**: 类型安全、代码规范、无遗留问题。

| Score | Description |
|-------|-------------|
| 5/5 | tsc --noEmit 零错误，类型完整，无 any 逃逸，遵循现有组件模式（WidgetComponentProps 泛型） |
| 4/5 | tsc 通过，有少量 any 或类型不完整 |
| 3/5 | tsc 通过但有 @ts-ignore 或大量 any |
| 2/5 | tsc 有错误但不影响运行 |
| 1/5 | tsc 报大量错误或代码不可编译 |

**Hard cap**: tsc --noEmit 失败 → max 2/5

**Detection method**:
1. `cd solutions/business/edu-platform/frontend && npx tsc --noEmit 2>&1`
2. `cd solutions/business/edu-platform/mcp-server && npx tsc --noEmit 2>&1`
3. `grep -rn 'any\|@ts-ignore\|@ts-expect-error' solutions/business/edu-platform/frontend/src/widgets/`
4. 检查 widget 组件是否使用 `WidgetComponentProps<T>` 泛型
5. 检查 import 是否有未使用的

---

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 修改 frozen 文件 (chat-interface core widgets) | -5 per file | `git diff --name-only` 检查 `packages/chat-interface/src/widgets/` |
| 修改 frozen 文件 (WidgetRenderer/registry/catalog) | -5 per file | `git diff --name-only` 检查 core 基础设施 |
| hardcoded 颜色值 (hex/rgb 非 CSS variable) | -0.5 per instance | `grep -rn '#[0-9a-fA-F]\{3,6\}\|rgb(' solutions/business/edu-platform/frontend/src/widgets/` |
| console.log 残留 | -1 per instance | `grep -rn 'console\.log' solutions/business/edu-platform/frontend/src/widgets/` |
| 未使用的 import | -0.5 per instance | tsc 或 grep unused imports |

## Score Calculation

1. 每个维度: `(score / 5) * weight`
   - 例: D1 MetricDashboard 得 4/5 → (4/5) * 20 = 16
   - 例: D2 StepWizard 得 3/5 → (3/5) * 25 = 15
2. 基础分: 六个维度加权分之和
3. 扣分: Penalty 扣分
4. **总分 = 基础分 - Penalty 扣分**（满分 100，最低 0）
5. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Thresholds

- **Pass**: 65/100
- **Target**: 80/100
- **Estimated baseline**: ~25/100（第一轮预期仅有 registry 骨架 + MetricDashboard 基础渲染）
