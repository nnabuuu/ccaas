# Evaluation Criteria — AskUserQuestion Widget

> 你是一位独立的前端质量审查员。你没有参与代码编写，只评估最终实现。
> 按照以下标准严格评分。视觉标准以 `ask-user-question.html` 原型为准。

## Pre-Scoring Gate

**tsc --noEmit 必须通过。** 失败则直接 0 分，跳过所有维度评估。

```bash
cd solutions/business/edu-platform/frontend && npx tsc --noEmit
```

## Scoring Dimensions (7 dimensions, 100 pts)

### D1: Header Chips 行 (Weight: 12/100)

**What to evaluate**: 多问题导航 chips 是否匹配原型 `.auq-chips` 区域。

| Score | Description |
|-------|-------------|
| 5/5 | Pill 形状 chips 排列正确；状态圆点（灰=未答/绿=已答）可见且颜色正确；已选值文本在回答后显示（含 ellipsis 截断）；点击切换面板生效；当前 chip 有高亮背景+边框；chips 栏有底部边框分隔 |
| 4/5 | Chips 基本正确但缺少已选值显示或状态圆点 |
| 3/5 | 有 chips 但样式严重偏离原型（无 pill 形状、无高亮） |
| 2/5 | 有多问题概念但 chips 不可交互 |
| 1/5 | 无 chips 导航，所有问题平铺显示 |

**Detection method**:
1. 读 `AskUserQuestionRenderer.tsx` 检查 chips 结构
2. 检查 `chip-dot` 或等价状态指示元素
3. 检查 chip 点击 → 面板切换逻辑
4. 检查 answered chip 的值文本显示
5. 浏览器截图对比

---

### D2: 选项列表 + 交互 (Weight: 22/100)

**What to evaluate**: 选项卡片、indicator、推荐、Other、自动跳转是否匹配原型。

| Score | Description |
|-------|-------------|
| 5/5 | Radio/Checkbox indicator 正确（圆形/方形）；选中状态=info 色边框+背景+实心 indicator；推荐 badge 可见且默认预选；单选自动跳转下一未答 tab（~200ms）；Other 虚线边框+始终可见输入框+打字自动勾选；选择变化实时更新 chip 已选值 |
| 4/5 | 选项交互正确但缺少推荐 badge 或自动跳转 |
| 3/5 | 选项可点击但 indicator 样式不对（如无 radio/checkbox 区分），或 Other 区域缺失 |
| 2/5 | 选项存在但交互逻辑有 bug（如多选当单选处理） |
| 1/5 | 选项不可交互或渲染崩溃 |

**Hard cap**: 无 Other 输入区域 → max 3/5

**Detection method**:
1. 检查 radio vs checkbox indicator 渲染逻辑（`multiSelect` 字段）
2. 检查 `recommended` 选项的 badge 和默认预选逻辑
3. 检查自动跳转逻辑（setTimeout ~200ms 跳下一未答 tab）
4. 检查 Other 区域：虚线边框 `dashed`，输入框 `<input>` 始终渲染，`oninput` 自动勾选
5. 浏览器交互验证

---

### D3: Footer + 提交流程 (Weight: 12/100)

**What to evaluate**: 进度计数、确认按钮、已提交状态是否匹配原型。

| Score | Description |
|-------|-------------|
| 5/5 | 进度文本 "X / N 已回答" 绿色高亮已回答数；按钮在全部回答后激活（disabled→enabled）；点击确认后 Widget 锁定（选项不可点、chip 不可切、Other 只读）；选中项变 success 绿色；未选中淡化 opacity；Footer 显示 "✓ 值1 · 值2 · 值3" 汇总 |
| 4/5 | 进度和按钮逻辑正确但已提交状态视觉不完整（如未选中未淡化） |
| 3/5 | 有确认按钮但进度计数不准或已提交状态样式不匹配 |
| 2/5 | 可提交但无进度显示，或已提交后 Widget 未锁定 |
| 1/5 | 无 footer 区域或提交功能不工作 |

**Detection method**:
1. 检查 answered count 计算逻辑
2. 检查 button disabled 条件
3. 检查提交后的 `submitted` 状态样式（锁定、变绿、汇总文字）
4. 检查 `handleAction` 调用是否正确发送汇总
5. 浏览器提交流程验证

---

### D4: Preview 分栏模式 (Weight: 12/100)

**What to evaluate**: 左右分栏布局、预览内容、实时切换是否匹配原型。

| Score | Description |
|-------|-------------|
| 5/5 | `preview: true` 时面板变为左右分栏；右侧等宽字体+浅灰背景+边框分隔；切换选项时右侧预览实时更新；Other 输入时预览显示自定义内容；非 preview 问题不分栏 |
| 4/5 | 分栏布局正确但预览内容更新有延迟或格式不对 |
| 3/5 | 有分栏但右侧预览为静态（不随选项切换） |
| 2/5 | 有 preview 相关代码但布局错乱 |
| 1/5 | 无 Preview 分栏实现 |

**Detection method**:
1. 检查 `preview` 属性的条件渲染逻辑
2. 检查 CSS grid 分栏 `grid-template-columns: 1fr 1fr`
3. 检查选项切换 → 预览更新联动
4. 浏览器截图验证分栏布局

---

### D5: 面板高度 + 状态管理 (Weight: 17/100)

**What to evaluate**: 面板叠放固定高度、三种状态流转、数据流集成。

