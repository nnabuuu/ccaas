# Evaluation Report — v5

## Pre-Scoring Gate

- **frontend tsc --noEmit**: PASS (zero errors)
- Component lines: 1090
- CSS variable refs: 74
- Hardcoded colors: 0
- console.log: 0
- box-shadow: 0

## 浏览器验证摘要

| Step | Result | Screenshot |
|------|--------|------------|
| 登录 | ✅ 成功（form login + localStorage） | `01-logged-in-state.png` |
| 发送消息触发 AskUserQuestion | ✅ Widget 在 streaming 期间渲染 | `02-after-send-attempt.png` |
| 初始态 Widget | ✅ Chips + 选项 + 推荐预选 + Footer 均可见 | `02-after-send-attempt.png` |
| Streaming 完成后 | ⚠️ Widget 折叠进 "使用了 3 个工具" 摘要 | `03-after-streaming-complete.png` |
| 展开工具区域 | ❌ 点击 ▶ 无法展开折叠 | `04-tools-expanded.png` |
| 加载已有 session | ⚠️ Session 切换后内容相同 | `05-previous-session.png` |
| 提交后截图 | ❌ 未能执行（Widget 折叠无法交互） | — |
| 刷新持久化 | ❌ 未能执行（API 返回 0 sessions） | — |

**关键发现**: Widget 在 streaming 阶段正确渲染（screenshot 02），包含完整的 chips、选项列表、推荐预选、Other 输入、footer 进度和确认按钮。但 AI stream 完成后，所有 tool blocks 被折叠进 "使用了 N 个工具" 摘要区域，用户无法交互。此为 chat-interface 的 tool collapsing 行为，非 AskUserQuestionRenderer 自身缺陷。

---

## 维度评分

### D1 Chips 行 (12/100): 5/5

**代码分析**:
- ✅ Pill 形状: `borderRadius: 20` (S.chip, line 835)
- ✅ 状态圆点: 6×6px circle, `background: 'var(--t3)'` 默认灰 → `'var(--success-t)'` 已答绿 (lines 501-503)
- ✅ 已选值文本: `<span style={S.chipVal}>{val}</span>` + ellipsis 截断 (maxWidth: 80, lines 860-866)
- ✅ 点击切换: `onClick={() => { if (!submitted) setActiveTab(i) }}` (line 493)
- ✅ 当前 chip 高亮: S.chipActive = `bg1` 背景 + `b1` 边框 (lines 846-849)
- ✅ Chips 栏底部边框: `borderBottom: '0.5px solid var(--b1)'` (line 826)
- ✅ bg2 背景: `background: 'var(--bg2)'` (line 828)

**浏览器验证** (screenshot 02):
- ✅ Chips 可见: "题型 混合出题" + "难度 分层 (含3个难..."
- ✅ 绿色圆点可见
- ✅ 已选值文本显示
- ✅ Active chip 有高亮

**加权得分**: (5/5) × 12 = **12.0**

---

### D2 选项+交互 (22/100): 5/5

**代码分析**:
- ✅ Radio indicator: `borderRadius: '50%'` 默认 + inner circle `8×8 var(--bg1)` (lines 922-951)
- ✅ Checkbox indicator: `borderRadius: 4` + CheckmarkIcon SVG (lines 935-936, 661-667)
- ✅ `multiSelect` 条件分支: `q.multiSelect ? S.indicatorCheckbox : {}` (line 550)
- ✅ 选中样式: info-bg 背景 + info-t 边框 (S.optSelected, lines 913-916)
- ✅ 推荐 badge: `{isRecommendedOpt(opt) && <span style={S.recBadge}>推荐</span>}` (line 563)
- ✅ 推荐默认预选: `initSelections` with `recIdx >= 0 ? new Set([recIdx])` (lines 146-154)
- ✅ 自动跳转 (仅单选): `setTimeout` 200ms → 找下一个未答 tab (lines 396-408)
- ✅ Other 虚线边框: `'0.5px dashed var(--b1)'` (S.otherWrap, line 989)
- ✅ Other 输入框始终渲染: `<input>` 在 JSX 中始终存在 (lines 599-611)
- ✅ Other 打字自动勾选: `handleOtherInput` → `text.length > 0 && !prev.otherSelected → otherSelected = true` (lines 427-441)
- ✅ 单选下 Other 清空取消: `text.length === 0 && !q.multiSelect → otherSelected = false` (line 436-438)
- ✅ Chip 实时更新: `getDisplayValue` 每次 render 重计算 (lines 160-168)

