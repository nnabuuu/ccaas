# SSE Transport (Server-Sent Events)

KedgeAgentic uses **SSE (Server-Sent Events)** as its default transport. All real-time events stream over a standard HTTP connection — no WebSocket or Socket.IO required.

> **Recommended**: Use `@kedge-agentic/react-sdk` rather than handling the SSE stream manually. The SDK wraps all connection management, event parsing, and state logic.
>
> Only read this page if you are building a non-React client (native iOS/Android, CLI tool, Python script, etc.).

---

## Endpoint Overview

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/sessions/:sessionId/messages` | Send a message; receive SSE event stream (per turn) |
| `GET` | `/api/v1/sessions/:sessionId/events` | Subscribe to push channel (persistent, cross-turn) |
| `POST` | `/api/v1/sessions/:sessionId/cancel` | Cancel the currently running task |

---

## POST /messages — Send a Message

Call this endpoint each time the user sends a message. The response is an SSE stream containing all events for this turn; the connection closes automatically when the turn ends.

### Request

```
POST /api/v1/sessions/:sessionId/messages
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "message": "User message content",
  "tenantId": "default",
  "apiKey": "sk-..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | ✅ | User message content |
| `tenantId` | string | ✅ | Tenant ID |
| `apiKey` | string | ❌ | API Key (can also be passed via `Authorization: Bearer` header) |
| `enabledSkillSlugs` | string[] | ❌ | Skill slugs to enable; omit to auto-load all enabled skills for the tenant |
| `appendSystemPrompt` | string | ❌ | Additional instructions appended to the system prompt |
| `templateName` | string | ❌ | Session template to apply (configured in the admin panel) |
| `mcpServers` | object | ❌ | Additional MCP Server configuration for this request |
| `context` | object | ❌ | Page context (current route, form data, etc.) |
| `attachments` | object[] | ❌ | Attachments (images or documents; paths relative to the session workspace) |
| `afterSeq` | number | ❌ | Reconnect: replay events after this sequence number |
| `autoClose` | boolean | ❌ | Destroy the session immediately after processing completes. For stateless one-shot tasks. Default: `false` |

### Response Format

Response header: `Content-Type: text/event-stream`

Each event is a single line prefixed with `data: `, separated by blank lines:

```
data: {"type":"agent_status","status":"running","sessionId":"my-session","timestamp":"..."}

data: {"type":"text_delta","delta":"Hello","sessionId":"my-session"}

data: {"type":"agent_status","status":"complete","sessionId":"my-session","timestamp":"..."}

```

The connection closes when the turn ends (no client action needed).

### curl Example

```bash
curl -N -X POST http://localhost:3001/api/v1/sessions/my-session/messages \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "Please write a report", "tenantId": "default"}'
```

---

## GET /events — Push Channel (Persistent)

Subscribe to a long-lived push channel to receive cross-turn background task notifications (`subagent_started` / `subagent_completed`).

**Difference from `/messages`:**

| | `POST /messages` | `GET /events` |
|---|---|---|
| Lifetime | Single turn | Persistent, cross-turn |
| Event types | All events | Subagent events only |
| Use case | Receive AI response stream | Monitor background tasks |

### Request

```
GET /api/v1/sessions/:sessionId/events
Accept: text/event-stream
```

### When to Use

When the AI uses the `Task` tool with `run_in_background: true`, the `POST /messages` turn ends immediately while the task continues running in the background. Completion notifications are delivered via `GET /events`:

```
data: {"type":"subagent_started","sessionId":"my-session","payload":{"subAgentId":"toolu_01ABC","agentType":"Task","description":"Generate report","status":"running"}}

# A few minutes later...
data: {"type":"subagent_completed","sessionId":"my-session","payload":{"subAgentId":"toolu_01ABC","status":"completed","durationMs":45000}}
```

### curl Example

```bash
# Keep connection open and wait for background task notifications
curl -N http://localhost:3001/api/v1/sessions/my-session/events \
  -H "Accept: text/event-stream"
```

---

## POST /cancel — Cancel Task

Cancel the currently running turn.

### Request

```
POST /api/v1/sessions/:sessionId/cancel
Content-Type: application/json
```

```json
{
  "tenantId": "default"
}
```

### curl Example

```bash
curl -X POST http://localhost:3001/api/v1/sessions/my-session/cancel \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "default"}'
```

---

## One-Shot Sessions (autoClose)

`autoClose: true` enables "one-shot session" mode: the session is destroyed immediately after processing completes, freeing the process pool slot.

### When to Use

| Use case | Recommended value |
|----------|-------------------|
| Multi-turn conversation (chatbot, context continuity) | `autoClose: false` (default) |
| Stateless one-shot task (webhook, batch processing, API call) | `autoClose: true` |

### Behaviour Comparison

| | `autoClose: false` (default) | `autoClose: true` |
|---|---|---|
| Session state after completion | Retained (idle, conversation can continue) | Immediately destroyed (process terminated) |
| Process pool slot | Held until TTL expires | Released immediately |
| Next request with same sessionId | Reuses session; history preserved | Creates a fresh session; no history |

### Concurrent Requests

When multiple `autoClose: true` requests are sent to the same `sessionId` (e.g. batch-processing a list of records), the platform guarantees **FIFO serial execution**:

```
Request A (autoClose=true) ──┐
                              ├─ Message queue (DB row-lock, per-session FIFO)
Request B (autoClose=true) ──┘
                    │
                    ▼ A processed first
              Worker processes A → complete → session destroyed
                    │
                    ▼ B was waiting in queue
              Worker processes B → getOrCreateSession() recreates session → complete → session destroyed
```

