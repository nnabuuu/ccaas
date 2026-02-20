# SSE Transport（Server-Sent Events）

即见Agentic 使用 **SSE（Server-Sent Events）** 作为默认 transport。所有实时事件通过标准 HTTP 连接流式传输，无需 WebSocket 或 Socket.IO。

> **推荐做法**：直接使用 React SDK（`@kedge-agentic/react-sdk`）而非手动处理 SSE 流。SDK 封装了所有连接管理、事件解析和状态逻辑。
>
> 仅在构建非 React 客户端（如原生 iOS/Android、CLI 工具、Python 脚本）时才需要直接使用本 API。

---

## 端点总览

| 方法 | 路径 | 用途 |
|------|------|------|
| `POST` | `/api/v1/sessions/:sessionId/messages` | 发送消息，接收 SSE 事件流（每轮对话） |
| `GET` | `/api/v1/sessions/:sessionId/events` | 订阅推送频道（跨轮次，持续连接） |
| `POST` | `/api/v1/sessions/:sessionId/cancel` | 取消当前正在执行的任务 |

---

## POST /messages — 发送消息

每次用户发送消息时调用此端点。响应是一个 SSE 流，包含本次对话轮次的所有事件，轮次结束后连接自动关闭。

### 请求

```
POST /api/v1/sessions/:sessionId/messages
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "message": "用户消息内容",
  "tenantId": "default",
  "apiKey": "sk-..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | ✅ | 用户消息内容 |
| `tenantId` | string | ✅ | 租户 ID |
| `apiKey` | string | ❌ | API Key（也可通过 `Authorization: Bearer` header 传递） |

### 响应格式

响应头：`Content-Type: text/event-stream`

每个事件占一行，以 `data: ` 开头，事件间以空行分隔：

```
data: {"type":"agent_status","status":"running","sessionId":"my-session","timestamp":"..."}

data: {"type":"text_delta","delta":"你好","sessionId":"my-session"}

data: {"type":"agent_status","status":"complete","sessionId":"my-session","timestamp":"..."}

```

轮次结束时连接关闭（无需客户端断开）。

### curl 示例

```bash
curl -N -X POST http://localhost:3001/api/v1/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "请帮我写一份报告", "tenantId": "default"}'
```

---

## GET /events — 推送频道（持续连接）

订阅长连接推送频道，接收跨轮次的后台任务完成通知（`subagent_started` / `subagent_completed`）。

**与 `/messages` 的区别：**

| | `POST /messages` | `GET /events` |
|---|---|---|
| 生命周期 | 单次对话轮次 | 跨轮次，持续连接 |
| 事件类型 | 全部事件 | 仅 subagent 事件 |
| 用途 | 接收 AI 响应流 | 监听后台任务完成 |

### 请求

```
GET /api/v1/sessions/:sessionId/events
Accept: text/event-stream
```

### 使用场景

当 AI 使用 `Task` 工具触发后台任务（`run_in_background: true`）时，`POST /messages` 的轮次会立即结束，但任务仍在后台执行。任务完成时，通知会通过 `GET /events` 推送：

```
data: {"type":"subagent_started","sessionId":"my-session","payload":{"subAgentId":"toolu_01ABC","agentType":"Task","description":"生成教案","status":"running"}}

# 几分钟后...
data: {"type":"subagent_completed","sessionId":"my-session","payload":{"subAgentId":"toolu_01ABC","status":"completed","durationMs":45000}}
```

### curl 示例

```bash
# 保持连接，等待后台任务通知
curl -N http://localhost:3001/api/v1/sessions/my-session/events \
  -H "Accept: text/event-stream"
