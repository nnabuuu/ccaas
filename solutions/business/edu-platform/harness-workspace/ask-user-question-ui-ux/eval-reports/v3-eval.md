# Evaluation Report — v3

## Pre-Scoring Gate
- frontend tsc --noEmit: **PASS** (automated check confirmed)

## 维度评分

### D1 Chips 行 (12/100): 5/5

**代码分析:**
- Pill 形状: `borderRadius: 20` — 匹配原型 ✅
- 状态圆点: `chipDot` 6x6 circle, 默认 `var(--t3)`, answered 切换 `var(--success-t)` ✅
- 已选值文本: `chipVal` with `maxWidth: 80`, `textOverflow: 'ellipsis'` ✅
- 点击切换: `onClick={() => setActiveTab(i)}` + `activeTab` state ✅
- 当前高亮: `chipActive` = `bg1 background + b1 border` ✅
- chips 栏底部边框: `borderBottom: '0.5px solid var(--b1)'` + `bg2` 背景 ✅
- 提交后锁定: `pointerEvents: 'none'`, color 调整 ✅

**浏览器验证（截图 07, 08）:**
- 题型 chip 显示 "选择题" 已选值 + 绿色圆点 ✅
- 难度 chip 切换为 active 高亮 ✅
- 值文本实时更新 ✅

---

### D2 选项+交互 (22/100): 4/5

**代码分析:**
- Radio indicator: `borderRadius: '50%'` + inner circle 8px ✅
- Checkbox indicator: `borderRadius: 4` + SVG checkmark ✅
- `multiSelect` 条件分支: radio 互斥 / checkbox toggle ✅
- 选中样式: `info-bg` + `info-t` 边框 ✅
- 推荐 badge: `{opt.recommended && <span style={S.recBadge}>推荐</span>}` ✅
- 推荐默认预选: `initSelections` 正确找 `recommended` 项 ✅
- 自动跳转: `setTimeout 200ms` 跳下一未答 tab（仅单选） ✅
- Other 区域: `dashed` 边框 + 始终可见 `<input>` ✅
- Other 自动勾选: 输入时自动选中，清空取消（单选模式） ✅
- Chip 值实时更新: `getDisplayValue` ✅

**浏览器验证（截图 04, 06, 07, 08）:**
- Radio indicator 可见，圆形 ✅
- 点击 "选择题" → 蓝色 info 选中样式 ✅
- 自动跳转到 "难度" tab（200ms 延迟） ✅
- Other 区域：虚线边框 + 输入框可见 ✅
- ⚠️ 推荐 badge 未显示 — 后端数据中 "(推荐)" 在 label 文本里而非 `recommended: true` 属性

**扣分原因:** 推荐 badge 代码正确但浏览器中未被触发（后端数据格式问题），无法验证推荐预选和 badge 视觉。

---

### D3 Footer+提交 (12/100): 5/5

**代码分析:**
- 进度文本: `<span style={S.progressDone}>{answeredCount}</span> / {questions.length} 已回答` ✅
- 绿色高亮: `progressDone` = `color: 'var(--success-t)'` ✅
- 按钮 disabled: `disabled={!allAnswered}` ✅
- 提交调用: `onSubmitAction({ label: summary, prompt: summary })` → `handleAction` ✅
- 提交后: `setSubmitted(true)` ✅
- 选中项: `optSubmittedSelected` = `success-bg + success-t` ✅
- 未选中: `opacity: 0.3` ✅
- 汇总文字: `✓ {summaryParts.join(' · ')}` ✅
- 按钮消失: `{!submitted && (... button ...)}` ✅

**浏览器验证（截图 07, 08, 10）:**
- 进度 "0 / 2 已回答" → "1 / 2 已回答" → "2 / 2 已回答" ✅
- 按钮从 disabled 变 enabled ✅
- 提交后选中项绿色，未选中 opacity 降低 ✅
- Footer 显示 "✓ 选择题 · 中等" ✅
- 按钮消失 ✅

---

### D4 Preview 分栏 (12/100): 3/5

**代码分析:**
- `preview` 条件: `hasPreview = questions.some(q => q.preview === true)` ✅
- Grid 分栏: `gridTemplateColumns: '1fr 1fr'` when hasPreview ✅
- 预览区域: `previewPane` = `gridColumn: 2`, 等宽字体 SF Mono, `bg2` 背景, 左边框 ✅
- `previewContent` 读取: `opt?.previewContent || ''` ✅
- 选项切换 → 预览更新: `getPreviewContent()` callback ✅
- Other 输入 → 自定义预览: `"根据你的描述：\n\n"${sel.otherText}"\n\nAI 将据此生成。"` ✅
- SubmittedView 中也有 preview 逻辑 ✅

