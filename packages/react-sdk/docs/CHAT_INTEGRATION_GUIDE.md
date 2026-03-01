# Chat Integration Guide

This guide shows how to integrate the CCAAS chat components into your solution.

## Quick Start: 5 Steps to Chat

### 1. Install Dependencies

```json
{
  "dependencies": {
    "@kedge-agentic/react-sdk": "workspace:*",
    "@kedge-agentic/common": "workspace:*"
  }
}
```

### 2. Create Your Custom Hook

Combine SDK hooks with your solution-specific logic:

```typescript
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  useChatLayout
} from '@kedge-agentic/react-sdk'

export function useMySession() {
  // Core SDK hooks
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my-solution',
  })

  const chat = useAgentChat({
    connection,
    tenantId: 'default'
  })

  const status = useAgentStatus({ connection })
  const layout = useChatLayout()

  // Add solution-specific state
  const [customData, setCustomData] = useState(...)

  // Return combined interface
  return {
    ...connection,
    ...chat,
    ...status,
    ...layout,
    customData,
    setCustomData
  }
}
```

### 3. Use ChatPanel Component

```tsx
import { ChatPanel, MessageBubble } from '@kedge-agentic/react-sdk'

export function App() {
  const session = useMySession()

  return (
    <ChatPanel
      messages={session.messages}
      isProcessing={session.isProcessing}
      connected={session.connected}
      activeTools={session.activeTools}
      activeSubAgents={session.activeSubAgents}
      isThinking={session.isThinking}
      thinkingContent={session.thinkingContent}
      todoItems={session.todoItems}
      todoStats={session.todoStats}
      onSendMessage={session.sendMessage}
      onCancel={() => session.cancelProcessing()}
    />
  )
}
```

### 4. Add Custom Message Rendering (Optional)

```tsx
<ChatPanel
  {...props}
  renderMessage={(msg) => (
    <MessageBubble message={msg}>
      {/* Your custom content */}
      {msg.outputUpdates?.map(update => (
        <OutputUpdateCard
          key={update.field}
          field={update.field}
          fieldLabel={FIELD_LABELS[update.field]}
          preview={update.preview}
          synced={update.synced}
          syncedAt={update.syncedAt}
          onSync={() => handleSync(update)}
          onDiscard={() => handleDiscard(update)}
        />
      ))}
    </MessageBubble>
  )}
/>
```

### 5. Add Quick Actions (Optional)

```tsx
import { QuickActions } from '@kedge-agentic/react-sdk'

const myActions = [
  { id: 'action1', label: 'Generate Report', prompt: 'Generate a report' },
  { id: 'action2', label: 'Analyze Data', prompt: 'Analyze the data' }
]

<ChatPanel
  {...props}
  renderQuickActions={() => (
    <QuickActions
      actions={myActions}
      onAction={session.sendMessage}
    />
  )}
/>
```

## Hook Composition Patterns

### Basic Chat-Only Integration

```typescript
export function useChatSession() {
  const connection = useAgentConnection({
    serverUrl: process.env.REACT_APP_BACKEND_URL,
    sessionPrefix: 'chat'
  })

  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })

  return {
    connected: connection.connected,
    messages: chat.messages,
    sendMessage: chat.sendMessage,
    isProcessing: status.isProcessing,
    activeTools: status.activeTools
  }
}
```

### With Layout Controls

```typescript
export function useLayoutSession() {
  const connection = useAgentConnection({...})
  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })
  const layout = useChatLayout() // Adds layout state management

  return {
    ...connection,
    ...chat,
    ...status,
    ...layout,  // mode, isCollapsed, setMode, setCollapsed, toggleCollapsed
  }
}
```

### With Form Sync

