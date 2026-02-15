# 6.5 前端实现

在本节中，你将构建 Task Manager 的 React 前端。前端有三个职责：展示来自 Solution 后端的领域数据、通过 CCAAS 中继聊天消息、以及处理 `output_update` 事件让 AI 可以填充表单。学完本节后，你将拥有一个可工作的分屏 UI：左侧是任务列表，右侧是聊天面板。

## 架构回顾

在写代码之前，回顾前端在数据流中的位置：

```
┌──────────────────────────────────────────────────────┐
│                      前端                            │
│                                                      │
│  ┌─────────────┐    ┌────────────┐    ┌───────────┐ │
│  │ TaskList     │    │ ChatPanel  │    │ FormSync  │ │
│  │ (REST)       │    │ (WebSocket)│    │ (事件)    │ │
│  └──────┬──────┘    └─────┬──────┘    └─────┬─────┘ │
│         │                 │                 │        │
└─────────┼─────────────────┼─────────────────┼────────┘
          │                 │                 │
    Solution 后端         CCAAS            CCAAS
    (端口 3003)        (端口 3001)      (端口 3001)
    GET /api/tasks    WebSocket 中继   output_update
```

Vite 开发服务器代理请求，所以前端无需知道实际的后端端口。所有 `/api` 请求发送到 Solution 后端，所有 `/api/v1` 和 `/socket.io` 请求发送到 CCAAS。

## 项目配置

### vite.config.ts

代理配置是连接前端和两个后端的粘合剂：

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5281,
    proxy: {
      // CCAAS 会话 API
      '/api/v1/sessions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS 健康检查 API
      '/api/v1/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS Skills API
      '/api/v1/skills': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Solution 后端 API（任务 CRUD、项目 CRUD）
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      // CCAAS WebSocket
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
```

{% hint style="warning" %}
**顺序很重要。** `/api/v1/sessions` 规则必须出现在 `/api` 之前，因为 Vite 会匹配第一个符合的前缀。如果 `/api` 在前面，CCAAS 请求会被发送到 Solution 后端并失败。
{% endhint %}

### 依赖

前端依赖 monorepo 中的两个工作区包：

```json
{
  "dependencies": {
    "@ccaas/common": "file:../../../packages/common",
    "@ccaas/react-sdk": "file:../../../packages/react-sdk",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.8.1"
  }
}
```

- **@ccaas/common** 提供共享的 TypeScript 类型（`OutputUpdateEvent`、`TextDeltaEvent`、`TokenUsage`）
- **@ccaas/react-sdk** 提供连接 CCAAS 的 hooks（`useAgentConnection`、`useAgentChat`、`useOutputSync`）

## 第一步：定义领域类型

首先定义与 Solution 后端 API 响应匹配的 TypeScript 接口。这些类型驱动整个前端：

```typescript
// frontend/src/hooks/useTaskManagerSession.ts

export interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  projectId: string | null
  dueDate: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}
```

{% hint style="info" %}
**为什么不使用 @ccaas/common 的类型？** 这些是 Task Manager Solution 特有的领域类型。`@ccaas/common` 包提供平台类型（会话、事件、消息）。你的 Solution 定义自己的业务实体类型。
{% endhint %}

## 第二步：构建 Session Hook

Session hook 是前端的核心。它将三个关注点组合成一个可组合的 API：

1. **REST 数据获取** -- 从 Solution 后端加载任务和项目
2. **WebSocket 连接** -- 维护到 CCAAS 的实时连接用于聊天
3. **输出同步** -- 处理来自 AI Agent 的 `output_update` 事件

### 基础版本（仅 REST）

从最简单的版本开始，只从 Solution 后端获取数据：

```typescript
// frontend/src/hooks/useTaskManagerSession.ts

import { useState, useEffect, useCallback } from 'react'

export function useTaskManagerSession() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch {
      // 后端可能还没有运行
    }
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch {
      // 后端可能还没有运行
    }
  }, [])

  useEffect(() => {
    refreshTasks()
    refreshProjects()

    fetch('/api/v1/health')
      .then(res => setIsConnected(res.ok))
      .catch(() => setIsConnected(false))
  }, [refreshTasks, refreshProjects])

  const sendMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, msg])
  }, [])

  return {
    tasks, projects, messages, isConnected,
    sendMessage, refreshTasks, refreshProjects,
  }
}
```

这个版本可以立即工作：它从后端加载任务并允许用户输入消息（虽然消息还没有到达 AI）。

### 完整版本（集成 react-sdk）

要连接到 CCAAS，用 `@ccaas/react-sdk` 的 hooks 替换手动的 WebSocket 逻辑：

```typescript
// frontend/src/hooks/useTaskManagerSession.ts（完整版）

