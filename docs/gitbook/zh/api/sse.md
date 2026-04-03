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
| `POST` | `/api/v1/sessions/:sessionId/control-response` | 提交用户对交互式提示的回答 |

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
| `enabledSkills` | string[] | ❌ | 指定启用的 Skill slug 列表；不传时自动加载租户下所有已启用的 Skill |
| `appendSystemPrompt` | string | ❌ | 追加到系统提示词末尾的额外指令 |
| `templateName` | string | ❌ | 应用的会话模板名称（在管理后台配置） |
| `context` | object | ❌ | 页面上下文（如当前路由、表单数据等） |
| `attachments` | object[] | ❌ | 附件列表（图片或文档，路径相对于会话工作区） |
| `afterSeq` | number | ❌ | 断线重连：从此序号之后的事件开始重放 |
| `autoClose` | boolean | ❌ | 处理完成后立即销毁 Session，适合无状态单次任务；默认 `false` |

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

## 连接保活（Heartbeat）

平台在所有 SSE 连接上每 30 秒发送一次 **SSE 注释心跳**（`: heartbeat`），防止代理服务器、负载均衡器和 CDN 因空闲超时关闭长时间运行的连接（如扩展思考、复杂工具调用等）。

- **格式**：`: heartbeat\n\n` — 标准 SSE 注释，非数据事件
- **客户端无需处理**：SSE 规范要求解析器忽略注释行。React SDK 和下方的解析示例均已自动兼容。
- **不消耗序号**：心跳不占用 `id:` 序号，不影响 `afterSeq` 断线重连

> 如果你在构建自定义 SSE 解析器，请确保只处理 `data:` 开头的行——以 `:` 开头的注释行应被忽略。

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

工具调用活动（读文件、写文件、搜索等）。当 `toolName` 为 `AskUserQuestion` 且 `phase` 为 `start` 时，`toolInput` 中包含问题 payload 和 `requestId`，前端应渲染问题 UI 并在用户回答后调用 `POST /control-response`。

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

## POST /control-response — 提交向导答案

当 AI 使用 `AskUserQuestion` 时，Agent Engine 暂停执行，前端收到包含问题 payload 的 `tool_activity(start)` 事件。用户完成向导或回答问题后，通过此端点提交响应。

### 请求

```
POST /api/v1/sessions/:sessionId/control-response
Content-Type: application/json
```

```json
{
  "requestId": "ctrl_req_abc123",
  "answers": {
    "question_key": "selected_answer"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `requestId` | string | ✅ | `tool_activity` 事件中 `toolInput.requestId` 的请求 ID |
| `answers` | Record\<string, string\> | ✅ | 用户答案的键值映射（值必须为字符串，每个最大 10KB） |

### 响应

```json
{ "success": true, "sessionId": "my-session", "requestId": "ctrl_req_abc123" }
```

提交后，Agent Engine 恢复执行，LLM 收到结构化的 JSON 答案。

---

## 一次性会话（autoClose）

`autoClose: true` 启用"一次性会话"模式：请求处理完成后，Session 立即销毁，进程池槽位释放。

### 适用场景

| 场景 | 推荐值 |
|------|--------|
| 多轮对话（聊天机器人、上下文延续） | `autoClose: false`（默认） |
| 无状态单次任务（Webhook、批处理、API 调用） | `autoClose: true` |

### 行为对比

| | `autoClose: false`（默认） | `autoClose: true` |
|---|---|---|
| 处理完成后 Session 状态 | 保留（idle，可继续对话） | 立即销毁（进程终止） |
| 进程池槽位 | 持续占用（直到 TTL 回收） | 立即释放 |
| 下次同 sessionId 请求 | 复用现有会话，历史上下文延续 | 创建全新 Session，无历史 |

### 并发请求的处理

同一 `sessionId` 连续发出多个 `autoClose: true` 请求（例如批量处理多条记录）时，平台保证 **FIFO 串行执行**：

```
请求 A (autoClose=true) ──┐
                           ├─ 消息队列（DB 行级锁，per-session FIFO）
请求 B (autoClose=true) ──┘
                    │
                    ▼ A 先处理
              Worker 处理 A → 完成 → Session 销毁
                    │
                    ▼ B 自动排队等待
              Worker 处理 B → getOrCreateSession() 重建 Session → 完成 → Session 销毁
```

B 不会因为 A 销毁了 Session 而失败——Worker 会透明地为 B 重建一个全新的 Session。

### 失败时的行为

处理失败时，即使设置了 `autoClose: true`，Session **不会**被强制销毁（由 TTL 自动回收）。这确保了在重试场景下不会过早销毁会话。

### 示例

```bash
# 无状态分析任务（用完即销毁）
curl -N -X POST http://localhost:3001/api/v1/sessions/job-$(uuidgen)/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "分析以下日志并输出结构化报告: ...",
    "tenantId": "default",
    "autoClose": true
  }'
```

```typescript
// React SDK 用法
const chat = useAgentChat({ connection, tenantId: 'default' })

// 发送一次性任务
chat.sendMessage('分析这份数据', { autoClose: true })
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
      // SSE 注释行（如 ": heartbeat"）没有 data: 前缀，直接跳过
      const dataLine = chunk.split('\n').find(l => l.startsWith('data:'))
      if (!dataLine) continue  // 心跳注释和空 chunk 被忽略
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
