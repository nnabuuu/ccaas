# 6.5 Frontend

In this section you will build the React frontend for your Solution. The frontend combines five modular SDK hooks with Solution-specific logic to create a split-panel UI: an editable form on the left and an AI chat panel on the right. By the end, you will understand how real CCAAS frontends compose `useAgentConnection`, `useAgentChat`, `useAgentStatus`, `usePageContext`, and `useFiles` into a single session hook.

## Architecture Recap

Before writing code, recall how the frontend fits into the data flow:

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                                                              │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐  ┌───────┐ │
│  │ FormEditor   │  │ ChatPanel  │  │ FilesView│  │ Tasks │ │
│  │ (REST)       │  │ (WebSocket)│  │ (SDK)    │  │ (SDK) │ │
│  └──────┬───────┘  └─────┬──────┘  └────┬─────┘  └───┬───┘ │
│         │                │              │             │      │
└─────────┼────────────────┼──────────────┼─────────────┼──────┘
          │                │              │             │
    Solution Backend     CCAAS          CCAAS         CCAAS
    (port 3002)        (port 3001)    (port 3001)   (port 3001)
    GET /api/plans    WebSocket      Files API     SubAgents
```

The frontend talks to two backends. Domain data (lesson plans, textbooks) comes from the Solution backend via REST. Chat, files, agent status, and real-time events flow through the CCAAS core backend via WebSocket.

## Project Dependencies

The frontend depends on two workspace packages from the monorepo:

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

- **@kedge-agentic/common** -- shared TypeScript types (`OutputUpdateEvent`, `TextDeltaEvent`, `TokenUsage`)
- **@kedge-agentic/react-sdk** -- modular hooks and pre-built components (`useAgentConnection`, `useAgentChat`, `useAgentStatus`, `usePageContext`, `useFiles`, `AgentActivityLine`, `OutputUpdateCard`)

## Step 1: Understand the SDK Hook Architecture

The `@kedge-agentic/react-sdk` provides five core hooks. Each handles one concern:

| Hook | Responsibility |
|------|---------------|
| `useAgentConnection` | Socket.io connection, session ID persistence, reconnection |
| `useAgentChat` | Message history, text streaming, send via REST, conversation lifecycle |
| `useAgentStatus` | Tool activity, thinking state, SubAgent tracking, todo items |
| `usePageContext` | Sends current page/form state as context with every message |
| `useFiles` | Session file listing, upload, download, new-file tracking |

Your Solution composes these hooks inside a single session hook (e.g., `useLessonPlanSession`), then passes the returned state and actions to your components.

```
useLessonPlanSession()
├── useAgentConnection()    → connected, sessionId, socket
├── useAgentChat()          → messages, sendMessage, isProcessing
├── useAgentStatus()        → activeTools, activeSubAgents, isThinking
├── usePageContext()        → context, updateContext
├── useFiles()              → files, newFilesCount, uploadFile
├── useLessonPlanSync()     → pendingUpdates, syncToForm, undoSync  (Solution-specific)
└── useLessonPlanCRUD()     → lessonPlan, savePlan, loadPlan         (Solution-specific)
```

## Step 2: Build the Session Hook

The session hook is the heart of the frontend. It composes SDK hooks with Solution-specific logic into a single API. Here is the pattern used in the Lesson Plan Designer:

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
import { useLessonPlanCRUD } from './useLessonPlanCRUD'

// IMPORTANT: Use absolute URL to the CCAAS backend, NOT a relative path
// Vite proxy only works for HTML/CSS, not for Socket.IO connections
const SOCKET_URL = 'http://localhost:3001'

export function useLessonPlanSession(options = {}) {
  const { tenantId = 'lesson-plan-designer', autoConnect = true } = options

  // ===== 1. SDK Connection =====
  const connection = useAgentConnection({
    serverUrl: SOCKET_URL,
    tenantId,
    autoConnect,
  })

  // ===== 2. Domain CRUD =====
  const crud = useLessonPlanCRUD({ onError: (err) => setError(err) })

  // ===== 3. Page Context =====
  const { context, updateContext } = usePageContext()

  // ===== 4. Form Sync State =====
  const {
    pendingUpdates, modifiedFields,
    addPendingUpdate, removePendingUpdate,
    syncToForm: doSyncToForm, undoSync: doUndoSync, canUndo,
    resetSyncState,
  } = useLessonPlanSync()

  // ===== 5. SDK Chat =====
  const chat = useAgentChat({
    connection,
    tenantId,
    sessionTemplate: 'lesson-plan-designer',  // MCP servers, skills resolved server-side
    context,
    onOutputUpdate: (update) => {
      // Bridge SDK output_update events to the sync hook
      addPendingUpdate({
        field: update.field,
        value: update.value,
        preview: update.preview,
      })
    },
  })

  // ===== 6. SDK Status =====
  const status = useAgentStatus({ connection })

  // ===== 7. SDK Files =====
  const files = useFiles({
    connection,
    sessionId: connection.sessionId,
    enabled: connection.connected,
  })

  // Computed state
  const hasActiveSubAgents = status.activeSubAgents.length > 0
  const isMainProcessing = chat.isProcessing && !hasActiveSubAgents

  // Auto-update page context when lesson plan changes
  useEffect(() => {
    if (crud.lessonPlan) {
      updateContext('lesson-plan-editor', {
        lessonPlanId: crud.lessonPlan.id,
        currentForm: {
          title: crud.lessonPlan.title,
          subject: crud.lessonPlan.subject,
          gradeLevel: crud.lessonPlan.gradeLevel,
          // ... other fields
        },
      })
    }
  }, [crud.lessonPlan, updateContext])

  return {
    // Connection
    connected: connection.connected,
    sessionId: connection.sessionId,
    connection,

    // Domain data
    lessonPlan: crud.lessonPlan,
    loading: crud.loading,

    // Chat
    messages: chat.messages,
    isProcessing: isMainProcessing,
    isLoadingHistory: chat.isLoadingHistory,
    currentStreamContent: chat.currentStreamContent,
    sendMessage: chat.sendMessage,
    clearConversation: chat.clearConversation,
    cancelProcessing: chat.cancelProcessing,

    // Status
    activeTools: status.activeTools,
    activeSubAgents: status.activeSubAgents,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,
    tokenUsage: status.tokenUsage,
    todoItems: status.todoItems,
    todoStats: status.todoStats,

    // Files
    newFilesCount: files.newFilesCount,

    // Form sync
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

### Key Patterns to Note

**Absolute Socket URL.** The connection must use `http://localhost:3001`, not a relative path. Socket.IO does not go through Vite's proxy system.