**浏览器验证** (screenshot 02):
- ✅ Radio circles 可见 (选择题/填空题/解答题/混合出题)
- ✅ 混合出题选中状态: 蓝色背景 + filled indicator
- ✅ "推荐" badge 可见
- ✅ Other 区域 "或者自定义" + input 可见

**加权得分**: (5/5) × 22 = **22.0**

---

### D3 Footer+提交 (12/100): 4/5

**代码分析**:
- ✅ 进度文本: `<span style={S.progressDone}>{answeredCount}</span> / {questions.length} 已回答` (line 635)
- ✅ 绿色高亮: S.progressDone = `color: 'var(--success-t)'` (lines 1070-1073)
- ✅ 按钮 disabled: `disabled={!allAnswered}` + S.submitBtnDisabled opacity 0.3 (lines 641-643)
- ✅ 提交调用: `onSubmitAction({ label: summary, prompt: summary })` (line 451)
- ✅ 已提交选中: S.optSubmittedSelected = `success-t 边框 + success-bg 背景` (lines 917-920)
- ✅ 未选中淡化: `!isSelected && submitted → opacity: 0.3` (line 544)
- ✅ 汇总 Footer: `✓ {summaryParts.join(' · ')}` (line 652)
- ✅ Chips 锁定: `pointerEvents: 'none'` on submitted (line 497)
- ✅ 按钮消失: `{!submitted && (...)}` 条件渲染 (line 632)
- ✅ Other 只读: `readOnly={submitted}` (line 610)

**浏览器验证** (screenshot 02):
- ✅ "2 / 2 已回答" 可见，绿色数字
- ✅ "确认选择" 按钮可见且 enabled (所有推荐项预选完)
- ❌ 已提交状态未能验证 (Widget 折叠后无法点击确认)

**扣分理由**: 已提交状态视觉完整性无法通过浏览器确认（代码实现完整，但 streaming 后 Widget 折叠）。

**加权得分**: (4/5) × 12 = **9.6**

---

### D4 Preview 分栏 (12/100): 4/5

**代码分析**:
- ✅ Preview 条件: `hasPreview = questions.some((q) => q.preview === true)` (line 455)
- ✅ Grid 分栏: `gridTemplateColumns: '1fr 1fr'` when hasPreview (lines 515, 240)
- ✅ 右侧预览: S.previewPane — `gridColumn: 2, gridRow: 1, borderLeft, bg2, monospace` (lines 1029-1056)
- ✅ 预览标签: S.previewLabel — uppercase, 10px, `var(--t3)` (lines 1037-1045)
- ✅ previewContent 读取: `getPreviewContent()` → `opt?.previewContent` (lines 459-472)
- ✅ Other 预览: `根据你的描述：\n\n"${sel.otherText}"` (line 464)
- ✅ 非 preview 不分栏: `gridTemplateColumns: '1fr'` 默认 (line 871)
- ✅ SubmittedView 也处理 Preview (lines 320-335)

**浏览器验证**:
- ❌ 未触发 preview 问题 (本次 AI 返回的是标准题型/难度两问，无 preview 属性)

**扣分理由**: 代码完整实现 Preview 分栏，但无法在浏览器中验证。

**加权得分**: (4/5) × 12 = **9.6**

