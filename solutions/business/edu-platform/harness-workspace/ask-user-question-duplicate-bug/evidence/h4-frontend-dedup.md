# Hypothesis H4: 前端 postprocessor 事件去重失败

## Verification Steps (actually executed)

1. 读 `packages/react-sdk/src/hooks/useAgentChat.ts`，分析 tool_activity 事件累积逻辑
2. 读 `packages/chat-interface/src/harness/postprocessor.ts`，分析 buildContentBlocksFromSdkBlocks 去重逻辑
3. 读 `packages/chat-interface/src/context/ChatCoreContext.tsx`，分析 streaming vs historical 消息处理路径

## Collected Evidence

### React SDK: 事件累积 (useAgentChat.ts:178-189)

```typescript
if (payload.phase === 'start') {
  blocks.push({ type: 'tool', tool: toolActivity })
} else if (payload.phase === 'end') {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    if (block && block.type === 'tool' && block.tool.toolId === toolActivity.toolId) {
      blocks[i] = { type: 'tool', tool: toolActivity }  // UPDATE existing
      break
    }
  }
}
```

**React SDK 有 toolId 去重**: start 时 push，end 时向后扫描匹配 toolId 并 update。
如果收到 3 个**不同 toolId** 的 AskUserQuestion，每个都会被正确 push 为独立 block。

### Postprocessor: 无 streaming 去重 (postprocessor.ts:154-229)

```typescript
for (let i = 0; i < sdkBlocks.length; i++) {
  const block = sdkBlocks[i]
  // ... 线性遍历，每个 block 直接 push 到 contentBlocks
  contentBlocks.push({
    type: 'tool_use',
    toolName: block.tool.toolName,
    toolId: block.tool.toolId || `tool-${i}`,
    // ...
  })
}
```

**Postprocessor 无去重**: 线性遍历所有 sdkBlocks，每个都转为 ToolUseBlock。如果 sdkBlocks 有 3 个 AskUserQuestion block（3 个不同 toolId），就会生成 3 个 ToolUseBlock。

### AskUserQuestion 是 ALWAYS_VISIBLE_TOOLS (postprocessor.ts:116-118)

```typescript
const ALWAYS_VISIBLE_TOOLS = new Set([
  'AskUserQuestion',
])
```

每个 AskUserQuestion 'end' 事件会被额外包裹空文本分隔符，强制 inline 渲染。

### ChatCoreContext: 两条路径 (ChatCoreContext.tsx)

**Streaming 路径 (lines 152-156)** — 无去重:
```typescript
if (msg.role === 'assistant' && sdkBlocks && sdkBlocks.length > 0) {
  const result = buildContentBlocksFromSdkBlocks(sdkBlocks, isStreaming)
  contentBlocks = result.contentBlocks
}
```

直接传 sdkBlocks 到 postprocessor，无 toolId 去重。

**Historical 路径 (lines 157-231)** — 有去重:
```typescript
const toolEventMap = new Map<string, Record<string, unknown>>()
for (const te of toolEventsArr) {
  const id = (evt.toolUseId ?? evt.id ?? '') as string
  const phase = evt.phase as string
  const existing = toolEventMap.get(id)
  if (!existing || phase === 'end') {
    toolEventMap.set(id, evt)
  }
}
```

历史消息用 Map 按 toolId 去重，保留 'end' phase。

### AskUserQuestionRenderer (AskUserQuestionRenderer.tsx:171-186)

```typescript
export const askUserQuestionRenderer: ToolRenderer = (block) => {
  if (block.phase !== 'end') return <span style={{ display: 'none' }} />
  // 渲染逻辑...
}
```

渲染器层**无去重**: 对每个 phase='end' 的 AskUserQuestion block 都渲染 Widget。

## Judgment: CONFIRMED (with nuance)

## Rationale

前端去重机制**只存在于历史消息路径**，streaming 路径完全没有。

但这不是 "去重失败"（原假设），而是 "去重未实现"。真正的问题链条是：

1. LLM 调用了 3 次 AskUserQuestion（每次不同 toolId）→ H2 相关
2. React SDK 正确地将每次调用作为独立 block 累积（因为 toolId 不同）
3. Postprocessor 线性处理，每个 block → 1 个 ToolUseBlock → 1 个 Widget
4. 结果: 3 个 Widget

如果 LLM 只调用了 1 次，前端就只会渲染 1 次。前端逻辑在"每个 toolId 渲染 1 次"的设计下是**正确的**。

**问题不在前端去重，而在 LLM 的多次调用 + bypassPermissions 的空结果返回。**

## Root Cause Description

前端 streaming 路径没有跨 toolId 的去重机制（因为设计上每个 toolId 就应该渲染一个 Widget）。当 LLM 因 bypassPermissions 获得空 tool_result 而重试 3 次时，前端正确渲染了 3 个 Widget — 这是预期行为的结果，不是 bug。

真正的 fix 应在 LLM 层（不重试）或 backend 层（暂停等待用户输入），而非前端去重。

## Suggested Fix Direction

前端可以添加"同一 turn 内相同 toolName 的去重"作为防御层，但根本解决需要在 backend/CLI 层实现 AskUserQuestion 的 human-in-the-loop。
