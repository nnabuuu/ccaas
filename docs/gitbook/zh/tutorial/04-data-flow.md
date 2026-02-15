# 4. 数据流与状态管理

在前几章中，我们为 Task Manager Solution 设计了领域模型并映射了用户旅程。现在我们需要理解**数据是如何在 LoopAI 平台中流动的** -- 从用户输入消息到结构化数据出现在前端表单中。

本章涵盖完整的数据流架构、WebSocket 事件系统以及你在 Solution 中使用的状态管理模式。

## 学习目标

完成本章后，你将能够：

- 追踪一条消息在整个 LoopAI 中继架构中的流转路径
- 识别所有 WebSocket 事件类型及其用途
- 理解 CCAAS 后端作为中继层的角色
- 为 Solution 前端设计状态管理模式

## 中继架构

LoopAI 使用**中继架构**，CCAAS 后端位于你的 Solution 和 AI Agent 之间。这是使整个平台运作的核心设计模式。

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Solution   │     │  CCAAS 后端       │     │   AI Agent   │
│   前端       │◄───►│  (中继层)         │◄───►│   进程       │
└──────────────┘     └──────────────────┘     └──────────────┘
   Socket.io              NestJS               Claude Code /
   WebSocket           会话管理                 OpenCode / 等
                       技能路由
                       事件流
```

关键洞察：**你的 Solution 前端永远不会直接与 AI Agent 通信**。所有通信都由 CCAAS 后端中转，它提供：

- **会话管理** -- 创建、追踪和恢复 Agent 会话
- **技能路由** -- 将用户消息匹配到正确的 Skill
- **事件流** -- 将 Agent 进程输出转换为结构化 WebSocket 事件
- **认证鉴权** -- API Key 验证和租户隔离

## 完整数据流：消息生命周期

让我们追踪一次从开始到结束的完整交互。当用户在 Task Manager 前端输入 "创建一个名为 Fix login bug 的高优先级任务" 时，以下是发生的事情：

### 第 1 步：前端发送聊天消息

```typescript
// Solution 前端 (React 或 Vue)
socket.emit('chat', {
  message: '创建一个名为 Fix login bug 的高优先级任务',
  sessionId: 'session-abc-123'  // 可选：省略则创建新会话
})
```

### 第 2 步：Solution 后端中继到 CCAAS

Solution 后端接收 Socket.io 事件并通过 REST API 转发给 CCAAS 后端：

```typescript
// Solution 后端中继
socket.on('chat', async (data) => {
  const { message, sessionId } = data

  await axios.post(`${CCAAS_URL}/api/v1/sessions/${sessionId}/completion`, {
    clientId: socket.id,
    message,
    tenantId: TENANT_ID,
    mcpServers: getMcpConfig(),
    enabledSkillSlugs: ['task-manager']
  })
})
```

### 第 3 步：CCAAS 处理请求

CCAAS 后端执行以下操作：

1. **认证鉴权** -- 验证 API Key 和租户
2. **技能解析** -- 将消息与已注册的 Skill 触发器匹配
3. **会话管理** -- 创建新会话或恢复已有会话
4. **Agent 启动** -- 使用匹配的 Skill 指令启动 AI Agent 进程

### 第 4 步：AI Agent 执行

AI Agent 读取 Skill 指令，理解用户请求，并采取行动：

```
AI Agent 进程:
  1. 解析用户意图: "创建任务"
  2. 提取字段: title="Fix login bug", priority="high"
  3. 调用 write_output 工具: { field: "title", value: "Fix login bug" }
  4. 调用 write_output 工具: { field: "priority", value: "high" }
  5. 调用 write_output 工具: { field: "status", value: "todo" }
```

### 第 5 步：事件流回到前端

当 AI Agent 工作时，CCAAS 后端发出一系列 WebSocket 事件。Solution 后端将这些事件中继到前端：

```
时间线:
─────────────────────────────────────────────────────────────
t=0ms    agent_status    { status: 'thinking' }
t=200ms  agent_thinking  { phase: 'start', content: '...' }
t=500ms  text_delta      { text: '我将创建一个任务...' }
t=800ms  tool_activity   { toolName: 'write_output', phase: 'start' }
t=850ms  output_update   { payload: { data: { field: 'title', value: 'Fix login bug' } } }
t=900ms  tool_activity   { toolName: 'write_output', phase: 'end' }
t=1000ms tool_activity   { toolName: 'write_output', phase: 'start' }
t=1050ms output_update   { payload: { data: { field: 'priority', value: 'high' } } }
t=1100ms tool_activity   { toolName: 'write_output', phase: 'end' }
t=1200ms agent_status    { status: 'complete' }
─────────────────────────────────────────────────────────────
```

### 第 6 步：前端更新 UI

前端监听这些事件并相应地更新表单状态：

```typescript
socket.on('output_update', (event) => {
  const { field, value } = event.payload.data
  setFormData(prev => ({ ...prev, [field]: value }))
})

