# 6.5 前端实现

在本节中，你将构建 Solution 的 React 前端。前端将五个模块化的 SDK hooks 与 Solution 特定逻辑相结合，创建一个分屏 UI：左侧是可编辑表单，右侧是 AI 聊天面板。学完本节后，你将理解真实的 CCAAS 前端如何将 `useAgentConnection`、`useAgentChat`、`useAgentStatus`、`usePageContext` 和 `useFiles` 组合成一个会话 hook。

## 架构回顾

在写代码之前，回顾前端在数据流中的位置：

```
┌──────────────────────────────────────────────────────────────┐
│                          前端                                 │
│                                                              │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐  ┌───────┐ │
│  │ 表单编辑器    │  │ 聊天面板    │  │ 文件视图  │  │ 任务  │ │
│  │ (REST)       │  │ (WebSocket)│  │ (SDK)    │  │ (SDK) │ │
│  └──────┬───────┘  └─────┬──────┘  └────┬─────┘  └───┬───┘ │
│         │                │              │             │      │
└─────────┼────────────────┼──────────────┼─────────────┼──────┘
          │                │              │             │
    Solution 后端        CCAAS          CCAAS         CCAAS
    (端口 3002)        (端口 3001)    (端口 3001)   (端口 3001)
    GET /api/plans    WebSocket      文件 API     SubAgents
```

前端与两个后端通信。领域数据（教案、教材）通过 REST 从 Solution 后端获取。聊天、文件、Agent 状态和实时事件通过 WebSocket 从 CCAAS 核心后端流入。

## 项目依赖

前端依赖 monorepo 中的两个工作区包：

```json
{
  "dependencies": {
    "@kedge-agentic/common": "file:../../../packages/common",
    "@kedge-agentic/react-sdk": "file:../../../packages/react-sdk",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.8.1"
  }
}
```

- **@kedge-agentic/common** -- 共享的 TypeScript 类型（`OutputUpdateEvent`、`TextDeltaEvent`、`TokenUsage`）
- **@kedge-agentic/react-sdk** -- 模块化 hooks 和预构建组件（`useAgentConnection`、`useAgentChat`、`useAgentStatus`、`usePageContext`、`useFiles`、`AgentActivityLine`、`OutputUpdateCard`）

## 第一步：理解 SDK Hook 架构

`@kedge-agentic/react-sdk` 提供五个核心 hooks，每个处理一个关注点：

| Hook | 职责 |
|------|------|
| `useAgentConnection` | Socket.io 连接、会话 ID 持久化、自动重连 |
| `useAgentChat` | 消息历史、文本流式传输、通过 REST 发送消息、会话生命周期 |
| `useAgentStatus` | 工具活动、思考状态、SubAgent 跟踪、待办事项 |
| `usePageContext` | 将当前页面/表单状态作为上下文随每条消息发送 |
| `useFiles` | 会话文件列表、上传、下载、新文件追踪 |

你的 Solution 在一个会话 hook（如 `useLessonPlanSession`）中组合这些 hooks，然后将返回的状态和操作传递给组件。

```
useLessonPlanSession()
├── useAgentConnection()    → connected, sessionId, socket
├── useAgentChat()          → messages, sendMessage, isProcessing
├── useAgentStatus()        → activeTools, activeSubAgents, isThinking
├── usePageContext()        → context, updateContext
├── useFiles()              → files, newFilesCount, uploadFile
├── useLessonPlanSync()     → pendingUpdates, syncToForm, undoSync  (Solution 特有)
├── useLessonPlanCRUD()     → lessonPlan, savePlan, loadPlan         (Solution 特有)
└── useSolutionConfig()     → mcpServers, skillPath                  (Solution 特有)
```

## 第二步：构建 Session Hook

Session hook 是前端的核心。它将 SDK hooks 与 Solution 特有逻辑组合成一个统一的 API。以下是备课方案设计器中使用的模式：

