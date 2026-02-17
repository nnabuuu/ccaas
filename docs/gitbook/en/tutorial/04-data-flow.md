# 4. Data Flow and State Management

In the previous chapters, we designed the domain model and mapped user journeys for our Lesson Plan Designer Solution. Now we need to understand **how data actually moves** through the CCAAS platform -- from a user typing a message to structured data appearing in the frontend form.

This chapter covers the complete data flow architecture, the WebSocket event system, and the React SDK hooks you will use in your Solution.

## Learning Objectives

By the end of this chapter, you will be able to:

- Trace a message through the CCAAS direct connection architecture
- Use the React SDK hooks (`useAgentConnection`, `useAgentChat`, `useAgentStatus`, `usePageContext`, `useFiles`)
- Identify all WebSocket event types and their purposes
- Design state management patterns for your Solution frontend

## The Direct Connection Architecture

CCAAS uses a **direct connection architecture** where your Solution frontend connects directly to the CCAAS backend via WebSocket. The CCAAS backend manages AI Agent processes and streams events back to the frontend in real time.

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Solution   │  WS     │  CCAAS Backend   │  stdin/  │   AI Agent   │
│   Frontend   │◄───────►│  (NestJS)        │  stdout  │   Process    │
└──────────────┘         └──────────────────┘◄────────►└──────────────┘
  React + SDK              Session Mgmt                  Claude Code /
  @ccaas/react-sdk         Skill Router                  OpenCode / etc.
                           Event Streaming
                           Authentication

┌──────────────┐         ┌──────────────────┐
│   Solution   │  REST   │  Solution        │
│   Frontend   │◄───────►│  Backend         │
└──────────────┘         └──────────────────┘
                           Domain CRUD
                           Business Logic
```

Key architectural facts:

- **The Solution frontend connects directly to CCAAS** -- there is no relay through a Solution backend for AI interactions
- **Messages are sent via REST** (`POST /api/v1/sessions/:sessionId/completion`) and **responses stream back via WebSocket** events
- **Domain data** (e.g., lesson plans, tasks) uses a separate REST channel to the Solution backend

## Complete Data Flow: Message Lifecycle

Let us trace a complete interaction from start to finish. When a user types "Generate learning objectives for this lesson plan" in the Lesson Plan Designer frontend:

### Step 1: Frontend establishes a WebSocket connection

The `useAgentConnection` hook connects to the CCAAS backend and manages session identity:

```typescript
// From: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // CCAAS backend directly
  tenantId: 'lesson-plan-designer',
  autoConnect: true,
})
```

On connect, the hook:

1. Creates a Socket.io connection with WebSocket transport
2. Emits `session:join` with the sessionId
3. Receives a `client_id` event with a unique client identifier
4. Persists the sessionId in localStorage under `ccaas_session_${tenantId}`

### Step 2: Frontend sends a message via REST

The `useAgentChat` hook sends messages through a REST endpoint, not through WebSocket:

```typescript
// From: packages/react-sdk/src/hooks/useAgentChat.ts

const chatPayload = {
  clientId: connection.clientId,
  message: content,
  tenantId: 'lesson-plan-designer',
  mcpServers: solutionConfig?.mcpServers,
  skillPath: solutionConfig?.skillPath,
  enabledSkillSlugs: ['lesson-plan-designer'],
  context: context,  // Page context from usePageContext
}