socket.on('agent_status', (data) => {
  setAgentStatus(data.status)
})
```

## WebSocket 事件类型

CCAAS 后端发出多个类别的事件。理解每个类别对构建响应式前端至关重要。

### 控制事件

这些事件管理连接和会话生命周期：

| 事件 | 方向 | 用途 |
|------|------|------|
| `client_id` | 服务端 -> 客户端 | 连接时分配唯一客户端 ID |
| `session_restored` | 服务端 -> 客户端 | 确认会话重连成功 |
| `session_not_found` | 服务端 -> 客户端 | 会话重连失败 |
| `error` | 服务端 -> 客户端 | 包含恢复信息的错误 |

```typescript
// 连接生命周期
socket.on('client_id', (data) => {
  console.log('已连接，客户端 ID:', data.clientId)
})

socket.on('error', (data) => {
  if (data.recoverable) {
    // 自动重试逻辑
  } else {
    // 向用户显示错误
  }
})
```

### Agent 生命周期事件

这些事件追踪 AI Agent 的执行状态：

| 事件 | 用途 | 关键字段 |
|------|------|----------|
| `agent_status` | Agent 状态变化 | `status`, `context`, `error` |
| `agent_thinking` | 扩展思考内容 | `phase`, `content`, `thinkingId` |

`agent_status` 事件携带的 `status` 字段有以下可能值：

```typescript
type AgentStatus =
  | 'idle'        // Agent 就绪
  | 'thinking'    // 处理请求中
  | 'exploring'   // 搜索/读取文件
  | 'executing'   // 执行工具
  | 'running'     // 一般处理
  | 'complete'    // 成功完成
  | 'error'       // 出错
  | 'cancelled'   // 用户取消
```

### 内容事件

这些事件传递 AI Agent 的输出：

| 事件 | 用途 | 关键字段 |
|------|------|----------|
| `text_delta` | 流式文本输出 | `text` |
| `output_update` | 结构化表单数据 | `payload.data.field`, `payload.data.value` |
| `todo_update` | 任务进度列表 | `todos`, `summary` |

### 可观测性事件

这些事件提供 Agent 行为的透明度：

| 事件 | 用途 | 关键字段 |
|------|------|----------|
| `tool_activity` | 工具调用追踪 | `toolName`, `phase`, `description` |
| `token_usage` | Token 消耗统计 | `inputTokens`, `outputTokens`, `estimatedCostUsd` |
| `exploration_activity` | 文件/代码搜索活动 | `action`, `target`, `phase` |

## 状态管理模式

一个设计良好的 Solution 前端需要管理几类状态。以下是 LoopAI Solution 中使用的模式。

### 模式 1：Agent 连接状态

追踪 WebSocket 连接和 Agent 状态：

```typescript
// React 模式
interface AgentConnectionState {
  connected: boolean
  clientId: string | null
  sessionId: string | null
  agentStatus: AgentStatus
  error: ErrorEvent | null
}

function useAgentConnection(serverUrl: string) {
  const [state, setState] = useState<AgentConnectionState>({
    connected: false,
    clientId: null,
    sessionId: null,
    agentStatus: 'idle',
    error: null,
  })

  useEffect(() => {
    const socket = io(serverUrl)

    socket.on('connect', () => {
      setState(prev => ({ ...prev, connected: true }))
    })

    socket.on('client_id', (data) => {
      setState(prev => ({ ...prev, clientId: data.clientId }))
    })

    socket.on('agent_status', (data) => {
      setState(prev => ({
        ...prev,
        agentStatus: data.status,
        sessionId: data.sessionId,
      }))
    })

    socket.on('error', (data) => {
      setState(prev => ({ ...prev, error: data }))
    })

    return () => { socket.disconnect() }
  }, [serverUrl])

  return state
}
```

```typescript
// Vue 模式 (使用 @ccaas/vue-sdk)
import { useAgentState } from '@ccaas/vue-sdk'

