# Evaluation Report — v4

## Pre-Scoring Gate
- frontend tsc --noEmit: **PASS**

## 维度评分

### D1 Chips 行 (12/100): 5/5

**Browser verified** (screenshots 01, 04, 06):
- Pill 形状 chips：✓ — 可见的圆角 pill 形状 chips，排列正确
- 状态圆点（灰=未答/绿=已答）：✓ — 初始态灰色，选择后变绿
- 已选值文本：✓ — 选择后显示"混合出题"等文字，含 ellipsis 截断逻辑（`maxWidth: 80px, overflow: hidden, textOverflow: 'ellipsis'`）
- 点击切换面板：✓ — screenshot 06 确认 chip 切换回题型面板
- 当前 chip 高亮：✓ — 当前 chip 有背景和边框高亮（`var(--bg1)` 背景 + `var(--b1)` 边框）
- chips 栏底部边框：✓ — `borderBottom: '0.5px solid var(--b1)'` 存在

**Code evidence**: `auq-chips` 容器包含 `chip-dot`（6px 圆点）、header text、selected value 显示。

### D2 选项+交互 (22/100): 4/5

**Browser verified** (screenshots 04, 08):
- Radio indicator：✓ — 圆形 radio 指示器，选中时 info 色填充
- Checkbox indicator：代码实现正确（`borderRadius: 4px` + checkmark SVG），但本次 session 无多选问题，未浏览器验证
- `multiSelect` 条件分支：✓ — 代码中 `q.multiSelect` 条件正确区分
- 选中样式（info-bg 背景 + info-t 边框）：✓ — screenshot 04 可见
- 推荐 badge：代码有实现（检查 `opt.recommended` 属性和 `(推荐)/(Recommended)` label 匹配），但 AI Skill 返回的 questions 不含 `recommended: true`，**未能浏览器验证**
- 推荐默认预选：`initSelections()` 中有预选逻辑，同上未能浏览器验证
- 单选自动跳转：✓ — screenshot 04 确认选择"混合出题"后 200ms 自动跳转到"难度"tab
- Other 区域：✓ — 虚线边框 `dashed`，`<input>` 始终渲染
- Other 自动勾选：✓ — screenshot 08 确认输入文字后自动选中 Other，取消之前选项
- Chip 值实时更新：✓ — 选择后 chip 值立即更新

**扣分原因**: 推荐 badge 和默认预选无法浏览器验证（AI Skill 未返回 recommended 属性），仅代码层确认。

### D3 Footer+提交 (12/100): 5/5

**Browser verified** (screenshots 05, 09, 10):
- 进度文本 "X / N 已回答"：✓ — 可见"2 / 2 已回答"
- 已回答数字绿色高亮：✓ — 代码使用 `var(--success-t)` 高亮
- 确认按钮 disabled 条件：✓ — screenshot 05 显示全部回答后按钮激活
- 点击确认 → handleAction 调用：✓ — 提交成功，AI 收到选择并生成题目
- 已提交态——选中项 success 绿色：✓ — screenshot 09 清晰可见选中项变绿（`var(--success-bg)` + `var(--success-t)`）
- 已提交态——未选中 opacity 淡化：✓ — screenshot 09 可见未选中项淡化
- 已提交态——Footer 显示 "✓ 混合出题 · 分层（含3个难度）"：✓ — screenshot 09/10 确认
- 已提交态——pointer-events: none：✓ — 代码中 `pointerEvents: 'none'` 在 submitted 容器上

### D4 Preview 分栏 (12/100): 3/5

**仅代码分析**（AI Skill 未返回 `preview: true` 的 question，无法浏览器验证）:
- `preview` 属性条件判断：✓ — `hasPreview` 变量检查 `q.preview`
- Grid 分栏 `grid-template-columns: 1fr 1fr`：✓ — 代码 `gridTemplateColumns: '1fr 1fr'`
- 右侧预览区域（等宽字体 + bg2 背景 + 左边框）：✓ — `fontFamily: 'monospace'`, `background: 'var(--bg2)'`, `borderLeft: '0.5px solid var(--b1)'`
- `previewContent` 属性读取和渲染：✓ — 代码读取 `opt.previewContent` 或 `opt.markdown`
- 选项切换 → 预览更新：✓ — 选中选项变化时 previewContent 联动更新
- Other 输入 → 预览自定义内容：✓ — `otherText` 非空时预览显示自定义内容

**Hard cap**: 无浏览器验证 → max 3/5

### D5 面板+状态 (17/100): 5/5

**Browser + Code verified**:
- CSS Grid 叠放：✓ — `gridRow: 1, gridColumn: 1` 面板叠放（代码确认 + 浏览器中面板切换无高度跳动）
- Opacity 切换：✓ — `opacity: 1`（当前面板）, `opacity: 0, pointerEvents: 'none'`（其他面板）
- Phase 过滤：✓ — `if (block.phase !== 'end') return <span style={{ display: 'none' }} />`
- toolOutput.answers 安全解析：✓ — 安全解析 rawOutput、rawAnswers（JSON.parse catch + 空值检查）
- 推荐项初始预选：✓ — `initSelections()` 中检查 recommended 属性并预选
- useState 状态管理：✓ — `activeTab`, `selections`, `submitted`, `otherTexts` 状态完整
- 无 console.log：✓ — grep 计数 = 0

**面板切换高度固定验证**: 浏览器中 chip 切换时容器高度不跳动，CSS Grid 叠放生效。

### D6 设计系统 (10/100): 5/5

**Automated checks**:
- `var(--)` CSS 变量引用数：74（≥ 10 ✓）
- hardcoded hex/rgb：0 ✓
- box-shadow：0 ✓
- console.log：0 ✓

