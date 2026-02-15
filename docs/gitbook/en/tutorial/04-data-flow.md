# 4. Data Flow and State Management

In the previous chapters, we designed the domain model and mapped user journeys for our Task Manager Solution. Now we need to understand **how data actually moves** through the LoopAI platform -- from a user typing a message to structured data appearing in the frontend form.

This chapter covers the complete data flow architecture, the WebSocket event system, and state management patterns you will use in your Solution.

## Learning Objectives

By the end of this chapter, you will be able to:

- Trace a message through the entire LoopAI relay architecture
- Identify all WebSocket event types and their purposes
- Understand the role of the CCAAS backend as a relay layer
- Design state management patterns for your Solution frontend

## The Relay Architecture

LoopAI uses a **relay architecture** where the CCAAS backend sits between your Solution and the AI Agent. This is the central design pattern that makes the entire platform work.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Solution   │     │  CCAAS Backend   │     │   AI Agent   │
│   Frontend   │◄───►│  (Relay Layer)   │◄───►│   Process    │
└──────────────┘     └──────────────────┘     └──────────────┘
   Socket.io              NestJS               Claude Code /
   WebSocket           Session Mgmt            OpenCode / etc.
                       Skill Router
                       Event Stream
```

The key insight: **your Solution frontend never communicates directly with the AI Agent**. All communication is mediated by the CCAAS backend, which provides:

- **Session management** -- Creating, tracking, and resuming agent sessions
- **Skill routing** -- Matching user messages to the right Skill
- **Event streaming** -- Translating agent process output into structured WebSocket events
- **Authentication** -- API key validation and tenant isolation

## Complete Data Flow: Message Lifecycle

Let us trace a complete interaction from start to finish. When a user types "Create a new task called Fix login bug with high priority" in the Task Manager frontend, here is what happens:

### Step 1: Frontend sends a chat message

```typescript
// Solution frontend (React or Vue)
socket.emit('chat', {
  message: 'Create a new task called Fix login bug with high priority',
  sessionId: 'session-abc-123'  // Optional: omit for new session
})
```

### Step 2: Solution backend relays to CCAAS

The Solution backend receives the Socket.io event and forwards it to the CCAAS backend via REST API:

```typescript
// Solution backend relay
socket.on('chat', async (data) => {
  const { message, sessionId } = data

  await axios.post(`${CCAAS_URL}/api/v1/sessions/${sessionId}/completion`, {
    clientId: socket.id,
    message,
    tenantId: TENANT_ID,
    mcpServers: getMcpConfig(),
    enabledSkillSlugs: ['task-manager']
  })
})
```

### Step 3: CCAAS processes the request

The CCAAS backend performs several operations:

1. **Authentication** -- Validates the API key and tenant
2. **Skill resolution** -- Matches the message against registered Skill triggers
3. **Session management** -- Creates a new session or resumes an existing one
4. **Agent launch** -- Starts the AI Agent process with the matched Skill's instructions

### Step 4: AI Agent executes

The AI Agent reads the Skill instructions, understands the user request, and takes action:

```
AI Agent Process:
  1. Parse user intent: "create task"
  2. Extract fields: title="Fix login bug", priority="high"
  3. Call write_output tool: { field: "title", value: "Fix login bug" }
  4. Call write_output tool: { field: "priority", value: "high" }
  5. Call write_output tool: { field: "status", value: "todo" }
```

### Step 5: Events stream back to the frontend

As the AI Agent works, the CCAAS backend emits a stream of WebSocket events. The Solution backend relays these to the frontend:

```
Timeline:
─────────────────────────────────────────────────────────────
t=0ms    agent_status    { status: 'thinking' }
t=200ms  agent_thinking  { phase: 'start', content: '...' }
t=500ms  text_delta      { text: 'I will create a task...' }
t=800ms  tool_activity   { toolName: 'write_output', phase: 'start' }
t=850ms  output_update   { payload: { data: { field: 'title', value: 'Fix login bug' } } }
t=900ms  tool_activity   { toolName: 'write_output', phase: 'end' }
t=1000ms tool_activity   { toolName: 'write_output', phase: 'start' }
t=1050ms output_update   { payload: { data: { field: 'priority', value: 'high' } } }
t=1100ms tool_activity   { toolName: 'write_output', phase: 'end' }
t=1200ms agent_status    { status: 'complete' }
─────────────────────────────────────────────────────────────
```

### Step 6: Frontend updates the UI

The frontend listens for these events and updates the form state accordingly:

```typescript
socket.on('output_update', (event) => {
  const { field, value } = event.payload.data
  setFormData(prev => ({ ...prev, [field]: value }))
})