**浏览器验证:**
- ❌ 未能验证 — 本次测试的后端数据不包含 `preview: true` 的问题，无法触发 Preview 模式

**扣分原因:** 代码实现完整，但浏览器中未触发 Preview 模式，按评分标准 "代码中有实现但截图未验证" → max 3/5。

---

### D5 面板+状态 (17/100): 4/5

**代码分析:**
- CSS Grid 叠放: `gridRow: 1, gridColumn: 1` 所有 panel ✅
- Opacity 切换: `opacity: isVis ? 1 : 0`, `pointerEvents: isVis ? 'auto' : 'none'` ✅
- Phase 过滤: `if (block.phase !== 'end') return <span style={{ display: 'none' }} />` ✅
- toolOutput.answers: `rawAnswers = rawOutput?.answers`，非空检查后渲染 SubmittedView ✅
- 推荐预选: `initSelections` 正确实现 ✅
- useState: `activeTab`, `selections`, `submitted` ✅
- console.log: 0 ✅

**浏览器验证（截图 04, 06, 07, 08, 10）:**
- 面板切换无高度跳动（grid 叠放正确） ✅
- Phase 过滤工作（start-phase 返回 hidden span） ✅
- 三种状态流转: 初始 → 交互 → 已提交 ✅
- ⚠️ 推荐项初始预选未在浏览器中观察到（后端数据 `recommended` 字段缺失）
- ⚠️ 同一消息中出现两个 AskUserQuestion widget — 这是后端调用了工具两次（"使用了 3 个工具" 中有两个 ask_user_question），非组件 phase 过滤问题

**Hard cap 检查:**
- 无 phase 过滤 → max 2/5: **不触发**（phase 过滤存在且正确）
- 面板切换高度跳动 → max 3/5: **不触发**（grid 叠放正确）

**扣分原因:** 推荐预选代码正确但浏览器中未生效（后端数据问题）。

---

### D6 设计系统 (10/100): 5/5

