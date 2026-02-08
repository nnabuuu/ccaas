# @ccaas/react-sdk

用于构建 Claude Code 即服务解决方案的 React SDK，提供聊天 UI、实时更新和智能体状态追踪。

## 特性

- **聊天组件**：预构建的 ChatPanel、MessageBubble、AgentActivityLine
- **React Hooks**：用于连接、聊天、状态和布局的模块化 hooks
- **实时更新**：Socket.io 集成，自动重连
- **智能体追踪**：监控工具执行、子智能体、思考和待办事项
- **表单同步**：用于 AI 建议的表单更改的输出更新协议
- **布局控制**：多种聊天模式（默认、覆盖、展开）
- **类型安全**：完整的 TypeScript 支持，类型来自 @ccaas/common

## 安装

```bash
npm install @ccaas/react-sdk @ccaas/common socket.io-client
```

## 快速开始

```tsx
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  ChatPanel
} from '@ccaas/react-sdk'

function App() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'demo'
  })

  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })

  return (
    <ChatPanel
      messages={chat.messages}
      isProcessing={status.isProcessing}
      connected={connection.connected}
      activeTools={status.activeTools}
      onSendMessage={chat.sendMessage}
    />
  )
}
```

## 核心 Hooks

### useAgentConnection

管理与 CCAAS 后端的 WebSocket 连接。

```tsx
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  sessionPrefix: 'my-solution',
  autoConnect: true,
  reconnectionAttempts: 5
})

// 返回：
// - connected: boolean
// - sessionId: string
// - socket: Socket | null
// - connect: () => void
// - disconnect: () => void
```

### useAgentChat

处理聊天消息和用户输入。

```tsx
const chat = useAgentChat({
  connection,
  tenantId: 'default'
})

// 返回：
// - messages: Message[]
// - sendMessage: (content: string) => void
```

### useAgentStatus

追踪智能体执行状态。

```tsx
const status = useAgentStatus({ connection })

// 返回：
// - isProcessing: boolean
// - activeTools: Map<string, ToolActivity>
// - activeSubAgents: ActiveSubAgent[]
// - isThinking: boolean
// - thinkingContent: string
// - todoItems: TodoItem[]
// - todoStats: TodoStats | null
```

### useChatLayout

管理聊天 UI 布局状态。

```tsx
const layout = useChatLayout()

// 返回：
// - mode: 'default' | 'overlay' | 'expanded'
// - isCollapsed: boolean
// - setMode: (mode) => void
// - setCollapsed: (collapsed: boolean) => void
// - toggleCollapsed: () => void
```

### useSkills

管理解决方案技能（CRUD 操作）。

```tsx
const { skills, enabledSkills, toggleSkill, createSkill, deleteSkill } =
  useSkills({ tenantId: 'default' })
```

## 聊天组件

### ChatPanel

主要聊天界面，包含消息列表、输入和活动线。

```tsx
<ChatPanel
  messages={messages}
  isProcessing={isProcessing}
  connected={connected}
  activeTools={activeTools}
  activeSubAgents={activeSubAgents}
  isThinking={isThinking}
  thinkingContent={thinkingContent}
  todoItems={todoItems}
  todoStats={todoStats}
  onSendMessage={sendMessage}
  onCancel={() => socket?.emit('cancel')}
  renderMessage={(msg) => (
    <MessageBubble message={msg}>
      {/* 自定义内容 */}
    </MessageBubble>
  )}
  renderQuickActions={() => (
    <QuickActions actions={actions} onAction={sendMessage} />
  )}
/>
```

### MessageBubble

基于角色样式的单个消息显示。

```tsx
<MessageBubble
  message={message}
  colorScheme="blue"  // 或 "purple"、"green" 等
>
  {/* 可选的子元素用于自定义内容 */}
</MessageBubble>
```

### AgentActivityLine

显示工具执行、思考、待办事项和子智能体的状态栏。

```tsx
<AgentActivityLine
  isProcessing={isProcessing}
  isThinking={isThinking}
  thinkingContent={thinkingContent}
  activeTools={activeTools}
  activeSubAgents={activeSubAgents}
  todoItems={todoItems}
  todoStats={todoStats}
  onCancel={() => socket?.emit('cancel')}
/>
```

特性：
- 可展开的详情面板
- 任务层次结构可视化
- 带持续时间计时器的实时子智能体追踪
- 带状态指示器的待办事项列表
- 思考内容显示
- 取消按钮

### OutputUpdateCard

显示 AI 建议的内容更新，带有同步/丢弃操作。

```tsx
<OutputUpdateCard
  field="title"
  fieldLabel="标题"
  preview="建议的标题..."
  synced={false}
  icon="sync"  // 或 "download"、"attach" 或 ReactNode
  syncLabel="同步到表单"
  onSync={() => handleSync('title')}
  onDiscard={() => handleDiscard('title')}
/>
```

### QuickActions

常用提示的快速操作按钮。