import { useState, useEffect, useCallback } from 'react'
import { useAgentConnection } from '@ccaas/react-sdk'
import { useAgentChat } from '@ccaas/react-sdk'
import { useOutputSync } from '@ccaas/react-sdk'

export function useTaskManagerSession() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [taskFormData, setTaskFormData] = useState<Record<string, unknown>>({})

  // 1. 连接到 CCAAS
  const connection = useAgentConnection({
    serverUrl: '/',
    tenantId: 'task-manager-tutorial',
  })

  // 2. 处理 output_update 事件
  const outputSync = useOutputSync({
    mode: 'auto',
  })

  // 3. 与 AI Agent 聊天
  const chat = useAgentChat({
    connection,
    tenantId: 'task-manager-tutorial',
    onOutputUpdate: (update) => {
      outputSync.handleOutputUpdate(update)
      // 自动应用到表单数据
      setTaskFormData(prev => ({
        ...prev,
        [update.field]: update.value,
      }))
    },
  })

  // REST 数据获取（同前）
  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) setTasks(await res.json())
    } catch { /* 忽略 */ }
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) setProjects(await res.json())
    } catch { /* 忽略 */ }
  }, [])

  useEffect(() => {
    refreshTasks()
    refreshProjects()
  }, [refreshTasks, refreshProjects])

  return {
    // 领域数据
    tasks, projects,
    refreshTasks, refreshProjects,
    // 聊天
    messages: chat.messages,
    isConnected: connection.connected,
    isProcessing: chat.isProcessing,
    sendMessage: chat.sendMessage,
    // 表单同步
    taskFormData,
    pendingUpdates: outputSync.pendingUpdates,
    modifiedFields: outputSync.modifiedFields,
  }
}
```

三个 react-sdk hooks 分层清晰：

| Hook | 职责 |
|------|------|
| `useAgentConnection` | Socket.io 连接、会话 ID、重连 |
| `useAgentChat` | 消息历史、文本流、基于 REST 的 sendMessage |
| `useOutputSync` | 待处理更新队列、撤销栈、字段跟踪 |

{% hint style="info" %}
**为什么通过 REST 发送消息而不是 WebSocket？** `useAgentChat` hook 通过调用 `POST /api/v1/sessions/{id}/completion` 发送消息。这是一个刻意的设计选择：REST 请求更容易重试、可以携带认证头、并产生清晰的 HTTP 错误码。WebSocket 用于流式返回响应，而不是发送消息。
{% endhint %}

## 第三步：构建任务列表组件

任务列表渲染来自 Solution 后端的领域数据。它不了解 CCAAS 或 WebSocket -- 它是一个纯展示组件：

```typescript
// frontend/src/components/TaskList.tsx

import { Task, Project } from '../hooks/useTaskManagerSession'