```typescript
export function useFormSession<T>(initialForm: T) {
  const connection = useAgentConnection({...})
  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })

  const [formData, setFormData] = useState(initialForm)
  const [pendingUpdates, setPendingUpdates] = useState(new Map())

  // Listen for output updates via chat hook callback
  const chat = useAgentChat({
    connection,
    tenantId: 'default',
    onOutputUpdate: (event: OutputUpdateEvent) => {
      const { field, value, preview } = event.payload.data
      setPendingUpdates(prev => new Map(prev).set(field, { value, preview }))
    },
  })

  const syncToForm = (field: string) => {
    const update = pendingUpdates.get(field)
    if (!update) return

    setFormData(prev => ({ ...prev, [field]: update.value }))
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }

  const discardUpdate = (field: string) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }

  return {
    ...connection,
    ...chat,
    ...status,
    formData,
    setFormData,
    pendingUpdates,
    syncToForm,
    discardUpdate
  }
}
```

## Custom Message Rendering

### Rendering Output Updates

```tsx
// Define field labels for your domain
const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  content: 'Content'
}

// In your component
<ChatPanel
  {...props}
  renderMessage={(msg) => (
    <MessageBubble message={msg}>
      {msg.outputUpdates?.map(update => (
        <OutputUpdateCard
          key={update.field}
          field={update.field}
          fieldLabel={FIELD_LABELS[update.field]}
          preview={update.preview}
          synced={update.synced}
          syncedAt={update.syncedAt}
          onSync={() => session.syncToForm(update.field)}
          onDiscard={() => session.discardUpdate(update.field)}
        />
      ))}
    </MessageBubble>
  )}
/>
```

### Rendering File Attachments

```tsx
<ChatPanel
  {...props}
  renderMessage={(msg) => (
    <MessageBubble message={msg}>
      {filesInMessage.get(msg.id)?.map(file => (
        <div key={file.id} className="file-attachment">
          <FileIcon type={file.type} />
          <span>{file.name}</span>
          <button onClick={() => downloadFile(file)}>Download</button>
        </div>
      ))}
    </MessageBubble>
  )}
/>
```

### Custom Attachment Icons

```tsx
<OutputUpdateCard
  field="attachments"
  fieldLabel="附件"
  preview={`${files.length} files`}
  icon="attach"  // or 'sync', 'download', or custom ReactNode
  syncLabel="添加附件"
  onSync={handleAttach}
  onDiscard={handleDiscard}
/>
```

## QuickActions Configuration

### Basic Actions

```tsx
import { QuickActions, type QuickAction } from '@kedge-agentic/react-sdk'

const actions: QuickAction[] = [
  { id: 'summarize', label: 'Summarize', prompt: 'Please summarize this' },
  { id: 'translate', label: 'Translate', prompt: 'Translate to English' }
]

<QuickActions
  actions={actions}
  onAction={(prompt) => session.sendMessage(prompt)}
/>
```

### With Disabled State

```tsx
const actions = ACTIONS.map(action => ({
  ...action,
  disabled: !session.connected || session.isProcessing
}))

<QuickActions
  actions={actions}
  onAction={session.sendMessage}
/>
```

### Custom Rendering

```tsx
<QuickActions
  actions={actions}
  onAction={session.sendMessage}
  renderAction={(action, onClick) => (
    <button
      key={action.id}
      onClick={onClick}
      disabled={action.disabled}
      className="custom-quick-action-button"
    >
      {action.icon}
      <span>{action.label}</span>
    </button>
  )}
/>
```

## Layout Customization

### Default Layout

```tsx
// Simple chat interface
<ChatPanel {...props} />
```

### With Layout Controls

```tsx
import { ChatPanel, ChatLayoutControls } from '@kedge-agentic/react-sdk'

export function App() {
  const session = useMySession()

  return (
    <div className="app-container">
      <ChatLayoutControls
        mode={session.mode}
        onModeChange={session.setMode}
        isCollapsed={session.isCollapsed}
        onToggleCollapse={session.toggleCollapsed}
        colorScheme="blue"
      />
      <ChatPanel
        {...props}
        className={session.mode === 'overlay' ? 'chat-overlay' : ''}
      />
    </div>
  )
}
```

### Custom Layout Modes

```tsx
// Use layout state directly
const layout = useChatLayout()

<div className={`app ${layout.mode}`}>
  {layout.mode === 'default' && <Sidebar />}
  {layout.mode === 'expanded' && <FullWidthChat />}
  {layout.mode === 'overlay' && <OverlayChat />}
</div>
```

