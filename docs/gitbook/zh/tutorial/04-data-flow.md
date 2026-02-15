# 4. 数据流与状态管理

在前几章中，我们为备课方案设计器 Solution 设计了领域模型并映射了用户旅程。现在我们需要理解**数据是如何在即见Agentic 平台中流动的** -- 从用户输入消息到结构化数据出现在前端表单中。

本章涵盖完整的数据流架构、WebSocket 事件系统以及你在 Solution 中使用的 React SDK hooks。

## 学习目标

完成本章后，你将能够：

- 追踪一条消息在 CCAAS 直连架构中的流转路径
- 使用 React SDK hooks（`useAgentConnection`、`useAgentChat`、`useAgentStatus`、`usePageContext`、`useFiles`）
- 识别所有 WebSocket 事件类型及其用途
- 为 Solution 前端设计状态管理模式

## 直连架构

CCAAS 使用**直连架构**，你的 Solution 前端通过 WebSocket 直接连接到 CCAAS 后端。CCAAS 后端管理 AI Agent 进程，并将事件实时流式传输回前端。

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Solution   │  WS     │  CCAAS 后端       │  stdin/  │   AI Agent   │
│   前端       │◄───────►│  (NestJS)        │  stdout  │   进程       │
└──────────────┘         └──────────────────┘◄────────►└──────────────┘
  React + SDK              会话管理                      Claude Code /
  @ccaas/react-sdk         技能路由                      OpenCode / 等
                           事件流
                           认证鉴权

┌──────────────┐         ┌──────────────────┐
│   Solution   │  REST   │  Solution        │
│   前端       │◄───────►│  后端            │
└──────────────┘         └──────────────────┘
                           领域 CRUD
                           业务逻辑
```

关键架构事实：

- **Solution 前端直接连接 CCAAS** -- AI 交互不需要通过 Solution 后端中继
- **消息通过 REST 发送**（`POST /api/v1/sessions/:sessionId/completion`），**响应通过 WebSocket** 事件流式返回
- **领域数据**（如备课方案、任务）使用独立的 REST 通道连接 Solution 后端

## 完整数据流：消息生命周期

让我们追踪一次从开始到结束的完整交互。当用户在备课方案设计器前端输入 "为这个备课方案生成学习目标" 时：

### 第 1 步：前端建立 WebSocket 连接

`useAgentConnection` hook 连接到 CCAAS 后端并管理会话身份：

```typescript
// 来自: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // 直连 CCAAS 后端
  tenantId: 'lesson-plan-designer',
  autoConnect: true,
})
```

连接时，hook 会：

1. 使用 WebSocket 传输创建 Socket.io 连接
2. 发送 `session:join` 事件携带 sessionId
3. 接收 `client_id` 事件获得唯一客户端标识
4. 将 sessionId 持久化到 localStorage，键名为 `ccaas_session_${tenantId}`

### 第 2 步：前端通过 REST 发送消息

`useAgentChat` hook 通过 REST 端点发送消息，而不是通过 WebSocket：

```typescript
// 来自: packages/react-sdk/src/hooks/useAgentChat.ts

const chatPayload = {
  clientId: connection.clientId,
  message: content,
  tenantId: 'lesson-plan-designer',
  mcpServers: solutionConfig?.mcpServers,
  skillPath: solutionConfig?.skillPath,
  enabledSkillSlugs: ['lesson-plan-designer'],
  context: context,  // 来自 usePageContext 的页面上下文
}

