# @ccaas/react-sdk

React SDK for building Claude Code as a Service solutions with chat UI, real-time updates, and agent status tracking.

## Features

- **Chat Components**: Pre-built ChatPanel, MessageBubble, AgentActivityLine
- **React Hooks**: Modular hooks for connection, chat, status, and layout
- **Real-time Updates**: Socket.io integration with automatic reconnection
- **Agent Tracking**: Monitor tool execution, subagents, thinking, and todos
- **Form Sync**: Output update protocol for AI-suggested form changes
- **Layout Controls**: Multiple chat modes (default, overlay, expanded)
- **Type Safe**: Full TypeScript support with types from @ccaas/common

## Installation

```bash
npm install @ccaas/react-sdk @ccaas/common socket.io-client
```

## Quick Start

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

## Core Hooks

### useAgentConnection

Manages WebSocket connection to CCAAS backend.

```tsx
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  sessionPrefix: 'my-solution',
  autoConnect: true,
  reconnectionAttempts: 5
})

// Returns:
// - connected: boolean
// - sessionId: string
// - socket: Socket | null
// - connect: () => void
// - disconnect: () => void
```

### useAgentChat

Handles chat messages and user input.

```tsx
const chat = useAgentChat({
  connection,
  tenantId: 'default'
})

// Returns:
// - messages: Message[]
// - sendMessage: (content: string) => void
```

### useAgentStatus

Tracks agent execution status.

```tsx
const status = useAgentStatus({ connection })

// Returns:
// - isProcessing: boolean
// - activeTools: Map<string, ToolActivity>
// - activeSubAgents: ActiveSubAgent[]
// - isThinking: boolean
// - thinkingContent: string
// - todoItems: TodoItem[]
// - todoStats: TodoStats | null
```

### useChatLayout

Manages chat UI layout state.

```tsx
const layout = useChatLayout()

// Returns:
// - mode: 'default' | 'overlay' | 'expanded'
// - isCollapsed: boolean
// - setMode: (mode) => void
// - setCollapsed: (collapsed: boolean) => void
// - toggleCollapsed: () => void
```

### useSkills

Manages solution skills (CRUD operations).

```tsx
const { skills, enabledSkills, toggleSkill, createSkill, deleteSkill } =
  useSkills({ tenantId: 'default' })
```

## Chat Components

### ChatPanel

Main chat interface with message list, input, and activity line.

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
      {/* Custom content */}
    </MessageBubble>
  )}
  renderQuickActions={() => (
    <QuickActions actions={actions} onAction={sendMessage} />
  )}
/>
```

### MessageBubble

Individual message display with role-based styling.

```tsx
<MessageBubble
  message={message}
  colorScheme="blue"  // or "purple", "green", etc.
>
  {/* Optional children for custom content */}
</MessageBubble>
```

### AgentActivityLine

Status bar showing tool execution, thinking, todos, and subagents.

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

Features:
- Expandable details panel
- Task hierarchy visualization
- Live subagent tracking with duration timers
- Todo list with status indicators
- Thinking content display
- Cancel button

### OutputUpdateCard

Display AI-suggested content updates with sync/discard actions.

```tsx
<OutputUpdateCard
  field="title"
  fieldLabel="Title"
  preview="Suggested title..."
  synced={false}
  icon="sync"  // or "download", "attach", or ReactNode
  syncLabel="Sync to Form"
  onSync={() => handleSync('title')}
  onDiscard={() => handleDiscard('title')}
/>
```

### QuickActions

Quick action buttons for common prompts.

```tsx
<QuickActions
  actions={[
    { id: 'summarize', label: 'Summarize', prompt: 'Summarize this' },
    { id: 'translate', label: 'Translate', prompt: 'Translate to English' }
  ]}
  onAction={(prompt) => sendMessage(prompt)}
  renderAction={(action, onClick) => (
    <button onClick={onClick}>{action.label}</button>
  )}