```typescript
// frontend/src/hooks/useLessonPlanSession.ts

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  useFiles,
  type Message,
} from '@kedge-agentic/react-sdk'
import { useLessonPlanSync } from './useLessonPlanSync'
import { useSolutionConfig } from './useSolutionConfig'
import { useLessonPlanCRUD } from './useLessonPlanCRUD'

// 重要：必须使用 CCAAS 后端的绝对 URL，不能使用相对路径
// Vite 代理仅适用于 HTML/CSS，不适用于 Socket.IO 连接
const SOCKET_URL = 'http://localhost:3001'

export function useLessonPlanSession(options = {}) {
  const { tenantId = 'lesson-plan-designer', autoConnect = true } = options

  // ===== 1. SDK 连接 =====
  const connection = useAgentConnection({
    serverUrl: SOCKET_URL,
    tenantId,
    autoConnect,
  })

  // ===== 2. Solution 配置（MCP 服务器、技能路径）=====
  const { config: solutionConfig } = useSolutionConfig()

  // ===== 3. 领域 CRUD =====
  const crud = useLessonPlanCRUD({ onError: (err) => setError(err) })

  // ===== 4. 页面上下文 =====
  const { context, updateContext } = usePageContext()

  // ===== 5. 表单同步状态 =====
  const {
    pendingUpdates, modifiedFields,
    addPendingUpdate, removePendingUpdate,
    syncToForm: doSyncToForm, undoSync: doUndoSync, canUndo,
    resetSyncState,
  } = useLessonPlanSync()

  // ===== 6. SDK 聊天 =====
  const chat = useAgentChat({
    connection,
    tenantId,
    mcpServers: solutionConfig?.mcpServers,
    skillPath: solutionConfig?.skillPath,
    context,
    onOutputUpdate: (update) => {
      // 将 SDK 的 output_update 事件桥接到同步 hook
      addPendingUpdate({
        field: update.field,
        value: update.value,
        preview: update.preview,
      })
    },
  })

  // ===== 7. SDK 状态 =====
  const status = useAgentStatus({ connection })

  // ===== 8. SDK 文件 =====
  const files = useFiles({
    connection,
    sessionId: connection.sessionId,
    enabled: connection.connected,
  })

  // 计算状态
  const hasActiveSubAgents = status.activeSubAgents.length > 0
  const isMainProcessing = chat.isProcessing && !hasActiveSubAgents

  // 教案变化时自动更新页面上下文
  useEffect(() => {
    if (crud.lessonPlan) {
      updateContext('lesson-plan-editor', {
        lessonPlanId: crud.lessonPlan.id,
        currentForm: {
          title: crud.lessonPlan.title,
          subject: crud.lessonPlan.subject,
          gradeLevel: crud.lessonPlan.gradeLevel,
          // ... 其他字段
        },
      })
    }
  }, [crud.lessonPlan, updateContext])

  return {
    // 连接
    connected: connection.connected,
    sessionId: connection.sessionId,
    connection,

    // 领域数据
    lessonPlan: crud.lessonPlan,
    loading: crud.loading,

    // 聊天
    messages: chat.messages,
    isProcessing: isMainProcessing,
    isLoadingHistory: chat.isLoadingHistory,
    currentStreamContent: chat.currentStreamContent,
    sendMessage: chat.sendMessage,
    clearConversation: chat.clearConversation,
    cancelProcessing: chat.cancelProcessing,

    // 状态
    activeTools: status.activeTools,
    activeSubAgents: status.activeSubAgents,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,
    tokenUsage: status.tokenUsage,
    todoItems: status.todoItems,
    todoStats: status.todoStats,

    // 文件
    newFilesCount: files.newFilesCount,

    // 表单同步
    pendingUpdates,
    modifiedFields,
    syncToForm, syncAll, discardUpdate, undoSync, canUndo,

    // CRUD
    saveLessonPlan: crud.savePlan,
    createNewPlan: crud.createPlan,
    updateField: crud.updateField,
    loadPlan,
  }
}
```