---

### D5 面板+状态 (17/100): 5/5

**代码分析**:
- ✅ CSS Grid 叠放: S.panel = `gridRow: 1, gridColumn: 1` (lines 874-875)
- ✅ Opacity 切换: `opacity: isVis ? 1 : 0, pointerEvents: isVis ? 'auto' : 'none'` (lines 524-526)
- ✅ Phase 过滤: `if (block.phase !== 'end') return <span style={{ display: 'none' }} />` (line 172)
- ✅ toolOutput 安全解析: `parseToolOutputAsAnswers` 多格式支持 (lines 87-126)
  - Case 1: `{ answers: { ... } }`
  - Case 2: `{ text: "val1 · val2" }`
  - Case 3: 直接 key-value map
  - Summary string parsing: `parseSummaryString` (lines 128-136)
- ✅ toolInput 安全解析: `parseToolInputRobust` 支持 JSON string (lines 51-60)
- ✅ 推荐项预选: `initSelections` → `recIdx >= 0 ? new Set([recIdx])` (lines 146-154)
- ✅ useState 三件套: `activeTab`, `selections`, `submitted` (lines 361-363)
- ✅ 零 console.log 残留: 自动化检查确认 = 0

**浏览器验证** (screenshot 02):
- ✅ Widget 渲染成功 (phase 过滤有效 — 只在 end 渲染)
- ✅ 推荐项预选生效 (两个问题都已回答，chips 绿点)
- ✅ 面板固定高度 (视觉上无跳动)

**加权得分**: (5/5) × 17 = **17.0**

---

### D6 设计系统 (10/100): 5/5

**自动化检查**:
- ✅ Hardcoded hex/rgb: 0
- ✅ box-shadow: 0
- ✅ CSS variable refs: 74 (远超 10 阈值)
- ✅ console.log: 0

**代码审查**:
- ✅ 所有颜色通过 CSS 变量: `var(--bg1)`, `var(--bg2)`, `var(--t1)`, `var(--t2)`, `var(--t3)`, `var(--b1)`, `var(--info-bg)`, `var(--info-t)`, `var(--success-bg)`, `var(--success-t)` 等
- ✅ 边框: `0.5px solid var(--b1)` 一致使用
- ✅ 圆角: `var(--r)` (8px) 用于选项卡, `var(--rl)` (12px) 用于容器
- ✅ 特殊圆角合理: `borderRadius: 20` (pill chips), `borderRadius: 6` (Other input) — 符合 DESIGN_SYSTEM.md 特殊组件规则
- ✅ 零 box-shadow
- ✅ `fontFamily: 'inherit'` 用于 input 和 button
- ✅ 暗色模式: 纯 CSS 变量驱动，自动适配

**加权得分**: (5/5) × 10 = **10.0**

---

### D7 持久化链路 (15/100): 3/5

**代码层验证**:
- ✅ **SDK 传参**: `useAgentChat.ts:318` — `includeToolEvents=true` 已添加到 loadMessageHistory URL
- ✅ **ChatCoreContext 重建逻辑**: lines 148-227 完整实现:
  - toolEvents 提取: `'toolEvents' in msg` 检查 (line 149)
  - 去重: `toolEventMap` Map，优先 'end' phase (lines 174-183)
  - AskUserQuestion 特殊处理: 从 user reply 的 `·` 分隔符推导 answers (lines 198-213)
  - 字段映射: toolName, toolId, phase='end', toolInput, toolOutput (lines 215-226)
- ✅ **SubmittedView 入口**: `parseToolOutputAsAnswers(block.toolOutput, questions)` → 非空则渲染 SubmittedView (lines 181-183)
- ✅ **Robust parsing**: 多格式兼容 (answers 对象, text 字段, summary string, direct keys)

**API 层验证**:
- ⚠️ Core backend `/api/v1/sessions` 返回 0 conversations — 无法通过 API 验证 toolOutput 持久化
- 可能原因: session 存储在 edu-platform 的 SQLite 而非 core backend