```tsx
<QuickActions
  actions={[
    { id: 'summarize', label: '总结', prompt: '总结这个' },
    { id: 'translate', label: '翻译', prompt: '翻译成英文' }
  ]}
  onAction={(prompt) => sendMessage(prompt)}
  renderAction={(action, onClick) => (
    <button onClick={onClick}>{action.label}</button>
  )}
/>
```

### SubAgentCard

显示单个子智能体的进度。

```tsx
<SubAgentCard
  subAgent={{
    subAgentId: 'agent-123',
    agentType: 'Explore',
    status: 'running',
    description: '正在探索代码库...',
    startedAt: new Date().toISOString()
  }}
/>
```

### ChatLayoutControls

用于切换聊天布局模式的 UI 控件。

```tsx
<ChatLayoutControls
  mode={mode}
  onModeChange={setMode}
  isCollapsed={isCollapsed}
  onToggleCollapse={toggleCollapsed}
  colorScheme="blue"
/>
```

## 高级用法

### 自定义 Hook 模式

```tsx
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  useChatLayout
} from '@ccaas/react-sdk'

export function useMySession() {
  const connection = useAgentConnection({
    serverUrl: process.env.REACT_APP_BACKEND_URL,
    sessionPrefix: 'my-solution'
  })

  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })
  const layout = useChatLayout()

  // 添加特定于解决方案的逻辑
  const [customState, setCustomState] = useState(...)

  return {
    ...connection,
    ...chat,
    ...status,
    ...layout,
    customState,
    setCustomState
  }
}
```

### 自定义消息渲染

```tsx
<ChatPanel
  {...props}
  renderMessage={(msg) => (
    <MessageBubble message={msg}>
      {/* 渲染输出更新 */}
      {msg.outputUpdates?.map(update => (
        <OutputUpdateCard
          key={update.field}
          field={update.field}
          fieldLabel={FIELD_LABELS[update.field]}
          preview={update.preview}
          onSync={() => syncToForm(update.field)}
          onDiscard={() => discardUpdate(update.field)}
        />
      ))}

      {/* 渲染文件附件 */}
      {msg.attachments?.map(file => (
        <FileCard key={file.id} file={file} />
      ))}
    </MessageBubble>
  )}
/>
```

### 表单同步

```tsx
function useFormSync<T>(initialForm: T) {
  const connection = useAgentConnection({...})
  const [formData, setFormData] = useState(initialForm)
  const [pendingUpdates, setPendingUpdates] = useState(new Map())

  useEffect(() => {
    if (!connection.socket) return

    const handleOutputUpdate = (event: OutputUpdateEvent) => {
      const { field, value, preview } = event.payload.data
      setPendingUpdates(prev => new Map(prev).set(field, { value, preview }))
    }

    connection.socket.on('output_update', handleOutputUpdate)
    return () => connection.socket.off('output_update', handleOutputUpdate)
  }, [connection.socket])

  const syncToForm = (field: string) => {
    const update = pendingUpdates.get(field)
    if (update) {
      setFormData(prev => ({ ...prev, [field]: update.value }))
      setPendingUpdates(prev => {
        const next = new Map(prev)
        next.delete(field)
        return next
      })
    }
  }

  return { formData, pendingUpdates, syncToForm }
}
```

## TypeScript 支持

所有组件和 hooks 都完全类型化。从 `@ccaas/common` 导入类型：

```tsx
import type {
  Message,
  ToolActivity,
  ActiveSubAgent,
  TodoItem,
  OutputUpdateEvent
} from '@ccaas/common'

import type {
  AgentConnectionConfig,
  ChatLayoutMode
} from '@ccaas/react-sdk'
```

## Socket 事件

SDK 监听来自后端的这些标准事件：

- `chat_message` - 新的助手消息
- `text_delta` - 流式文本更新
- `output_update` - AI 建议的表单更新
- `tool_activity` - 工具执行追踪
- `agent_status` - 智能体完成/错误
- `subagent_started` - 子智能体执行开始
- `subagent_completed` - 子智能体执行完成
- `agent_thinking` - 思考内容
- `todo_created`, `todo_updated` - 待办事项追踪

## 示例

查看完整示例：

- `solutions/ccaas-demo` - 带文件追踪的基本聊天
- `solutions/lesson-plan-designer` - 带输出更新的表单同步

## 文档

- [聊天集成指南](./docs/CHAT_INTEGRATION_GUIDE.md) - 完整集成教程
- [解决方案模板](../../docs/SOLUTION_TEMPLATE.md) - 新解决方案模板
- [后端事件](../backend/CLAUDE.md#socket-events) - 后端事件参考

## 贡献

添加新组件或 hooks 时：

1. 如果共享，将 TypeScript 类型添加到 `@ccaas/common`
2. 使用 JSDoc 注释记录 props
3. 在此 README 中添加示例
4. 如有需要，更新 CHAT_INTEGRATION_GUIDE.md
5. 运行 `npm run build` 验证

## 许可证

参见仓库根目录的 LICENSE 文件。
