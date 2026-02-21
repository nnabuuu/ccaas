# 前端集成指南

## 概述

即见Agentic 提供 Vue SDK（`@kedge-agentic/vue-sdk`）和 React SDK（`@kedge-agentic/react-sdk`），以及通用 Socket.io 集成模式，支持 Vue 和 React 前端框架。

## Vue SDK 集成

### 安装

```bash
npm install @kedge-agentic/vue-sdk@0.0.1-SNAPSHOT
```

### 基础架构

Vue SDK 采用 Composables-first 设计，提供三层架构：

```
Composables 层（开发者直接使用）
├── useAgentState    - Agent 连接与处理状态
├── useFormBridge    - 表单与 Agent 数据桥接
├── useAIEditing     - AI 编辑模式管理
├── usePlanMode      - 计划模式管理
├── useTodoProgress  - 任务进度追踪
└── useToolActivity  - 工具活动监控

Services 层（SDK 内部）
└── FormStateSynchronizer - 表单状态同步单例

Types & Symbols 层
└── 40+ 注入符号（Injection Keys）
```

### 快速开始

```vue
<!-- App.vue -->
<template>
  <AgentListener>
    <RouterView />
  </AgentListener>
</template>
```

```vue
<!-- 组件中使用 -->
<script setup lang="ts">
import { useAgentState, useTodoProgress } from '@kedge-agentic/vue-sdk'

const { isProcessing, currentToolName } = useAgentState()
const { progress, currentTodo, isComplete } = useTodoProgress()
</script>

<template>
  <div v-if="isProcessing" class="agent-status">
    <span>正在执行: {{ currentToolName }}</span>
    <ProgressBar :value="progress" />
  </div>
</template>
```

### 表单桥接

使用 `useFormBridge` 实现 AI Agent 与表单的双向数据同步：

```typescript
import { useFormBridge } from '@kedge-agentic/vue-sdk'

const form = reactive({ title: '', content: '' })

const { isActive } = useFormBridge({
  formId: 'my-form',
  readonly: false,
  getFormState: () => ({ ...form }),
  applyFormData: async (data) => {
    Object.assign(form, data)
    return { success: true, appliedFields: Object.keys(data) }
  },
  submit: async () => {
    await saveForm()
    return { success: true }
  }
})
```

### AI 编辑模式

使用 `useAIEditing` 管理 AI 批量编辑：

```typescript
import { useAIEditing } from '@kedge-agentic/vue-sdk'

const {
  aiEditingMode,
  aiCurrentSection,
  progress,
  startAIEditing,
  updateFromAI,
  completeAISection,
  finishAIEditing
} = useAIEditing({
  allSections: ['objectives', 'activities', 'assessment'],
  onSectionUpdate: (id, content) => {
    formData.value[id] = content
  },
  onComplete: () => {
    console.log('AI 编辑完成')
  }
})
```

## React SDK 集成 (@kedge-agentic/react-sdk)

### 安装

```bash
npm install @kedge-agentic/react-sdk@0.0.2-SNAPSHOT
```

### 核心 Hooks

React SDK 提供六个核心 Hooks，用于 Solution 开发：

#### 1. useAgentConnection

管理与 CCAAS 后端的 WebSocket 连接：

```typescript
import { useAgentConnection } from '@kedge-agentic/react-sdk'

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // CCAAS 后端
  tenantId: 'lesson-plan-designer',
  autoConnect: true,
})

// connection.socket - Socket.io 客户端实例
// connection.sendMessage(message, sessionId) - 发送聊天消息
// connection.cancelCompletion(sessionId) - 取消正在进行的请求
```

#### 2. useAgentChat

管理聊天消息与流式传输：

```typescript
import { useAgentChat } from '@kedge-agentic/react-sdk'

const chat = useAgentChat({
  sessionId,
  onComplete: (message) => console.log('完成:', message),
})

// chat.messages - 聊天消息数组
// chat.isStreaming - AI 是否正在响应
// chat.streamingContent - 当前流式文本内容
```

#### 3. useAgentStatus

追踪 Agent 处理状态：

```typescript
import { useAgentStatus } from '@kedge-agentic/react-sdk'

const status = useAgentStatus()

// status.isProcessing - Agent 是否正在工作
// status.currentTool - 当前执行的工具名称
// status.phase - 处理阶段（如 'tool_use'、'thinking'）
```

#### 4. usePageContext

上下文感知的 Skill 触发：

```typescript
import { usePageContext } from '@kedge-agentic/react-sdk'

const { setContext } = usePageContext()

// 设置上下文以影响 Skill 触发
setContext({
  page: 'lesson-plan-editor',
  lessonPlanId: '123',
  editMode: true
})
```

#### 5. useFiles

文件上传与管理：

```typescript
import { useFiles } from '@kedge-agentic/react-sdk'

const { files, uploadFile, removeFile } = useFiles({ sessionId })

const handleUpload = async (file: File) => {
  await uploadFile(file)
}
```

#### 6. useOutputSync

管理 AI 输出字段的 pending 状态（`output_update` 事件 → 用户点击 Sync → 应用到表单）。