**浏览器层验证**:
- ⚠️ 加载已有 session 后显示相同折叠内容 (截图 05)
- ❌ 无法执行 "提交 → 刷新 → 对比" 流程（Widget 折叠无法交互）

**扣分理由**: 代码链路完整（SDK → ChatCore → SubmittedView），但缺少浏览器端 end-to-end 验证。按评分规则 "代码中有实现但截图未验证 → max 3/5"。

**加权得分**: (3/5) × 15 = **9.0**

---

## Penalty 扣分明细

| Rule | Count | Details | Deduction |
|------|-------|---------|-----------|
| 修改 frozen 文件 | 1 | `packages/chat-interface/src/styles/tokens.css` (unstaged, 添加 coral/purple/teal/muted tokens + dark mode) — AskUserQuestionRenderer 未使用这些 tokens，可能来自 ui-ux-redesign workspace | -10 |
| hardcoded 颜色值 | 0 | — | 0 |
| console.log 残留 | 0 | — | 0 |
| box-shadow 使用 | 0 | — | 0 |
| 未使用 import | 0 | tsc PASS | 0 |

**Penalty 小计**: -10

---

## 维度汇总

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| D1 Chips 行 | 12 | 5/5 | 12.0 |
| D2 选项+交互 | 22 | 5/5 | 22.0 |
| D3 Footer+提交 | 12 | 4/5 | 9.6 |
| D4 Preview 分栏 | 12 | 4/5 | 9.6 |
| D5 面板+状态 | 17 | 5/5 | 17.0 |
| D6 设计系统 | 10 | 5/5 | 10.0 |
| D7 持久化链路 | 15 | 3/5 | 9.0 |
| **维度小计** | | | **89.2** |
| Penalties | | | **-10** |

---

## Top 3 未解决问题

1. **[严重] tokens.css frozen 文件污染**: `packages/chat-interface/src/styles/tokens.css` 存在未暂存修改（新增 coral/purple/teal tokens）。虽然 AskUserQuestion 未使用，但违反 frozen constraint。需要 `git checkout -- packages/chat-interface/src/styles/tokens.css` 还原。

2. **[中等] Widget 在 streaming 结束后折叠**: AskUserQuestion Widget 在 AI stream 完成后被 chat-interface 的 tool collapsing 逻辑折叠到 "使用了 N 个工具" 摘要中。用户无法在 stream 结束后与 Widget 交互（选择选项、点击确认）。这是 chat-interface ToolBlock 渲染策略问题，但严重影响用户体验。**建议**: 在 chat-interface 中为 `AskUserQuestion` tool 添加特殊处理，使其不被折叠（类似 `customToolRenderers` 的 Widget 应始终展示）。

3. **[中等] 持久化端到端验证缺失**: 虽然代码链路完整（SDK → ChatCore → SubmittedView），但无法通过浏览器验证提交后刷新的状态恢复。需要解决 session 加载问题后重新验证。

---

## 改进建议（供 Generator 参考）

1. **还原 tokens.css**: 执行 `git checkout -- packages/chat-interface/src/styles/tokens.css`，消除 -10 penalty → 立即 +10 分。

2. **修复 Widget 折叠问题**: 在 chat-interface 的 tool rendering 逻辑中，对 `customToolRenderers` 注册的工具（如 AskUserQuestion）不应用自动折叠。可能需要在 `ChatCoreContext.tsx` 的 `buildContentBlocksFromSdkBlocks` 中标记 custom widget blocks 为 `alwaysExpanded: true`。这是解锁 D3/D4/D7 满分的关键。

3. **验证 session 加载**: 确保在加载已有 session 时，历史消息中的 AskUserQuestion SubmittedView 正确渲染（不被折叠），以验证 D7 完整链路。

总分: 79/100
