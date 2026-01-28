# 前端集成指南

## 概述

LoopAI 提供 Vue SDK（`@ccaas/vue-sdk`）和通用 Socket.io 集成模式，支持 Vue 和 React 前端框架。

## Vue SDK 集成

### 安装

```bash
npm install @ccaas/vue-sdk
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
import { useAgentState, useTodoProgress } from '@ccaas/vue-sdk'

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
import { useFormBridge } from '@ccaas/vue-sdk'

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
import { useAIEditing } from '@ccaas/vue-sdk'

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

## React 集成

React 应用通过 Socket.io 直接集成。以下是核心 Hook 模式。

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
    setMessages(prev => appendText(prev, data.text))
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

实现"同步按钮"模式，让用户选择是否接受 AI 生成的内容：

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

1. **使用类型定义** —— 从 `@ccaas/shared` 导入事件类型
2. **统一解析** —— 使用 `parseOutputUpdateEvent` 处理 output\_update
3. **错误处理** —— 监听 `error` 事件并提供用户反馈
4. **状态指示** —— 利用 `agent_status` 和 `tool_activity` 展示执行进度
5. **断线重连** —— 实现 Socket.io 自动重连和会话恢复