await fetch(`${connection.serverUrl}/api/v1/sessions/${connection.sessionId}/completion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(chatPayload),
})
```

The REST call tells the backend which WebSocket client should receive the streaming response.

### Step 3: CCAAS backend processes the request

The backend (`SessionsController.createCompletion`) performs these operations:

1. **WebSocket lookup** -- Finds the Socket.io connection by `clientId`
2. **Skill resolution** -- Generates a system prompt from enabled skills
3. **Session management** -- Gets or creates an AgentEngine session
4. **Agent launch** -- Spawns the AI Agent process (or resumes an existing one with `--resume`)

### Step 4: Events stream back via WebSocket

As the AI Agent works, the CCAAS backend parses its stdout and emits structured WebSocket events to the connected client:

```
Timeline:
─────────────────────────────────────────────────────────────────────
t=0ms    agent_status      { status: 'thinking' }
t=200ms  agent_thinking    { payload: { phase: 'start' } }
t=500ms  agent_thinking    { payload: { phase: 'delta', content: '...' } }
t=800ms  text_delta        { delta: 'I will generate learning objectives...' }
t=1200ms tool_activity     { payload: { toolName: 'write_output', phase: 'start' } }
t=1300ms output_update     { payload: { data: { field: 'objectives', value: [...] } } }
t=1400ms tool_activity     { payload: { toolName: 'write_output', phase: 'end' } }
t=1600ms token_usage       { payload: { inputTokens: 1200, outputTokens: 450 } }
t=1800ms agent_status      { status: 'complete' }
─────────────────────────────────────────────────────────────────────
```

### Step 5: SDK hooks process events into React state

The SDK hooks automatically listen for these events and update React state. You do not write socket event listeners manually.

## React SDK Hooks

The `@ccaas/react-sdk` package provides five core hooks that together manage the complete data flow. Here is how they compose in a real Solution:

```typescript
// From: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  useFiles,
} from '@ccaas/react-sdk'

export function useLessonPlanSession(options) {
  // 1. Connection management
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    tenantId: 'lesson-plan-designer',
    autoConnect: true,
  })

  // 2. Page context (sends current form state with every message)
  const { context, updateContext } = usePageContext()

  // 3. Chat messaging
  const chat = useAgentChat({
    connection,
    tenantId: 'lesson-plan-designer',
    mcpServers: solutionConfig?.mcpServers,
    skillPath: solutionConfig?.skillPath,
    enabledSkillSlugs,
    context,
    onOutputUpdate: (update) => {
      // Bridge output_update to domain-specific sync logic
      addPendingUpdate({
        field: update.field as SyncField,
        value: update.value,
        preview: update.preview,
      })
    },
  })

  // 4. Agent status tracking
  const status = useAgentStatus({ connection })

  // 5. File management
  const files = useFiles({
    connection,
    sessionId: connection.sessionId,
    enabled: connection.connected,
  })
}
```

### Hook 1: useAgentConnection

Manages the Socket.io connection lifecycle and session identity.

**Options:**

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `serverUrl` | `string` | `'/'` | CCAAS backend URL |
| `tenantId` | `string` | -- | Tenant ID for localStorage persistence |
| `autoConnect` | `boolean` | `true` | Connect on mount |
| `forceNewConversation` | `boolean` | `false` | Clear saved session and start fresh |

**Returns:**

| Property | Type | Purpose |
|----------|------|---------|
| `socket` | `Socket \| null` | Raw Socket.io instance |
| `connected` | `boolean` | Connection status |
| `clientId` | `string \| null` | Server-assigned client ID |
| `sessionId` | `string` | Current session/conversation ID |
| `error` | `string \| null` | Connection error message |
| `connect()` | function | Manual connect |
| `disconnect()` | function | Manual disconnect |
| `startNewConversation()` | function | Clear session, generate new ID, reconnect |

**Session persistence:** When `tenantId` is provided, the sessionId is stored in localStorage under `ccaas_session_${tenantId}`. On page refresh, the hook recovers the saved sessionId, allowing message history to be loaded automatically.

### Hook 2: useAgentChat

Manages message state, REST-based sending, and WebSocket event processing.

**Options:**

| Option | Type | Purpose |
|--------|------|---------|
| `connection` | `UseAgentConnectionReturn` | From `useAgentConnection` |
| `tenantId` | `string` | Tenant identifier |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP server configuration |
| `skillPath` | `string \| null` | Custom skill instructions path |
| `enabledSkillSlugs` | `string[]` | Which skills to enable |
| `context` | `PageContext \| null` | Page context from `usePageContext` |
| `onOutputUpdate` | `(update: OutputUpdate) => void` | Callback for structured field updates |

**Returns:**

| Property | Type | Purpose |
|----------|------|---------|
| `messages` | `Message[]` | All messages (user + assistant), with contentBlocks and outputUpdates |
| `isProcessing` | `boolean` | Whether the agent is currently processing |
| `isLoadingHistory` | `boolean` | Whether message history is being loaded |
| `currentStreamContent` | `string` | Live-updating text during streaming |
| `sendMessage(content, options?)` | function | Send a message (REST + WebSocket response) |
| `clearMessages()` | function | Clear local messages |
| `clearConversation()` | function | Clear messages AND start a new conversation |
| `cancelProcessing()` | function | Cancel current agent processing |

**What it handles internally:**

- Listens for `text_delta` events and accumulates streaming text into content blocks
- Listens for `output_update` events and calls the `onOutputUpdate` callback
- Listens for `tool_activity` events and creates inline tool cards in messages
- Listens for `agent_status` events to finalize messages on completion
- Auto-loads message history on connection via `GET /api/v1/sessions/:sessionId/messages`
- Retries on WebSocket disconnection (up to 2 attempts)

### Hook 3: useAgentStatus

Tracks agent status, tool activity, thinking state, and token usage.

**Options:**

| Option | Type | Purpose |
|--------|------|---------|
| `connection` | `UseAgentConnectionReturn` | From `useAgentConnection` |

**Returns:**

| Property | Type | Purpose |
|----------|------|---------|
| `agentStatus` | `AgentStatusValue` | Current status (idle, thinking, running, etc.) |
| `isProcessing` | `boolean` | True when agent is actively working |
| `activeTools` | `Map<string, ToolActivity>` | Currently executing tools |
| `isThinking` | `boolean` | Whether the agent is in extended thinking mode |
| `thinkingContent` | `string` | Accumulated thinking text |
| `thinkingStartTime` | `number \| null` | When thinking started (for duration display) |
| `thinkingVerb` | `string` | Dynamic verb that changes with thinking duration |
| `tokenUsage` | `TokenUsage \| null` | Token consumption stats |
| `todoItems` | `TodoItem[]` | Agent's internal task list |
| `todoStats` | `TodoStats` | Aggregated todo statistics |
| `activeSubAgents` | `ActiveSubAgent[]` | Running sub-agent tasks |
| `currentActivity` | `string` | Prioritized activity description string |

**Events it handles:**

- `agent_status` -- updates agent status, clears state on completion
- `tool_activity` -- tracks tool start/progress/end with auto-cleanup after 2s
- `agent_thinking` -- manages extended thinking state with phase-based verbs
- `token_usage` -- accumulates token consumption
- `todo_update` -- tracks agent's internal task list
- `subagent_started` / `subagent_completed` -- tracks sub-agent lifecycle

### Hook 4: usePageContext

Manages page context that gets sent with every chat message, allowing the AI Agent to read the current state of the form before responding.

```typescript
// From: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const { context, updateContext } = usePageContext()

// Update context whenever the lesson plan form changes
useEffect(() => {
  if (lessonPlan) {
    updateContext('lesson-plan-editor', {
      lessonPlanId: lessonPlan.id,
      currentForm: {
        title: lessonPlan.title,
        subject: lessonPlan.subject,
        gradeLevel: lessonPlan.gradeLevel,
        objectives: lessonPlan.objectives,
        content: lessonPlan.content,
        // ... other fields
      },
    })
  }
}, [lessonPlan, updateContext])

// Pass context to chat hook -- it will be included in every message
const chat = useAgentChat({ connection, context, /* ... */ })
```

**Returns:**

| Property | Type | Purpose |
|----------|------|---------|
| `context` | `PageContext \| null` | Current page context |
| `updateContext(pageType, pageData)` | function | Update the context |
| `clearContext()` | function | Clear the context |

This is how the AI Agent knows what is already in the form when the user asks for changes.

### Hook 5: useFiles

Manages files created by the AI Agent during a session, with real-time updates and badge state.

```typescript
// From: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const files = useFiles({
  connection,
  sessionId: connection.sessionId,
  enabled: connection.connected,
})

// files.newFilesCount -- number of files not yet seen
// files.files -- all files in the session
// files.uploadFile(file, path) -- upload a file
// files.downloadFile(fileId) -- download a file
```

**Returns:**

| Property | Type | Purpose |
|----------|------|---------|
| `files` | `FileMetadata[]` | All session files |
| `newFilesCount` | `number` | Unseen file count (for badges) |
| `hasNewFiles` | `boolean` | Whether there are new files |
| `uploadFile(file, path?)` | function | Upload a file to the session |
| `downloadFile(fileId)` | function | Download a file |
| `deleteFile(fileId)` | function | Delete a file |
| `markAsSynced(fileId)` | function | Mark file as seen |
| `markAllSeen()` | function | Clear all file badges |

**Events it handles:**

- `file.created` -- refetch file list when agent creates a file
- `file.modified` -- refetch file list when agent modifies a file

## WebSocket Event Types

The CCAAS backend emits several categories of events. Understanding each category is essential for building a responsive frontend. Note that the SDK hooks handle all of these for you -- this reference is for understanding what happens under the hood.

### Control Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `client_id` | Server -> Client | Assigns a unique client ID on connection |
| `session:join` | Client -> Server | Join a session room (sent automatically by SDK) |

### Agent Lifecycle Events

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `agent_status` | Agent state changes | `status`, `context`, `error` |
| `agent_thinking` | Extended thinking content | `payload.phase`, `payload.content` |

The `agent_status` event carries a `status` field with these possible values:

```typescript
type AgentStatusValue =
  | 'idle'        // Agent is ready
  | 'thinking'    // Processing the request
  | 'exploring'   // Searching/reading files
  | 'executing'   // Running tools
  | 'running'     // General processing
  | 'complete'    // Finished successfully
  | 'error'       // Failed with error
  | 'cancelled'   // User cancelled
```

### Content Events

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `text_delta` | Streaming text output | `delta` |
| `output_update` | Structured form data | `payload.data.field`, `payload.data.value`, `payload.data.preview` |
| `todo_update` | Agent task progress list | `payload.todos`, `payload.completed`, `payload.total` |

### Tool & SubAgent Events

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `tool_activity` | Tool invocation tracking | `payload.toolName`, `payload.phase`, `payload.description` |
| `tool_event` | Raw tool input/output | `toolName`, `input`, `output` |
| `subagent_started` | SubAgent spawn | `payload.subAgentId`, `payload.agentType`, `payload.description` |
| `subagent_completed` | SubAgent finish | `payload.subAgentId`, `payload.status` |

### Observability Events

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `token_usage` | Token consumption stats | `payload.inputTokens`, `payload.outputTokens`, `payload.cachedInputTokens` |
| `file.created` | Agent created a file | `sessionId` |
| `file.modified` | Agent modified a file | `sessionId` |

## Data Flow Diagram: Lesson Plan Designer

Here is the complete data flow for the Lesson Plan Designer Solution:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Lesson Plan Designer Frontend                        │
│                                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ ChatPanel    │  │ Form Editor   │  │ Files   │  │ AgentActivity │  │
│  │ (useAgent    │  │ (output_      │  │ Panel   │  │ Line          │  │
│  │  Chat)       │  │  update +     │  │ (use    │  │ (useAgent     │  │
│  │              │  │  SyncCards)   │  │  Files) │  │  Status)      │  │
│  └──────┬───────┘  └──────▲────────┘  └────▲────┘  └──────▲────────┘  │
│         │                 │                │               │           │
│    sendMessage     onOutputUpdate   file.created    agent_status      │
│    (REST POST)     (WebSocket)      (WebSocket)     (WebSocket)      │
└─────────┼─────────────────┼────────────────┼───────────────┼──────────┘
          │                 │                │               │
     ┌────▼─────────────────┴────────────────┴───────────────┴──────────┐
     │                       CCAAS Backend (:3001)                       │
     │                                                                   │
     │  POST /sessions/:id/completion        WebSocket event streaming   │
     │  GET  /sessions/:id/messages          via Socket.io               │
     │  GET  /files/session/:id/tree                                     │
     └──────────────────────────┬────────────────────────────────────────┘
                                │ stdin / stdout
     ┌──────────────────────────▼────────────────────────────────────────┐
     │                       AI Agent Process                            │
     │                                                                   │
     │  1. Read Skill instructions                                       │
     │  2. Read page context (current form state)                        │
     │  3. Generate text response (→ text_delta)                         │
     │  4. Call MCP tools: write_output (→ output_update)                │
     │  5. Create files (→ file.created)                                 │
     └──────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────┐
     │                   Solution Backend (:3002)                       │
     │                                                                  │
     │  GET  /api/lesson-plans          Domain CRUD only                │
     │  POST /api/lesson-plans          No AI relay responsibility      │
     │  PUT  /api/lesson-plans/:id                                      │
     └──────────────────────────────────────────────────────────────────┘
```

## Dual Data Channels

A Solution uses **two separate data channels**:

### Channel 1: CCAAS (AI interactions)

- **Outbound**: REST `POST /api/v1/sessions/:sessionId/completion`
- **Inbound**: WebSocket events (`text_delta`, `output_update`, `agent_status`, `tool_activity`, etc.)
- **Purpose**: Real-time AI Agent interaction

### Channel 2: Solution Backend (Domain CRUD)

- **Both directions**: REST API to the Solution backend
- **Purpose**: Traditional data operations (list lesson plans, save lesson plan, etc.)

```typescript
// Channel 1: AI interaction via CCAAS
// Handled by useAgentChat -- you just call sendMessage
chat.sendMessage('Generate learning objectives for grade 5 math')
// Results arrive via onOutputUpdate callback

// Channel 2: Domain CRUD via Solution backend
const plans = await fetch('http://localhost:3002/api/lesson-plans').then(r => r.json())
await fetch('http://localhost:3002/api/lesson-plans', {
  method: 'POST',
  body: JSON.stringify(lessonPlanData)
})
```

This separation is important: the AI Agent generates structured data through Channel 1 (as `output_update` events), but the actual persistence happens through Channel 2 when the user confirms and saves.

## Session and Conversation Persistence

Sessions are the unit of AI interaction in CCAAS. The React SDK provides automatic session persistence.

### How Session Persistence Works

When `tenantId` is provided to `useAgentConnection`:

1. The sessionId is persisted in localStorage under `ccaas_session_${tenantId}`
2. On page refresh, the saved sessionId is recovered
3. `useAgentChat` auto-loads message history via `GET /api/v1/sessions/:sessionId/messages`
4. The conversation continues where it left off

```typescript
// This is all handled automatically by the SDK:
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  tenantId: 'lesson-plan-designer',  // <-- enables persistence
})