### 关键模式

**绝对 Socket URL。** 连接必须使用 `http://localhost:3001`，不能使用相对路径。Socket.IO 不会经过 Vite 的代理系统。

**tenantId 启用会话持久化。** 当提供 `tenantId` 时，SDK 会将 `sessionId` 持久化到 `localStorage` 的 `ccaas_session_{tenantId}` 键下。页面刷新后，会恢复相同的会话并自动加载消息历史。

**onOutputUpdate 桥接 SDK 与 Solution 同步。** `useAgentChat` hook 解析 `output_update` WebSocket 事件，并以 `{ field, value, preview }` 调用你的回调。你的 session hook 将这些转发给同步 hook，后者将它们排队为待处理更新。

**usePageContext 随每条消息发送表单状态。** 当用户发送聊天消息时，SDK 会附加当前的 `context` 对象，这样 AI agent 始终了解当前的表单内容。

## 第三步：构建聊天面板

ChatPanel 是主要的对话界面。在真实的 Solution 中，它包含多个标签页（消息、文件、任务）、活动状态行和待处理 AI 更新的同步区域。

```typescript
// frontend/src/components/ChatPanel.tsx

import { useState, useRef, useEffect } from 'react'
import {
  AgentActivityLine,
  useTaskTracking,
  TasksView,
  useMessageSplitter,
  AssistantMessageGroup,
  type ToolActivity,
} from '@kedge-agentic/react-sdk'
import type { Message, SyncField } from '../types'

export function ChatPanel({
  messages, isProcessing, connected, connection,
  activeTools, isThinking, thinkingContent,
  activeSubAgents, todoItems, todoStats,
  pendingUpdatesWithMeta,
  onSendMessage, onSync, onSyncAll, onDiscard, onCancel,
}) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 将长助手消息拆分为段落，提升可读性
  const { splitMessages } = useMessageSplitter({ messages })

  // 跟踪 SubAgent 任务，用于任务标签页
  const taskTracking = useTaskTracking({ activeSubAgents, todoItems })

  // 新消息时自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim() || isProcessing || !connected) return
    onSendMessage(inputValue.trim())
    setInputValue('')
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 标签栏：消息 | 文件 | 任务 */}
      {/* ... 标签切换 UI ... */}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          /* 渲染用户和助手消息 */
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Agent 活动状态行 -- 显示工具、思考、SubAgents */}
      <AgentActivityLine
        isProcessing={isProcessing}
        isThinking={isThinking}
        thinkingContent={thinkingContent}
        activeTools={activeTools}
        activeSubAgents={activeSubAgents}
        todoItems={todoItems}
        todoStats={todoStats}
        onCancel={onCancel}
      />

      {/* 全局同步区域 -- 待处理的 output_update 项目 */}
      <GlobalSyncSection
        pendingUpdates={pendingUpdatesWithMeta}
        onSyncAll={onSyncAll}
        onSyncField={onSync}
        onDiscardField={onDiscard}
      />

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
        <div className="flex gap-3">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={connected ? '输入您的需求...' : '正在连接...'}
            disabled={!connected}
          />
          <button type="submit" disabled={!inputValue.trim() || isProcessing}>
            发送
          </button>
        </div>
      </form>
    </div>
  )
}
```

### 关键特性

**AgentActivityLine。** 这是一个预构建的 SDK 组件，渲染紧凑的状态栏，显示 agent 当前正在做什么：活跃的工具、思考状态、SubAgent 进度和待办事项。所有 CCAAS Solution 都使用相同的组件。

**useMessageSplitter。** 包含多个工具调用和文本段的长助手消息被拆分为独立的视觉块，提升可读性。

**useTaskTracking。** 将 SubAgent 和待办数据聚合成组，用于任务标签页，并提供未读计数的徽章状态。