const { isProcessing, currentToolName, agentStatus } = useAgentState()
```

### 模式 2：聊天消息状态

将流式文本累积为完整消息：

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming: boolean
  timestamp: number
}

function useChatMessages(socket: Socket) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    socket.on('text_delta', (data) => {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.isStreaming && last.role === 'assistant') {
          // 追加到现有流式消息
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + data.text }
          ]
        }
        // 开始新的 assistant 消息
        return [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.text,
          isStreaming: true,
          timestamp: Date.now(),
        }]
      })
    })

    socket.on('agent_status', (data) => {
      if (data.status === 'complete' || data.status === 'error') {
        // 标记流式完成
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }]
          }
          return prev
        })
      }
    })

    return () => {
      socket.off('text_delta')
      socket.off('agent_status')
    }
  }, [socket])

  return messages
}
```

### 模式 3：表单数据状态 (通过 output\_update)

这是 Solution 中最重要的模式。`output_update` 事件携带结构化数据从 AI Agent 到前端表单。我们将在第 5 章详细介绍。

基本模式：

```typescript
function useFormData(socket: Socket) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  useEffect(() => {
    socket.on('output_update', (event) => {
      // 重要：数据嵌套在 payload.data 中
      const { field, value, operation } = event.payload.data

      setFormData(prev => {
        switch (operation) {
          case 'set':
            return { ...prev, [field]: value }
          case 'append':
            const existing = prev[field]
            if (Array.isArray(existing)) {
              return { ...prev, [field]: [...existing, value] }
            }
            return { ...prev, [field]: (existing || '') + String(value) }
          case 'merge':
            return { ...prev, [field]: { ...(prev[field] as object), ...(value as object) } }
          default:
            return { ...prev, [field]: value }
        }
      })
    })

    return () => { socket.off('output_update') }
  }, [socket])

  return formData
}
```

### 模式 4：工具活动追踪

向用户展示 AI Agent 正在做什么：

```typescript
interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  description?: string
  startedAt: number
  duration?: number
}

function useToolActivity(socket: Socket) {
  const [activeTools, setActiveTools] = useState<Map<string, ToolActivity>>(new Map())

  useEffect(() => {
    socket.on('tool_activity', (data) => {
      const activity = data.payload || data

      setActiveTools(prev => {
        const next = new Map(prev)
        if (activity.phase === 'start') {
          next.set(activity.toolId, {
            ...activity,
            startedAt: Date.now(),
          })
        } else if (activity.phase === 'end') {
          next.delete(activity.toolId)
        }
        return next
      })
    })

    return () => { socket.off('tool_activity') }
  }, [socket])

  return activeTools
}
```

## 数据流图：Task Manager

以下是 Task Manager Solution 的完整数据流：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Task Manager 前端                              │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ 聊天     │  │ 任务表单     │  │ 任务列表   │  │ Agent 状态   │ │
│  │ 面板     │  │ (output_     │  │ (REST API) │  │ 指示器       │ │
│  │          │  │  update)     │  │            │  │              │ │
│  └────┬─────┘  └──────▲───────┘  └──────▲─────┘  └──────▲───────┘ │
│       │               │                │               │         │
│       │  text_delta    │  output_update  │  REST         │ agent_  │
│       │               │                │  响应          │ status  │
└───────┼───────────────┼────────────────┼───────────────┼─────────┘
        │               │                │               │
   ┌────▼───────────────┴────────────────┴───────────────┴─────────┐
   │                    Solution 后端                                │
   │                                                                │
   │  ┌────────────────────┐    ┌─────────────────────┐            │
   │  │ Socket.io 中继     │    │ REST API             │            │
   │  │ (chat, 事件)       │    │ (任务 CRUD)          │            │
   │  └────────┬───────────┘    └──────────────────────┘            │
   └───────────┼────────────────────────────────────────────────────┘
               │
   ┌───────────▼────────────────────────────────────────────────────┐
   │                     CCAAS 后端                                  │
   │                                                                │
   │  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌────────────┐  │
   │  │ 认证 &   │  │ 技能      │  │ 会话      │  │ 事件       │  │
   │  │ 租户     │  │ 路由器    │  │ 管理器    │  │ 流处理器   │  │
   │  └──────────┘  └─────┬─────┘  └─────┬─────┘  └──────▲─────┘  │
   └───────────────────────┼──────────────┼───────────────┼────────┘
                           │              │               │
   ┌───────────────────────▼──────────────▼───────────────┼────────┐
   │                    AI Agent 进程                      │        │
   │                                                      │        │
   │  1. 读取 Skill 指令                                  │        │
   │  2. 理解用户意图                                      │        │
   │  3. 调用 MCP 工具 (write_output 等)  ────────────────┘        │
   │  4. 流式输出文本响应                                           │
   └───────────────────────────────────────────────────────────────┘
