# 核心概念

理解这些概念将帮助您使用 KedgeAgentic 构建解决方案。

## Conversation vs Session（对话 vs 会话）

**面向用户的术语**："Conversation"（对话）
**技术术语**："Session"（会话，数据库实体）

**它们是同一个东西** - 只是不同的视角。

- 与用户交流时："开始新对话"
- 在代码中：`Session` 接口，`sessionId` 字段
- 在文档中：两个术语可互换使用

平台使用"Session"作为技术实体名称，因为它代表用户与 AI 代理之间的活动或历史对话会话。

## Session 持久化

会话（对话）通过以下方式持久化：

- **浏览器**：localStorage 在 `ccaas_session_{tenantId}` 键下存储 sessionId
- **后端**：数据库存储所有消息、回合和元数据

当用户刷新页面时：

1. SDK 检查 localStorage 中的 `ccaas_session_{tenantId}`
2. 如果找到，从 `/api/v1/sessions/{sessionId}/messages` 获取消息历史
3. 对话无缝继续

**sessionId 格式**：使用 `tenantId` 启用持久化时，sessionId 遵循 `conv_{uuid}` 格式。例如：`conv_a1b2c3d4-e5f6-7890-abcd-ef1234567890`。

## 消息和回合

### Message（消息）

**Message** 表示来自用户或助手的单个话语。

- 有 `messageIndex`（0, 1, 2, ...）用于排序
- 有 `role`（"user" 或 "assistant"）
- 有 `content`（文本）
- 有可选的 `metadata`（模型、令牌、停止原因）

**为什么使用 messageIndex？**
使用 `messageIndex` 对消息排序，而不是 `createdAt`。`messageIndex` 是基于 0 的顺序编号，即使 `createdAt` 时间戳相同也能保证消息顺序。

**示例**：
```typescript
const message: Message = {
  id: "msg_123",
  sessionId: "conv_abc",
  role: "assistant",
  content: "你好！",
  messageIndex: 1,
  metadata: {
    model: "claude-opus-4.5",
    totalTokens: 150,
    stopReason: "end_turn"
  },
  createdAt: "2026-02-15T10:00:00Z"
}
```

### Turn（回合）

**Turn** 表示对话中的一次完整交互。

- 用户消息（偶数索引）+ 助手响应（奇数索引）
- 示例：Turn 0 = Message[0]（用户）+ Message[1]（助手）
- 用于分析：每回合令牌数、每回合成本

**为什么需要 Turn？**
Turn 支持按交互分析和成本跟踪。不是在整个会话中聚合令牌，而是可以分析每个单独的问答对的性能和成本。

**示例**：
```typescript
const turn: Turn = {
  id: "turn_123",
  sessionId: "conv_abc",
  turnNumber: 0,
  userMessageId: "msg_0",
  assistantMessageId: "msg_1",
  totalTokens: 250,
  durationMs: 1500,
  createdAt: "2026-02-15T10:00:00Z",
  completedAt: "2026-02-15T10:00:01.5Z"
}
```

## ConversationContext（对话上下文）

**ConversationContext** 在会话开始时捕获"可重现性元数据"。

目的：稍后重现完全相同的对话条件以进行调试。

捕获的元数据：
- 系统提示哈希
- 技能配置
- MCP 工具列表
- 模型版本
- 工作目录

**示例**：
```typescript
const context: ConversationContext = {
  id: "ctx_123",
  sessionId: "conv_abc",
  tenantId: "my-app",
  systemPromptHash: "sha256:abc123...",
  skillConfigHashes: [
    { slug: "code-reviewer", hash: "sha256:def456..." }
  ],
  mcpToolsList: ["read_file", "grep", "bash"],
  model: "claude-opus-4.5",
  createdAt: "2026-02-15T10:00:00Z"
}
```

## Session 状态

| 状态 | 含义 |
|--------|---------|
| `idle` | 无活动处理 |
| `processing` | 代理正在思考/运行 |
| `error` | 处理失败 |
| `completed` | 会话成功完成 |
| `cancelling` | 用户请求取消 |

**注意**：状态为 `completed` 的会话并不意味着它已永久关闭。用户仍然可以发送新消息继续对话。

## 消息分支（未来功能）

`Message` 接口包含用于对话分支的字段：

- `parentMessageId`：链接到此分支来源的消息
- `branchId`：将同一分支中的消息分组

**当前状态**：平台尚未实现，但架构支持未来功能，如探索替代响应。

## 最佳实践

### 消息排序

始终按 `messageIndex` 排序消息：

```typescript
// ✅ 正确
const sortedMessages = messages.sort((a, b) => a.messageIndex - b.messageIndex)

// ❌ 避免
const sortedMessages = messages.sort((a, b) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
)
```

### Session 生命周期

1. **创建会话**：用户打开应用，SDK 创建或恢复会话
2. **加载历史**：如果 sessionId 存在，从后端获取消息
3. **用户交互**：用户发送消息，代理响应
4. **持久化**：SDK 在每条消息时将 sessionId 保存到 localStorage
5. **刷新/重连**：用户刷新页面，SDK 恢复会话

### 成本跟踪

使用 `Turn` 实体进行按交互成本跟踪：

```typescript
// 获取每回合成本
const costPerTurn = turns.map(turn => ({
  turnNumber: turn.turnNumber,
  tokens: turn.totalTokens,
  estimatedCost: turn.totalTokens * COST_PER_TOKEN
}))

// 会话总成本
const totalCost = turns.reduce((sum, turn) =>
  sum + (turn.totalTokens * COST_PER_TOKEN), 0
)
```

## 相关文档

- [对话持久化指南](./conversation-persistence.md) - 详细实现指南
- [React SDK README](../../packages/react-sdk/README.md) - React 集成示例
- [Vue SDK README](../../packages/vue-sdk/README.md) - Vue 集成示例
- [API 参考](../api/README.md) - REST API 文档
