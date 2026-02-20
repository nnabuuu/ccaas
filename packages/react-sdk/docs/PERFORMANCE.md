# React SDK Performance Optimization Guide

Performance optimization strategies and best practices for `@kedge-agentic/react-sdk` based on real-world analysis and testing.

## Table of Contents

- [Overview](#overview)
- [Preventing Over-Rendering](#preventing-over-rendering)
- [Optimizing Tool Activity](#optimizing-tool-activity)
- [Message List Optimization](#message-list-optimization)
- [Streaming Performance](#streaming-performance)
- [Memory Management](#memory-management)
- [Bundle Size Optimization](#bundle-size-optimization)
- [Profiling and Monitoring](#profiling-and-monitoring)

---

## Overview

### Performance Goals

- **First Render**: < 100ms
- **Message Render**: < 16ms (60 FPS)
- **Streaming Updates**: < 8ms (120 FPS)
- **Memory Growth**: < 50MB per 100 messages
- **Bundle Size**: < 100KB (gzipped)

### Known Performance Issues

Based on codebase analysis, the SDK has these performance characteristics:

**Strengths:**
- Clean hook separation
- Efficient WebSocket event handling
- Minimal re-renders in connection hooks

**Areas for Improvement:**
- Missing React.memo on components
- O(n²) lookups in tool activity tracking
- 50-per-second polling intervals
- Large contentBlocks arrays without optimization

---

## Preventing Over-Rendering

### Problem: Components Re-render on Every State Change

**Issue:** Without memoization, child components re-render even when their props haven't changed.

**Example Problem:**
```tsx
// ❌ Every message re-renders when new message arrives
function MessageList({ messages }) {
  return (
    <div>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  )
}
```

**Solution 1: Memoize Components**

```tsx
import { memo } from 'react'
import { MessageBubble } from '@kedge-agentic/react-sdk'

// ✅ Only re-render if props actually changed
const MemoizedMessageBubble = memo(
  MessageBubble,
  (prevProps, nextProps) => {
    // Custom comparison for deep equality
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.isStreaming === nextProps.isStreaming &&
      prevProps.currentStreamContent === nextProps.currentStreamContent
    )
  }
)

function MessageList({ messages, currentStreamContent }) {
  return (
    <div>
      {messages.map((msg, idx) => (
        <MemoizedMessageBubble
          key={msg.id}
          message={msg}
          isStreaming={msg.isStreaming}
          currentStreamContent={
            idx === messages.length - 1 ? currentStreamContent : undefined
          }
        />
      ))}
    </div>
  )
}
```

**Solution 2: Memoize Expensive Computations**

```tsx
import { useMemo } from 'react'

function ChatPanel({ messages, activeTools }) {
  // ❌ Recalculates on every render
  const toolCount = Array.from(activeTools.values()).length

  // ✅ Only recalculates when activeTools changes
  const toolCount = useMemo(
    () => Array.from(activeTools.values()).length,
    [activeTools]
  )

  // ✅ Memoize filtered/sorted lists
  const visibleMessages = useMemo(
    () => messages.filter((msg) => !msg.hidden),
    [messages]
  )

  return (
    <div>
      <div>Active tools: {toolCount}</div>
      {visibleMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  )
}
```

**Solution 3: Stable Callback References**

```tsx
import { useCallback } from 'react'

function ChatInput({ onSend }) {
  // ❌ Creates new function on every render
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onSend(e.target.value)
    }
  }

  // ✅ Stable reference across renders
  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        onSend(e.target.value)
      }
    },
    [onSend]
  )

  return <input onKeyPress={handleKeyPress} />
}
```

**Measuring Impact:**

```tsx
import { useRef, useEffect } from 'react'

function useRenderCount(componentName: string) {
  const renderCount = useRef(0)

  useEffect(() => {
    renderCount.current += 1
    console.log(`${componentName} rendered ${renderCount.current} times`)
  })
}

// Usage
function MyComponent() {
  useRenderCount('MyComponent')
  // ...
}
```

---

## Optimizing Tool Activity

### Problem: O(n²) Tool Lookup

**Issue:** In `useAgentStatus`, updating tool activity involves linear search through contentBlocks array.

**Current Implementation:**
```typescript
// packages/react-sdk/src/hooks/useAgentChat.ts:229-236
if (payload.phase === 'end') {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    if (block && block.type === 'tool' && block.tool.toolId === toolActivity.toolId) {
      blocks[i] = { type: 'tool', tool: toolActivity }
      break
    }
  }
}
```

**Performance Impact:**
- With 100 tools: 100 iterations × 100 tools = 10,000 operations
- With 1000 tools: 1,000,000 operations

**Solution 1: Use Map for Fast Lookups**

```tsx
import { useState, useCallback, useMemo } from 'react'

function useOptimizedToolActivity() {
  const [activeTools, setActiveTools] = useState<Map<string, ToolActivity>>(new Map())

  // ✅ O(1) lookup instead of O(n)
  const updateTool = useCallback((toolId: string, tool: ToolActivity) => {
    setActiveTools((prev) => {
      const next = new Map(prev)
      next.set(toolId, tool)
      return next
    })
  }, [])

  const removeTool = useCallback((toolId: string) => {
    setActiveTools((prev) => {
      const next = new Map(prev)
      next.delete(toolId)
      return next
    })
  }, [])

  // Convert to array only when needed for rendering
  const toolsArray = useMemo(() => Array.from(activeTools.values()), [activeTools])

  return { activeTools, updateTool, removeTool, toolsArray }
}
```

**Solution 2: Index Content Blocks**

```tsx
interface IndexedContentBlocks {
  blocks: ContentBlock[]
  toolIndex: Map<string, number> // toolId -> block index
}

function useIndexedContentBlocks() {
  const [state, setState] = useState<IndexedContentBlocks>({
    blocks: [],
    toolIndex: new Map(),
  })

  const addToolBlock = useCallback((tool: ToolActivity) => {
    setState((prev) => {
      const blocks = [...prev.blocks, { type: 'tool', tool }]
      const toolIndex = new Map(prev.toolIndex)
      toolIndex.set(tool.toolId, blocks.length - 1)
      return { blocks, toolIndex }
    })
  }, [])

  const updateToolBlock = useCallback((toolId: string, tool: ToolActivity) => {
    setState((prev) => {
      const index = prev.toolIndex.get(toolId)
      if (index === undefined) return prev

      const blocks = [...prev.blocks]
      blocks[index] = { type: 'tool', tool }
      return { blocks, toolIndex: prev.toolIndex }
    })
  }, [])

  return { blocks: state.blocks, addToolBlock, updateToolBlock }
}
```

---

## Message List Optimization

### Problem: Re-rendering Entire List on Updates

**Solution: Virtualization for Long Lists**

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

function VirtualizedMessageList({ messages }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated message height
    overscan: 10, // Render 10 extra items above/below viewport
  })

  return (
    <div
      ref={parentRef}
      style={{
        height: '600px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index]

          return (
            <div
              key={message.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
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

**Benefits:**
- Renders only visible messages (typically 10-20 instead of 1000+)
- Smooth scrolling even with thousands of messages
- Reduced memory footprint

**When to use:**
- Message count > 100
- Messages contain rich content (images, code blocks)
- Users scroll through long histories

---

### Problem: Expensive Message Rendering

**Solution: Lazy Load Rich Content**

```tsx
import { useState, useEffect } from 'react'

function LazyMessageContent({ content }) {
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    // Defer expensive rendering
    const timer = setTimeout(() => setRendered(true), 16)
    return () => clearTimeout(timer)
  }, [])

  if (!rendered) {
    return <div className="message-placeholder">Loading...</div>
  }

  return (
    <div className="message-content">
      {/* Expensive markdown/syntax highlighting */}
      <MarkdownRenderer content={content} />
    </div>
  )
}
```

**Solution: Throttle Streaming Updates**

```tsx
import { useEffect, useRef, useState } from 'react'

function useThrottledStream(content: string, delay: number = 50) {
  const [throttled, setThrottled] = useState(content)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setThrottled(content)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [content, delay])

  return throttled
}

// Usage in streaming message
function StreamingMessage({ message, currentStreamContent }) {
  const throttledContent = useThrottledStream(
    message.isStreaming ? currentStreamContent : message.content,
    50 // Update at most every 50ms (20 FPS)
  )

  return <div>{throttledContent}</div>
}
```

---

## Streaming Performance

### Problem: High-Frequency Text Delta Events

**Issue:** `text_delta` events can fire very rapidly (100+ per second), causing excessive re-renders.

**Solution 1: Batch Updates**

```tsx
import { useState, useEffect, useRef } from 'react'

function useBatchedTextStream(socket) {
  const [content, setContent] = useState('')
  const bufferRef = useRef('')
  const flushTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!socket) return

    const handleTextDelta = (data: { text: string }) => {
      // Accumulate in buffer
      bufferRef.current += data.text

      // Debounce flush
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
      }

      flushTimeoutRef.current = setTimeout(() => {
        setContent((prev) => prev + bufferRef.current)
        bufferRef.current = ''
      }, 16) // Flush every ~60 FPS
    }

    socket.on('text_delta', handleTextDelta)

    return () => {
      socket.off('text_delta', handleTextDelta)
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
      }
    }
  }, [socket])

  return content
}
```

**Solution 2: RequestAnimationFrame for Smooth Updates**

```tsx
function useRAFTextStream(socket) {
  const [content, setContent] = useState('')
  const bufferRef = useRef('')
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!socket) return

    const flush = () => {
      if (bufferRef.current) {
        setContent((prev) => prev + bufferRef.current)
        bufferRef.current = ''
      }
      rafRef.current = requestAnimationFrame(flush)
    }

    rafRef.current = requestAnimationFrame(flush)

    const handleTextDelta = (data: { text: string }) => {
      bufferRef.current += data.text
    }

    socket.on('text_delta', handleTextDelta)

    return () => {
      socket.off('text_delta', handleTextDelta)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [socket])

  return content
}
```

---

## Memory Management

### Problem: Unbounded Message History Growth

**Solution: Implement Message Pagination**

```tsx
import { useState, useCallback } from 'react'

function usePagedMessages(initialMessages = []) {
  const [messages, setMessages] = useState(initialMessages)
  const MAX_MESSAGES = 100
  const [archivedCount, setArchivedCount] = useState(0)

  const addMessage = useCallback((message) => {
    setMessages((prev) => {
      const updated = [...prev, message]

      if (updated.length > MAX_MESSAGES) {
        // Archive old messages
        const archived = updated.slice(0, updated.length - MAX_MESSAGES)
        setArchivedCount((count) => count + archived.length)

        // Keep only recent messages
        return updated.slice(-MAX_MESSAGES)
      }

      return updated
    })
  }, [])

  const loadArchivedMessages = useCallback(async () => {
    // Load from server or IndexedDB
    const archived = await fetchArchivedMessages()
    setMessages((prev) => [...archived, ...prev])
  }, [])

  return {
    messages,
    addMessage,
    archivedCount,
    loadArchivedMessages,
  }
}
```

**Solution: Clear Old Content Blocks**

```tsx
function useEfficientContentBlocks() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([])

  const addBlock = useCallback((block: ContentBlock) => {
    setBlocks((prev) => {
      const updated = [...prev, block]

      // Limit tool blocks to last 50
      const toolBlocks = updated.filter((b) => b.type === 'tool')
      if (toolBlocks.length > 50) {
        const recentToolIds = new Set(
          toolBlocks.slice(-50).map((b) => b.tool.toolId)
        )

        return updated.filter(
          (b) => b.type !== 'tool' || recentToolIds.has(b.tool.toolId)
        )
      }

      return updated
    })
  }, [])

  return { blocks, addBlock }
}
```

---

## Bundle Size Optimization

### Current Size Analysis

```
@kedge-agentic/react-sdk: ~77KB ESM, ~80KB CJS
```

### Code Splitting

```tsx
// ✅ Lazy load heavy components
import { lazy, Suspense } from 'react'

const ChatPanel = lazy(() => import('@kedge-agentic/react-sdk').then(m => ({ default: m.ChatPanel })))

function App() {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      <ChatPanel {...props} />
    </Suspense>
  )
}
```

### Tree Shaking

```tsx
// ❌ Imports everything
import * as SDK from '@kedge-agentic/react-sdk'

// ✅ Import only what you need
import { useAgentConnection, useAgentChat } from '@kedge-agentic/react-sdk'
```

---

## Profiling and Monitoring

### React DevTools Profiler

```tsx
import { Profiler } from 'react'

function App() {
  const onRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    console.log(`${id} (${phase}) took ${actualDuration}ms`)

    // Send to analytics
    if (actualDuration > 16) {
      console.warn(`Slow render: ${id} took ${actualDuration}ms`)
    }
  }

  return (
    <Profiler id="ChatPanel" onRender={onRenderCallback}>
      <ChatPanel {...props} />
    </Profiler>
  )
}
```

### Performance Monitoring

```tsx
function usePerformanceMonitor(componentName: string) {
  useEffect(() => {
    const mark = `${componentName}-render-start`
    performance.mark(mark)

    return () => {
      const endMark = `${componentName}-render-end`
      performance.mark(endMark)
      performance.measure(componentName, mark, endMark)

      const measure = performance.getEntriesByName(componentName)[0]
      if (measure && measure.duration > 16) {
        console.warn(`${componentName} render took ${measure.duration}ms`)
      }

      performance.clearMarks(mark)
      performance.clearMarks(endMark)
      performance.clearMeasures(componentName)
    }
  })
}
```

---

## Performance Checklist

### Before Deploying

- [ ] All components memoized with React.memo where appropriate
- [ ] Expensive computations wrapped with useMemo
- [ ] Callbacks wrapped with useCallback
- [ ] Message list uses virtualization for > 100 messages
- [ ] Streaming updates throttled to reasonable FPS
- [ ] Memory limits enforced on message history
- [ ] Bundle size < 100KB (gzipped)
- [ ] No memory leaks (test with DevTools memory profiler)
- [ ] Profiler shows < 16ms render times

### During Development

- [ ] Use React DevTools Profiler to identify slow components
- [ ] Monitor Network tab for excessive requests
- [ ] Check Memory tab for memory leaks
- [ ] Test with 1000+ messages
- [ ] Test with slow 3G throttling
- [ ] Measure Core Web Vitals (LCP, FID, CLS)

---

## Related Documentation

- [API Reference](./API.md)
- [Advanced Patterns](./ADVANCED_PATTERNS.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