```

## 双数据通道

注意，一个 Solution 通常使用**两个独立的数据通道**：

### 通道 1：WebSocket（实时，经由 CCAAS）

用于 AI 交互：

- **入站**：来自用户的 `chat` 事件
- **出站**：`text_delta`、`output_update`、`agent_status`、`tool_activity`
- **用途**：实时流式传输 AI Agent 输出

### 通道 2：REST API（请求-响应，直连）

用于领域数据的 CRUD 操作：

- **入站**：来自前端的 HTTP 请求
- **出站**：包含领域数据的 JSON 响应
- **用途**：传统数据操作（列表任务、更新任务、删除任务）

```typescript
// 通道 1：通过 WebSocket 进行 AI 交互
socket.emit('chat', { message: '创建一个高优先级任务来修复登录问题' })
socket.on('output_update', (event) => {
  // AI 填充表单
})

// 通道 2：通过 REST API 进行 CRUD
const tasks = await fetch('/api/tasks').then(r => r.json())
await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify(taskData)
})
```

这种分离很重要：AI Agent 通过通道 1 生成结构化数据，但数据的实际持久化发生在通道 2 -- 当用户确认并保存时。

## 会话管理

会话是 LoopAI 中 AI 交互的单位。理解会话生命周期对状态管理很重要。

### 会话状态

```
            ┌──────────────┐
            │    已创建     │
            └──────┬───────┘
                   │ 用户发送 chat
            ┌──────▼───────┐
            │   处理中     │ ◄──── 用户发送后续消息
            └──────┬───────┘
                   │ Agent 完成
            ┌──────▼───────┐
            │    空闲      │ ◄──── 准备好接收下一条消息
            └──────┬───────┘
                   │ 用户断开连接
            ┌──────▼───────┐
            │    挂起      │
            └──────┬───────┘
                   │ reconnect_session
            ┌──────▼───────┐
            │    已恢复    │ ──── 回到空闲
            └──────────────┘
```

### 会话重连

用户可能关闭浏览器稍后返回。LoopAI 支持会话重连：

```typescript
// 应用加载时，尝试恢复之前的会话
const savedSessionId = localStorage.getItem('sessionId')
if (savedSessionId) {
  socket.emit('reconnect_session', { sessionId: savedSessionId })

  socket.on('session_restored', () => {
    console.log('会话恢复成功')
  })

  socket.on('session_not_found', () => {
    localStorage.removeItem('sessionId')
    console.log('之前的会话已过期，重新开始')
  })
}
```

## 练习

### 练习 4.1：追踪消息

给定这条用户消息："列出所有高优先级任务"

画出完整的数据流，识别：
1. 哪些 WebSocket 事件会被发出？
2. 是否会生成 `output_update` 事件？为什么？
3. 应该使用哪个数据通道（WebSocket 还是 REST）来获取任务列表？

### 练习 4.2：设计状态结构

为 Task Manager Solution 设计完整的前端状态结构。考虑：
- Agent 连接状态
- 聊天消息历史
- 当前任务表单数据（来自 `output_update`）
- 任务列表（来自 REST API）
- 活动工具指示器

```typescript
// 填写状态接口
interface TaskManagerState {
  // 你的设计在这里
}
```

### 练习 4.3：事件时间线

给定这个场景：用户要求 AI "创建一个标题为 'Deploy v2' 的任务并分配给 Alice"

写出预期的 WebSocket 事件时间线，包括：
- 事件类型
- 大致时间
- 关键负载数据

## 要点总结

1. **LoopAI 是中继架构** -- CCAAS 后端中转你的 Solution 和 AI Agent 之间的所有通信
2. **WebSocket 事件分为四类** -- 控制事件、生命周期事件、内容事件和可观测性事件
3. **`output_update` 是桥梁** -- 连接 AI Agent 输出和前端表单，它在嵌套的 `payload.data` 结构中携带结构化数据
4. **Solution 使用双数据通道** -- WebSocket 用于 AI 交互，REST 用于 CRUD 操作
5. **会话是交互的单位** -- 它们可以被创建、挂起和恢复

## 下一步

在[第 5 章](05-form-protocol.md)中，我们将深入探讨 `output_update` 协议和表单同步模式。你将学习如何在 MCP Server 中使用 `write_output`，如何在前端处理 `output_update` 事件，以及如何实现 SyncCard 审批流程等高级模式。