socket.on('agent_status', (data) => {
  setAgentStatus(data.status)
})
```

## WebSocket Event Types

The CCAAS backend emits several categories of events. Understanding each category is essential for building a responsive frontend.

### Control Events

These events manage the connection and session lifecycle:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `client_id` | Server -> Client | Assigns a unique client ID on connection |
| `session_restored` | Server -> Client | Confirms session reconnection |
| `session_not_found` | Server -> Client | Session reconnection failed |
| `error` | Server -> Client | Error with recovery information |

```typescript
// Connection lifecycle
socket.on('client_id', (data) => {
  console.log('Connected as:', data.clientId)
})

socket.on('error', (data) => {
  if (data.recoverable) {
    // Auto-retry logic
  } else {
    // Show error to user
  }
})
```

### Agent Lifecycle Events

These events track the AI Agent's execution state:

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `agent_status` | Agent state changes | `status`, `context`, `error` |
| `agent_thinking` | Extended thinking content | `phase`, `content`, `thinkingId` |

The `agent_status` event carries a `status` field with these possible values:

```typescript
type AgentStatus =
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

These events deliver the AI Agent's output:

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `text_delta` | Streaming text output | `text` |
| `output_update` | Structured form data | `payload.data.field`, `payload.data.value` |
| `todo_update` | Task progress list | `todos`, `summary` |

### Observability Events

These events provide transparency into what the agent is doing:

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `tool_activity` | Tool invocation tracking | `toolName`, `phase`, `description` |
| `token_usage` | Token consumption stats | `inputTokens`, `outputTokens`, `estimatedCostUsd` |
| `exploration_activity` | File/code search activity | `action`, `target`, `phase` |

## State Management Patterns

A well-designed Solution frontend manages several categories of state. Here are the patterns used in LoopAI Solutions.

### Pattern 1: Agent Connection State

Track the WebSocket connection and agent status:

```typescript
// React pattern
interface AgentConnectionState {
  connected: boolean
  clientId: string | null
  sessionId: string | null
  agentStatus: AgentStatus
  error: ErrorEvent | null
}

function useAgentConnection(serverUrl: string) {
  const [state, setState] = useState<AgentConnectionState>({
    connected: false,
    clientId: null,
    sessionId: null,
    agentStatus: 'idle',
    error: null,
  })

  useEffect(() => {
    const socket = io(serverUrl)

    socket.on('connect', () => {
      setState(prev => ({ ...prev, connected: true }))
    })

    socket.on('client_id', (data) => {
      setState(prev => ({ ...prev, clientId: data.clientId }))
    })

    socket.on('agent_status', (data) => {
      setState(prev => ({
        ...prev,
        agentStatus: data.status,
        sessionId: data.sessionId,
      }))
    })

    socket.on('error', (data) => {
      setState(prev => ({ ...prev, error: data }))
    })

    return () => { socket.disconnect() }
  }, [serverUrl])

  return state
}
```

```typescript
// Vue pattern (using @ccaas/vue-sdk)
import { useAgentState } from '@ccaas/vue-sdk'

const { isProcessing, currentToolName, agentStatus } = useAgentState()
```

### Pattern 2: Chat Message State

Accumulate streaming text into complete messages:

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming: boolean
  timestamp: number
}