// On page refresh: sessionId is recovered from localStorage
// On connect: message history is loaded from backend

// To start fresh:
connection.startNewConversation()  // clears storage, generates new ID
```

### Starting a New Conversation

```typescript
// From: solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const createNewPlan = useCallback(async (input) => {
  const plan = await crud.createPlan(input)
  resetSyncState()
  chat.clearConversation()  // Clear messages + new sessionId
  return plan
}, [crud, resetSyncState, chat])
```

`clearConversation()` performs three actions:
1. Clears all local messages
2. Removes the old sessionId from localStorage
3. Generates a new sessionId and reconnects

## Exercises

### Exercise 4.1: Trace the Data Flow

Given this user message: "Add assessment methods for this lesson plan"

Identify:
1. Which REST endpoint receives the message?
2. What WebSocket events will stream back?
3. How does the AI Agent know the current form state?
4. Where does the `output_update` end up in the React component tree?

### Exercise 4.2: Hook Composition

Using the five SDK hooks, design the session hook for a hypothetical "Quiz Builder" Solution. Determine:
- What `tenantId` would you use?
- What fields would `usePageContext` send?
- How would you handle `onOutputUpdate` for quiz questions vs. quiz metadata?

### Exercise 4.3: Event Timeline

Given this scenario: the user asks the AI to "Create a lesson plan for grade 3 math, chapter 2, with objectives and teaching methods"

Write out the expected timeline of WebSocket events, including:
- Event type
- Key payload data
- Which SDK hook processes each event

## Key Takeaways

1. **CCAAS uses direct connection** -- the Solution frontend connects directly to the CCAAS backend via Socket.io, not through a Solution backend relay
2. **Messages go via REST, responses stream via WebSocket** -- `POST /sessions/:id/completion` sends the message, WebSocket events deliver the response
3. **Five SDK hooks cover the complete data flow** -- `useAgentConnection` (connection), `useAgentChat` (messaging), `useAgentStatus` (status), `usePageContext` (form state), `useFiles` (file management)
4. **`usePageContext` is key for AI awareness** -- it sends the current form state with every message so the AI Agent knows what is already filled in
5. **Solutions use dual data channels** -- CCAAS for AI interactions, Solution backend for domain CRUD
6. **Session persistence is automatic** -- providing `tenantId` enables localStorage-based session recovery with message history loading

## What's Next

In [Chapter 5](05-form-protocol.md), we will dive deep into the `output_update` protocol and form synchronization patterns. You will learn how to use `write_output` in your MCP Server, handle `output_update` events via the `onOutputUpdate` callback, and implement the SyncCard approval flow that lets users review AI suggestions before applying them.
