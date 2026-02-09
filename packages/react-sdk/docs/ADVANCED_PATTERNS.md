# React SDK Advanced Patterns

Advanced patterns and techniques for building production applications with `@ccaas/react-sdk`.

## Table of Contents

- [Custom Hook Composition](#custom-hook-composition)
- [Error Handling and Retry Strategies](#error-handling-and-retry-strategies)
- [WebSocket Reconnection Patterns](#websocket-reconnection-patterns)
- [State Management Integration](#state-management-integration)
- [Custom Rendering Patterns](#custom-rendering-patterns)
- [Performance Optimization](#performance-optimization)
- [Testing Strategies](#testing-strategies)

---

## Custom Hook Composition

### Creating Domain-Specific Session Hooks

Combine SDK hooks with your domain logic to create reusable session hooks.

```tsx
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  useChatLayout,
  useOutputSync,
} from '@ccaas/react-sdk'
import { useState, useCallback } from 'react'

interface MyDomainData {
  title: string
  content: string
  metadata: Record<string, unknown>
}

export function useMyDomainSession() {
  // SDK hooks
  const connection = useAgentConnection({
    serverUrl: import.meta.env.VITE_API_URL,
    sessionPrefix: 'my-domain',
  })

  const chat = useAgentChat({
    connection,
    tenantId: 'my-tenant',
    mcpServers: ['@modelcontextprotocol/server-filesystem'],
    skillPath: '/skills/my-domain',
  })

  const status = useAgentStatus({ connection })
  const layout = useChatLayout()

  // Domain-specific state
  const [domainData, setDomainData] = useState<MyDomainData>({
    title: '',
    content: '',
    metadata: {},
  })

  const sync = useOutputSync<MyDomainData>({
    mode: 'auto',
    normalizeField: (field, value) => {
      // Domain-specific normalization
      if (field === 'title') {
        return String(value).trim().slice(0, 100)
      }
      return value
    },
  })

  // Domain-specific operations
  const saveData = useCallback(async () => {
    const response = await fetch('/api/my-domain/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(domainData),
    })
    return response.json()
  }, [domainData])

  const loadData = useCallback(async (id: string) => {
    const response = await fetch(`/api/my-domain/${id}`)
    const data = await response.json()
    setDomainData(data)
  }, [])

  // Handle output updates
  const handleOutputUpdate = useCallback((update) => {
    sync.handleOutputUpdate(update)
    sync.syncToForm(update.field, domainData, setDomainData)
  }, [sync, domainData])

  // Override chat's onOutputUpdate
  const chatWithSync = {
    ...chat,
    sendMessage: async (content: string) => {
      return chat.sendMessage(content)
    },
  }

  return {
    // SDK state
    connection,
    chat: chatWithSync,
    status,
    layout,
    sync,

    // Domain state
    domainData,
    setDomainData,

    // Domain operations
    saveData,
    loadData,
    handleOutputUpdate,
  }
}
```

### Multi-Session Management

Managing multiple concurrent agent sessions.

```tsx
import { useAgentConnection, useAgentChat } from '@ccaas/react-sdk'
import { useState, useCallback } from 'react'

interface Session {
  id: string
  connection: ReturnType<typeof useAgentConnection>
  chat: ReturnType<typeof useAgentChat>
}

export function useMultiSession() {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const createSession = useCallback((id: string) => {
    const connection = useAgentConnection({
      serverUrl: import.meta.env.VITE_API_URL,
      sessionPrefix: `session-${id}`,
    })

    const chat = useAgentChat({
      connection,
      tenantId: 'my-tenant',
    })

    const session: Session = { id, connection, chat }

    setSessions((prev) => new Map(prev).set(id, session))
    setActiveSessionId(id)

    return session
  }, [])

  const closeSession = useCallback((id: string) => {
    const session = sessions.get(id)
    if (session) {
      session.connection.disconnect()
      setSessions((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })

      if (activeSessionId === id) {
        const remaining = Array.from(sessions.keys()).filter((k) => k !== id)
        setActiveSessionId(remaining[0] || null)
      }
    }
  }, [sessions, activeSessionId])

  const activeSession = activeSessionId ? sessions.get(activeSessionId) : null

  return {
    sessions,
    activeSession,
    activeSessionId,
    createSession,
    closeSession,
    setActiveSessionId,
  }
}
```

---

## Error Handling and Retry Strategies

### Comprehensive Error Handling

```tsx
import { useAgentChat } from '@ccaas/react-sdk'
import { useState, useCallback } from 'react'
import { ApiError } from '@ccaas/react-sdk/utils'

export function useRobustChat(connection) {
  const [errorState, setErrorState] = useState<{
    error: Error | null
    canRetry: boolean
    retryCount: number
  }>({
    error: null,
    canRetry: false,
    retryCount: 0,
  })

  const chat = useAgentChat({ connection, tenantId: 'my-tenant' })

  const sendMessageWithRetry = useCallback(
    async (content: string, maxRetries = 3) => {
      let attempts = 0

      while (attempts < maxRetries) {
        try {
          await chat.sendMessage(content)
          setErrorState({ error: null, canRetry: false, retryCount: 0 })
          return
        } catch (error) {
          attempts++

          if (error instanceof ApiError) {
            // Handle specific HTTP errors
            if (error.status === 429) {
              // Rate limited - wait before retry
              const waitTime = Math.pow(2, attempts) * 1000
              await new Promise((resolve) => setTimeout(resolve, waitTime))
              continue
            }

            if (error.status >= 500) {
              // Server error - retry
              if (attempts < maxRetries) continue
            }

            // Client error - don't retry
            setErrorState({
              error,
              canRetry: false,
              retryCount: attempts,
            })
            throw error
          }

          // Network error - retry
          if (attempts < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
            continue
          }

          setErrorState({
            error: error as Error,
            canRetry: true,
            retryCount: attempts,
          })
          throw error
        }
      }
    },
    [chat]
  )

  const retry = useCallback(() => {
    setErrorState({ error: null, canRetry: false, retryCount: 0 })
  }, [])

  return {
    ...chat,
    sendMessage: sendMessageWithRetry,
    errorState,
    retry,
  }
}
```

### Error Boundary for Chat Components

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chat error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-boundary">
            <h2>Something went wrong</h2>
            <p>{this.state.error?.message}</p>
            <button onClick={this.reset}>Try again</button>
          </div>
        )
      )
    }

    return this.props.children
  }
}

// Usage
<ChatErrorBoundary
  onError={(error, errorInfo) => {
    // Log to error tracking service
    console.error('Chat crashed:', error, errorInfo)
  }}
>
  <ChatPanel {...chatProps} />
</ChatErrorBoundary>
```

---

## WebSocket Reconnection Patterns

### Auto-Reconnection with Exponential Backoff

```tsx
import { useAgentConnection } from '@ccaas/react-sdk'
import { useEffect, useRef, useState } from 'react'

export function useReconnectingConnection(options) {
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const maxReconnectAttempts = 5
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connection = useAgentConnection({
    ...options,
    autoConnect: false, // Manual control
  })

  useEffect(() => {
    if (!connection.connected && !isReconnecting) {
      // Start initial connection
      connection.connect()
    }
  }, [])

  useEffect(() => {
    if (connection.error && reconnectAttempts < maxReconnectAttempts) {
      setIsReconnecting(true)

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 16000)

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Reconnection attempt ${reconnectAttempts + 1}`)
        setReconnectAttempts((prev) => prev + 1)
        connection.connect()
        setIsReconnecting(false)
      }, delay)
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connection.error, reconnectAttempts])

  useEffect(() => {
    if (connection.connected) {
      // Reset on successful connection
      setReconnectAttempts(0)
      setIsReconnecting(false)
    }
  }, [connection.connected])

  const manualReconnect = () => {
    setReconnectAttempts(0)
    setIsReconnecting(false)
    connection.disconnect()
    setTimeout(() => connection.connect(), 100)
  }

  return {
    ...connection,
    isReconnecting,
    reconnectAttempts,
    maxReconnectAttempts,
    manualReconnect,
  }
}
```

### Connection Status Indicator

```tsx
import { useAgentConnection } from '@ccaas/react-sdk'

export function ConnectionStatus({ connection }) {
  if (connection.connected) {
    return (
      <div className="status-connected">
        <span className="status-dot bg-green-500" />
        Connected
      </div>
    )
  }

  if (connection.error) {
    return (
      <div className="status-error">
        <span className="status-dot bg-red-500" />
        Connection Error
        <button onClick={() => connection.connect()}>Retry</button>
      </div>
    )
  }

  return (
    <div className="status-connecting">
      <span className="status-dot bg-yellow-500 animate-pulse" />
      Connecting...
    </div>
  )
}
```

---

## State Management Integration

### Redux Integration

```tsx
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAgentChat, useAgentStatus } from '@ccaas/react-sdk'

// Redux actions
export const chatActions = {
  addMessage: (message) => ({ type: 'CHAT_ADD_MESSAGE', payload: message }),
  updateStatus: (status) => ({ type: 'CHAT_UPDATE_STATUS', payload: status }),
  setProcessing: (isProcessing) => ({
    type: 'CHAT_SET_PROCESSING',
    payload: isProcessing,
  }),
}

// Redux-integrated hook
export function useReduxChat(connection) {
  const dispatch = useDispatch()
  const messages = useSelector((state) => state.chat.messages)
  const isProcessing = useSelector((state) => state.chat.isProcessing)

  const chat = useAgentChat({ connection, tenantId: 'my-tenant' })
  const status = useAgentStatus({ connection })

  // Sync messages to Redux
  useEffect(() => {
    chat.messages.forEach((msg) => {
      dispatch(chatActions.addMessage(msg))
    })
  }, [chat.messages, dispatch])

  // Sync status to Redux
  useEffect(() => {
    dispatch(chatActions.updateStatus(status.agentStatus))
    dispatch(chatActions.setProcessing(status.isProcessing))
  }, [status.agentStatus, status.isProcessing, dispatch])

  return {
    messages,
    isProcessing,
    sendMessage: chat.sendMessage,
    status,
  }
}
```

### Zustand Integration

```tsx
import { create } from 'zustand'
import { useAgentChat, useAgentStatus } from '@ccaas/react-sdk'
import { useEffect } from 'react'

// Zustand store
interface ChatStore {
  messages: Message[]
  isProcessing: boolean
  agentStatus: string
  addMessage: (message: Message) => void
  setProcessing: (isProcessing: boolean) => void
  setStatus: (status: string) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isProcessing: false,
  agentStatus: 'idle',
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setStatus: (agentStatus) => set({ agentStatus }),
}))

// Hook that syncs SDK to Zustand
export function useSyncedChat(connection) {
  const chat = useAgentChat({ connection, tenantId: 'my-tenant' })
  const status = useAgentStatus({ connection })
  const { addMessage, setProcessing, setStatus } = useChatStore()

  useEffect(() => {
    chat.messages.forEach(addMessage)
  }, [chat.messages, addMessage])

  useEffect(() => {
    setProcessing(status.isProcessing)
  }, [status.isProcessing, setProcessing])

  useEffect(() => {
    setStatus(status.agentStatus)
  }, [status.agentStatus, setStatus])

  return chat
}
```

---

## Custom Rendering Patterns

### Custom Message Renderer

```tsx
import { ChatPanel, MessageBubble } from '@ccaas/react-sdk'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

function CustomMessageBubble({ message }) {
  return (
    <div className={`message message-${message.role}`}>
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {message.content}
      </ReactMarkdown>

      {/* Render tool activities */}
      {message.contentBlocks?.filter((b) => b.type === 'tool').map((block) => (
        <div key={block.tool.toolId} className="tool-activity">
          {block.tool.toolName}: {block.tool.description}
        </div>
      ))}

      {/* Render output updates */}
      {message.outputUpdates?.map((update) => (
        <div key={update.field} className="output-update">
          Updated {update.field}: {update.preview}
        </div>
      ))}
    </div>
  )
}

// Usage
<ChatPanel
  {...chatProps}
  renderMessage={(message) => <CustomMessageBubble message={message} />}
/>
```

### Custom Input Component

```tsx
import { useState, useRef } from 'react'

interface CustomChatInputProps {
  onSend: (content: string, attachments?: File[]) => void
  disabled?: boolean
  placeholder?: string
}

export function CustomChatInput({
  onSend,
  disabled,
  placeholder,
}: CustomChatInputProps) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return

    onSend(input, attachments)
    setInput('')
    setAttachments([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments((prev) => [...prev, ...files])
  }

  return (
    <div className="custom-chat-input">
      {attachments.length > 0 && (
        <div className="attachments">
          {attachments.map((file, idx) => (
            <div key={idx} className="attachment-chip">
              {file.name}
              <button onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="input-row">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="attach-button"
        >
          📎
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />

        <button onClick={handleSend} disabled={disabled || (!input.trim() && attachments.length === 0)}>
          Send
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}
```

---

## Performance Optimization

### Memoized Message List

```tsx
import { memo, useMemo } from 'react'
import { MessageBubble } from '@ccaas/react-sdk'

const MemoizedMessageBubble = memo(MessageBubble, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.isStreaming === next.isStreaming
  )
})

export function OptimizedMessageList({ messages, currentStreamContent }) {
  const messageElements = useMemo(() => {
    return messages.map((msg, idx) => (
      <MemoizedMessageBubble
        key={msg.id}
        message={msg}
        isStreaming={msg.isStreaming}
        currentStreamContent={
          idx === messages.length - 1 ? currentStreamContent : undefined
        }
      />
    ))
  }, [messages, currentStreamContent])

  return <div className="message-list">{messageElements}</div>
}
```

### Virtualized Message List

For long message histories:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function VirtualizedMessageList({ messages }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  })

  return (
    <div ref={parentRef} className="message-list-container">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MessageBubble message={message} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### Debounced Output Sync

```tsx
import { useOutputSync } from '@ccaas/react-sdk'
import { useMemo } from 'react'
import debounce from 'lodash.debounce'

export function useDebouncedSync<T>(options) {
  const sync = useOutputSync<T>(options)

  const debouncedSync = useMemo(
    () =>
      debounce(
        (field: string, currentData: T, setData: React.Dispatch<React.SetStateAction<T>>) => {
          sync.syncToForm(field, currentData, setData)
        },
        500
      ),
    [sync]
  )

  return {
    ...sync,
    syncToForm: debouncedSync,
  }
}
```

---

## Testing Strategies

### Mocking SDK Hooks

```tsx
import { renderHook } from '@testing-library/react'
import { vi } from 'vitest'

// Mock useAgentConnection
vi.mock('@ccaas/react-sdk', () => ({
  useAgentConnection: vi.fn(() => ({
    socket: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
    connected: true,
    clientId: 'test-client-id',
    sessionId: 'test-session-id',
    serverUrl: 'http://localhost:3001',
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  useAgentChat: vi.fn(() => ({
    messages: [],
    isProcessing: false,
    currentStreamContent: '',
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    cancelProcessing: vi.fn(),
  })),
}))
```

### Integration Testing

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatPanel } from '@ccaas/react-sdk'
import { setupServer } from 'msw/node'
import { rest } from 'msw'

const server = setupServer(
  rest.post('/api/v1/sessions/:sessionId/completion', (req, res, ctx) => {
    return res(ctx.json({ success: true }))
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('sends message and displays response', async () => {
  const user = userEvent.setup()

  render(<ChatPanel {...mockProps} />)

  const input = screen.getByPlaceholderText('Type a message...')
  await user.type(input, 'Hello')
  await user.click(screen.getByRole('button', { name: /send/i }))

  await waitFor(() => {
    expect(screen.getByText(/Hello/)).toBeInTheDocument()
  })
})
```

---

## Related Documentation

- [API Reference](./API.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Performance Optimization](./PERFORMANCE.md)
