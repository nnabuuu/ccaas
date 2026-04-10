# Evaluation Criteria — AskUserQuestion Wizard

> 你是一位独立的前端+后端质量审查员。你没有参与代码编写，只评估最终实现。
> 按照以下标准严格评分。E2E 流程必须通过浏览器实际验证。

## Pre-Scoring Gate

**tsc --noEmit + jest 必须通过。** 任一失败则直接 0 分。

```bash
cd packages/backend && npx tsc --noEmit && npx jest --no-coverage
cd packages/chat-interface && npx tsc --noEmit
cd packages/chat-interface && npm run build
cd solutions/business/edu-platform/frontend && npx tsc --noEmit
```

## Scoring Dimensions (6 dimensions, 100 pts)

### D1: control_request E2E 数据流 (Weight: 20/100)

**What to evaluate**: 从 LLM 调用 AskUserQuestion → backend 发射 SSE → 前端渲染 → 用户提交 → LLM 恢复的完整链路。

| Score | Description |
|-------|-------------|
| 5/5 | LLM 调用 AskUserQuestion → backend 日志出现 control_request 处理 → SSE tool_activity(start) 事件到达前端 → ControlRequestView 正确渲染 → 用户提交 → POST /control-response 200 OK → CLI stdin 写入成功 → LLM 收到 JSON answers 继续执行 |
| 4/5 | 数据流完整但有 1 处非阻塞问题（如 SSE 事件延迟、LLM 继续时有 warning） |
| 3/5 | 数据流 80% 完成但提交后 LLM 未正确恢复（重试或报错） |
| 2/5 | SSE 事件到达但 ControlRequestView 不渲染，或 POST 失败 |
| 1/5 | control_request 事件未被 EventMapper 处理（SSE 无事件） |

**Detection method**:
1. 启动全栈，发消息触发 AskUserQuestion
2. 检查 backend 日志: `grep 'control_request' logs` → 期望出现
3. 检查 SSE 事件流: `curl -N /sessions/:id/events` → 期望 tool_activity type
4. 检查浏览器: ControlRequestView 是否渲染
5. 点击提交 → 检查 Network tab POST /control-response → 200
6. 检查 LLM 继续输出（新的 assistant message 出现）

**Hard cap**: 无浏览器验证 → max 2/5

---

### D2: ControlRequestView 默认 UI (Weight: 15/100)

**What to evaluate**: 无 wizard config 匹配时的默认交互界面质量。

| Score | Description |
|-------|-------------|
| 5/5 | 与 ask-user-question-ui-ux harness v6 的 widget 视觉一致；问题+选项正确渲染；选择后确认提交调 /control-response；提交成功后显示已选摘要+锁定状态；错误时显示重试 |
| 4/5 | 交互正确但视觉与 v6 有明显差异（间距、颜色不匹配） |
| 3/5 | 可选择+提交但缺少已提交状态或错误处理 |
| 2/5 | 渲染了但选择或提交功能有 bug |
| 1/5 | 不渲染或渲染崩溃 |

**Detection method**:
1. 触发一个**无 wizard config 的** AskUserQuestion（如 quiz-generator skill）
2. 检查渲染的选项列表是否正确
3. 选择 → 提交 → 检查 POST 调用
4. 检查已提交状态渲染
5. CSS 变量使用: `grep -c 'var(--' AskUserQuestionRenderer.tsx` ≥ 10

---

### D3: WizardRenderer 通用框架 (Weight: 20/100)

**What to evaluate**: WizardRenderer 的视觉、交互、状态管理。

| Score | Description |
|-------|-------------|
| 5/5 | Step indicator 有清晰的数字+标题+状态色（当前/完成/待处理）；前进/后退按钮功能正确；已完成步骤可点击跳回；FormStep select/text 输入正常+contextKey 自动填充生效；dependsOn 未满足时显示提示；最终提交收集所有 answers；全部 CSS 变量+无 shadow |
| 4/5 | 框架正确但 step indicator 视觉粗糙或 contextKey 填充未生效 |
| 3/5 | 多步切换正常但缺少状态区分或 dependsOn 检查 |
| 2/5 | 只有单步渲染，步骤切换不工作 |
| 1/5 | 组件不渲染或崩溃 |

**Detection method**:
1. 触发备课向导 → 检查 step indicator 渲染
2. 检查 Step 1 的 select fields 是否正确渲染
3. 选择后点击"下一步" → 是否跳到 Step 2
4. 点击"上一步" → 是否回到 Step 1 且保留选择
5. 检查 contextKey 自动填充: sessionContext.subject → Step 1 学科 select 预选
6. `grep -c 'box-shadow' WizardRenderer.tsx` → 期望 = 0
7. `grep -c 'var(--' WizardRenderer.tsx` → 期望 ≥ 5