interface TaskListProps {
  tasks: Task[]
  projects: Project[]
  onRefresh: () => void
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

export function TaskList({ tasks, projects, onRefresh }: TaskListProps) {
  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null
    return projects.find(p => p.id === projectId)?.name ?? null
  }

  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg">No tasks yet</p>
        <p className="text-sm mt-2">
          Use the chat to create tasks with AI assistance
        </p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex justify-end mb-3">
        <button onClick={onRefresh}
          className="text-sm text-primary-600 hover:text-primary-700">
          Refresh
        </button>
      </div>
      <ul className="space-y-2">
        {tasks.map(task => (
          <li key={task.id}
            className="bg-white rounded-lg border border-gray-200 p-4
                       hover:shadow-sm transition-shadow">
            <h3 className="font-medium text-gray-900 truncate">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full
                font-medium ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
              <span className="text-xs text-gray-500">
                {statusLabels[task.status] ?? task.status}
              </span>
              {getProjectName(task.projectId) && (
                <span className="text-xs text-primary-600">
                  {getProjectName(task.projectId)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

关键设计决策：

- **优先级徽章使用颜色编码** -- urgent 红色、high 橙色、medium 蓝色、low 灰色
- **状态使用可读标签** -- `in_progress` 变成 "In Progress"
- **项目名称通过查找解析** -- 组件接收完整的项目列表，通过 ID 查找名称
- **空状态引导用户** -- 没有任务时，UI 建议使用聊天

## 第四步：构建聊天面板组件

聊天面板处理用户输入并显示对话。它从 session hook 接收消息和发送回调：

```typescript
// frontend/src/components/ChatPanel.tsx

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '../hooks/useTaskManagerSession'

interface ChatPanelProps {
  messages: ChatMessage[]
  isConnected: boolean
  onSendMessage: (message: string) => void
}

export function ChatPanel({
  messages, isConnected, onSendMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 新消息时自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    onSendMessage(trimmed)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* 带连接状态的头部 */}
      <div className="p-4 border-b border-gray-200 bg-white
                      flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">AI Assistant</h2>
        <span className={`text-xs px-2 py-1 rounded-full ${
          isConnected
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p>Start a conversation to manage tasks</p>
            <p className="text-sm mt-2">
              Try: "Create a task to review the API docs"
            </p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入表单 */}
      <form onSubmit={handleSubmit}
        className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2
                       text-sm focus:outline-none focus:ring-2
                       focus:ring-primary-500 focus:border-transparent"
            disabled={!isConnected}
          />
          <button type="submit"
            disabled={!isConnected || !input.trim()}
            className="px-4 py-2 bg-primary-600 text-white text-sm
                       font-medium rounded-lg hover:bg-primary-700
                       disabled:opacity-50 disabled:cursor-not-allowed">
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
```

值得注意的模式：

- **自动滚动** -- 消息列表底部的 ref 在消息变化时滚动到视图中
- **连接指示器** -- 绿色/红色徽章显示 WebSocket 状态
- **禁用状态** -- 未连接时输入框和按钮被禁用
- **用户 vs 助手样式** -- 用户消息右对齐蓝色，助手消息左对齐带边框

## 第五步：组合页面

页面组件使用分屏布局将所有内容组合在一起：

```typescript
// frontend/src/pages/TaskManagerPage.tsx

import { useTaskManagerSession } from '../hooks/useTaskManagerSession'
import { TaskList } from '../components/TaskList'
import { ChatPanel } from '../components/ChatPanel'

export function TaskManagerPage() {
  const {
    tasks, projects, isConnected,
    messages, sendMessage, refreshTasks,
  } = useTaskManagerSession()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左侧面板：任务列表 */}
      <div className="w-1/2 border-r border-gray-200 overflow-auto">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-semibold text-gray-900">
            Task Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tasks.length} tasks across {projects.length} projects
          </p>
        </div>
        <TaskList
          tasks={tasks}
          projects={projects}
          onRefresh={refreshTasks}
        />
      </div>

      {/* 右侧面板：聊天 */}
      <div className="w-1/2 flex flex-col">
        <ChatPanel
          messages={messages}
          isConnected={isConnected}
          onSendMessage={sendMessage}
        />
      </div>
    </div>
  )
}
```

布局是一个全高度的 flex 容器，将视口 50/50 分割。左侧面板独立于右侧面板滚动。

## 第六步：处理 output\_update 事件

当 AI Agent 调用 `write_output` 时，CCAAS 通过 WebSocket 发送 `output_update` 事件。`@ccaas/react-sdk` 的 `useOutputSync` hook 提供两种处理模式：

### 自动模式

在自动模式中，更新会立即应用到表单数据：

```typescript
const outputSync = useOutputSync({ mode: 'auto' })

// 在 onOutputUpdate 回调中：
onOutputUpdate: (update) => {
  outputSync.handleOutputUpdate(update)
  setTaskFormData(prev => ({
    ...prev,
    [update.field]: update.value,
  }))
}
```

### 手动模式

在手动模式中，更新被排队为待处理。用户必须点击"同步"按钮才能应用：

```typescript
const outputSync = useOutputSync({ mode: 'manual' })

// 更新被排队在 outputSync.pendingUpdates 中
// 用户点击"同步到表单"：
outputSync.syncAllToForm(currentData, setData)
```

{% hint style="info" %}
**应该使用哪种模式？** 自动模式更简单，适用于 AI 填写单个表单的场景。手动模式在你希望用户在应用 AI 建议之前先审核时更好 -- 这是 Human-in-the-Loop 模式的最强形态。
{% endhint %}

### 构建同步指示器组件

为了向用户展示 AI 提出了更改建议，构建一个小的指示器组件：

```typescript
// frontend/src/components/SyncIndicator.tsx

interface SyncIndicatorProps {
  pendingCount: number
  onSyncAll: () => void
}

export function SyncIndicator({
  pendingCount, onSyncAll,
}: SyncIndicatorProps) {
  if (pendingCount === 0) return null

  return (
    <div className="flex items-center gap-2 p-3 bg-yellow-50
                    border border-yellow-200 rounded-lg">
      <span className="text-sm text-yellow-800">
        AI 已更新 {pendingCount} 个字段
      </span>
      <button
        onClick={onSyncAll}
        className="text-sm font-medium text-yellow-900
                   bg-yellow-200 px-3 py-1 rounded hover:bg-yellow-300">
        同步到表单
      </button>
    </div>
  )
}
```

### 撤销支持

`useOutputSync` hook 包含内置的撤销支持。同步字段后，用户可以在可配置的超时时间内（默认 30 秒）撤销更改：

```typescript
// 检查某个字段是否可以撤销
const canUndoTitle = outputSync.canUndo('taskTitle')

// 撤销同步
outputSync.undoSync('taskTitle', currentData, setData)
```

## 第七步：保存任务到后端

AI 填写表单后用户审核完毕，将任务保存到 Solution 后端：

```typescript
const saveTask = async (formData: Record<string, unknown>) => {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: formData.taskTitle as string,
      description: formData.taskDescription as string,
      priority: formData.priority as string,
      status: formData.status as string,
      projectId: formData.projectId as string,
      dueDate: formData.dueDate as string,
      tags: formData.tags as string[],
    }),
  })

