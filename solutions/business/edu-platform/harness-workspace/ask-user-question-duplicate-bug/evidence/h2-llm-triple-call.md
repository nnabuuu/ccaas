# Hypothesis H2: LLM 连续调用 AskUserQuestion 导致 3 个不同 tool_use 事件

## Verification Steps (actually executed)

1. 基于 H1 证据（bypassPermissions → 空 tool_result）推断 LLM 行为
2. 分析 React SDK 事件累积逻辑确认每个 toolId 独立处理
3. 无法执行运行时验证（V2.1 — SSE 事件流抓取），基于代码分析推断

## Collected Evidence

### H1 证据链推断

From `h1-cli-auto-accept.md`:
- CLI 使用 `--permission-mode bypassPermissions`
- AskUserQuestion 是 Claude Code 内置工具
- bypassPermissions 下 AskUserQuestion 自动返回空/默认 tool_result
- Backend 不向 stdin 写入任何 tool_result

**推断**:
1. LLM 调用 AskUserQuestion → CLI 自动接受 → 返回空 tool_result
2. LLM 看到空 tool_result → 可能认为调用失败或用户未回答
3. LLM 重试 → 再次空 tool_result → 再次重试
4. LLM 放弃等待，自行选择默认值并继续

### React SDK 证据 (useAgentChat.ts:178-189)

每个 tool_use 事件有独立 toolId。React SDK 的去重是按 toolId 的：
- 3 次 AskUserQuestion 调用 → 3 个不同 toolId → 3 个独立 block
- 这与用户看到 "3 个完全相同的交互面板" 的症状一致

### 前端证据

AskUserQuestionRenderer 对每个 phase='end' block 渲染 1 个 Widget：
- 3 个不同 toolId 的 block → 3 个 Widget → 3 个相同面板（因为 toolInput 内容相同）

## Judgment: CONFIRMED (by inference, needs runtime verification)

## Rationale

虽然未执行运行时 SSE 事件流抓取（V2.1），但基于以下证据链可以高度确信：

1. **H1 已确认**: bypassPermissions → AskUserQuestion 自动返回空结果
2. **H3 已确认**: LLM 自行选择使用 AskUserQuestion（Skill 未指导）
3. **LLM 行为模式**: 当工具返回空结果时，LLM 常见的行为是重试
4. **前端表现**: 3 个相同面板 = 3 个不同 toolId（如果是同一 toolId 前端会 update 而非新增）
5. **最终 LLM 自行选择**: 3 次重试后 LLM 放弃等待，自行填入答案 → 用户看到自动继续

**待运行时验证**: 启动全栈，触发出题流程，抓取 SSE 事件流确认 toolId 数量。

## Root Cause Description

LLM 调用 AskUserQuestion → bypassPermissions 自动返回空 tool_result → LLM 重试 2 次（共 3 次调用）→ 每次产生不同 toolId 的 tool_activity 事件 → 前端各渲染 1 个 Widget → 用户看到 3 个相同面板。最终 LLM 放弃等待，自行选择默认值并继续执行。

## Suggested Fix Direction

- **根本修复**: 实现 AskUserQuestion 的 human-in-the-loop（H1 修复方向）
- **缓解措施**: Skill Prompt 禁止使用 AskUserQuestion（H3 修复方向）
- **防御层**: 前端对同一 assistant turn 内相同 toolName 的多次调用做合并展示