function useChatMessages(socket: Socket) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    socket.on('text_delta', (data) => {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.isStreaming && last.role === 'assistant') {
          // Append to existing streaming message
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + data.text }
          ]
        }
        // Start new assistant message
        return [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.text,
          isStreaming: true,
          timestamp: Date.now(),
        }]
      })
    })

    socket.on('agent_status', (data) => {
      if (data.status === 'complete' || data.status === 'error') {
        // Mark streaming complete
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }]
          }
          return prev
        })
      }
    })

    return () => {
      socket.off('text_delta')
      socket.off('agent_status')
    }
  }, [socket])

  return messages
}
```

### Pattern 3: Form Data State (via output\_update)

This is the most important pattern for Solutions. The `output_update` event carries structured data from the AI Agent to populate frontend forms. We will cover this in detail in Chapter 5.

The basic pattern:

```typescript
function useFormData(socket: Socket) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  useEffect(() => {
    socket.on('output_update', (event) => {
      // IMPORTANT: data is nested inside payload.data
      const { field, value, operation } = event.payload.data

      setFormData(prev => {
        switch (operation) {
          case 'set':
            return { ...prev, [field]: value }
          case 'append':
            const existing = prev[field]
            if (Array.isArray(existing)) {
              return { ...prev, [field]: [...existing, value] }
            }
            return { ...prev, [field]: (existing || '') + String(value) }
          case 'merge':
            return { ...prev, [field]: { ...(prev[field] as object), ...(value as object) } }
          default:
            return { ...prev, [field]: value }
        }
      })
    })

    return () => { socket.off('output_update') }
  }, [socket])

  return formData
}
```

### Pattern 4: Tool Activity Tracking

Show users what the AI Agent is doing:

```typescript
interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  description?: string
  startedAt: number
  duration?: number
}

function useToolActivity(socket: Socket) {
  const [activeTools, setActiveTools] = useState<Map<string, ToolActivity>>(new Map())

  useEffect(() => {
    socket.on('tool_activity', (data) => {
      const activity = data.payload || data

      setActiveTools(prev => {
        const next = new Map(prev)
        if (activity.phase === 'start') {
          next.set(activity.toolId, {
            ...activity,
            startedAt: Date.now(),
          })
        } else if (activity.phase === 'end') {
          next.delete(activity.toolId)
        }
        return next
      })
    })

    return () => { socket.off('tool_activity') }
  }, [socket])

  return activeTools
}
```

## Data Flow Diagram: Task Manager

Here is the complete data flow for our Task Manager Solution:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Task Manager Frontend                        │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ Chat     │  │ Task Form    │  │ Task List  │  │ Agent Status │ │
│  │ Panel    │  │ (output_     │  │ (REST API) │  │ Indicator    │ │
│  │          │  │  update)     │  │            │  │              │ │
│  └────┬─────┘  └──────▲───────┘  └──────▲─────┘  └──────▲───────┘ │
│       │               │                │               │         │
│       │  text_delta    │  output_update  │  REST         │ agent_  │
│       │               │                │  response     │ status  │
└───────┼───────────────┼────────────────┼───────────────┼─────────┘
        │               │                │               │
   ┌────▼───────────────┴────────────────┴───────────────┴─────────┐
   │                    Solution Backend                            │
   │                                                                │
   │  ┌────────────────────┐    ┌─────────────────────┐            │
   │  │ Socket.io Relay    │    │ REST API             │            │
   │  │ (chat, events)     │    │ (CRUD for tasks)     │            │
   │  └────────┬───────────┘    └──────────────────────┘            │
   └───────────┼────────────────────────────────────────────────────┘
               │
   ┌───────────▼────────────────────────────────────────────────────┐
   │                     CCAAS Backend                              │
   │                                                                │
   │  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌────────────┐  │
   │  │ Auth &   │  │ Skill     │  │ Session   │  │ Event      │  │
   │  │ Tenant   │  │ Router    │  │ Manager   │  │ Streamer   │  │
   │  └──────────┘  └─────┬─────┘  └─────┬─────┘  └──────▲─────┘  │
   └───────────────────────┼──────────────┼───────────────┼────────┘
                           │              │               │
   ┌───────────────────────▼──────────────▼───────────────┼────────┐
   │                    AI Agent Process                   │        │
   │                                                      │        │
   │  1. Read Skill instructions                          │        │
   │  2. Understand user intent                           │        │
   │  3. Call MCP tools (write_output, etc.)  ────────────┘        │
   │  4. Stream text response                                      │
   └───────────────────────────────────────────────────────────────┘
```