| Score | Description |
|-------|-------------|
| 5/5 | CSS Grid 叠放所有面板（grid-row:1/grid-column:1）高度固定不跳动；opacity 切换可见面板；初始态推荐项预选+chip 绿点；交互态选择实时更新；`phase !== 'end'` 返回隐藏元素；`toolOutput.answers` 非空时渲染已提交态；组件无 console.log 残留 |
| 4/5 | 状态管理正确但面板不是固定高度（切换时页面跳动） |
| 3/5 | 状态管理基本正确但 phase 过滤不完整（如 start+end 都渲染） |
| 2/5 | 有状态概念但初始化/提交逻辑有 bug |
| 1/5 | 无状态管理，或组件不渲染 |

**Hard cap**: 无 phase 过滤（同一问题渲染两次）→ max 2/5
**Hard cap**: 面板切换导致容器高度跳动 → max 3/5

**Detection method**:
1. 检查 `block.phase !== 'end'` guard
2. 检查 CSS Grid `grid-row: 1; grid-column: 1` 面板叠放
3. 检查 `opacity` 切换（vis 面板 opacity:1，其余 opacity:0 + pointer-events:none）
4. 检查 `toolOutput.answers` 解析逻辑（安全访问，非空检查）
5. 检查推荐项的初始预选 state
6. `grep 'console.log' AskUserQuestionRenderer.tsx` → 必须 = 0

---

### D6: 设计系统一致性 (Weight: 10/100)

**What to evaluate**: CSS 变量使用、设计 token 匹配 edu-platform 规范。

| Score | Description |
|-------|-------------|
| 5/5 | 所有颜色通过 CSS 变量（`--bg1`, `--info-bg`, `--success-bg` 等）；边框 `0.5px solid var(--b1)`；圆角 `var(--r)` / `var(--rl)`；零 box-shadow；暗色模式下所有颜色可读 |
| 4/5 | CSS 变量为主，有 1-2 处 hardcoded 值 |
| 3/5 | CSS 变量体系存在但部分颜色 hardcoded |
| 2/5 | 大量 hardcoded hex/rgb |
| 1/5 | 无 CSS 变量使用 |

**Detection method**:
1. `grep -c '#[0-9a-fA-F]\{3,6\}' AskUserQuestionRenderer.tsx` — 期望 = 0
2. `grep -c 'rgb\|rgba' AskUserQuestionRenderer.tsx` — 期望 = 0（仅 CSS 变量引用可接受）
3. `grep -c 'box-shadow' AskUserQuestionRenderer.tsx` — 期望 = 0
4. `grep -c 'var(--' AskUserQuestionRenderer.tsx` — 期望 ≥ 10
5. 检查与 DESIGN_SYSTEM.md 的一致性

---

### D7: 持久化链路 (Weight: 15/100)

**What to evaluate**: 提交后刷新 conversation，Widget 是否正确还原已提交状态。

| Score | Description |
|-------|-------------|
| 5/5 | SDK 传 includeToolEvents=true；历史消息重建 contentBlocks 含 toolOutput；刷新后 SubmittedView 正确渲染（绿色选中、淡化未选、汇总 footer）；多选/Other 均可恢复 |
| 4/5 | 链路正确但重建的 contentBlocks 缺少部分字段（如 duration, description）|
| 3/5 | SDK 传了参数但 contentBlocks 重建逻辑有 bug（部分工具无法恢复）|
| 2/5 | 有 includeToolEvents 但未重建 contentBlocks（toolEvents 数据浪费）|
| 1/5 | 无任何持久化改动，刷新后显示空白交互表单 |

Hard cap: SDK 不传 includeToolEvents → max 1/5
Hard cap: AskUserQuestion 的 SubmittedView 刷新后不渲染 → max 3/5

**Detection method**:
1. **API 验证**: curl GET /sessions/:id/messages?includeToolEvents=true → 检查 toolEvents[].toolOutput 非空
2. grep 'includeToolEvents' useAgentChat.ts — 期望匹配
3. 检查 toolEvents → contentBlocks 重建逻辑
4. **浏览器验证**: 提交 → 刷新 → 截图对比 → SubmittedView 是否渲染

---

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 修改 frozen 文件 | -10 per file | `git diff --name-only -- packages/` |
| hardcoded 颜色值 | -1 per instance | grep hex/rgb in component |
| console.log 残留 | -2 per instance | grep in component |
| box-shadow 使用 | -2 per instance | grep box-shadow |
| 未使用 import | -0.5 per instance | tsc warnings |

## Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 基础分: 七个维度加权分之和
3. **总分 = 基础分 - Penalty 扣分**（满分 100，最低 0）
4. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Browser Verification Requirement

**MANDATORY**: 每轮评估必须通过 Playwright 浏览器实际交互验证。

评估流程：
1. 打开 edu-platform frontend
2. 登录教师账户
3. 发消息触发 AskUserQuestion（"帮我出5道关于全等三角形判定的题"）
4. 截图初始态 → 与 HTML 原型视觉对比
5. 实际点击：选项选择、chip 切换、Other 输入
6. 截图交互过程（每个关键步骤）
7. 点击确认提交 → 截图已提交状态
8. 保存所有截图到 `screenshots/v{N}/`

**无浏览器验证时**: D1-D5 每个维度 max 3/5（无法确认运行时行为）

## Thresholds

- **Pass**: 65/100
- **Target**: 95/100
- **Estimated baseline**: ~15/100（当前实现仅有扁平选项列表，无 chips/Other/preview/提交流程）