/>
```

### SubAgentCard

Display individual subagent progress.

```tsx
<SubAgentCard
  subAgent={{
    subAgentId: 'agent-123',
    agentType: 'Explore',
    status: 'running',
    description: 'Exploring codebase...',
    startedAt: new Date().toISOString()
  }}
/>
```

### ChatLayoutControls

UI controls for switching chat layout modes.

```tsx
<ChatLayoutControls
  mode={mode}
  onModeChange={setMode}
  isCollapsed={isCollapsed}
  onToggleCollapse={toggleCollapsed}
  colorScheme="blue"
/>
```

## Advanced Usage

### Custom Hook Pattern

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

  // Add solution-specific logic
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

### Custom Message Rendering

```tsx
<ChatPanel
  {...props}
  renderMessage={(msg) => (
    <MessageBubble message={msg}>
      {/* Render output updates */}
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

      {/* Render file attachments */}
      {msg.attachments?.map(file => (
        <FileCard key={file.id} file={file} />
      ))}
    </MessageBubble>
  )}
/>
```

### Form Synchronization

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

## TypeScript Support

All components and hooks are fully typed. Import types from `@ccaas/common`:

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

## Testing

The SDK includes both unit and integration tests to ensure reliability.

### Running Tests

```bash
# Run all tests (unit + integration)
npm test

# Run only unit tests (fast, no backend required)
npm run test:unit

# Run only integration tests (requires backend running)
npm run test:integration

# Watch mode for development
npm run test:watch
```

### Integration Tests

Integration tests verify the SDK works correctly with a real CCAAS backend. They test:

- WebSocket connection establishment
- REST API endpoints (`/api/v1/sessions/:id/completion`)
- Message flow (send message → receive events)
- Multi-session concurrency
- Real-time event streaming

**Prerequisites:**

Before running integration tests, start the CCAAS backend:

```bash
cd packages/backend
npm run start:dev
```

The backend must be running on `http://localhost:3001` for integration tests to pass.

**Integration Test Coverage:**

| Test Suite | Coverage |
|------------|----------|
| `backend.test.ts` | Backend availability, endpoint existence |
| `websocket.test.ts` | WebSocket connections, client IDs, concurrent connections |
| `completion.test.ts` | REST endpoint validation, DTO validation, parameters |
| `message-flow.test.ts` | Complete message lifecycle, event streaming, follow-ups |

**CI/CD Setup:**

For CI pipelines, ensure the CCAAS backend is started before running integration tests:

```yaml
- name: Start CCAAS Backend
  run: |
    cd packages/backend
    npm run start:dev &
    sleep 5

- name: Run Integration Tests
  run: |
    cd packages/react-sdk
    npm run test:integration
```

## Socket Events

The SDK listens for these standard events from the backend:

- `chat_message` - New assistant message
- `text_delta` - Streaming text updates
- `output_update` - AI-suggested form updates
- `tool_activity` - Tool execution tracking
- `agent_status` - Agent completion/error
- `subagent_started` - SubAgent execution started
- `subagent_completed` - SubAgent execution completed
- `agent_thinking` - Thinking content
- `todo_created`, `todo_updated` - Todo tracking

## Examples

See complete examples in:

- `solutions/ccaas-demo` - Basic chat with file tracking
- `solutions/lesson-plan-designer` - Form sync with output updates

## Documentation

- [Chat Integration Guide](./docs/CHAT_INTEGRATION_GUIDE.md) - Complete integration tutorial
- [Solution Template](../../docs/SOLUTION_TEMPLATE.md) - Template for new solutions
- [Backend Events](../backend/CLAUDE.md#socket-events) - Backend event reference

## Contributing

When adding new components or hooks:

1. Add TypeScript types to `@ccaas/common` if shared
2. Document props with JSDoc comments
3. Add examples to this README
4. Update CHAT_INTEGRATION_GUIDE.md if needed
5. Run `npm run build` to verify

## License

See repository root LICENSE file.
