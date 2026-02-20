# React SDK API Reference

Complete API documentation for `@kedge-agentic/react-sdk`.

## Table of Contents

- [Hooks](#hooks)
  - [useAgentConnection](#useagentconnection)
  - [useAgentChat](#useagentchat)
  - [useAgentStatus](#useagentstatus)
  - [useOutputSync](#useoutputsync)
  - [useSkills](#useskills)
  - [useChatLayout](#usechatlayout)
- [Components](#components)
  - [ChatPanel](#chatpanel)
  - [MessageBubble](#messagebubble)
  - [AgentActivityLine](#agentactivityline)
  - [ThinkingIndicator](#thinkingindicator)
  - [ToolActivityIndicator](#toolactivityindicator)
  - [InlineToolCard](#inlinetoolcard)
  - [SubAgentCard](#subagentcard)
  - [OutputUpdateCard](#outputupdatecard)
  - [QuickActions](#quickactions)
  - [ChatLayoutControls](#chatlayoutcontrols)
  - [ChatSection](#chatsection)
  - [CollapsedChatTab](#collapsedchattab)
- [Types](#types)
- [Utilities](#utilities)

---

## Hooks

### useAgentConnection

Manages Socket.io connection to the CCAAS backend. Handles connect/disconnect, client_id assignment, and session joining.

#### Parameters

```typescript
interface UseAgentConnectionOptions {
  serverUrl?: string      // Backend URL (default: '/')
  sessionPrefix?: string  // Session ID prefix (default: 'session')
  autoConnect?: boolean   // Auto-connect on mount (default: true)
}
```

#### Returns

```typescript
interface UseAgentConnectionReturn {
  socket: Socket | null           // Socket.io instance
  connected: boolean              // Connection status
  clientId: string | null         // Assigned client ID from server
  sessionId: string               // Generated session ID
  serverUrl: string              // Normalized server URL
  error: string | null           // Connection error message
  connect: () => void            // Manual connect function
  disconnect: () => void         // Manual disconnect function
}
```

#### Example

```tsx
import { useAgentConnection } from '@kedge-agentic/react-sdk'

function MyApp() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my-app',
    autoConnect: true
  })

  if (!connection.connected) {
    return <div>Connecting to server...</div>
  }

  if (connection.error) {
    return <div>Error: {connection.error}</div>
  }

  return <div>Connected! Client ID: {connection.clientId}</div>
}
```

#### Notes

- Connection is established automatically if `autoConnect` is true
- Emits `session:join` event with sessionId upon connection
- Listens for `client_id` event to receive assigned client ID
- Handles reconnection and error states
- Cleans up socket on unmount

---

### useAgentChat

Core chat hook that manages messages, text streaming, output updates, and tool activity.

#### Parameters

```typescript
interface UseAgentChatOptions {
  connection: UseAgentConnectionReturn     // From useAgentConnection
  tenantId: string                        // Tenant identifier
  mcpServers?: string[]                   // MCP server configurations
  skillPath?: string                      // Path to skills directory
  enabledSkillSlugs?: string[]           // List of enabled skill slugs
  onOutputUpdate?: (update: OutputUpdate) => void  // Output update handler
  solutionConfigEndpoint?: string        // Endpoint to load solution config
}
```

#### Returns

```typescript
interface UseAgentChatReturn {
  messages: Message[]                           // Chat message history
  isProcessing: boolean                         // Agent is processing
  currentStreamContent: string                  // Current streaming text
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>
  clearMessages: () => void                     // Clear message history
  cancelProcessing: () => void                  // Cancel current agent task
}

interface SendMessageOptions {
  attachments?: Array<{
    type: string
    data: string
  }>
}
```

#### Example

```tsx
import { useAgentConnection, useAgentChat } from '@kedge-agentic/react-sdk'

function ChatApp() {
  const connection = useAgentConnection({ serverUrl: 'http://localhost:3001' })
  const chat = useAgentChat({
    connection,
    tenantId: 'my-tenant',
    mcpServers: ['@modelcontextprotocol/server-filesystem'],
    onOutputUpdate: (update) => {
      console.log('Output update:', update.field, update.value)
    }
  })

  const handleSend = async () => {
    await chat.sendMessage('Explain quantum computing')
  }

  return (
    <div>
      {chat.messages.map(msg => (
        <div key={msg.id}>{msg.role}: {msg.content}</div>
      ))}
      <button onClick={handleSend} disabled={chat.isProcessing}>
        Send
      </button>
    </div>
  )
}
```

#### Message Structure

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  contentBlocks?: ContentBlock[]
  outputUpdates?: OutputUpdate[]
  timestamp: Date
  createdAt: string
  isStreaming?: boolean
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: ToolActivity }
```

#### Notes

- Sends messages via REST API POST to `/api/v1/sessions/{sessionId}/completion`
- Streams text via `text_delta` socket event
- Handles output updates via `output_update` and `tool_event` events
- Automatically retries on WebSocket disconnection (up to 2 retries)
- Manages tool activity inline cards in content blocks
- Finalizes messages on `agent_status` complete/error/cancelled

---

### useAgentStatus

Tracks agent status, tool activity, thinking state, token usage, todos, and subagents.

#### Parameters

```typescript
interface UseAgentStatusOptions {
  connection: UseAgentConnectionReturn     // From useAgentConnection
}
```

#### Returns

```typescript
interface UseAgentStatusReturn {
  agentStatus: AgentStatusValue                    // Current agent status
  isProcessing: boolean                            // Agent is actively working
  activeTools: Map<string, ToolActivity>          // Currently active tools
  isThinking: boolean                             // Agent is in thinking state
  thinkingContent: string                         // Accumulated thinking content
  tokenUsage: {                                   // Token usage stats
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
  } | null
  todoItems: EventTodoItem[]                      // Todo list items
  todoStats: TodoStats                            // Todo statistics
  activeSubAgents: ActiveSubAgent[]              // Active subagent tasks
  currentActivity: string                         // Current activity description
}

type AgentStatusValue =
  | 'idle' | 'thinking' | 'running'
  | 'exploring' | 'executing' | 'complete'
  | 'error' | 'cancelled'

interface TodoStats {
  completed: number
  inProgress: number
  pending: number
  total: number
}
```

#### Example

```tsx
import { useAgentConnection, useAgentStatus } from '@kedge-agentic/react-sdk'

function StatusDisplay() {
  const connection = useAgentConnection()
  const status = useAgentStatus({ connection })

  return (
    <div>
      <div>Status: {status.agentStatus}</div>
      <div>Activity: {status.currentActivity}</div>
      {status.isThinking && <div>Thinking: {status.thinkingContent}</div>}
      {status.tokenUsage && (
        <div>
          Tokens: {status.tokenUsage.inputTokens} in,
          {status.tokenUsage.outputTokens} out
        </div>
      )}
      <div>
        Todos: {status.todoStats.completed}/{status.todoStats.total} completed
      </div>
      {status.activeSubAgents.map(agent => (
        <div key={agent.subAgentId}>
          Subagent: {agent.description} ({agent.type})
        </div>
      ))}
    </div>
  )
}
```

#### Notes

- `currentActivity` prioritizes: active todo > first active tool > thinking
- Automatically resets state on agent complete/error
- Removes completed/failed subagents after 3 seconds
- Tracks tool activity phases: 'start' and 'end'
- Thinking content accumulates via 'delta' phase

---

### useOutputSync

Generic output sync hook supporting manual and auto sync modes for form field updates.

#### Parameters

```typescript
interface UseOutputSyncOptions {
  mode: 'manual' | 'auto'                         // Sync mode
  normalizeField?: (field: string, value: unknown) => unknown  // Field normalizer
  undoTimeout?: number                            // Undo timeout ms (default: 30000)
}
```

#### Returns

```typescript
interface UseOutputSyncReturn<T> {
  pendingUpdates: Map<string, OutputUpdate>              // Queued updates
  modifiedFields: Set<string>                            // Fields modified by sync
  handleOutputUpdate: (update: OutputUpdate) => void     // Handle incoming update
  syncToForm: (field: string, currentData: T, setData: Dispatch<SetStateAction<T>>) => void
  syncAllToForm: (currentData: T, setData: Dispatch<SetStateAction<T>>) => void
  discardUpdate: (field: string) => void                 // Discard pending update
  undoSync: (field: string, currentData: T, setData: Dispatch<SetStateAction<T>>) => void
  canUndo: (field: string) => boolean                    // Check if undo available
  reset: () => void                                       // Reset all state
}
```

#### Example: Manual Mode

```tsx
import { useOutputSync } from '@kedge-agentic/react-sdk'

function ManualSyncForm() {
  const [formData, setFormData] = useState({ title: '', content: '' })

  const sync = useOutputSync<typeof formData>({
    mode: 'manual',
    normalizeField: (field, value) => {
      // Custom normalization logic
      if (field === 'title') return String(value).trim()
      return value
    }
  })

  const handleSync = (field: string) => {
    sync.syncToForm(field, formData, setFormData)
  }

  return (
    <div>
      {Array.from(sync.pendingUpdates.entries()).map(([field, update]) => (
        <div key={field}>
          <span>{field}: {update.preview}</span>
          <button onClick={() => handleSync(field)}>Sync</button>
          <button onClick={() => sync.discardUpdate(field)}>Discard</button>
        </div>
      ))}
    </div>
  )
}
```

#### Example: Auto Mode

```tsx
import { useAgentChat, useOutputSync } from '@kedge-agentic/react-sdk'

function AutoSyncForm() {
  const [formData, setFormData] = useState({ title: '', content: '' })

  const sync = useOutputSync<typeof formData>({
    mode: 'auto',
    undoTimeout: 15000
  })

  const chat = useAgentChat({
    connection,
    tenantId: 'my-tenant',
    onOutputUpdate: (update) => {
      sync.handleOutputUpdate(update)
      // Auto-apply immediately
      sync.syncToForm(update.field, formData, setFormData)
    }
  })

  return (
    <div>
      <input value={formData.title} readOnly />
      {sync.modifiedFields.has('title') && sync.canUndo('title') && (
        <button onClick={() => sync.undoSync('title', formData, setFormData)}>
          Undo
        </button>
      )}
    </div>
  )
}
```

#### Notes

- **Manual mode**: Updates queued in `pendingUpdates`, user must call `syncToForm`
- **Auto mode**: Updates applied immediately (still queued for reference)
- Automatically parses JSON strings (arrays/objects)
- Maintains undo stack with configurable timeout
- Undo entries expire after `undoTimeout` milliseconds

---

### useSkills

Skills management hook for fetching, searching, and toggling skills.

#### Parameters

```typescript
interface UseSkillsOptions {
  serverUrl: string       // Backend URL
  tenantId: string       // Tenant identifier
}
```

#### Returns

```typescript
interface UseSkillsReturn {
  skills: Skill[]                          // All skills
  loading: boolean                         // Loading state
  error: string | null                     // Error message
  searchQuery: string                      // Current search query
  setSearchQuery: (query: string) => void  // Update search
  filteredSkills: Skill[]                  // Filtered by search
  toggleSkill: (skillId: string) => Promise<void>  // Toggle enabled state
  enabledSkillIds: Set<string>            // Set of enabled skill IDs
  isSkillEnabled: (skillId: string) => boolean  // Check if skill enabled
  refresh: () => Promise<void>            // Refresh skills list
}
```

#### Example

```tsx
import { useSkills } from '@kedge-agentic/react-sdk'

function SkillsManager() {
  const skills = useSkills({
    serverUrl: 'http://localhost:3001',
    tenantId: 'my-tenant'
  })

  if (skills.loading) return <div>Loading skills...</div>
  if (skills.error) return <div>Error: {skills.error}</div>

  return (
    <div>
      <input
        value={skills.searchQuery}
        onChange={(e) => skills.setSearchQuery(e.target.value)}
        placeholder="Search skills..."
      />
      {skills.filteredSkills.map(skill => (
        <div key={skill.id}>
          <span>{skill.name}</span>
          <button onClick={() => skills.toggleSkill(skill.id)}>
            {skills.isSkillEnabled(skill.id) ? 'Disable' : 'Enable'}
          </button>
        </div>
      ))}
    </div>
  )
}
```

#### Notes

- Fetches from `/api/v1/skills` with `X-Tenant-Id` header
- Toggles via PATCH `/api/v1/skills/{id}/toggle`
- Search filters by name, description, or slug (case-insensitive)
- `enabledSkillIds` is memoized for efficient lookups

---

### useChatLayout

Manages chat layout modes (default, overlay, side-by-side) with resizable overlay.

#### Parameters

None

#### Returns

```typescript
interface UseChatLayoutReturn {
  mode: ChatLayoutMode                          // Current layout mode
  setMode: (mode: ChatLayoutMode) => void      // Change layout mode
  isCollapsed: boolean                          // Overlay collapsed state
  setCollapsed: (collapsed: boolean) => void   // Toggle overlay collapse
  overlayWidth: number                          // Overlay width in pixels
  isResizing: boolean                           // Resize in progress
  overlayResizeProps: {                         // Props for resize handle
    onMouseDown: (e: React.MouseEvent) => void
  }
}

type ChatLayoutMode = 'default' | 'overlay' | 'side-by-side'
```

#### Example

```tsx
import { useChatLayout } from '@kedge-agentic/react-sdk'

function LayoutDemo() {
  const layout = useChatLayout()

  return (
    <div>
      <button onClick={() => layout.setMode('overlay')}>Overlay</button>
      <button onClick={() => layout.setMode('side-by-side')}>Side by Side</button>

      {layout.mode === 'overlay' && (
        <div style={{ width: layout.overlayWidth }}>
          <div {...layout.overlayResizeProps}>Resize Handle</div>
          <button onClick={() => layout.setCollapsed(!layout.isCollapsed)}>
            {layout.isCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      )}
    </div>
  )
}
```

#### Notes

- Persists mode and overlay width to localStorage
- Overlay width constraints: 320px minimum, 70% viewport maximum
- Automatically resets collapse state when switching to 'default' mode
- Resize handle adds/removes `select-none` class on document.body

---

## Components

### ChatPanel

Main chat interface component with message list, input, and status indicators.

#### Props

```typescript
interface ChatPanelProps {
  messages: Message[]
  isProcessing: boolean
  onSendMessage: (content: string) => void | Promise<void>
  onCancelProcessing?: () => void
  currentStreamContent?: string
  placeholder?: string
  disabled?: boolean

  // Agent status props
  agentStatus?: AgentStatusValue
  currentActivity?: string
  isThinking?: boolean
  thinkingContent?: string
  activeSubAgents?: ActiveSubAgent[]
  activeTools?: Map<string, ToolActivity>

  // Rendering customization
  renderMessage?: (message: Message) => React.ReactNode
  showActivityLine?: boolean
  showThinking?: boolean
  showToolActivity?: boolean

  // Layout
  className?: string
  messageListClassName?: string
  inputClassName?: string
}
```

#### Example

```tsx
import { ChatPanel } from '@kedge-agentic/react-sdk'

function MyChat() {
  const connection = useAgentConnection()
  const chat = useAgentChat({ connection, tenantId: 'my-tenant' })
  const status = useAgentStatus({ connection })

  return (
    <ChatPanel
      messages={chat.messages}
      isProcessing={chat.isProcessing}
      onSendMessage={chat.sendMessage}
      onCancelProcessing={chat.cancelProcessing}
      currentStreamContent={chat.currentStreamContent}
      agentStatus={status.agentStatus}
      currentActivity={status.currentActivity}
      isThinking={status.isThinking}
      thinkingContent={status.thinkingContent}
      activeSubAgents={status.activeSubAgents}
      activeTools={status.activeTools}
      placeholder="Ask me anything..."
    />
  )
}
```

---

### MessageBubble

Renders individual chat message with content blocks and output updates.

#### Props

```typescript
interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  currentStreamContent?: string
  className?: string
  renderOutputUpdate?: (update: OutputUpdate) => React.ReactNode
}
```

#### Example

```tsx
import { MessageBubble } from '@kedge-agentic/react-sdk'

<MessageBubble
  message={msg}
  isStreaming={msg.isStreaming}
  renderOutputUpdate={(update) => (
    <div>Field {update.field}: {update.preview}</div>
  )}
/>
```

---

### AgentActivityLine

Displays current agent activity with expandable details for tools and subagents.

#### Props

```typescript
interface AgentActivityLineProps {
  currentActivity?: string
  agentStatus?: AgentStatusValue
  activeTools?: Map<string, ToolActivity>
  activeSubAgents?: ActiveSubAgent[]
  className?: string
}
```

#### Example

```tsx
import { AgentActivityLine } from '@kedge-agentic/react-sdk'

<AgentActivityLine
  currentActivity={status.currentActivity}
  agentStatus={status.agentStatus}
  activeTools={status.activeTools}
  activeSubAgents={status.activeSubAgents}
/>
```

---

### ThinkingIndicator

Animated thinking indicator with optional content display.

#### Props

```typescript
interface ThinkingIndicatorProps {
  content?: string
  showContent?: boolean
  className?: string
}
```

---

### ToolActivityIndicator

Displays active tool activities with descriptions.

#### Props

```typescript
interface ToolActivityIndicatorProps {
  activeTools: Map<string, ToolActivity>
  className?: string
}
```

---

### InlineToolCard

Inline tool activity card for displaying tool calls in messages.

#### Props

```typescript
interface InlineToolCardProps {
  tool: ToolActivity
  className?: string
}
```

---

### SubAgentCard

Card displaying subagent task information.

#### Props

```typescript
interface SubAgentCardProps {
  agent: ActiveSubAgent
  className?: string
}
```

---

### OutputUpdateCard

Card for displaying output field updates.

#### Props

```typescript
interface OutputUpdateCardProps {
  update: OutputUpdate
  onSync?: () => void
  onDiscard?: () => void
  className?: string
}
```

---

### QuickActions

Quick action buttons for common chat operations.

#### Props

```typescript
interface QuickActionsProps {
  actions: Array<{
    label: string
    onClick: () => void
    icon?: React.ReactNode
    disabled?: boolean
  }>
  className?: string
}
```

---

### ChatLayoutControls

Controls for switching between chat layout modes.

#### Props

```typescript
interface ChatLayoutControlsProps {
  mode: ChatLayoutMode
  setMode: (mode: ChatLayoutMode) => void
  className?: string
}
```

---

### ChatSection

Wrapper for chat content with layout mode support.

#### Props

```typescript
interface ChatSectionProps {
  mode: ChatLayoutMode
  isCollapsed?: boolean
  overlayWidth?: number
  onToggleCollapse?: () => void
  overlayResizeProps?: any
  children: React.ReactNode
  className?: string
}
```

---

### CollapsedChatTab

Tab shown when chat overlay is collapsed.

#### Props

```typescript
interface CollapsedChatTabProps {
  onClick: () => void
  hasUnread?: boolean
  className?: string
}
```

---

## Types

### Core Types

```typescript
// Message types
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  contentBlocks?: ContentBlock[]
  outputUpdates?: OutputUpdate[]
  timestamp: Date
  createdAt: string
  isStreaming?: boolean
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: ToolActivity }

// Tool activity
interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'end'
  timestamp: Date
  duration?: number
  success?: boolean
  description?: string
  toolInput?: unknown
  toolOutput?: unknown
  agentType?: string
  nestingLevel?: number
}

// Output updates
interface OutputUpdate {
  field: string
  value: unknown
  preview: string
  timestamp: number
  synced?: boolean
  syncedAt?: Date
}

// Subagents
interface ActiveSubAgent {
  subAgentId: string
  type: string
  description: string
  status: 'running' | 'completed' | 'failed'
  startedAt: number
}

// Todos
interface EventTodoItem {
  id: string
  subject: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}
```

---

## Utilities

### parseOutputUpdate

Parses `OutputUpdateEvent` from socket into normalized `OutputUpdate`.

```typescript
function parseOutputUpdate(event: OutputUpdateEvent): OutputUpdate | null
```

### ApiError

Custom error class for API errors.

```typescript
class ApiError extends Error {
  constructor(public status: number, message: string)
}
```

---

## Best Practices

1. **Always check connection status** before sending messages
2. **Use memoization** for expensive computations in custom hooks
3. **Provide stable callbacks** to avoid unnecessary re-renders
4. **Handle errors gracefully** with try-catch blocks
5. **Clean up effects** properly to prevent memory leaks
6. **Use TypeScript** for type safety across your application

## Related Documentation

- [Chat Integration Guide](./CHAT_INTEGRATION_GUIDE.md)
- [Advanced Patterns](./ADVANCED_PATTERNS.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Performance Optimization](./PERFORMANCE.md)