**tenantId enables conversation persistence.** When `tenantId` is provided, the SDK persists the `sessionId` in `localStorage` under `ccaas_session_{tenantId}`. On page refresh, the same session is recovered and message history is loaded automatically.

**onOutputUpdate bridges SDK to Solution sync.** The `useAgentChat` hook parses `output_update` WebSocket events and calls your callback with `{ field, value, preview }`. Your session hook forwards these to the sync hook, which queues them as pending updates.

**usePageContext sends form state with every message.** When the user sends a chat message, the SDK attaches the current `context` object so the AI agent always knows the current form contents.

## Step 3: Build the Chat Panel

The ChatPanel is the main conversation interface. In a real Solution, it includes multiple tabs (messages, files, tasks), an activity status line, and a sync section for pending AI updates.

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

  // Split long assistant messages into segments for better UX
  const { splitMessages } = useMessageSplitter({ messages })

  // Track SubAgent tasks for the Tasks tab
  const taskTracking = useTaskTracking({ activeSubAgents, todoItems })

  // Auto-scroll on new messages
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
      {/* Tab bar: Messages | Files | Tasks */}
      {/* ... tab switching UI ... */}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          /* Render user and assistant messages */
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Agent Activity Line -- shows tools, thinking, SubAgents */}
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

      {/* Global Sync Section -- pending output_update items */}
      <GlobalSyncSection
        pendingUpdates={pendingUpdatesWithMeta}
        onSyncAll={onSyncAll}
        onSyncField={onSync}
        onDiscardField={onDiscard}
      />

      {/* Input area */}
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
            placeholder={connected ? 'Type your message...' : 'Connecting...'}
            disabled={!connected}
          />
          <button type="submit" disabled={!inputValue.trim() || isProcessing}>
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
```

### Key Features

**AgentActivityLine.** This pre-built SDK component renders a compact status bar showing what the agent is currently doing: active tools, thinking state, SubAgent progress, and todo items. It is the same component used across all CCAAS Solutions.

**useMessageSplitter.** Long assistant messages containing multiple tool calls and text segments are split into separate visual chunks for readability.

**useTaskTracking.** Aggregates SubAgent and todo data into groups for the Tasks tab, with badge state for showing unread counts.

**GlobalSyncSection.** Displays all pending `output_update` items from the AI, with "Sync All" and per-field "Sync" / "Discard" actions.

## Step 4: Handle output\_update Events

When the AI agent calls `write_output` via MCP, CCAAS sends an `output_update` event through the WebSocket. The SDK's `useAgentChat` hook parses these events and calls your `onOutputUpdate` callback. Your Solution then renders sync cards to let the user review and apply the AI's suggestions.

### The OutputUpdateCard Component

The SDK provides `OutputUpdateCard` for rendering each pending update:

```typescript
// frontend/src/components/SyncButton.tsx