```

---

## POST /cancel — 取消任务

取消当前正在执行的对话轮次。

### 请求

```
POST /api/v1/sessions/:sessionId/cancel
Content-Type: application/json
```

```json
{
  "tenantId": "default"
}
```

### curl 示例

```bash
curl -X POST http://localhost:3001/api/v1/sessions/my-session/cancel \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "default"}'
```

---

## 事件参考

所有事件遵循同一基础结构：

```typescript
interface FrontendEvent {
  type: string
  sessionId: string
  timestamp?: string  // ISO 8601
}
```

### agent\_status

Agent 执行状态变化。

```typescript
{
  type: 'agent_status'
  sessionId: string
  timestamp: string
  status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error' | 'cancelled'
  error?: string  // status='error' 时
}
```

`isProcessing = status in ['thinking', 'running', 'exploring', 'executing']`

### text\_delta

AI 文本流式输出片段。拼接所有 `delta` 即为完整回复。

```typescript
{
  type: 'text_delta'
  sessionId: string
  delta: string
}
```

### output\_update

结构化输出更新（适用于表单同步场景）。

```typescript
{
  type: 'output_update'
  sessionId: string
  payload: {
    data: {
      field: string        // 字段名
      value: unknown       // 新值
      operation: 'set' | 'append' | 'merge'
    }
    progressive: boolean
    complete: boolean
    status: string
    progress: number
  }
}
```

{% hint style="warning" %}
注意：字段数据在 `event.payload.data` 中，而非 `event` 顶层。
{% endhint %}

### tool\_activity

工具调用活动（读文件、写文件、搜索等）。

```typescript
{
  type: 'tool_activity'
  sessionId: string
  payload: {
    toolId: string
    toolName: string
    phase: 'start' | 'progress' | 'end'
    description: string
    duration?: number   // phase='end' 时
    success?: boolean   // phase='end' 时
  }
}
```

### agent\_thinking

Agent 思考过程（扩展思考模式）。

```typescript
{
  type: 'agent_thinking'
  sessionId: string
  payload: {
    phase: 'start' | 'delta' | 'end'
    content?: string  // phase='delta' 时
  }
}
```

### subagent\_started

后台 Task 工具启动（来自 `/events` 推送频道）。

```typescript
{
  type: 'subagent_started'
  sessionId: string
  timestamp: string
  payload: {
    subAgentId: string    // Tool use ID，如 "toolu_01ABC"
    agentType: string     // 如 "Task"
    description: string   // 任务描述
    startedAt: string     // ISO 8601
    status: 'running'
    nestingLevel: number  // 嵌套层级，通常为 1
  }
}
```

### subagent\_completed

后台 Task 工具完成（来自 `/events` 推送频道）。

```typescript
{
  type: 'subagent_completed'
  sessionId: string
  timestamp: string
  payload: {
    subAgentId: string
    status: 'completed' | 'failed'
    durationMs: number
    error?: string  // status='failed' 时
  }
}
```

### token\_usage

Token 使用统计，每轮结束时发送。

```typescript
{
  type: 'token_usage'
  sessionId: string
  payload: {
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    sessionTotalTokens: number
    sessionInputTokens: number
    sessionOutputTokens: number
    model: string
    stopReason: string
    messageId: string
  }
}
```

### error

错误事件。

```typescript
{
  type: 'error'
  sessionId: string
  code: string
  message: string
  recoverable: boolean
  suggestion?: string
}
```

---

## SSE 解析实现

如果你需要在非 React 环境下手动解析 SSE 流：

```typescript
async function streamMessages(
  serverUrl: string,
  sessionId: string,
  message: string,
  onEvent: (event: any) => void
) {
  const response = await fetch(`${serverUrl}/api/v1/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ message, tenantId: 'default' }),
  })

  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const chunk of parts) {
      const dataLine = chunk.split('\n').find(l => l.startsWith('data:'))
      if (!dataLine) continue
      try {
        const event = JSON.parse(dataLine.slice(5).trim())
        onEvent(event)
      } catch {
        // 忽略解析错误
      }
    }
  }
}
```

---

## React SDK（推荐）

直接使用 React SDK 可跳过以上所有手动处理：

```tsx
import { useAgentConnection, useAgentChat, useAgentStatus } from '@kedge-agentic/react-sdk'

function MyApp() {
  // SSE 是默认 transport
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',  // 必须是绝对 URL
    sessionPrefix: 'my-app'
  })

  // 自动处理 POST /messages SSE 流
  const chat = useAgentChat({ connection, tenantId: 'default' })

  // 自动订阅 GET /events 推送频道（SSE 模式下）
  // 自动处理 subagent_started / subagent_completed 事件
  const status = useAgentStatus({ connection })

  return (
    <div>
      <p>连接状态: {connection.connected ? '已连接' : '未连接'}</p>
      <p>Agent 状态: {status.agentStatus}</p>
      {status.activeSubAgents.map(agent => (
        <p key={agent.subAgentId}>后台任务: {agent.description} ({agent.status})</p>
      ))}
      <button onClick={() => chat.sendMessage('你好')}>发送</button>
    </div>
  )
}
```

- `useAgentChat` — 管理 `POST /messages` 和消息列表
- `useAgentStatus` — 管理 `GET /events` 推送频道和所有 Agent 状态
- `useAgentConnection` — 管理连接生命周期

详细文档：[React SDK 聊天集成](../guide/chat-integration.md)
