# 会话持久化架构

本文档解释 CCAAS 如何实现会话持久化，使用户能够在页面刷新后继续会话。

> **📚 初次了解消息模型?** 阅读 [理解消息模型](./CONVERSATION_PERSISTENCE_IMPLEMENTATION_STATUS.md#理解消息模型) 以获得关于 Session、Message、Turn 和 ConversationContext 实体的全面解释，包含可视化图表和数据流。

## 概述

CCAAS 使用前端驱动的持久化模型，其中 `conversationId` 存储在租户作用域的 `localStorage` 中，消息历史在重新连接时自动从后端加载。

```
页面加载
  |
  v
useAgentConnection({ tenantId })
  |
  +--> 检查 localStorage 中的 ccaas_session_{tenantId}
  |      |
  |      +--> 找到: 使用保存的 conversationId
  |      +--> 未找到: 生成 conv_{uuid}，保存到 localStorage
  |
  +--> 使用 conversationId 连接 WebSocket
  |
  v
useAgentChat({ connection, tenantId })
  |
  +--> GET /api/v1/sessions/{conversationId}/messages?limit=100
  |
  +--> 填充 messages[] 状态
  |
  v
用户看到之前的会话
```

## 关键概念

### 会话 vs 运行时会话

| 概念 | 作用域 | 生命周期 | ID 格式 |
|------|-------|---------|---------|
| **会话 (Conversation)** | 用户端，持久化 | 直到用户创建新会话 | `conv_{uuid}` |
| **运行时会话 (RuntimeSession)** | 后端进程 | 30 分钟空闲 TTL，然后回收 | 内部 |

单个会话可以跨越多个运行时会话。当运行时会话因不活动而过期时，同一会话中的下一条消息会触发新的运行时会话，但会话(及其消息历史)会持久保留。

### 租户隔离

每个 `tenantId` 都有自己的 localStorage 键和会话作用域:

```
localStorage:
  ccaas_session_default                    -> conv_abc123    (ccaas-demo)
  ccaas_session_lesson-plan-designer       -> conv_def456    (lesson-plan-designer)
```

在同一源上运行的不同解决方案不共享会话。

## 前端集成指南

### 步骤 1: 启用持久化

在 `useAgentConnection` 中用 `tenantId` 替换 `sessionPrefix`:

```typescript
// 之前 (临时会话)
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  sessionPrefix: 'my-app',
})

// 之后 (持久会话)
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  tenantId: 'my-app',
})
```

### 步骤 2: 显示加载状态

`useAgentChat` 在获取消息历史时返回 `isLoadingHistory`:

```typescript
const chat = useAgentChat({ connection, tenantId: 'my-app' })

if (chat.isLoadingHistory) {
  return <LoadingSpinner text="加载会话中..." />
}
```

### 步骤 3: 添加"新会话"按钮

使用 `clearConversation()` 开始新会话:

```typescript
<button onClick={() => chat.clearConversation()}>
  新会话
</button>
```

`clearConversation()` 做三件事:
1. 清除本地消息状态
2. 从 localStorage 删除 conversationId
3. 生成新的 `conv_{uuid}`，断开连接并重新连接

### 步骤 4: 挂载时强制新会话 (可选)

如果您的解决方案应始终重新开始 (例如，一次性向导):

```typescript
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  tenantId: 'my-wizard',
  forceNewConversation: true,
})
```

## 后端 APIs

### 消息历史

```
GET /api/v1/sessions/{conversationId}/messages?limit=100
```

按时间顺序返回消息。`limit` 参数限制返回的消息数量(默认: 100)。

### 会话元数据

```
GET /api/v1/admin/sessions/{conversationId}
```

返回会话元数据，包括 `messageCount`、`totalTokens`、`estimatedCost`、`createdAt`、`lastActivity`。

## localStorage 格式

**键**: `ccaas_session_{tenantId}`
**值**: `conv_{uuid}` (纯字符串，不是 JSON)

SDK 使用安全的 localStorage 包装器，优雅地处理:
- localStorage 禁用 (隐私浏览)
- 存储配额超出
- 权限错误

localStorage 中仅存储 conversationId，从不存储消息内容。这最大程度降低了 XSS 暴露风险。

## 从旧 SDK 用法迁移

### 之前 (v1.x 模式)

```typescript
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  sessionPrefix: 'my-app',
})

const chat = useAgentChat({ connection, tenantId: 'my-app' })

// 手动重启
const restart = () => {
  chat.clearMessages()
}
```

### 之后 (v2.x 模式与持久化)

```typescript
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  tenantId: 'my-app',  // 从 sessionPrefix 更改
})

const chat = useAgentChat({ connection, tenantId: 'my-app' })

// 正确的新会话 (清除存储 + 重新连接)
const newConversation = () => {
  chat.clearConversation()
}
```

**关键区别**:
- `sessionPrefix` 被 `tenantId` 替换 (选择加入持久化)
- `clearMessages()` 仍然存在，仅用于清除 UI (保持同一会话)
- `clearConversation()` 是用于开始新会话的新方法
- `isLoadingHistory` 是用于显示加载指示器的新状态
- `connection.startNewConversation()` 可用于更低级的控制

## 故障排除

### 刷新后消息不持久

1. 验证 `tenantId` 已提供给 `useAgentConnection` (不是 `sessionPrefix`)
2. 在浏览器 DevTools 中检查 localStorage: 查找 `ccaas_session_{tenantId}`
3. 验证后端从 `GET /api/v1/sessions/{id}/messages` 返回消息

### 加载时间过长

消息历史端点的默认限制为 100 条消息。对于长会话，旧消息会被截断。这是设计使然，以防止性能问题。

### 会话在解决方案之间泄漏

确保每个解决方案使用唯一的 `tenantId`。在同一源上具有相同 `tenantId` 的两个解决方案将共享会话。

### localStorage 不可用

当 localStorage 不可用时 (隐私浏览，权限被阻止)，SDK 优雅地回退到临时会话。不会抛出错误。