```typescript
import { useOutputSync } from '@kedge-agentic/react-sdk'

const { pendingUpdates, addPendingUpdate, removePendingUpdate, clearPendingUpdates } =
  useOutputSync()

// output_update 事件触发时（通常在 useAgentChat 的 onOutputUpdate 回调中）
const chat = useAgentChat({
  connection,
  onOutputUpdate: (update) => addPendingUpdate(update.field, update.value),
})

// 用户点击某字段的 Sync 按钮
const handleSync = (field: string) => {
  applyField(field)           // 应用到表单
  removePendingUpdate(field)  // 清除 pending 状态
}

// 全部清除
clearPendingUpdates()
```

**返回值:**
- `pendingUpdates` - `Record<string, any>` — 当前 pending 字段及其值
- `addPendingUpdate(field, value)` - 添加/更新一个 pending 字段
- `removePendingUpdate(field)` - 移除某个 pending 字段
- `clearPendingUpdates()` - 清除所有 pending 字段

> 此 hook 替代了每个 Solution frontend 中的 30+ 行 pending state 样板代码。已在 rehab-motion-renderer 和 lesson-plan-designer 中落地。

### 完整集成示例

参见教程第 6.5 章，了解如何将所有 Hooks 组合使用的完整示例。

## 自定义 React 集成（高级）

> 大多数场景下，建议优先使用上文介绍的 `@kedge-agentic/react-sdk` Hooks。

React 应用也可以通过 Socket.io 直接集成。以下是底层 Hook 模式。

### useSocket Hook

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket(url: string) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    socketRef.current = io(url)
    return () => { socketRef.current?.disconnect() }
  }, [url])

  const sendMessage = useCallback((message: string, sessionId?: string) => {
    socketRef.current?.emit('chat', { message, sessionId })
  }, [])

  const cancel = useCallback((sessionId: string) => {
    socketRef.current?.emit('cancel', { sessionId })
  }, [])

  return { socket: socketRef.current, sendMessage, cancel }
}
```

### 事件处理

```typescript
useEffect(() => {
  if (!socket) return

  // 文本流
  socket.on('text_delta', (data) => {
    setMessages(prev => appendText(prev, data.delta))
  })

  // 结构化输出
  socket.on('output_update', (event) => {
    const { field, value } = event.payload.data
    setFormData(prev => ({ ...prev, [field]: value }))
  })

  // Agent 状态
  socket.on('agent_status', (data) => {
    setAgentStatus(data.status)
  })

  // 工具活动
  socket.on('tool_activity', (data) => {
    setCurrentTool(data.toolName)
  })

  return () => {
    socket.off('text_delta')
    socket.off('output_update')
    socket.off('agent_status')
    socket.off('tool_activity')
  }
}, [socket])
```

### 同步管理

> **如果使用 `@kedge-agentic/react-sdk`**，请直接使用 [`useOutputSync`](#6-useoutputsync)，该 Hook 已内置此模式。

以下是不使用 SDK 的自定义集成实现方式：

```typescript
export function useSyncManager() {
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any>>({})

  // 收到 output_update 时暂存
  const handleOutputUpdate = (field: string, value: any) => {
    setPendingUpdates(prev => ({ ...prev, [field]: value }))
  }

  // 用户点击同步按钮时应用
  const applyUpdate = (field: string) => {
    const value = pendingUpdates[field]
    setFormData(prev => ({ ...prev, [field]: value }))
    setPendingUpdates(prev => {
      const { [field]: _, ...rest } = prev
      return rest
    })
  }

  // 用户放弃更新
  const discardUpdate = (field: string) => {
    setPendingUpdates(prev => {
      const { [field]: _, ...rest } = prev
      return rest
    })
  }

  return { pendingUpdates, handleOutputUpdate, applyUpdate, discardUpdate }
}
```

## Socket.io 事件参考

| 事件 | 方向 | 数据格式 |
|------|------|----------|
| `chat` | 客户端→服务端 | `{ message, sessionId }` |
| `cancel` | 客户端→服务端 | `{ sessionId }` |
| `text_delta` | 服务端→客户端 | `{ text, sessionId }` |
| `output_update` | 服务端→客户端 | `{ payload: { data: { field, value } } }` |
| `agent_status` | 服务端→客户端 | `{ status, context? }` |
| `tool_activity` | 服务端→客户端 | `{ toolName, phase, description }` |
| `todo_update` | 服务端→客户端 | `{ todos, summary }` |
| `token_usage` | 服务端→客户端 | `{ inputTokens, outputTokens, ... }` |
| `error` | 服务端→客户端 | `{ code, message, recoverable }` |

## 最佳实践

1. **使用类型定义** —— 从 `@kedge-agentic/common` 导入事件类型
2. **统一解析** —— 使用 `parseOutputUpdateEvent` 处理 output\_update
3. **错误处理** —— 监听 `error` 事件并提供用户反馈
4. **状态指示** —— 利用 `agent_status` 和 `tool_activity` 展示执行进度
5. **断线重连** —— 实现 Socket.io 自动重连和会话恢复
