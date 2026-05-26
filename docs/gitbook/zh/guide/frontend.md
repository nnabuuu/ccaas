# 前端集成指南

## 概述

即见Agentic 提供 Vue SDK（`@kedge-agentic/vue-sdk`）和 React SDK（`@kedge-agentic/react-sdk`），默认使用 SSE（Server-Sent Events）实时通信，支持 Vue 和 React 前端框架。

## 认证

### API Key 认证

所有 API 请求需要 API Key，通过以下两种方式之一传递：

- `Authorization: Bearer sk-...`
- `X-API-Key: sk-...`

### useAuth Hook（chat-interface）

`@kedge-agentic/chat-interface` 包提供 `useAuth` hook 用于管理 API Key 认证：

```typescript
import { useAuth } from '@kedge-agentic/chat-interface'

const { apiKey, isAuthenticated, login, logout } = useAuth()

// 使用 API Key 登录
login('sk-my-api-key')

// 检查认证状态
if (isAuthenticated) {
  // API Key 存储在 localStorage 中，自动附加到请求
}

// 登出清除存储的 Key
logout()
```

### ApiKeyLogin 组件

提供即用型登录组件，包含两个标签页：

1. **账号登录** — 用户名/密码表单（调用 `POST /auth/login`，仅开发环境）
2. **API Key** — 直接输入 API Key

```typescript
import { ApiKeyLogin } from '@kedge-agentic/chat-interface'

<ApiKeyLogin
  serverUrl="http://localhost:3001"
  onLoginSuccess={(apiKey) => console.log('已登录')}
/>
```

### 嵌入模式

在嵌入场景中，通过 URL 参数传入 API Key：

```
https://your-app.com/chat?apiKey=sk-your-key
```

Key 会自动从 URL 中提取并存储到 localStorage，同时从地址栏中移除以保证安全。

## Vue SDK 集成

### 安装

```bash
npm install @kedge-agentic/vue-sdk@0.2.0
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
npm install @kedge-agentic/react-sdk@0.2.0
```

### 核心 Hooks

React SDK 提供六个核心 Hooks，用于 Solution 开发：

#### 1. useAgentConnection

管理与 CCAAS 后端的连接（SSE 默认）：

```typescript
import { useAgentConnection } from '@kedge-agentic/react-sdk'

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // CCAAS 后端
  solutionId: 'lesson-plan-designer',
  autoConnect: true,
})

// connection.connected - 连接状态
// connection.sessionId - 当前会话 ID（持久化在 localStorage）
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

## 事件参考（SSE）

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
5. **断线重连** —— SDK 内置 SSE 自动重连和会话恢复