await fetch(`${connection.serverUrl}/api/v1/sessions/${connection.sessionId}/completion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(chatPayload),
})
```

REST 调用告诉后端哪个 WebSocket 客户端应该接收流式响应。

### 第 3 步：CCAAS 后端处理请求

后端（`SessionsController.createCompletion`）执行以下操作：

1. **WebSocket 查找** -- 通过 `clientId` 找到 Socket.io 连接
2. **技能解析** -- 从启用的技能生成系统提示词
3. **会话管理** -- 获取或创建 AgentEngine 会话
4. **Agent 启动** -- 启动 AI Agent 进程（或使用 `--resume` 恢复已有进程）

### 第 4 步：事件通过 WebSocket 流式返回

当 AI Agent 工作时，CCAAS 后端解析其 stdout 并向已连接的客户端发送结构化 WebSocket 事件：

```
时间线:
─────────────────────────────────────────────────────────────────────
t=0ms    agent_status      { status: 'thinking' }
t=200ms  agent_thinking    { payload: { phase: 'start' } }
t=500ms  agent_thinking    { payload: { phase: 'delta', content: '...' } }
t=800ms  text_delta        { text: '我将为你生成学习目标...' }
t=1200ms tool_activity     { payload: { toolName: 'write_output', phase: 'start' } }
t=1300ms output_update     { payload: { data: { field: 'objectives', value: [...] } } }
t=1400ms tool_activity     { payload: { toolName: 'write_output', phase: 'end' } }
t=1600ms token_usage       { payload: { inputTokens: 1200, outputTokens: 450 } }
t=1800ms agent_status      { status: 'complete' }
─────────────────────────────────────────────────────────────────────
```

### 第 5 步：SDK hooks 将事件处理为 React 状态

SDK hooks 自动监听这些事件并更新 React 状态。你不需要手动编写 socket 事件监听器。

## React SDK Hooks

`@ccaas/react-sdk` 包提供五个核心 hooks，共同管理完整的数据流。以下是它们在真实 Solution 中的组合方式：

```typescript
// 来自: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  useFiles,
} from '@ccaas/react-sdk'

export function useLessonPlanSession(options) {
  // 1. 连接管理
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    tenantId: 'lesson-plan-designer',
    autoConnect: true,
  })

  // 2. 页面上下文（每条消息都发送当前表单状态）
  const { context, updateContext } = usePageContext()

  // 3. 聊天消息
  const chat = useAgentChat({
    connection,
    tenantId: 'lesson-plan-designer',
    mcpServers: solutionConfig?.mcpServers,
    skillPath: solutionConfig?.skillPath,
    enabledSkillSlugs,
    context,
    onOutputUpdate: (update) => {
      // 将 output_update 桥接到领域特定的同步逻辑
      addPendingUpdate({
        field: update.field as SyncField,
        value: update.value,
        preview: update.preview,
      })
    },
  })

  // 4. Agent 状态追踪
  const status = useAgentStatus({ connection })

  // 5. 文件管理
  const files = useFiles({
    connection,
    sessionId: connection.sessionId,
    enabled: connection.connected,
  })
}
```

### Hook 1: useAgentConnection

管理 Socket.io 连接生命周期和会话身份。

**选项：**

| 选项 | 类型 | 默认值 | 用途 |
|------|------|--------|------|
| `serverUrl` | `string` | `'/'` | CCAAS 后端 URL |
| `tenantId` | `string` | -- | 租户 ID，用于 localStorage 持久化 |
| `autoConnect` | `boolean` | `true` | 挂载时自动连接 |
| `forceNewConversation` | `boolean` | `false` | 清除保存的会话并重新开始 |

**返回值：**

| 属性 | 类型 | 用途 |
|------|------|------|
| `socket` | `Socket \| null` | 原始 Socket.io 实例 |
| `connected` | `boolean` | 连接状态 |
| `clientId` | `string \| null` | 服务端分配的客户端 ID |
| `sessionId` | `string` | 当前会话/对话 ID |
| `error` | `string \| null` | 连接错误消息 |
| `connect()` | function | 手动连接 |
| `disconnect()` | function | 手动断开 |
| `startNewConversation()` | function | 清除会话、生成新 ID、重新连接 |

**会话持久化：** 当提供 `tenantId` 时，sessionId 会存储在 localStorage 中，键名为 `ccaas_session_${tenantId}`。页面刷新后，hook 会恢复保存的 sessionId，从而自动加载消息历史。

### Hook 2: useAgentChat

管理消息状态、基于 REST 的发送和 WebSocket 事件处理。

**选项：**

| 选项 | 类型 | 用途 |
|------|------|------|
| `connection` | `UseAgentConnectionReturn` | 来自 `useAgentConnection` |
| `tenantId` | `string` | 租户标识 |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP 服务器配置 |
| `skillPath` | `string \| null` | 自定义技能指令路径 |
| `enabledSkillSlugs` | `string[]` | 启用哪些技能 |
| `context` | `PageContext \| null` | 来自 `usePageContext` 的页面上下文 |
| `onOutputUpdate` | `(update: OutputUpdate) => void` | 结构化字段更新回调 |

**返回值：**

| 属性 | 类型 | 用途 |
|------|------|------|
| `messages` | `Message[]` | 所有消息（用户 + 助手），包含 contentBlocks 和 outputUpdates |
| `isProcessing` | `boolean` | Agent 是否正在处理 |
| `isLoadingHistory` | `boolean` | 消息历史是否正在加载 |
| `currentStreamContent` | `string` | 流式传输期间实时更新的文本 |
| `sendMessage(content, options?)` | function | 发送消息（REST + WebSocket 响应） |
| `clearMessages()` | function | 清除本地消息 |
| `clearConversation()` | function | 清除消息并开始新对话 |
| `cancelProcessing()` | function | 取消当前 Agent 处理 |

**内部处理的事件：**

- 监听 `text_delta` 事件，将流式文本累积到内容块中
- 监听 `output_update` 事件，调用 `onOutputUpdate` 回调
- 监听 `tool_activity` 事件，在消息中创建内联工具卡片
- 监听 `agent_status` 事件，在完成时终结消息
- 连接时通过 `GET /api/v1/sessions/:sessionId/messages` 自动加载消息历史
- WebSocket 断开时自动重试（最多 2 次）

### Hook 3: useAgentStatus

追踪 Agent 状态、工具活动、思考状态和 token 使用情况。

**选项：**

| 选项 | 类型 | 用途 |
|------|------|------|
| `connection` | `UseAgentConnectionReturn` | 来自 `useAgentConnection` |

**返回值：**

| 属性 | 类型 | 用途 |
|------|------|------|
| `agentStatus` | `AgentStatusValue` | 当前状态（idle, thinking, running 等） |
| `isProcessing` | `boolean` | Agent 是否正在活跃工作 |
| `activeTools` | `Map<string, ToolActivity>` | 当前正在执行的工具 |
| `isThinking` | `boolean` | Agent 是否处于扩展思考模式 |
| `thinkingContent` | `string` | 累积的思考文本 |
| `thinkingStartTime` | `number \| null` | 思考开始时间（用于展示持续时间） |
| `thinkingVerb` | `string` | 随思考时长变化的动态动词 |
| `tokenUsage` | `TokenUsage \| null` | Token 消耗统计 |
| `todoItems` | `TodoItem[]` | Agent 的内部任务列表 |
| `todoStats` | `TodoStats` | 聚合的 todo 统计 |
| `activeSubAgents` | `ActiveSubAgent[]` | 正在运行的子代理任务 |
| `currentActivity` | `string` | 优先级排序的活动描述字符串 |

**处理的事件：**

- `agent_status` -- 更新 Agent 状态，完成时清理状态
- `tool_activity` -- 追踪工具的开始/进行/结束，2 秒后自动清理
- `agent_thinking` -- 管理扩展思考状态，基于阶段选择动词
- `token_usage` -- 累积 Token 消耗
- `todo_update` -- 追踪 Agent 的内部任务列表
- `subagent_started` / `subagent_completed` -- 追踪子代理生命周期

### Hook 4: usePageContext

管理页面上下文，随每条聊天消息一起发送，让 AI Agent 在回复前能读取当前表单状态。

```typescript
// 来自: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const { context, updateContext } = usePageContext()

// 当备课方案表单变化时更新上下文
useEffect(() => {
  if (lessonPlan) {
    updateContext('lesson-plan-editor', {
      lessonPlanId: lessonPlan.id,
      currentForm: {
        title: lessonPlan.title,
        subject: lessonPlan.subject,
        gradeLevel: lessonPlan.gradeLevel,
        objectives: lessonPlan.objectives,
        content: lessonPlan.content,
        // ... 其他字段
      },
    })
  }
}, [lessonPlan, updateContext])

// 将上下文传给 chat hook -- 每条消息都会包含它
const chat = useAgentChat({ connection, context, /* ... */ })
```

**返回值：**

| 属性 | 类型 | 用途 |
|------|------|------|
| `context` | `PageContext \| null` | 当前页面上下文 |
| `updateContext(pageType, pageData)` | function | 更新上下文 |
| `clearContext()` | function | 清除上下文 |

这就是 AI Agent 知道用户请求修改时表单中已有什么内容的机制。

### Hook 5: useFiles

管理 AI Agent 在会话期间创建的文件，支持实时更新和角标状态。

```typescript
// 来自: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const files = useFiles({
  connection,
  sessionId: connection.sessionId,
  enabled: connection.connected,
})

// files.newFilesCount -- 未查看的文件数量
// files.files -- 会话中的所有文件
// files.uploadFile(file, path) -- 上传文件
// files.downloadFile(fileId) -- 下载文件
```

**返回值：**

| 属性 | 类型 | 用途 |
|------|------|------|
| `files` | `FileMetadata[]` | 所有会话文件 |
| `newFilesCount` | `number` | 未查看的文件数量（用于角标） |
| `hasNewFiles` | `boolean` | 是否有新文件 |
| `uploadFile(file, path?)` | function | 上传文件到会话 |
| `downloadFile(fileId)` | function | 下载文件 |
| `deleteFile(fileId)` | function | 删除文件 |
| `markAsSynced(fileId)` | function | 标记文件为已查看 |
| `markAllSeen()` | function | 清除所有文件角标 |

**处理的事件：**

- `file.created` -- Agent 创建文件时重新获取文件列表
- `file.modified` -- Agent 修改文件时重新获取文件列表

## WebSocket 事件类型

CCAAS 后端发出多个类别的事件。理解每个类别对构建响应式前端至关重要。注意 SDK hooks 会自动处理所有这些事件 -- 这里的参考是为了帮助你理解底层发生了什么。

### 控制事件

| 事件 | 方向 | 用途 |
|------|------|------|
| `client_id` | 服务端 -> 客户端 | 连接时分配唯一客户端 ID |
| `session:join` | 客户端 -> 服务端 | 加入会话房间（SDK 自动发送） |

### Agent 生命周期事件

| 事件 | 用途 | 关键字段 |
|------|------|----------|
| `agent_status` | Agent 状态变化 | `status`, `context`, `error` |
| `agent_thinking` | 扩展思考内容 | `payload.phase`, `payload.content` |

`agent_status` 事件携带的 `status` 字段有以下可能值：

```typescript
type AgentStatusValue =
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

| 事件 | 用途 | 关键字段 |
|------|------|----------|
| `text_delta` | 流式文本输出 | `text` |
| `output_update` | 结构化表单数据 | `payload.data.field`, `payload.data.value`, `payload.data.preview` |
| `todo_update` | Agent 任务进度列表 | `payload.todos`, `payload.completed`, `payload.total` |

### 工具 & 子代理事件

| 事件 | 用途 | 关键字段 |
|------|------|----------|
| `tool_activity` | 工具调用追踪 | `payload.toolName`, `payload.phase`, `payload.description` |
| `tool_event` | 原始工具输入/输出 | `toolName`, `input`, `output` |
| `subagent_started` | 子代理启动 | `payload.subAgentId`, `payload.agentType`, `payload.description` |
| `subagent_completed` | 子代理完成 | `payload.subAgentId`, `payload.status` |

### 可观测性事件

| 事件 | 用途 | 关键字段 |
|------|------|----------|
| `token_usage` | Token 消耗统计 | `payload.inputTokens`, `payload.outputTokens`, `payload.cachedInputTokens` |
| `file.created` | Agent 创建了文件 | `sessionId` |
| `file.modified` | Agent 修改了文件 | `sessionId` |

## 数据流图：备课方案设计器

以下是备课方案设计器 Solution 的完整数据流：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       备课方案设计器前端                                  │
│                                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ 聊天面板     │  │ 表单编辑器    │  │ 文件    │  │ Agent 活动    │  │
│  │ (useAgent    │  │ (output_      │  │ 面板    │  │ 指示器        │  │
│  │  Chat)       │  │  update +     │  │ (use    │  │ (useAgent     │  │
│  │              │  │  SyncCards)   │  │  Files) │  │  Status)      │  │
│  └──────┬───────┘  └──────▲────────┘  └────▲────┘  └──────▲────────┘  │
│         │                 │                │               │           │
│    sendMessage     onOutputUpdate   file.created    agent_status      │
│    (REST POST)     (WebSocket)      (WebSocket)     (WebSocket)      │
└─────────┼─────────────────┼────────────────┼───────────────┼──────────┘
          │                 │                │               │
     ┌────▼─────────────────┴────────────────┴───────────────┴──────────┐
     │                      CCAAS 后端 (:3001)                           │
     │                                                                   │
     │  POST /sessions/:id/completion        WebSocket 事件流             │
     │  GET  /sessions/:id/messages          通过 Socket.io              │
     │  GET  /files/session/:id/tree                                     │
     └──────────────────────────┬────────────────────────────────────────┘
                                │ stdin / stdout
     ┌──────────────────────────▼────────────────────────────────────────┐
     │                       AI Agent 进程                               │
     │                                                                   │
     │  1. 读取 Skill 指令                                               │
     │  2. 读取页面上下文（当前表单状态）                                   │
     │  3. 生成文本回复 (→ text_delta)                                    │
     │  4. 调用 MCP 工具: write_output (→ output_update)                 │
     │  5. 创建文件 (→ file.created)                                     │
     └──────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────┐
     │                   Solution 后端 (:3002)                          │
     │                                                                  │
     │  GET  /api/lesson-plans          仅领域 CRUD                     │
     │  POST /api/lesson-plans          无 AI 中继职责                   │
     │  PUT  /api/lesson-plans/:id                                      │
     └──────────────────────────────────────────────────────────────────┘
```

## 双数据通道

一个 Solution 使用**两个独立的数据通道**：

### 通道 1：CCAAS（AI 交互）

- **出站**：REST `POST /api/v1/sessions/:sessionId/completion`
- **入站**：WebSocket 事件（`text_delta`、`output_update`、`agent_status`、`tool_activity` 等）
- **用途**：实时 AI Agent 交互

### 通道 2：Solution 后端（领域 CRUD）

- **双向**：到 Solution 后端的 REST API
- **用途**：传统数据操作（列表备课方案、保存备课方案等）

```typescript
// 通道 1：通过 CCAAS 进行 AI 交互
// 由 useAgentChat 处理 -- 你只需调用 sendMessage
chat.sendMessage('为五年级数学生成学习目标')
// 结果通过 onOutputUpdate 回调到达

// 通道 2：通过 Solution 后端进行领域 CRUD
const plans = await fetch('http://localhost:3002/api/lesson-plans').then(r => r.json())
await fetch('http://localhost:3002/api/lesson-plans', {
  method: 'POST',
  body: JSON.stringify(lessonPlanData)
})
```

这种分离很重要：AI Agent 通过通道 1 生成结构化数据（作为 `output_update` 事件），但实际的持久化发生在通道 2 -- 当用户确认并保存时。

## 会话与对话持久化

会话是 CCAAS 中 AI 交互的单位。React SDK 提供自动会话持久化。

### 会话持久化工作原理

当向 `useAgentConnection` 提供 `tenantId` 时：

1. sessionId 持久化到 localStorage，键名为 `ccaas_session_${tenantId}`
2. 页面刷新时，恢复保存的 sessionId
3. `useAgentChat` 通过 `GET /api/v1/sessions/:sessionId/messages` 自动加载消息历史
4. 对话从上次中断的地方继续

```typescript
// 这一切都由 SDK 自动处理：
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  tenantId: 'lesson-plan-designer',  // <-- 启用持久化
})

// 页面刷新时：从 localStorage 恢复 sessionId
// 连接时：从后端加载消息历史

// 要重新开始：
connection.startNewConversation()  // 清除存储，生成新 ID
```

### 开始新对话

```typescript
// 来自: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const createNewPlan = useCallback(async (input) => {
  const plan = await crud.createPlan(input)
  resetSyncState()
  chat.clearConversation()  // 清除消息 + 新 sessionId
  return plan
}, [crud, resetSyncState, chat])
```

`clearConversation()` 执行三个操作：
1. 清除所有本地消息
2. 从 localStorage 移除旧的 sessionId
3. 生成新的 sessionId 并重新连接

## 练习

### 练习 4.1：追踪数据流

给定这条用户消息："为这个备课方案添加评估方法"

识别：
1. 哪个 REST 端点接收消息？
2. 哪些 WebSocket 事件会流式返回？
3. AI Agent 如何知道当前表单状态？
4. `output_update` 最终在 React 组件树中的什么位置？

### 练习 4.2：Hook 组合

使用五个 SDK hooks，设计一个假设的 "Quiz Builder" Solution 的会话 hook。确定：
- 你会使用什么 `tenantId`？
- `usePageContext` 会发送哪些字段？
- 你如何处理测验题目与测验元数据的 `onOutputUpdate`？

### 练习 4.3：事件时间线

给定这个场景：用户要求 AI "创建一个三年级数学第二章的备课方案，包含学习目标和教学方法"

写出预期的 WebSocket 事件时间线，包括：
- 事件类型
- 关键负载数据
- 哪个 SDK hook 处理每个事件

## 要点总结

1. **CCAAS 使用直连架构** -- Solution 前端通过 Socket.io 直接连接 CCAAS 后端，不需要通过 Solution 后端中继
2. **消息通过 REST 发送，响应通过 WebSocket 流式返回** -- `POST /sessions/:id/completion` 发送消息，WebSocket 事件传递响应
3. **五个 SDK hooks 覆盖完整数据流** -- `useAgentConnection`（连接）、`useAgentChat`（消息）、`useAgentStatus`（状态）、`usePageContext`（表单状态）、`useFiles`（文件管理）
4. **`usePageContext` 是 AI 感知的关键** -- 它随每条消息发送当前表单状态，让 AI Agent 知道已填写了什么
5. **Solution 使用双数据通道** -- CCAAS 用于 AI 交互，Solution 后端用于领域 CRUD
6. **会话持久化是自动的** -- 提供 `tenantId` 即可启用基于 localStorage 的会话恢复和消息历史加载

## 下一步

在[第 5 章](05-form-protocol.md)中，我们将深入探讨 `output_update` 协议和表单同步模式。你将学习如何在 MCP Server 中使用 `write_output`，如何通过 `onOutputUpdate` 回调处理 `output_update` 事件，以及如何实现让用户在应用 AI 建议前审核的 SyncCard 审批流程。