**Code verification**:
- 所有颜色：`var(--bg1)`, `var(--bg2)`, `var(--bg3)`, `var(--info-bg)`, `var(--info-t)`, `var(--success-bg)`, `var(--success-t)`, `var(--b1)`, `var(--t1)`, `var(--t2)`, `var(--t3)` — 全部 CSS 变量
- 边框：`0.5px solid var(--b1)` ✓
- 圆角：`var(--r)` / `var(--rl)` 和 `20px`（pill 形状 chips）✓
- 零 box-shadow ✓
- 暗色模式：通过 CSS 变量自动适配 ✓

### D7 持久化链路 (15/100): 3/5

**Code-level verification (PASS)**:
- `useAgentChat.ts` line 318：`includeToolEvents=true` ✓
- `ChatCoreContext.tsx` lines 148-188：toolEvents → contentBlocks 重建逻辑 ✓
  - 过滤 `evt.phase !== 'end'` ✓
  - 映射 `toolUseId → toolId`, `toolName`, `toolInput`, `toolOutput` ✓
  - 传递给 `buildContentBlocksFromSdkBlocks()` ✓

**Browser-level verification (FAIL)**:
- 提交后刷新页面 → 重新登录 → 加载 session
- screenshot 18 (persistence-top-view.png)：**AskUserQuestion Widget 未渲染**
- 只显示文字 "好的！在生成题目之前，我需要确认几个出题参数：" 和用户回复 "混合出题 · 分层（含3个难度）"
- SubmittedView（绿色选中、淡化未选、汇总 footer）**完全缺失**
- 可能原因：API 返回的 toolEvents 中 AskUserQuestion 的 toolOutput 为空，或重建逻辑未正确识别该工具

**Hard cap**: SubmittedView 刷新后不渲染 → max 3/5

## Penalty 扣分明细
| Rule | Count | Details | Deduction |
|------|-------|---------|-----------|
| 修改 frozen 文件 | 0 | `useAgentChat.ts` 和 `ChatCoreContext.tsx` 均在允许范围内；`tokens.css` 为未暂存的其他 harness 改动 | 0 |
| hardcoded 颜色值 | 0 | grep 计数 = 0 | 0 |
| console.log 残留 | 0 | grep 计数 = 0 | 0 |
| box-shadow 使用 | 0 | grep 计数 = 0 | 0 |

Penalty 小计: 0

## 维度汇总
| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| D1 Chips 行 | 12 | 5/5 | 12.0 |
| D2 选项+交互 | 22 | 4/5 | 17.6 |
| D3 Footer+提交 | 12 | 5/5 | 12.0 |
| D4 Preview 分栏 | 12 | 3/5 | 7.2 |
| D5 面板+状态 | 17 | 5/5 | 17.0 |
| D6 设计系统 | 10 | 5/5 | 10.0 |
| D7 持久化链路 | 15 | 3/5 | 9.0 |
| **维度小计** | | | **84.8** |
| Penalties | | | **0** |

## 浏览器截图清单

| # | 文件名 | 描述 |
|---|--------|------|
| 01 | 01-initial-widget-state.png | Widget 初始态（chips + 选项 + footer） |
| 04 | 04-after-js-click-mixed.png | 选择"混合出题"后自动跳转难度 tab |
| 05 | 05-both-answered-ready-submit.png | 两个问题都回答，按钮激活 |
| 06 | 06-chip-switch-back.png | Chip 切换回题型面板 |
| 08 | 08-other-input-auto-select.png | Other 输入自动勾选验证 |
| 09 | 09-submitted-state.png | 提交后锁定、绿色、汇总 footer |
| 10 | 10-submitted-top-view.png | 提交后完整视图 |
| 18 | 18-persistence-top-view.png | **刷新后 Widget 未渲染**（D7 FAIL） |

## Top 3 未解决问题

1. **D7 持久化失败**: 刷新页面后 AskUserQuestion Widget 完全不渲染。toolEvents → contentBlocks 重建链路在代码层正确，但实际运行时 SubmittedView 不出现。可能是 API 未返回 toolOutput、或 `buildContentBlocksFromSdkBlocks()` 未正确处理重建后的 AskUserQuestion ToolBlock。
2. **D4 Preview 无法浏览器验证**: AI Skill 返回的 questions 不包含 `preview: true`，导致 Preview 分栏模式无法在实际环境中测试。需要修改 Skill prompt 或构造测试数据来验证。
3. **D2 推荐功能无法浏览器验证**: AI Skill 返回的 options 不含 `recommended: true`，导致推荐 badge 和默认预选无法浏览器确认。代码实现看起来正确，但缺少实际运行验证。

## 改进建议（供 Generator 参考）

1. **修复 D7 持久化**: 排查 `buildContentBlocksFromSdkBlocks()` 对历史 toolEvents 重建后的 AskUserQuestion ToolBlock 的处理。检查 `postprocessor.ts` 中 `toolName === 'AskUserQuestion'` 的匹配逻辑是否对重建的 block 生效。验证 API 返回的 `toolEvents[].toolOutput` 是否包含 `answers` 字段。可以通过 curl 请求直接检查：`GET /api/v1/sessions/{id}/messages?includeToolEvents=true`。
2. **确保 Preview 可测试**: 在 AuqTestHarness 中添加一个包含 `preview: true` 的测试问题，或修改 AI Skill 的 prompt 让它在某些场景返回 preview 模式的 question。这样 evaluator 可以通过测试 harness 验证 preview 分栏。
3. **确保推荐可测试**: 同上，在 AI Skill 的 AskUserQuestion 调用中添加 `recommended: true` 到某些选项（如"中等"难度），或在 AuqTestHarness 中确保推荐选项存在。

总分: 85/100
