# Investigation Harness Specification

## Symptom

在 edu-platform 的出题流程中，发送"帮我出5道关于全等三角形判定的题"后：

1. **AskUserQuestion Widget 重复渲染 3 次** — 同一组问题（题型/难度/题量）在一条 AI 消息中出现 3 个完全相同的交互面板
2. **LLM 未等待用户选择即自动继续** — LLM 自行决定"混合出题 + 分层 + 5题"并继续执行，用户还没操作 Widget

## Expected Behavior

1. AskUserQuestion Widget 只渲染 1 次
2. Widget 出现后 LLM 暂停，等待用户实际选择
3. 用户提交后 LLM 才继续执行出题

## Reproduction Steps

1. 启动 edu-platform 全栈（core backend:3001 + edu backend:3011 + frontend:5290）
2. 以教师身份登录，进入备课会话
3. 发送消息 "帮我出5道关于全等三角形判定的题"
4. 观察 AI 回复中 AskUserQuestion Widget 出现次数
5. 观察 LLM 是否在用户选择前就自动继续执行

## Code Path

```
用户发送 "出题" 消息
  → backend: completion-orchestration.service.ts 路由到 CLI 进程
    → cli-process.service.ts: spawn Claude Code CLI 子进程
      → CLI (Claude Code): 执行 Skill prompt (quiz-generator)
        → LLM 决定调用 AskUserQuestion 工具
          → CLI 处理 tool_use → 发送 tool_activity(start) SSE 事件
          → CLI 内部处理 AskUserQuestion → ❓ headless 模式下如何获取输入？
          → CLI 发送 tool_result → 发送 tool_activity(end) SSE 事件
        → LLM 看到 tool_result → 继续生成（或重试）

Frontend:
  → useAgentChat 接收 SSE tool_activity 事件
    → ChatCoreContext 转换为 ContentBlock[]
    → postprocessor.ts: buildContentBlocksFromSdkBlocks 处理 tool blocks
    → AskUserQuestionRenderer 渲染 Widget
```

**关键断点**:
1. `cli-process.service.ts` — CLI spawn 参数 + stdin 写入逻辑
2. `event-mapper.service.ts` — tool_activity 事件发射处
3. `postprocessor.ts:buildContentBlocksFromSdkBlocks` — sdkBlocks 输入处
4. `AskUserQuestionRenderer.tsx` — 渲染入口处

## Hypotheses (ranked by likelihood)

### H1: CLI headless 模式自动接受 AskUserQuestion (Likelihood: high)

- **Claim**: Backend 启动 Claude Code CLI 时传了 `--yes` 或 `--dangerouslySkipPermissions` 等标志，导致 AskUserQuestion 在无用户输入的情况下自动返回空/默认结果
- **Verification method**:
  1. 读 `packages/backend/src/sessions/cli-process.service.ts`，找到 spawn/exec CLI 的代码
  2. 检查命令行参数列表中是否包含 auto-accept 相关标志
  3. 检查 stdin 写入逻辑：当 CLI 发送 AskUserQuestion tool_use 时，backend 是否向 stdin 写入了响应
- **Expected evidence if TRUE**: spawn 参数中存在 `--yes` / `--dangerouslySkipPermissions` 或类似 auto-accept 标志；或 stdin 写入了自动响应
- **Expected evidence if FALSE**: 无 auto-accept 标志，且无 stdin 自动响应逻辑
- **Files to inspect**:
  - `packages/backend/src/sessions/cli-process.service.ts`
  - `packages/backend/src/sessions/completion-orchestration.service.ts`

### H2: LLM 连续调用 AskUserQuestion 导致 3 个不同 tool_use 事件 (Likelihood: high)

- **Claim**: AskUserQuestion tool_result 为空/自动填充 → LLM 认为调用失败 → 重试 → 产生 3 个不同 toolId 的 tool_use 事件 → 前端各渲染 1 个 Widget → 共 3 个
- **Verification method**:
  1. 抓取完整 SSE 事件流，筛选 tool_activity 事件
  2. 统计 AskUserQuestion 相关事件的 toolId 数量
  3. 检查每个 tool_result 的内容
- **Expected evidence if TRUE**: 存在 3 个不同 toolId 的 AskUserQuestion tool_activity 事件
- **Expected evidence if FALSE**: 只有 1 个 toolId，前端却渲染了 3 次
- **Files to inspect**:
  - `packages/backend/src/sessions/event-mapper.service.ts`
  - `packages/react-sdk/src/hooks/useAgentChat.ts`

### H3: quiz-generator Skill Prompt 未限制 AskUserQuestion 使用 (Likelihood: high)

- **Claim**: quiz-generator SKILL.md 使用 `show_info_card` + `actions` 模式收集参数，但完全不提 AskUserQuestion。LLM 在可用工具列表中看到 AskUserQuestion（Claude Code 内置），自行决定使用它而非 show_info_card
- **Verification method**:
  1. 读 quiz-generator SKILL.md，确认无 AskUserQuestion 引用
  2. 检查 CLI 工具列表中是否包含 AskUserQuestion
  3. 对比 show_info_card 和 AskUserQuestion 的功能重叠度