**自动化检查:**
- Hardcoded 颜色 (#hex/rgb): **0** ✅
- console.log: **0** ✅
- box-shadow: **0** ✅
- CSS 变量引用 (var(--): **74** (远超 ≥10 阈值) ✅

**代码分析:**
- 所有颜色通过 CSS 变量: `var(--bg1)`, `var(--info-bg)`, `var(--success-bg)`, `var(--t1)`, `var(--t2)`, `var(--t3)`, `var(--b1)` ✅
- 边框: `0.5px solid var(--b1)` 全局一致 ✅
- 圆角: `var(--r)` (8px), `var(--rl)` (12px), 20px for pill chips (合规特殊值) ✅
- 零 box-shadow ✅
- 暗色模式: 通过 CSS 变量自动适配 ✅
- `fontFamily: 'inherit'` on button/input ✅

---

### D7 持久化链路 (15/100): 3/5

**代码分析:**
- `useAgentChat.ts` L318: `includeToolEvents=true` 已添加到 loadMessageHistory URL ✅
- `ChatCoreContext.tsx` L148-186: toolEvents → contentBlocks 重建逻辑完整 ✅
  - 提取 `rawToolEvents`，过滤 `phase === 'end'`
  - 映射 `toolName`, `toolId` (from `toolUseId`), `toolInput`, `toolOutput`, `success`, `duration`
  - 调用 `buildContentBlocksFromSdkBlocks(reconstructed, false)` 重建
- SubmittedView: 正确从 `toolOutput.answers` 渲染已提交状态 ✅

**浏览器验证:**
- ❌ 提交后刷新页面 → 重新登录后点击 session → 显示欢迎屏而非历史对话（截图 12, 13）
- ❌ SubmittedView 刷新后未渲染 — session 历史未加载

**API 验证:**
- core backend `GET /sessions?limit=5` 返回空 conversations 列表 — session 数据可能在 edu-backend 侧

**Hard cap:**
- SDK 不传 includeToolEvents → max 1/5: **不触发**（SDK 已传）
- SubmittedView 刷新后不渲染 → max 3/5: **触发** — 刷新后 session 历史不加载

**扣分原因:** 持久化链路代码（SDK 参数 + 重建逻辑）完整正确，但端到端流程不通——页面刷新后 session 历史不加载，导致 SubmittedView 无法恢复。可能是 session 加载 flow 的更上层问题。

---

## Penalty 扣分明细

| Rule | Count | Details | Deduction |
|------|-------|---------|-----------|
| 修改 frozen 文件 | 0 | `ChatCoreContext.tsx` 和 `useAgentChat.ts` 在允许范围内；`tokens.css` 为 unstaged 且与本组件无关（pre-existing） | 0 |
| hardcoded 颜色 | 0 | grep 确认 | 0 |
| console.log 残留 | 0 | grep 确认 | 0 |
| box-shadow 使用 | 0 | grep 确认 | 0 |

Penalty 小计: **0**

## 维度汇总

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| D1 Chips 行 | 12 | 5/5 | 12.0 |
| D2 选项+交互 | 22 | 4/5 | 17.6 |
| D3 Footer+提交 | 12 | 5/5 | 12.0 |
| D4 Preview 分栏 | 12 | 3/5 | 7.2 |
| D5 面板+状态 | 17 | 4/5 | 13.6 |
| D6 设计系统 | 10 | 5/5 | 10.0 |
| D7 持久化链路 | 15 | 3/5 | 9.0 |
| **维度小计** | | | **81.4** |
| Penalties | | | **0** |

## 浏览器验证截图索引

| 截图 | 文件 | 内容 |
|------|------|------|
| S1 | 01-existing-session.png | 已有 session 加载（底部） |
| S2 | 02-session-top.png | 已有 session 顶部（上次提交结果） |
| S3 | 03-ai-response-initial.png | 新消息 AI 响应初始态 |
| S4 | 04-widget-expanded.png | 展开工具 → widget 初始态可见 |
| S5 | 05-scroll-bottom-duplicate.png | 发现两个重复 widget |
| S6 | 06-after-option-click.png | 选择 "选择题" 后自动跳转 |
| S7 | 07-auto-advanced-to-difficulty.png | 跳转到难度 tab，chips 显示已选值 |
| S8 | 08-all-answered.png | 选择 "中等"，2/2 已回答，按钮激活 |
| S9 | 09-after-submit.png | 提交后 AI 生成试题 |
| S10 | 10-submitted-top-view.png | 已提交态：绿色选中、淡化未选、✓汇总 |
| S11 | 11-after-refresh.png | 刷新后跳回登录页 |
| S12 | 12-after-refresh-session-loaded.png | 重新登录后显示欢迎页 |
| S13 | 13-persistence-test.png | 点击 session 仍显示欢迎页 |

## Top 3 未解决问题

1. **Preview 模式无法在浏览器中验证** — 后端出题组卷 Skill 未发送 `preview: true` 的问题数据。代码完整但需要实际触发 Preview 分栏的 Skill 场景（如备课助手）来验证。（D4 = 3/5）

2. **刷新后 session 历史不加载** — 持久化链路代码（`includeToolEvents=true` + `toolEvents → contentBlocks` 重建）完整，但页面刷新后重新登录点击 session 显示欢迎页而非历史对话。需排查：① session 选择后的 SSE 连接建立逻辑 ② loadMessageHistory 是否被正确触发 ③ 消息列表是否正确渲染。（D7 = 3/5）

3. **推荐项预选未在浏览器中生效** — `initSelections` 正确查找 `recommended: true` 并预选，但后端数据将 "(推荐)" 嵌入 label 文本而非设置 `recommended` 属性。需要后端 Skill 配置正确发送 `recommended: true` 字段。（影响 D2 和 D5）

## 改进建议（供 Generator 参考）

1. **确保后端 Skill 发送 `recommended: true`** — 修改出题组卷 Skill 的 AskUserQuestion 数据，确保推荐选项设置 `recommended: true` 属性（而非在 label 中写 "(推荐)"）。这将同时修复预选和 badge 显示。具体位置: `skills/exam-generator/SKILL.md` 中的 ask_user_question 示例数据。

2. **排查 session 历史加载** — 刷新后 session 不加载可能是因为：(a) SSE 连接未在 session 切换时正确建立；(b) `useAgentChat` 的 `loadMessageHistory` 依赖 `connection.connected` 但连接未就绪。检查 `frontend/src/App.tsx` 中 session 切换时的连接参数传递流程。

3. **消除重复 widget** — AI 调用了 ask_user_question 两次（"使用了 3 个工具"），导致两个独立 widget。需检查 Skill prompt 中是否有重复调用逻辑，或者在组件层面对同一消息中的多个相同 tool 调用做去重处理。

总分: 81/100