**GlobalSyncSection。** 显示所有来自 AI 的待处理 `output_update` 项目，支持"全部同步"和单个字段的"同步"/"忽略"操作。

## 第四步：处理 output\_update 事件

当 AI agent 通过 MCP 调用 `write_output` 时，CCAAS 通过 WebSocket 发送 `output_update` 事件。SDK 的 `useAgentChat` hook 解析这些事件并调用你的 `onOutputUpdate` 回调。你的 Solution 然后渲染同步卡片，让用户审查并应用 AI 的建议。

### OutputUpdateCard 组件

SDK 提供 `OutputUpdateCard` 用于渲染每个待处理的更新：

```typescript
// frontend/src/components/SyncButton.tsx

import { OutputUpdateCard } from '@kedge-agentic/react-sdk'
import type { SyncField } from '../types'

const FIELD_LABELS: Record<SyncField, string> = {
  title: '标题',
  objectives: '学习目标',
  content: '学习过程',
  // ... 将每个 SyncField 映射为可读标签
}

export function SyncButton({ field, preview, synced, syncedAt, onSync, onDiscard }) {
  return (
    <OutputUpdateCard
      field={field}
      fieldLabel={FIELD_LABELS[field]}
      preview={preview}
      synced={synced}
      syncedAt={syncedAt}
      onSync={onSync}
      onDiscard={onDiscard}
    />
  )
}
```

### 同步 Hook

同步 hook 管理待处理更新的生命周期：排队、应用和撤销：

```typescript
// frontend/src/hooks/useLessonPlanSync.ts

export function useLessonPlanSync() {
  const [pendingUpdates, setPendingUpdates] = useState(new Map())
  const [modifiedFields, setModifiedFields] = useState(new Set())
  const [undoStack, setUndoStack] = useState([])

  const addPendingUpdate = (update) => {
    setPendingUpdates(prev => new Map(prev).set(update.field, update))
  }

  const syncToForm = (field, lessonPlan, setLessonPlan) => {
    const update = pendingUpdates.get(field)
    if (!update) return

    // 保存之前的值用于撤销
    const previousValue = lessonPlan[field]

    // 将归一化后的值应用到表单
    setLessonPlan({ ...lessonPlan, [field]: normalizeFieldValue(field, update.value) })

    // 标记为已修改，添加到撤销栈（30秒超时）
    setModifiedFields(prev => new Set(prev).add(field))
    // ... 撤销超时逻辑
  }

  const undoSync = (field, lessonPlan, setLessonPlan) => {
    // 从撤销栈恢复之前的值
    // 从已修改字段中移除
  }

  return {
    pendingUpdates, modifiedFields,
    addPendingUpdate, removePendingUpdate,
    syncToForm, undoSync, canUndo, resetSyncState,
  }
}
```

关键设计决策：

- **默认人在回路中。** 更新被排队为待处理状态，不会自动应用。用户审查后点击"同步到表单"。
- **30秒撤销窗口。** 同步后，用户可以在 30 秒内撤销。
- **字段归一化。** 来自 AI 的值被归一化为期望的类型（如 `gradeLevel` 转为 `Number`，`curriculumRequirements` 转为 `Array`）。
- **已修改字段跟踪。** 从 AI 输出同步的字段会有视觉指示器（如蓝色左边框），让用户看到 AI 修改了哪些部分。

## 第五步：通过 WebSocket 跟踪 SubAgent

当 AI agent 创建 SubAgent（如 Task 或 Explore agent）时，CCAAS 发送实时 WebSocket 事件。SDK 完全处理这一切 -- 无需轮询。

**数据流：**

1. 后端 `EventMapperService` 维护 `activeSubAgentsMap` 并发射 `subagent_started` / `subagent_completed` 事件
2. SDK 的 `useAgentStatus` 监听这些事件并维护 `activeSubAgents` 状态
3. 你的 session hook 导出 `activeSubAgents` 给 UI
4. `AgentActivityLine` 显示活跃的 SubAgent 及实时计时器