## Dual Data Channels

Notice that a Solution typically uses **two separate data channels**:

### Channel 1: WebSocket (Real-time, via CCAAS)

Used for AI interactions:

- **Inbound**: `chat` events from user
- **Outbound**: `text_delta`, `output_update`, `agent_status`, `tool_activity`
- **Purpose**: Real-time streaming of AI Agent output

### Channel 2: REST API (Request-response, direct)

Used for CRUD operations on domain data:

- **Inbound**: HTTP requests from frontend
- **Outbound**: JSON responses with domain data
- **Purpose**: Traditional data operations (list tasks, update task, delete task)

```typescript
// Channel 1: AI interaction via WebSocket
socket.emit('chat', { message: 'Create a high priority task for fixing login' })
socket.on('output_update', (event) => {
  // AI fills in the form
})

// Channel 2: CRUD via REST API
const tasks = await fetch('/api/tasks').then(r => r.json())
await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify(taskData)
})
```

This separation is important: the AI Agent generates structured data through Channel 1, but the actual persistence of that data happens through Channel 2 when the user confirms and saves.

## Session Management

Sessions are the unit of AI interaction in LoopAI. Understanding session lifecycle is important for state management.

### Session States

```
            ┌──────────────┐
            │   Created    │
            └──────┬───────┘
                   │ user sends chat
            ┌──────▼───────┐
            │  Processing  │ ◄──── user sends follow-up
            └──────┬───────┘
                   │ agent completes
            ┌──────▼───────┐
            │     Idle     │ ◄──── ready for next message
            └──────┬───────┘
                   │ user disconnects
            ┌──────▼───────┐
            │  Suspended   │
            └──────┬───────┘
                   │ reconnect_session
            ┌──────▼───────┐
            │   Restored   │ ──── back to Idle
            └──────────────┘
```

### Session Reconnection

Users may close the browser and return later. LoopAI supports session reconnection:

```typescript
// On app load, try to restore previous session
const savedSessionId = localStorage.getItem('sessionId')
if (savedSessionId) {
  socket.emit('reconnect_session', { sessionId: savedSessionId })

  socket.on('session_restored', () => {
    console.log('Session restored successfully')
  })

  socket.on('session_not_found', () => {
    localStorage.removeItem('sessionId')
    console.log('Previous session expired, starting fresh')
  })
}
```

## Exercises

### Exercise 4.1: Trace a Message

Given this user message: "List all tasks with high priority"

Draw the complete data flow, identifying:
1. Which WebSocket events will be emitted?
2. Will `output_update` events be generated? Why or why not?
3. Which data channel (WebSocket or REST) should be used to fetch the task list?

### Exercise 4.2: Design State Shape

For the Task Manager Solution, design the complete frontend state shape. Consider:
- Agent connection state
- Chat message history
- Current task form data (from `output_update`)
- Task list (from REST API)
- Active tool indicators

```typescript
// Fill in the state interface
interface TaskManagerState {
  // Your design here
}
```

### Exercise 4.3: Event Timeline

Given this scenario: the user asks the AI to "Create a task with title 'Deploy v2' and assign it to Alice"

Write out the expected timeline of WebSocket events, including:
- Event type
- Approximate timing
- Key payload data

## Key Takeaways

1. **LoopAI is a relay architecture** -- the CCAAS backend mediates all communication between your Solution and the AI Agent
2. **WebSocket events are categorized** into control, lifecycle, content, and observability events
3. **`output_update` is the bridge** between AI Agent output and frontend forms -- it carries structured data in a nested `payload.data` structure
4. **Solutions use dual data channels** -- WebSocket for AI interactions, REST for CRUD operations
5. **Sessions are the unit of interaction** -- they can be created, suspended, and restored

## What's Next

In [Chapter 5](05-form-protocol.md), we will dive deep into the `output_update` protocol and form synchronization patterns. You will learn how to use `write_output` in your MCP Server, handle `output_update` events in the frontend, and implement advanced patterns like the SyncCard approval flow.
