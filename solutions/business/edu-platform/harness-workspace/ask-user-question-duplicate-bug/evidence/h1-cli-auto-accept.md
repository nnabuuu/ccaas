# Hypothesis H1: CLI headless 模式自动接受 AskUserQuestion

## Verification Steps (actually executed)

1. 读 `packages/backend/src/sessions/cli-process.service.ts`，找到 spawn 调用和完整参数列表
2. 搜索 `--yes`, `--dangerouslySkipPermissions`, `--no-confirm` 等 auto-accept 标志
3. 检查 stdin 写入逻辑：backend 是否向 CLI stdin 写入 AskUserQuestion 的响应
4. 搜索 backend 中所有 AskUserQuestion 相关代码

## Collected Evidence

### CLI Spawn 参数 (cli-process.service.ts:68-73)

```typescript
const args: string[] = [
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--verbose',
  '--permission-mode', 'bypassPermissions',
];
```

**关键发现**: 没有 `--yes` 标志，但使用了 `--permission-mode bypassPermissions`。

Resume 模式 (lines 179-185) 同样使用 `bypassPermissions`。

### stdin 写入逻辑 (cli-process.service.ts:478)

```typescript
const canWrite = session.stdin.write(jsonMessage + '\n');
```

Backend **只向 stdin 写入用户消息**（`type: 'user'`），不写入 tool_result。
Tool 执行完全在 Claude Code CLI 内部完成。

### AskUserQuestion 在 Backend 中的引用

Backend 源码中 **零个** AskUserQuestion 引用。无特殊处理、无自动接受逻辑、无 tool_result 合成。

### event-mapper.service.ts:handleSpecialToolResult (lines 1087-1183)

处理 `todo_write` 等特殊工具，但 **无 AskUserQuestion case**。

## Judgment: CONFIRMED (revised)

## Rationale

原假设问的是"是否有 `--yes` 等 auto-accept 标志" — 字面上没有。但 `--permission-mode bypassPermissions` **功能等价**：

- Claude Code 的 `bypassPermissions` 模式会自动接受所有工具调用，包括 AskUserQuestion
- AskUserQuestion 是 Claude Code 内置工具，不是 MCP 工具
- 在 bypassPermissions 模式下，AskUserQuestion 无法暂停等待用户输入 — 它会立即返回空/默认结果
- 这解释了"LLM 没等用户选择就继续"的症状

## Root Cause Description

`--permission-mode bypassPermissions` 导致 CLI 在 headless 模式下自动接受 AskUserQuestion 工具调用，返回空/默认 tool_result，而非暂停等待用户输入。

## Suggested Fix Direction

需要为 AskUserQuestion 实现 human-in-the-loop 机制：
1. CLI 发送 AskUserQuestion tool_use → 通过 SSE 通知前端
2. 前端渲染 Widget → 用户选择
3. 用户提交 → 通过 stdin 写回 CLI → CLI 返回 tool_result
4. 需要新增 backend 的 stdin 写入路径，专门处理 AskUserQuestion 的用户响应