B will not fail because A destroyed the session — the worker transparently creates a fresh session for B.

### Failure Behaviour

On processing failure, the session is **not** destroyed even if `autoClose: true` was set (TTL handles cleanup). This ensures sessions are not prematurely destroyed during retry scenarios.

### Examples

```bash
# Stateless analysis task (destroy when done)
curl -N -X POST http://localhost:3001/api/v1/sessions/job-$(uuidgen)/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Analyze this log file and return a structured report: ...",
    "tenantId": "default",
    "autoClose": true
  }'
```

```typescript
// React SDK usage
const chat = useAgentChat({ connection, tenantId: 'default' })

// Send a one-shot task
chat.sendMessage('Analyze this data', { autoClose: true })
```

---

## Event Reference

All events share the same base structure:

```typescript
interface FrontendEvent {
  type: string
  sessionId: string
  timestamp?: string  // ISO 8601
}
```

### agent\_status

Agent execution state change.

```typescript
{
  type: 'agent_status'
  sessionId: string
  timestamp: string
  status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error' | 'cancelled'
  error?: string  // when status='error'
}
```

`isProcessing = status in ['thinking', 'running', 'exploring', 'executing']`

### text\_delta

Streamed AI text output fragment. Concatenate all `delta` values for the full reply.

```typescript
{
  type: 'text_delta'
  sessionId: string
  delta: string
}
```

### output\_update

Structured output update (for form sync scenarios).

```typescript
{
  type: 'output_update'
  sessionId: string
  payload: {
    data: {
      field: string        // field name
      value: unknown       // new value
      operation: 'set' | 'append' | 'merge'
    }
    progressive: boolean
    complete: boolean
    status: string
    progress: number
  }
}
```

{% hint style="warning" %}
Note: field data is in `event.payload.data`, not at the top level of `event`.
{% endhint %}

### tool\_activity

Tool call activity (read file, write file, search, etc.).

```typescript
{
  type: 'tool_activity'
  sessionId: string
  payload: {
    toolId: string
    toolName: string
    phase: 'start' | 'progress' | 'end'
    description: string
    duration?: number   // when phase='end'
    success?: boolean   // when phase='end'
  }
}
```

### agent\_thinking

Agent reasoning process (extended thinking mode).

```typescript
{
  type: 'agent_thinking'
  sessionId: string
  payload: {
    phase: 'start' | 'delta' | 'end'
    content?: string  // when phase='delta'
  }
}
```

### subagent\_started

Background Task tool started (from `/events` push channel).

```typescript
{
  type: 'subagent_started'
  sessionId: string
  timestamp: string
  payload: {
    subAgentId: string    // Tool use ID, e.g. "toolu_01ABC"
    agentType: string     // e.g. "Task"
    description: string   // task description
    startedAt: string     // ISO 8601
    status: 'running'
    nestingLevel: number  // nesting level, typically 1
  }
}
```

### subagent\_completed

Background Task tool completed (from `/events` push channel).

```typescript
{
  type: 'subagent_completed'
  sessionId: string
  timestamp: string
  payload: {
    subAgentId: string
    status: 'completed' | 'failed'
    durationMs: number
    error?: string  // when status='failed'
  }
}
```

### token\_usage

Token usage statistics, sent at the end of each turn.

```typescript
{
  type: 'token_usage'
  sessionId: string
  payload: {
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    sessionTotalTokens: number
    sessionInputTokens: number
    sessionOutputTokens: number
    model: string
    stopReason: string
    messageId: string
  }
}
```

### error

Error event.

```typescript
{
  type: 'error'
  sessionId: string
  code: string
  message: string
  recoverable: boolean
  suggestion?: string
}
```

---

## SSE Parsing Implementation

If you need to parse the SSE stream manually in a non-React environment:

```typescript
async function streamMessages(
  serverUrl: string,
  sessionId: string,
  message: string,
  onEvent: (event: any) => void
) {
  const response = await fetch(`${serverUrl}/api/v1/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ message, tenantId: 'default' }),
  })

  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const chunk of parts) {
      const dataLine = chunk.split('\n').find(l => l.startsWith('data:'))
      if (!dataLine) continue
      try {
        const event = JSON.parse(dataLine.slice(5).trim())
        onEvent(event)
      } catch {
        // ignore parse errors
      }
    }
  }
}
```

---

## React SDK (Recommended)

Using the React SDK eliminates all of the above manual handling:

```tsx
import { useAgentConnection, useAgentChat, useAgentStatus } from '@kedge-agentic/react-sdk'

function MyApp() {
  // SSE is the default transport
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',  // must be an absolute URL
    sessionPrefix: 'my-app'
  })

  // Automatically manages POST /messages SSE stream
  const chat = useAgentChat({ connection, tenantId: 'default' })

  // Automatically subscribes to GET /events push channel (SSE mode)
  // Automatically handles subagent_started / subagent_completed events
  const status = useAgentStatus({ connection })

  return (
    <div>
      <p>Connected: {connection.connected ? 'yes' : 'no'}</p>
      <p>Agent status: {status.agentStatus}</p>
      {status.activeSubAgents.map(agent => (
        <p key={agent.subAgentId}>Background task: {agent.description} ({agent.status})</p>
      ))}
      <button onClick={() => chat.sendMessage('Hello')}>Send</button>
    </div>
  )
}
```

- `useAgentChat` — manages `POST /messages` and message list
- `useAgentStatus` — manages `GET /events` push channel and all agent state
- `useAgentConnection` — manages connection lifecycle

Full documentation: [Chat Integration with React SDK](../guide/chat-integration.md)