---

### D4: TreeSelect + DataReview 动态步骤 (Weight: 15/100)

**What to evaluate**: 章节树选择和学情分析数据渲染。

| Score | Description |
|-------|-------------|
| 5/5 | TreeSelectStep 从 API 获取数据+渲染可展开树+checkbox 全选/单选；DataReviewStep 从 API 获取数据+渲染进度条+emphasis toggle；Loading 状态有 spinner；API 失败有错误信息+重试；Mock 数据兜底可用 |
| 4/5 | 两个步骤都渲染正确但缺少 loading 或错误处理 |
| 3/5 | 一个步骤正确，另一个有明显 bug |
| 2/5 | 渲染了但数据获取失败且无 fallback |
| 1/5 | 两个步骤都不渲染 |

**Detection method**:
1. 在备课向导中进入 Step 2 → 检查章节树是否出现
2. 展开/折叠节点 → 勾选 checkbox
3. 进入 Step 3 → 检查学情数据是否出现
4. 切换 emphasis toggle → 检查状态变化
5. 断网测试 → 检查错误提示和重试按钮

**Hard cap**: TreeSelectStep 数据获取失败且无 fallback → max 2/5

---

### D5: SummaryStep + 提交确认 (Weight: 10/100)

**What to evaluate**: 最终摘要展示和提交流程。

| Score | Description |
|-------|-------------|
| 5/5 | 摘要分步显示所有选择（步骤标题+key-value）；可点击跳回修改；确认按钮绿色强调；提交后按钮变 loading → 成功 → 面板显示"已提交" |
| 4/5 | 摘要正确但无跳回功能或提交动画 |
| 3/5 | 有摘要但格式粗糙或缺少部分步骤的显示 |
| 2/5 | 摘要不完整或确认按钮不工作 |
| 1/5 | 无 SummaryStep 实现 |

**Detection method**:
1. 完成 Step 1-3 → 进入 Step 4
2. 检查摘要内容是否包含所有步骤的选择
3. 点击某步骤摘要 → 是否跳回该步骤
4. 点击确认 → 检查按钮状态变化
5. 检查 POST /control-response 是否发送

---

### D6: 备课向导 4 步流程 (Weight: 20/100)

**What to evaluate**: lesson-plan wizard 的端到端完整体验。

| Score | Description |
|-------|-------------|
| 5/5 | 发送"帮我备课" → AI 调用 AskUserQuestion(header="备课向导") → 前端渲染 4 步向导 → Step 1 contextKey 自动填充 → Step 2 章节树可交互 → Step 3 学情数据+emphasis → Step 4 摘要确认 → 提交后 LLM 继续生成教案 → 教案内容基于用户选择 |
| 4/5 | 4 步流程完整但某个步骤有视觉/交互小问题 |
| 3/5 | 4 步可走完但提交后 LLM 不继续或忽略 answers |
| 2/5 | 向导渲染了但某些步骤不可用（如 TreeSelect 崩溃） |
| 1/5 | 向导不渲染（registry 匹配失败或 control_request 不触发） |

**Hard cap**: 无浏览器验证 → max 2/5
**Hard cap**: LLM 不恢复执行 → max 3/5

**Detection method**:
1. 登录教师 → 发送"帮我备课"
2. 等待 AI 调用 AskUserQuestion → 检查向导渲染
3. 完成 4 步 → 截图每一步
4. 点击确认 → 等待 LLM 响应
5. 检查 LLM 生成的教案是否引用了用户选择的参数

---

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 修改 frozen SubmittedView | -10 | git diff 显示修改了 ask-user-question-ui-ux 的 SubmittedView 代码 |
| hardcoded 颜色值 | -1 per instance | grep hex/rgb in wizard components |
| console.log 残留 | -2 per instance | grep in wizard/AskUserQuestionRenderer |
| box-shadow 使用 | -2 per instance | grep box-shadow in wizard components |
| bypassPermissions 行为变化 | -15 | Bash/Read/Write 工具不再自动放行 |
| tsc/jest regression | -20 | 引入新的类型错误或测试失败 |

## Score Calculation

1. 每个维度: `(score / 5) x weight`
2. 基础分: 6 个维度加权分之和
3. **总分 = 基础分 - Penalty 扣分**（满分 100，最低 0）
4. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Thresholds

- **Pass**: 60/100
- **Target**: 90/100
- **Estimated baseline**: ~20/100（架构已实现但未经 E2E 验证，组件未打磨）