```typescript
// SDK 提供的 ActiveSubAgent 类型：
interface ActiveSubAgent {
  subAgentId: string        // 唯一标识符（toolUseId）
  agentType: string         // 'Explore' | 'Task' | 'general-purpose'
  description?: string      // SubAgent 正在做什么
  startedAt: string         // ISO 时间戳，用于计时
  status: 'running' | 'completed' | 'failed'
  nestingLevel?: number     // 0=主 agent, 1=subagent, 2=嵌套
}
```

`AgentActivityLine` 组件以紧凑的可展开视图渲染 SubAgent。每个 SubAgent 显示其类型、描述和实时运行时长。已完成或失败的 SubAgent 在 3 秒后自动移除。

{% hint style="info" %}
**为什么用 WebSocket 而不是轮询？** 早期实现使用 `useSubAgentPolling` 定期调用 REST API。这已被移除，因为 WebSocket 提供即时更新（对比轮询的 2-10 秒延迟），消除了不必要的 HTTP 请求，并避免了轮询数据与 WebSocket 数据之间的状态同步问题。
{% endhint %}

## 第六步：会话持久化

会话持久化内置在 SDK hooks 中。当向 `useAgentConnection` 提供 `tenantId` 时，会话会自动跨页面刷新持久化。

**工作原理：**

1. `useAgentConnection` 生成 `conv_{uuid}` 会话 ID 并存储在 `localStorage` 的 `ccaas_session_{tenantId}` 键下
2. 重新连接时，使用相同的会话 ID 重新加入 WebSocket 房间
3. `useAgentChat` 自动通过 `GET /api/v1/sessions/{sessionId}/messages` 获取消息历史
4. 加载历史时，`chat.isLoadingHistory` 为 `true` -- 显示加载指示器

**开始新对话：**

```typescript
// clearConversation 做三件事：
// 1. 清除 UI 中的消息
// 2. 从 localStorage 移除保存的 sessionId
// 3. 生成新的 conv_{uuid} 并重新连接
chat.clearConversation()
```

**加载状态：**

```typescript
if (chat.isLoadingHistory) {
  return <div>正在加载对话历史...</div>
}
```

## 第七步：使用 usePageContext 发送页面上下文

`usePageContext` hook 将当前页面状态作为上下文随每条聊天消息发送。这让 AI agent 无需用户描述就能了解当前的表单内容。

```typescript
const { context, updateContext } = usePageContext()

// 表单变化时更新上下文
useEffect(() => {
  if (lessonPlan) {
    updateContext('lesson-plan-editor', {
      lessonPlanId: lessonPlan.id,
      currentForm: {
        title: lessonPlan.title,
        subject: lessonPlan.subject,
        objectives: lessonPlan.objectives,
        content: lessonPlan.content,
        // ... 其他字段
      },
    })
  }
}, [lessonPlan, updateContext])
```

当 `context` 传递给 `useAgentChat` 时，它会自动附加到发送给后端的每条消息。AI agent 可以在响应中引用当前的表单状态。

## 第八步：使用 useFiles 管理文件

`useFiles` hook 提供会话文件管理：列表、上传、下载和跟踪 AI agent 创建的新文件。

```typescript
const files = useFiles({
  connection,
  sessionId: connection.sessionId,
  enabled: connection.connected,
})

// files.files         -- FileMetadata 数组
// files.newFilesCount -- 未读文件数量（用于徽章显示）
// files.hasNewFiles   -- 布尔快捷方式
// files.uploadFile    -- 上传文件到会话
// files.markAsSynced  -- 标记文件为已读
// files.markAllSeen   -- 标记所有文件为已读
```

FilesView 组件渲染一个文件浏览器，包含基于 MIME 类型的图标、文件大小显示、下载按钮，以及可选的"附加"按钮将文件链接到领域实体。

## 组合页面

