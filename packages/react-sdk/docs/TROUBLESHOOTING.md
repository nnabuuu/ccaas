# React SDK Troubleshooting Guide

Common issues, debugging techniques, and solutions for `@ccaas/react-sdk`.

## Table of Contents

- [Common Errors](#common-errors)
- [Connection Issues](#connection-issues)
- [Message Sending Problems](#message-sending-problems)
- [State Synchronization Issues](#state-synchronization-issues)
- [Performance Problems](#performance-problems)
- [Debugging Techniques](#debugging-techniques)
- [FAQ](#faq)

---

## Common Errors

### Error: "Client not connected"

**Symptoms:**
```
Error 400: Client clientId_xxx not connected to session
```

**Causes:**
1. Sending message before WebSocket connection established
2. WebSocket disconnected mid-operation
3. Session expired or cleaned up by server

**Solutions:**

```tsx
// ✅ Wait for connection before sending
const chat = useAgentChat({ connection, tenantId: 'my-tenant' })

useEffect(() => {
  if (connection.connected && connection.clientId) {
    // Safe to send messages now
    chat.sendMessage('Hello')
  }
}, [connection.connected, connection.clientId])

// ✅ Check connection status before sending
const handleSend = async (content: string) => {
  if (!connection.connected) {
    alert('Not connected to server')
    return
  }

  if (!connection.clientId) {
    alert('Client ID not assigned yet')
    return
  }

  await chat.sendMessage(content)
}
```

**Prevention:**
- Always check `connection.connected` and `connection.clientId` before sending
- SDK's `sendMessage` has built-in retry logic for transient disconnections
- Use connection status indicators in UI

---

### Error: "Session not found"

**Symptoms:**
```
Error 404: Session session_xxx not found
```

**Causes:**
1. Session ID mismatch (client vs server)
2. Server restarted and lost session state
3. Session expired due to inactivity

**Solutions:**

```tsx
// ✅ Generate stable session IDs
const [sessionId] = useState(() => `my-app_${crypto.randomUUID()}`)

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  sessionPrefix: sessionId, // Use stable ID
})

// ✅ Or persist session ID to localStorage
function usePersistedSession(key: string) {
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem(key)
    if (stored) return stored

    const newId = `session_${crypto.randomUUID()}`
    localStorage.setItem(key, newId)
    return newId
  })

  return sessionId
}
```

---

### Error: TypeError - Cannot read property 'on' of null

**Symptoms:**
```
TypeError: Cannot read properties of null (reading 'on')
```

**Causes:**
1. Using chat/status hooks before connection is established
2. Socket reference is null
3. Component rendering before `useAgentConnection` initializes

**Solutions:**

```tsx
// ❌ Bad: Using hooks immediately
function MyApp() {
  const connection = useAgentConnection()
  const chat = useAgentChat({ connection, tenantId: 'my-tenant' })
  // Error: socket might be null!

  return <ChatPanel {...chat} />
}

// ✅ Good: Guard against null socket
function MyApp() {
  const connection = useAgentConnection()

  if (!connection.socket) {
    return <div>Initializing connection...</div>
  }

  return <ChatContent connection={connection} />
}

function ChatContent({ connection }) {
  const chat = useAgentChat({ connection, tenantId: 'my-tenant' })
  return <ChatPanel {...chat} />
}

// ✅ Alternative: Use autoConnect: false and manual control
function MyApp() {
  const connection = useAgentConnection({ autoConnect: false })

  useEffect(() => {
    connection.connect()
  }, [])

  if (!connection.connected) {
    return <div>Connecting...</div>
  }

  return <ChatContent connection={connection} />
}
```

---

## Connection Issues

### WebSocket Connection Fails

**Symptoms:**
- `connection.connected` stays `false`
- `connection.error` shows connection error
- Console shows "WebSocket connection failed"

**Debugging Steps:**

1. **Check server URL:**
```tsx
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001', // Correct URL?
})

console.log('Connecting to:', connection.serverUrl)
```

2. **Verify CORS settings:**
Server must allow WebSocket connections from your origin:
```typescript
// Backend: main.ts or app.ts
app.enableCors({
  origin: 'http://localhost:5173', // Your frontend URL
  credentials: true,
})
```

3. **Check network tab:**
- Open DevTools → Network → WS
- Look for WebSocket connection attempts
- Check for 101 Switching Protocols response

4. **Test with polling transport:**
```tsx
import { io } from 'socket.io-client'

// Temporarily force polling to isolate WebSocket issues
const socket = io(serverUrl, {
  transports: ['polling'], // Test without WebSocket
})
```

---

### Connection Drops Frequently

**Symptoms:**
- Connection established but disconnects within seconds/minutes
- `disconnect` event fires repeatedly

**Causes:**
1. Server timeout settings too aggressive
2. Network instability
3. Browser tab suspended (mobile)
4. Reverse proxy/load balancer timeout

**Solutions:**

```tsx
// ✅ Implement auto-reconnection
function useAutoReconnect(connection) {
  useEffect(() => {
    const socket = connection.socket
    if (!socket) return

    const handleDisconnect = (reason: string) => {
      console.log('Disconnected:', reason)

      // Reconnect unless intentional disconnect
      if (reason !== 'io client disconnect') {
        setTimeout(() => {
          console.log('Attempting to reconnect...')
          socket.connect()
        }, 1000)
      }
    }

    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('disconnect', handleDisconnect)
    }
  }, [connection.socket])
}

// Usage
const connection = useAgentConnection({ serverUrl: '...' })
useAutoReconnect(connection)
```

**Server-side solution:**
```typescript
// Increase server timeout
const io = new Server(httpServer, {
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
})
```

---

## Message Sending Problems

### Messages Not Appearing

**Symptoms:**
- `sendMessage` resolves successfully
- No errors in console
- Message not showing in UI

**Causes:**
1. Message not added to state
2. React not re-rendering
3. Message filtered out by component

**Debugging:**

```tsx
const chat = useAgentChat({ connection, tenantId: 'my-tenant' })

// Debug: Log messages state
useEffect(() => {
  console.log('Current messages:', chat.messages)
}, [chat.messages])

// Debug: Log sendMessage calls
const handleSend = async (content: string) => {
  console.log('Sending:', content)
  try {
    await chat.sendMessage(content)
    console.log('Sent successfully')
  } catch (error) {
    console.error('Send failed:', error)
  }
}
```

**Solutions:**

```tsx
// ✅ Ensure message list renders all messages
function MessageList({ messages }) {
  console.log('Rendering', messages.length, 'messages')

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role}: {msg.content}
        </div>
      ))}
    </div>
  )
}

// ✅ Check for unique keys
// Bad: key={index} causes issues
// Good: key={msg.id}
```

---

### Stream Content Not Updating

**Symptoms:**
- `text_delta` events received (check with socket.io dev tools)
- `currentStreamContent` not updating
- UI shows blank or stale content

**Causes:**
1. Stale closure in event handler
2. Component not re-rendering on state change
3. Streaming content not passed to component

**Solutions:**

```tsx
// ✅ Pass currentStreamContent to MessageBubble
<MessageBubble
  message={msg}
  isStreaming={msg.isStreaming}
  currentStreamContent={
    msg.id === messages[messages.length - 1]?.id
      ? currentStreamContent
      : undefined
  }
/>

// ✅ Debug streaming state
useEffect(() => {
  console.log('Stream content:', currentStreamContent)
}, [currentStreamContent])

// ✅ Check isStreaming flag
useEffect(() => {
  const lastMsg = messages[messages.length - 1]
  if (lastMsg) {
    console.log('Last message streaming?', lastMsg.isStreaming)
  }
}, [messages])
```

---

## State Synchronization Issues

### Output Updates Not Syncing

**Symptoms:**
- `output_update` events received
- `pendingUpdates` Map empty
- Form fields not updating

**Debugging:**

```tsx
const sync = useOutputSync({
  mode: 'auto',
})

// Debug: Log updates
const chat = useAgentChat({
  connection,
  tenantId: 'my-tenant',
  onOutputUpdate: (update) => {
    console.log('Output update received:', update)
    sync.handleOutputUpdate(update)
  },
})

// Debug: Check pending updates
useEffect(() => {
  console.log('Pending updates:', Array.from(sync.pendingUpdates.entries()))
}, [sync.pendingUpdates])
```

**Solutions:**

```tsx
// ✅ Ensure handleOutputUpdate is called
const handleOutputUpdate = useCallback((update: OutputUpdate) => {
  console.log('Handling update:', update.field, update.value)

  sync.handleOutputUpdate(update)

  // Auto mode: immediately sync
  if (sync.mode === 'auto') {
    sync.syncToForm(update.field, formData, setFormData)
  }
}, [sync, formData])

// ✅ Check field name matches
const normalizeField = (field: string, value: unknown) => {
  // Ensure field names match your form data keys
  console.log('Normalizing field:', field)

  if (field === 'lesson_title') {
    // Map to correct key
    return { title: value }
  }

  return value
}
```

---

### Undo Not Working

**Symptoms:**
- `canUndo()` returns false
- `undoSync` has no effect

**Causes:**
1. Undo timeout expired
2. Undo entry not created (normalization issue)
3. Field name mismatch

**Solutions:**

```tsx
// ✅ Increase undo timeout if needed
const sync = useOutputSync({
  mode: 'auto',
  undoTimeout: 60000, // 60 seconds instead of default 30
})

// ✅ Check undo availability
const canUndo = sync.canUndo('title')
console.log('Can undo title?', canUndo)

// ✅ Debug undo stack
useEffect(() => {
  console.log('Undo stack:', sync.undoStack)
}, [sync.undoStack])
```

---

## Performance Problems

### Slow Rendering with Many Messages

**Symptoms:**
- UI lags when message count > 50
- Input becomes unresponsive
- High CPU usage

**Solutions:**

```tsx
// ✅ Memoize expensive computations
const MessageList = memo(({ messages }) => {
  return (
    <div>
      {messages.map((msg) => (
        <MemoizedMessage key={msg.id} message={msg} />
      ))}
    </div>
  )
})

const MemoizedMessage = memo(
  MessageBubble,
  (prev, next) => {
    return (
      prev.message.id === next.message.id &&
      prev.message.content === next.message.content &&
      prev.isStreaming === next.isStreaming
    )
  }
)

// ✅ Use virtualization for long lists
import { useVirtualizer } from '@tanstack/react-virtual'
```

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed optimization strategies.

---

### Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Browser tab becomes slow after extended use
- DevTools shows increasing node count

**Common Causes:**

1. **Socket event listeners not cleaned up:**
```tsx
// ❌ Bad: No cleanup
useEffect(() => {
  const socket = connection.socket
  socket?.on('text_delta', handleDelta)
}, [connection.socket])

// ✅ Good: Cleanup on unmount
useEffect(() => {
  const socket = connection.socket
  if (!socket) return

  const handleDelta = (data) => { /* ... */ }
  socket.on('text_delta', handleDelta)

  return () => {
    socket.off('text_delta', handleDelta)
  }
}, [connection.socket])
```

2. **Intervals/timeouts not cleared:**
```tsx
// ❌ Bad: Timeout not cleared
useEffect(() => {
  const timeout = setTimeout(() => {
    // Do something
  }, 1000)
}, [])

// ✅ Good: Clear on unmount
useEffect(() => {
  const timeout = setTimeout(() => {
    // Do something
  }, 1000)

  return () => clearTimeout(timeout)
}, [])
```

3. **Large data structures in state:**
```tsx
// ❌ Bad: Accumulating unbounded data
const [allMessages, setAllMessages] = useState([])

// ✅ Good: Limit message history
const MAX_MESSAGES = 100

const addMessage = (msg) => {
  setMessages((prev) => {
    const updated = [...prev, msg]
    return updated.slice(-MAX_MESSAGES) // Keep last 100
  })
}
```

---

## Debugging Techniques

### Enable Socket.io Debug Logs

```tsx
import { io } from 'socket.io-client'

localStorage.setItem('debug', 'socket.io-client:*')

// Reload page to see debug logs
```

### React DevTools Profiler

1. Install [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
2. Open DevTools → Profiler tab
3. Click record, perform actions, stop
4. Analyze render times and re-render counts

### Custom Debug Hook

```tsx
import { useEffect, useRef } from 'react'

export function useWhyDidYouUpdate(name: string, props: any) {
  const previousProps = useRef<any>()

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props })
      const changedProps: any = {}

      allKeys.forEach((key) => {
        if (previousProps.current[key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current[key],
            to: props[key],
          }
        }
      })

      if (Object.keys(changedProps).length > 0) {
        console.log('[why-did-you-update]', name, changedProps)
      }
    }

    previousProps.current = props
  })
}

// Usage
function MyComponent(props) {
  useWhyDidYouUpdate('MyComponent', props)
  // ...
}
```

### Network Monitoring

```tsx
// Monitor all fetch requests
const originalFetch = window.fetch

window.fetch = async (...args) => {
  console.log('Fetch:', args[0], args[1])
  const response = await originalFetch(...args)
  console.log('Response:', response.status, await response.clone().text())
  return response
}

// Monitor socket events
useEffect(() => {
  const socket = connection.socket
  if (!socket) return

  const originalEmit = socket.emit
  socket.emit = function (...args: any[]) {
    console.log('Socket emit:', args[0], args[1])
    return originalEmit.apply(this, args)
  }

  const originalOn = socket.on
  socket.on = function (event: string, handler: any) {
    const wrappedHandler = (...args: any[]) => {
      console.log('Socket event:', event, args)
      return handler(...args)
    }
    return originalOn.call(this, event, wrappedHandler)
  }
}, [connection.socket])
```

---

## FAQ

### Q: Why are my messages duplicated?

**A:** This usually happens when:
1. Component re-mounts and creates new hook instance
2. Using `key={index}` instead of `key={msg.id}`
3. Same message sent multiple times

**Solution:**
```tsx
// ✅ Use stable keys
{messages.map((msg) => (
  <MessageBubble key={msg.id} message={msg} />
))}

// ✅ Prevent duplicate sends
const [isSending, setIsSending] = useState(false)

const handleSend = async (content: string) => {
  if (isSending) return

  setIsSending(true)
  try {
    await chat.sendMessage(content)
  } finally {
    setIsSending(false)
  }
}
```

---

### Q: How do I test components that use SDK hooks?

**A:** Mock the hooks in your tests:

```tsx
import { vi } from 'vitest'

vi.mock('@ccaas/react-sdk', () => ({
  useAgentConnection: () => ({
    socket: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
    connected: true,
    clientId: 'test-client',
    sessionId: 'test-session',
    serverUrl: 'http://test',
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  useAgentChat: () => ({
    messages: [],
    isProcessing: false,
    currentStreamContent: '',
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    cancelProcessing: vi.fn(),
  }),
}))
```

See [ADVANCED_PATTERNS.md#testing-strategies](./ADVANCED_PATTERNS.md#testing-strategies) for more details.

---

### Q: Can I use the SDK with TypeScript strict mode?

**A:** Yes! The SDK is fully typed with TypeScript strict mode enabled. If you encounter type errors, make sure you're using the latest version.

---

### Q: How do I handle session persistence across page reloads?

**A:** Store session ID in localStorage:

```tsx
function usePersistedSession() {
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('ccaas-session-id')
    if (!id) {
      id = `session_${crypto.randomUUID()}`
      localStorage.setItem('ccaas-session-id', id)
    }
    return id
  })

  const connection = useAgentConnection({
    serverUrl: import.meta.env.VITE_API_URL,
    sessionPrefix: sessionId,
  })

  return { connection, sessionId }
}
```

Note: Server must also persist session state for this to work.

---

### Q: Why is my server receiving duplicate `session:join` events?

**A:** This happens when:
1. React StrictMode is enabled (double-render in development)
2. Component re-mounts
3. Hot module replacement (HMR) in development

**Solution:**
```tsx
// SDK handles this internally by checking if already connected
// If you're seeing issues, disable autoConnect and manage manually:

const connection = useAgentConnection({
  serverUrl: '...',
  autoConnect: false,
})

useEffect(() => {
  connection.connect()
  return () => connection.disconnect()
}, []) // Only on mount/unmount
```

---

## Getting Help

If you can't find a solution here:

1. Check the [API Reference](./API.md) for detailed hook documentation
2. Review [Advanced Patterns](./ADVANCED_PATTERNS.md) for complex use cases
3. Check [GitHub Issues](https://github.com/your-org/ccaas/issues)
4. Ask in the community Discord/Slack

When reporting issues, include:
- SDK version
- React version
- Browser and version
- Minimal reproduction code
- Console errors and network logs