import { OutputUpdateCard } from '@kedge-agentic/react-sdk'
import type { SyncField } from '../types'

const FIELD_LABELS: Record<SyncField, string> = {
  title: 'Title',
  objectives: 'Learning Objectives',
  content: 'Teaching Content',
  // ... map every SyncField to a human-readable label
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

### The Sync Hook

The sync hook manages the lifecycle of pending updates: queueing, applying, and undoing:

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

    // Store previous value for undo
    const previousValue = lessonPlan[field]

    // Apply normalized value to form
    setLessonPlan({ ...lessonPlan, [field]: normalizeFieldValue(field, update.value) })

    // Mark as modified, add to undo stack with 30s timeout
    setModifiedFields(prev => new Set(prev).add(field))
    // ... undo timeout logic
  }

  const undoSync = (field, lessonPlan, setLessonPlan) => {
    // Restore previous value from undo stack
    // Remove from modified fields
  }

  return {
    pendingUpdates, modifiedFields,
    addPendingUpdate, removePendingUpdate,
    syncToForm, undoSync, canUndo, resetSyncState,
  }
}
```

The key design decisions:

- **Propose-review-apply by default.** Updates are queued as pending, not auto-applied. The user reviews and clicks "Sync to Form."
- **30-second undo window.** After syncing, the user can undo within 30 seconds.
- **Field normalization.** Values from the AI are normalized to match expected types (e.g., `gradeLevel` to `Number`, `curriculumRequirements` to `Array`).
- **Modified field tracking.** Fields synced from AI output get a visual indicator (e.g., a blue left border) so the user can see which parts the AI changed.

## Step 5: SubAgent Tracking via WebSocket

When the AI agent spawns SubAgents (e.g., Task or Explore agents), CCAAS sends real-time WebSocket events. The SDK handles this entirely -- no polling required.

**Data flow:**

1. Backend `EventMapperService` maintains `activeSubAgentsMap` and emits `subagent_started` / `subagent_completed` events
2. SDK `useAgentStatus` listens for these events and maintains `activeSubAgents` state
3. Your session hook exports `activeSubAgents` for the UI
4. `AgentActivityLine` displays the active SubAgents with live duration timers

```typescript
// The SDK provides the ActiveSubAgent type:
interface ActiveSubAgent {
  subAgentId: string        // Unique identifier (toolUseId)
  agentType: string         // 'Explore' | 'Task' | 'general-purpose'
  description?: string      // What the SubAgent is doing
  startedAt: string         // ISO timestamp for duration timer
  status: 'running' | 'completed' | 'failed'
  nestingLevel?: number     // 0=main agent, 1=subagent, 2=nested
}
```

The `AgentActivityLine` component renders SubAgents in a compact expandable view. Each SubAgent shows its type, description, and a live duration timer. Completed or failed SubAgents are automatically removed after 3 seconds.

{% hint style="info" %}
**Why WebSocket instead of polling?** An earlier implementation used `useSubAgentPolling` to periodically call a REST API. This was removed because WebSocket provides instant updates (vs. 2-10 second polling delay), eliminates unnecessary HTTP requests, and avoids state synchronization issues between the polling data and the WebSocket data.
{% endhint %}

## Step 6: Conversation Persistence

Conversation persistence is built into the SDK hooks. When `tenantId` is provided to `useAgentConnection`, the session automatically persists across page refreshes.

**How it works:**

1. `useAgentConnection` generates a `conv_{uuid}` session ID and stores it in `localStorage` under `ccaas_session_{tenantId}`
2. On reconnection, the same session ID is used to rejoin the WebSocket room
3. `useAgentChat` automatically fetches message history via `GET /api/v1/sessions/{sessionId}/messages`
4. While history is loading, `chat.isLoadingHistory` is `true` -- show a loading indicator

**Starting a new conversation:**

```typescript
// clearConversation does three things:
// 1. Clears messages from the UI
// 2. Removes the saved sessionId from localStorage
// 3. Generates a new conv_{uuid} and reconnects
chat.clearConversation()
```

**Loading state:**

```typescript
if (chat.isLoadingHistory) {
  return <div>Loading conversation history...</div>
}
```

## Step 7: Page Context with usePageContext

The `usePageContext` hook sends the current page state as context with every chat message. This lets the AI agent know the current form contents without the user needing to describe them.

```typescript
const { context, updateContext } = usePageContext()