- **Expected evidence if TRUE**: SKILL.md 无 AskUserQuestion 相关内容 + CLI 工具列表包含它 → LLM 有机会自行使用
- **Expected evidence if FALSE**: SKILL.md 明确引用了 AskUserQuestion
- **Files to inspect**:
  - `solutions/business/edu-platform/skills/quiz-generator/SKILL.md`
  - `packages/backend/src/sessions/cli-process.service.ts`（工具列表配置）

### H4: 前端 postprocessor 事件去重失败 (Likelihood: medium)

- **Claim**: postprocessor.ts 或 ChatCoreContext.tsx 的去重逻辑有 bug，同一个 tool_use 事件被错误地处理为多个 ContentBlock
- **Verification method**:
  1. 读 `postprocessor.ts` 的 `buildContentBlocksFromSdkBlocks`，分析去重逻辑
  2. 读 `ChatCoreContext.tsx` 中 tool_activity 事件的处理路径
  3. 检查是否存在 event dedup 机制（基于 toolId 或 eventId）
- **Expected evidence if TRUE**: 缺少 toolId 去重逻辑，或去重条件有 bug（如比较错误的字段）
- **Expected evidence if FALSE**: 去重逻辑正确，bug 在上游
- **Files to inspect**:
  - `packages/chat-interface/src/harness/postprocessor.ts`
  - `packages/chat-interface/src/context/ChatCoreContext.tsx`
  - `packages/react-sdk/src/hooks/useAgentChat.ts`

## Evidence Collection Plan

按信息价值排序（便宜的文件读取优先，运行时验证后做）：

### V1.1 — CLI spawn 参数审计 (targets H1)
- **Action**: 读 `cli-process.service.ts`，找到 spawn 调用，记录完整参数列表
- **Look for**: `--yes`, `--dangerouslySkipPermissions`, `--no-confirm`, `auto-accept` 相关字符串
- **If found**: H1 CONFIRMED — CLI 自动接受是直接原因
- **If not found**: 继续 V1.2

### V1.2 — CLI stdin 写入逻辑审计 (targets H1)
- **Action**: 在 `cli-process.service.ts` 中搜索 stdin 写入逻辑，特别是对 AskUserQuestion 的响应
- **Look for**: `process.stdin.write`, `child.stdin.write`, 或任何向 CLI 进程发送数据的代码
- **If found**: H1 CONFIRMED — backend 自动响应了 AskUserQuestion
- **If not found**: H1 可能 ELIMINATED（除非有其他 auto-accept 机制）

### V3.1 — Skill Prompt 审计 (targets H3)
- **Action**: 读 `quiz-generator/SKILL.md`，搜索 `AskUserQuestion` 关键词
- **Look for**: 是否有 AskUserQuestion 的使用指导或禁止指令
- **If not found**: H3 部分 CONFIRMED — Prompt 未限制导致 LLM 自行使用
- **If found**: H3 ELIMINATED

### V4.1 — 前端去重逻辑审计 (targets H4)
- **Action**: 读 `postprocessor.ts` 和 `ChatCoreContext.tsx`，分析 tool block 去重逻辑
- **Look for**: 基于 toolId 的去重机制是否存在且正确
- **If missing/broken**: H4 CONFIRMED
- **If correct**: H4 ELIMINATED

### V2.1 — SSE 事件流抓取 (targets H2, runtime)
- **Action**: 启动全栈，触发出题流程，抓取 SSE 事件流
- **Look for**: AskUserQuestion tool_activity 事件的 toolId 数量
- **If 3 different toolIds**: H2 CONFIRMED — LLM 确实调用了 3 次
- **If 1 toolId**: H2 ELIMINATED — 问题在前端

## Agent Architecture

### Investigator
- **Role**: 按假设优先级逐一验证，收集代码和运行时证据。不修复 bug，只定位根因。
- **Perspective**: 系统性调试者 — 用证据验证假设，做出明确判断
- **Input**: SPEC.md（症状 + 假设 + 代码路径 + 验证步骤）, progress.md, evidence/
- **Output**: `evidence/h{N}-{hypothesis-name}.md` per hypothesis + `root-cause-report.md`
- **Isolation**: Fresh context per round (mandatory)
- **Key constraint**: 每轮只验证 1 个假设。不跳到修复。

## Exit Conditions

- **Root cause confirmed**: 至少 1 个假设状态为 CONFIRMED，有代码证据支持
- **Max rounds**: 4（每轮验证 1 个假设，对应 H1-H4）
- **Dead end**: 所有假设 ELIMINATED → 生成 `evidence/new-hypotheses.md` + 请求人工介入
- **Combination root cause**: 多个假设 CONFIRMED → 在 root-cause-report.md 中描述交互关系

## Modifiable Files

调查阶段只读，不修改任何源代码文件。Investigator 只有 `Read,Grep,Glob,Bash` 权限。

如需运行时验证（V2.1），通过 Bash 启动服务和抓取事件，不改代码逻辑。

## Frozen Files

以下文件在调查阶段**绝对不能修改**：

- `packages/backend/src/**` — 所有 backend 源码
- `packages/chat-interface/src/**` — 所有 chat-interface 源码
- `packages/react-sdk/src/**` — 所有 react-sdk 源码
- `solutions/business/edu-platform/**` — 所有 edu-platform 源码（除 harness-workspace/）