页面组件将所有内容组合在一起。典型的 CCAAS Solution 使用分屏布局：左侧是领域内容，右侧是聊天面板。

```typescript
// frontend/src/App.tsx

import { useLessonPlanSession } from './hooks/useLessonPlanSession'
import { LessonPlanContent } from './components/LessonPlanContent'
import { ChatPanel } from './components/ChatPanel'

function App() {
  const session = useLessonPlanSession()

  return (
    <div className="flex h-screen">
      {/* 左侧面板：表单编辑器 */}
      <div className="flex-1 overflow-auto">
        <LessonPlanContent
          lessonPlan={session.lessonPlan}
          modifiedFields={session.modifiedFields}
          canUndo={session.canUndo}
          onUndo={session.undoSync}
          onChange={session.updateField}
        />
      </div>

      {/* 右侧面板：聊天 */}
      <div className="w-[400px] flex flex-col border-l">
        <ChatPanel
          messages={session.messages}
          isProcessing={session.isProcessing}
          connected={session.connected}
          connection={session.connection}
          activeTools={session.activeTools}
          activeSubAgents={session.activeSubAgents}
          isThinking={session.isThinking}
          thinkingContent={session.thinkingContent}
          todoItems={session.todoItems}
          todoStats={session.todoStats}
          pendingUpdatesWithMeta={session.pendingUpdatesWithMeta}
          newFilesCount={session.newFilesCount}
          sessionId={session.sessionId}
          onSendMessage={session.sendMessage}
          onSync={session.syncToForm}
          onSyncAll={session.syncAll}
          onDiscard={session.discardUpdate}
          onCancel={session.cancelProcessing}
          onClearConversation={session.clearConversation}
        />
      </div>
    </div>
  )
}
```

## 常见陷阱

{% hint style="danger" %}
**陷阱 1：Socket.IO 使用相对 URL。** Vite 的代理仅适用于浏览器同源上下文中的 HTTP 请求。Socket.IO 创建自己的连接，不经过 Vite 的代理。始终使用绝对 URL `http://localhost:3001`。
{% endhint %}

{% hint style="danger" %}
**陷阱 2：定义本地事件类型而不使用 @kedge-agentic/common。** 对于平台事件如 `OutputUpdateEvent` 和 `TextDeltaEvent`，始终从 `@kedge-agentic/common` 导入类型。定义本地类型在事件格式变化时会导致不匹配。领域类型（LessonPlan、Task）是 Solution 特有的，应该在本地定义。
{% endhint %}

{% hint style="danger" %}
**陷阱 3：轮询 SubAgent 状态。** SubAgent 跟踪完全由 SDK 的 `useAgentStatus` hook 通过 WebSocket 事件（`subagent_started`、`subagent_completed`）处理。不要添加轮询机制 -- 它引入延迟、不必要的 HTTP 请求和状态同步问题。
{% endhint %}

{% hint style="danger" %}
**陷阱 4：忘记将 context 传递给 useAgentChat。** 如果你使用 `usePageContext` 但忘记将 `context` 对象传递给 `useAgentChat`，AI agent 将不会收到当前的表单状态。始终在聊天 hook 选项中包含 `context`。
{% endhint %}

## 检查点

在继续测试之前，验证：

- [ ] 前端通过 `npm run dev` 启动并显示分屏布局
- [ ] 聊天面板连接到 CCAAS（绿色连接指示器）
- [ ] 发送消息后收到带有流式文本的 AI 响应
- [ ] `output_update` 事件渲染为带有"同步到表单"按钮的同步卡片
- [ ] 点击"同步到表单"应用 AI 建议并显示撤销选项
- [ ] SubAgent 活动在 AgentActivityLine 中显示，无需任何轮询
- [ ] 页面刷新恢复对话并加载消息历史
- [ ] "新对话"清除消息并开始新的会话

## 下一步

前端就位后，是时候编写测试来验证整个技术栈正常工作了。继续前往 [6.6 测试](06-testing.md)。