## Real-World Example: CCAAS Demo

Here's the complete integration from `solutions/ccaas-demo`:

```tsx
// hooks/useDemoSession.ts
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  useChatLayout,
  useSkills
} from '@kedge-agentic/react-sdk'

const BACKEND_URL = 'http://localhost:3001'
const TENANT_ID = 'default'

export function useDemoSession() {
  // Core connection
  const connection = useAgentConnection({
    serverUrl: BACKEND_URL,
    sessionPrefix: 'demo',
  })

  // Chat functionality
  const chat = useAgentChat({
    connection,
    tenantId: TENANT_ID,
  })

  // Status tracking
  const status = useAgentStatus({ connection })

  // Layout controls
  const layout = useChatLayout()

  // Skills management
  const { skills, enabledSkills, toggleSkill, createSkill, deleteSkill } =
    useSkills({ tenantId: TENANT_ID })

  // File tracking (solution-specific)
  // File events are delivered via SSE and handled by the SDK's event system.
  // Use the useAgentChat onFileRegistered callback or fetch files via REST API.
  const [filesInMessages, setFilesInMessages] = useState(new Map())
  const [trackedFiles, setTrackedFiles] = useState([])

  return {
    // Connection
    connected: connection.connected,
    sessionId: connection.sessionId,
    socket: connection.socket,

    // Chat
    messages: chat.messages,
    sendMessage: chat.sendMessage,

    // Status
    isProcessing: status.isProcessing,
    activeTools: status.activeTools,
    activeSubAgents: status.activeSubAgents,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,
    todoItems: status.todoItems,
    todoStats: status.todoStats,

    // Layout
    ...layout,

    // Skills
    skills,
    enabledSkills,
    toggleSkill,
    createSkill,
    deleteSkill,

    // Files
    filesInMessages,
    trackedFiles,
  }
}

// App.tsx
import { ChatPanel, MessageBubble, ChatLayoutControls } from '@kedge-agentic/react-sdk'
import { useDemoSession } from './hooks/useDemoSession'

export function App() {
  const session = useDemoSession()

  return (
    <div className="app">
      <ChatLayoutControls
        mode={session.mode}
        onModeChange={session.setMode}
        isCollapsed={session.isCollapsed}
        onToggleCollapse={session.toggleCollapsed}
        colorScheme="blue"
      />

      <div className="main-content">
        <Sidebar
          skills={session.skills}
          enabledSkills={session.enabledSkills}
          onToggleSkill={session.toggleSkill}
        />

        <ChatPanel
          messages={session.messages}
          isProcessing={session.isProcessing}
          connected={session.connected}
          activeTools={session.activeTools}
          activeSubAgents={session.activeSubAgents}
          isThinking={session.isThinking}
          thinkingContent={session.thinkingContent}
          todoItems={session.todoItems}
          todoStats={session.todoStats}
          onSendMessage={session.sendMessage}
          onCancel={() => session.cancelProcessing()}
          renderMessage={(msg) => (
            <MessageBubble message={msg}>
              {session.filesInMessages.get(session.sessionId)?.map((file, idx) => (
                <div key={idx} className="file-card">
                  <FileIcon type={file.fileType} />
                  <span>{file.fileName}</span>
                  <button onClick={() => downloadFile(file)}>
                    Download
                  </button>
                </div>
              ))}
            </MessageBubble>
          )}
        />
      </div>
    </div>
  )
}
```

## Backend Integration Checklist

- [ ] Backend emits standard events: `output_update`, `tool_activity`, `agent_status`
- [ ] Session ID format matches `sessionPrefix` pattern
- [ ] CORS configured for frontend origin
- [ ] SSE endpoints accessible from frontend origin
- [ ] Tenant ID passed in chat events
- [ ] File upload endpoints return proper file metadata

## Next Steps

- Review [React SDK API Reference](../README.md)
- Explore [Solution Template](../../../docs/SOLUTION_TEMPLATE.md)
- Check [Backend Events](../../../packages/backend/CLAUDE.md#socket-events)