  if (response.ok) {
    // 刷新任务列表以显示新任务
    await refreshTasks()
    // 重置表单
    setTaskFormData({})
    outputSync.reset()
  }
}
```

这完成了数据流：

```
AI 调用 write_output
    → output_update 事件到达
    → useOutputSync 排队/应用更新
    → 表单字段更新
    → 用户审核并点击保存
    → POST /api/tasks
    → 数据库存储任务
    → refreshTasks() 重新加载列表
```

## 常见模式

### AI 更改后刷新

当 AI 创建或修改数据时，自动刷新任务列表：

```typescript
// 在 onOutputUpdate 回调中：
onOutputUpdate: (update) => {
  outputSync.handleOutputUpdate(update)

  // 如果 AI 信号表示任务已保存，刷新
  if (update.field === '_taskSaved') {
    refreshTasks()
  }
}
```

### 错误边界

用错误边界包裹主页面，捕获格式错误的 AI 输出导致的渲染错误：

```typescript
// frontend/src/App.tsx

import { ErrorBoundary } from './components/ErrorBoundary'
import { TaskManagerPage } from './pages/TaskManagerPage'

function App() {
  return (
    <ErrorBoundary>
      <TaskManagerPage />
    </ErrorBoundary>
  )
}
```

### 加载状态

在获取数据时显示加载指示器：

```typescript
const { tasks, isLoadingHistory } = useTaskManagerSession()

if (isLoadingHistory) {
  return <div className="p-8 text-center text-gray-500">Loading...</div>
}
```

## 常见陷阱

{% hint style="danger" %}
**陷阱 1：忘记 Vite 代理顺序。** 如果代理配置中 `/api` 在 `/api/v1/sessions` 之前，所有 CCAAS 请求都会被路由到 Solution 后端。最具体的路由必须排在前面。
{% endhint %}

{% hint style="danger" %}
**陷阱 2：使用本地类型而不是 @ccaas/common。** 对于平台事件如 `OutputUpdateEvent` 和 `TextDeltaEvent`，始终使用 `@ccaas/common` 的类型。定义本地类型在事件格式变化时会导致不匹配。领域类型（Task、Project）是 Solution 特有的，应该在本地定义。
{% endhint %}

{% hint style="danger" %}
**陷阱 3：没有处理嵌套的 output\_update 结构。** `output_update` 事件有嵌套结构：`event.payload.data.field`。`@ccaas/react-sdk` 的 `parseOutputUpdate` 工具函数会为你处理这个。不要手动解析事件。
{% endhint %}

## 检查点

在继续测试之前，验证：

- [ ] 前端通过 `npm run dev` 启动并显示分屏布局
- [ ] 任务列表从 Solution 后端加载数据（或显示空状态）
- [ ] 聊天面板接受输入并显示用户消息
- [ ] 连接指示器显示 WebSocket 状态
- [ ] Vite 代理将 `/api` 路由到端口 3003，将 `/api/v1` 路由到端口 3001

验证 UI 正确加载：

```bash
cd solutions/task-manager-tutorial/frontend
npm run dev
# 在浏览器中打开 http://localhost:5281
```

你应该看到 Task Manager 分屏布局，左侧是空任务列表，右侧是 AI 聊天面板。

## 下一步

前端就位后，是时候编写测试来验证整个技术栈正常工作了。继续前往 [6.6 测试](06-testing.md)。
