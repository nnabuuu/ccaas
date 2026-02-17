# WebSocket Events

KedgeAgentic uses Socket.io for WebSocket communication, providing a rich real-time event stream.

## Connection

```typescript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  auth: {
    token: 'YOUR_API_KEY'  // Optional
  }
})
```

After a successful connection, the server sends a `client_id` event containing the client ID assigned to that connection.

## Client → Server Events

### chat

Send a chat message.

```typescript
socket.emit('chat', {
  message: 'User message content',
  sessionId: 'session-uuid'    // Optional
})
```

### cancel

Cancel a running operation.

```typescript
socket.emit('cancel', {
  sessionId: 'session-uuid'
})
```

### reconnect\_session

Resume a previous session.

```typescript
socket.emit('reconnect_session', {
  sessionId: 'session-uuid'
})
```

### get\_stats

Get server statistics.

```typescript
socket.emit('get_stats', {}, (stats) => {
  console.log('Sessions:', stats.activeSessions)
})
```

## Server → Client Events

### client\_id

Client ID assigned upon successful connection.

```typescript
socket.on('client_id', (data) => {
  // data: { clientId: 'uuid' }
})
```

### text\_delta

AI text streaming output.

```typescript
socket.on('text_delta', (data) => {
  // data: {
  //   type: 'text_delta',
  //   sessionId: 'uuid',
  //   delta: 'Partial text...'
  // }
})
```

### agent\_status

Agent status change.

```typescript
socket.on('agent_status', (data) => {
  // data: {
  //   type: 'agent_status',
  //   sessionId: 'uuid',
  //   status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'running' | 'complete' | 'error',
  //   context?: {
  //     currentAction: string,
  //     target: string,
  //     steps: { current: number, total: number },
  //     goalNarrative: string
  //   },
  //   error?: {
  //     code: string,
  //     message: string,
  //     recoverable: boolean,
  //     suggestion: string
  //   }
  // }
})
```

### tool\_activity

Tool usage activity.

```typescript
socket.on('tool_activity', (data) => {
  // data: {
  //   type: 'tool_activity',
  //   sessionId: 'uuid',
  //   toolName: 'write_output',
  //   toolId: 'tool-uuid',
  //   phase: 'start' | 'progress' | 'end',
  //   description: 'Generating lesson plan...',
  //   decisionLogic?: {
  //     why: string,
  //     benefit: string,
  //     nextStep: string
  //   },
  //   duration?: number,
  //   success?: boolean
  // }
})
```

### output\_update

Structured output update.

```typescript
socket.on('output_update', (data) => {
  // data: {
  //   type: 'output_update',
  //   sessionId: 'uuid',
  //   payload: {
  //     data: {
  //       field: 'title',
  //       value: 'Calculating Triangle Area',
  //       operation: 'set' | 'append' | 'merge'
  //     },
  //     progressive: boolean,
  //     complete: boolean,
  //     status: string,
  //     progress: number
  //   }
  // }
})
```

{% hint style="danger" %}
**Watch the nested structure**: The field data is located in `event.payload.data`, not at the top level of `event`.
{% endhint %}

### todo\_update

Task list update.

```typescript
socket.on('todo_update', (data) => {
  // data: {
  //   type: 'todo_update',
  //   sessionId: 'uuid',
  //   todos: [
  //     {
  //       id: 'todo-uuid',
  //       content: 'Design learning objectives',
  //       status: 'pending' | 'in_progress' | 'completed'
  //     }
  //   ],
  //   summary: {
  //     total: 5,
  //     completed: 2,
  //     inProgress: 1,
  //     pending: 2
  //   }
  // }
})
```

### token\_usage

Token usage statistics.

```typescript
socket.on('token_usage', (data) => {
  // data: {
  //   type: 'token_usage',
  //   sessionId: 'uuid',
  //   inputTokens: number,
  //   outputTokens: number,
  //   reasoningTokens: number,
  //   cachedInputTokens: number,
  //   sessionTotalTokens: number,
  //   estimatedCostUsd: number,
  //   model: string
  // }
})
```

### agent\_thinking

Agent thinking process.

```typescript
socket.on('agent_thinking', (data) => {
  // data: {
  //   type: 'agent_thinking',
  //   sessionId: 'uuid',
  //   phase: 'start' | 'delta' | 'end',
  //   content: 'Thinking content...'
  // }
})
```

### error

Error event.

```typescript
socket.on('error', (data) => {
  // data: {
  //   type: 'error',
  //   sessionId: 'uuid',
  //   code: string,
  //   message: string,
  //   recoverable: boolean,
  //   suggestion?: string
  // }
})
```

### session\_restored

Session successfully restored.

```typescript
socket.on('session_restored', (data) => {
  // data: { sessionId: 'uuid', status: 'restored' }
})
```

### session\_not\_found

Session not found.

```typescript
socket.on('session_not_found', (data) => {
  // data: { sessionId: 'uuid' }
})
```