// Update context whenever the form changes
useEffect(() => {
  if (lessonPlan) {
    updateContext('lesson-plan-editor', {
      lessonPlanId: lessonPlan.id,
      currentForm: {
        title: lessonPlan.title,
        subject: lessonPlan.subject,
        objectives: lessonPlan.objectives,
        content: lessonPlan.content,
        // ... other fields
      },
    })
  }
}, [lessonPlan, updateContext])
```

When `context` is passed to `useAgentChat`, it is automatically attached to every message sent to the backend. The AI agent can then reference the current form state in its responses.

## Step 8: File Management with useFiles

The `useFiles` hook provides session file management: listing, uploading, downloading, and tracking new files created by the AI agent.

```typescript
const files = useFiles({
  connection,
  sessionId: connection.sessionId,
  enabled: connection.connected,
})

// files.files         -- Array of FileMetadata
// files.newFilesCount -- Number of unread files (for badge display)
// files.hasNewFiles   -- Boolean shortcut
// files.uploadFile    -- Upload a file to the session
// files.markAsSynced  -- Mark a file as seen
// files.markAllSeen   -- Mark all files as seen
```

The FilesView component renders a file browser with icons based on MIME type, file size display, download buttons, and optional "Attach" buttons to link files to domain entities.

## Composing the Page

The page component brings everything together. A typical CCAAS Solution uses a split-panel layout: domain content on the left, chat panel on the right.

```typescript
// frontend/src/App.tsx

import { useLessonPlanSession } from './hooks/useLessonPlanSession'
import { LessonPlanContent } from './components/LessonPlanContent'
import { ChatPanel } from './components/ChatPanel'

function App() {
  const session = useLessonPlanSession()

  return (
    <div className="flex h-screen">
      {/* Left panel: Form editor */}
      <div className="flex-1 overflow-auto">
        <LessonPlanContent
          lessonPlan={session.lessonPlan}
          modifiedFields={session.modifiedFields}
          canUndo={session.canUndo}
          onUndo={session.undoSync}
          onChange={session.updateField}
        />
      </div>

      {/* Right panel: Chat */}
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

## Common Pitfalls

{% hint style="danger" %}
**Pitfall 1: Using relative URL for Socket.IO.** Vite's proxy only works for HTTP requests made from the browser's same-origin context. Socket.IO creates its own connection and does not go through Vite's proxy. Always use the absolute URL `http://localhost:3001`.
{% endhint %}

{% hint style="danger" %}
**Pitfall 2: Defining local event types instead of using @kedge-agentic/common.** For platform events like `OutputUpdateEvent` and `TextDeltaEvent`, always import types from `@kedge-agentic/common`. Defining local types leads to mismatches when the event format changes. Domain types (LessonPlan, Task) are Solution-specific and should be defined locally.
{% endhint %}

{% hint style="danger" %}
**Pitfall 3: Polling for SubAgent status.** SubAgent tracking is handled entirely by WebSocket events (`subagent_started`, `subagent_completed`) through the SDK's `useAgentStatus` hook. Do not add a polling mechanism -- it introduces latency, unnecessary HTTP requests, and state synchronization issues.
{% endhint %}

{% hint style="danger" %}
**Pitfall 4: Forgetting to pass context to useAgentChat.** If you use `usePageContext` but forget to pass the `context` object to `useAgentChat`, the AI agent will not receive the current form state. Always include `context` in the chat hook options.
{% endhint %}

## Checkpoint

Before proceeding to testing, verify:

- [ ] The frontend starts with `npm run dev` and shows the split-panel layout
- [ ] The chat panel connects to CCAAS (green connection indicator)
- [ ] Sending a message produces an AI response with streaming text
- [ ] `output_update` events render as sync cards with "Sync to Form" buttons
- [ ] Clicking "Sync to Form" applies the AI suggestion and shows the undo option
- [ ] SubAgent activity appears in the AgentActivityLine without any polling
- [ ] Page refresh recovers the conversation and loads message history
- [ ] "New Conversation" clears messages and starts a fresh session

## Next Step

With the frontend in place, it is time to write tests that verify the entire stack works correctly. Proceed to [6.6 Testing](06-testing.md).
