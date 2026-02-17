# WebSocket 事件

{% hint style="danger" %}
**⚠️ 已弃用（Deprecated）**

Socket.IO / WebSocket transport 已弃用。**请使用 SSE transport 替代。**

- 旧端点 `POST /api/v1/sessions/:id/completion` 现返回 **410 Gone**
- 旧端点 `DELETE /api/v1/sessions/:id/completion` 现返回 **410 Gone**
- 新端点：`POST /api/v1/sessions/:id/messages`（SSE 流）、`GET /api/v1/sessions/:id/events`（推送频道）

👉 请参阅 [SSE Transport 参考](sse.md) 和 [React SDK 聊天集成](../guide/chat-integration.md)
{% endhint %}

本页保留供历史参考，记录 Socket.io 时代的事件协议。**新的 Solution 不应使用 Socket.IO。**

---

即见Agentic 使用 Socket.io 进行 WebSocket 通信，提供丰富的实时事件流。

## 连接

```typescript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  auth: {
    token: 'YOUR_API_KEY'  // 可选
  }
})
```

连接成功后，服务端会发送 `client_id` 事件，包含分配给该连接的客户端 ID。

## 客户端 → 服务端事件

### chat

发送聊天消息。

```typescript
socket.emit('chat', {
  message: '用户消息内容',
  sessionId: 'session-uuid'    // 可选
})
```

### cancel

取消正在执行的操作。

```typescript
socket.emit('cancel', {
  sessionId: 'session-uuid'
})
```

### reconnect\_session

恢复之前的会话。

```typescript
socket.emit('reconnect_session', {
  sessionId: 'session-uuid'
})
```

### get\_stats

获取服务端统计信息。

```typescript
socket.emit('get_stats', {}, (stats) => {
  console.log('Sessions:', stats.activeSessions)
})
```

## 服务端 → 客户端事件

### client\_id

连接成功时分配的客户端 ID。

```typescript
socket.on('client_id', (data) => {
  // data: { clientId: 'uuid' }
})
```

### text\_delta

AI 文本流式输出。

```typescript
socket.on('text_delta', (data) => {
  // data: {
  //   type: 'text_delta',
  //   sessionId: 'uuid',
  //   delta: '部分文本...'
  // }
})
```

### agent\_status

Agent 状态变化。

```typescript
socket.on('agent_status', (data) => {
  // data: {
  //   type: 'agent_status',
  //   sessionId?: 'uuid',          // idle 时可省略
  //   timestamp: 'ISO 8601',       // 所有状态均有
  //   status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error' | 'cancelled',
  //   context?: {
  //     currentAction?: string,
  //     currentTarget?: string,
  //     stepsCompleted?: number,
  //     stepsTotal?: number,
  //     percentComplete?: number,
  //     activeSubAgents?: ActiveSubAgent[],
  //     goalNarrative?: object
  //   },
  //   error?: string               // error 状态时的错误消息
  // }
})
```

### tool\_activity

工具使用活动。

```typescript
socket.on('tool_activity', (data) => {
  // data: {
  //   type: 'tool_activity',
  //   sessionId: 'uuid',
  //   toolName: 'write_output',
  //   toolId: 'tool-uuid',
  //   phase: 'start' | 'progress' | 'end',
  //   description: '正在生成教案...',
  //   decisionLogic?: {
  //     why: string,
  //     benefit: string,
  //     nextStep: string
  //   },
  //   duration?: number,
  //   success?: boolean
  // }
})
```

### output\_update

结构化输出更新。

```typescript
socket.on('output_update', (data) => {
  // data: {
  //   type: 'output_update',
  //   sessionId: 'uuid',
  //   payload: {
  //     data: {
  //       field: 'title',
  //       value: '三角形面积计算',
  //       operation: 'set' | 'append' | 'merge'
  //     },
  //     progressive: boolean,
  //     complete: boolean,
  //     status: string,
  //     progress: number
  //   }
  // }
})
```

{% hint style="danger" %}
**注意嵌套结构**：字段数据在 `event.payload.data` 中，而非 `event` 顶层。
{% endhint %}

### todo\_update

任务列表更新。

```typescript
socket.on('todo_update', (data) => {
  // data: {
  //   type: 'todo_update',
  //   sessionId: 'uuid',
  //   todos: [
  //     {
  //       id: 'todo-uuid',
  //       content: '设计教学目标',
  //       status: 'pending' | 'in_progress' | 'completed'
  //     }
  //   ],
  //   summary: {
  //     total: 5,
  //     completed: 2,
  //     inProgress: 1,
  //     pending: 2
  //   }
  // }
})
```

### token\_usage

Token 使用统计。

```typescript
socket.on('token_usage', (data) => {
  // data: {
  //   type: 'token_usage',
  //   sessionId: 'uuid',
  //   inputTokens: number,
  //   outputTokens: number,
  //   reasoningTokens: number,
  //   cachedInputTokens: number,
  //   sessionTotalTokens: number,
  //   estimatedCostUsd: number,
  //   model: string
  // }
})
```

### agent\_thinking

Agent 思考过程。

```typescript
socket.on('agent_thinking', (data) => {
  // data: {
  //   type: 'agent_thinking',
  //   sessionId: 'uuid',
  //   phase: 'start' | 'delta' | 'end',
  //   content: '思考内容...'
  // }
})
```

### error

错误事件。

```typescript
socket.on('error', (data) => {
  // data: {
  //   type: 'error',
  //   sessionId: 'uuid',
  //   code: string,
  //   message: string,
  //   recoverable: boolean,
  //   suggestion?: string
  // }
})
```

### session\_restored

会话恢复成功。

```typescript
socket.on('session_restored', (data) => {
  // data: { sessionId: 'uuid', status: 'restored' }
})
```

### session\_not\_found

会话未找到。

```typescript
socket.on('session_not_found', (data) => {
  // data: { sessionId: 'uuid' }
})
```
