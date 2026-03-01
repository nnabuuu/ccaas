# Chat Integration Deep Dive

`ChatPanel` covers most use cases out of the box — see [Frontend Integration](frontend.md) for the standard setup. This guide covers what to do when you need to go beyond the defaults.

## When to Use This

**Use `ChatPanel` as-is (don't read this guide)** when the default message rendering is fine for your solution. `ChatPanel` handles streaming, tool status, sub-agent tracking, and layout automatically.

**Read on when:**
- You need to render specific message types differently (e.g., show quiz results as a table, not a text bubble)
- A message contains both tool output and text that should display in different parts of the UI
- You want to build a fully custom chat UI without `ChatPanel` at all

---

## Transport: SSE (Default)

The SDK uses **SSE (Server-Sent Events) as the default transport**. SSE streams agent responses over a single HTTP connection — no WebSocket required.

SSE is the default — no extra configuration needed:

```tsx
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  sessionPrefix: 'demo'
  // transport: 'sse' is the default
})
```

---

## Custom Rendering with `renderMessage`

The easiest way to customize message display is the `renderMessage` prop. It lets you intercept individual messages and render them however you want, while `ChatPanel` still handles layout, input, and status.

```tsx
import { ChatPanel, MessageBubble } from '@kedge-agentic/react-sdk'

<ChatPanel
  messages={chat.messages}
  isProcessing={status.isProcessing}
  connected={connection.connected}
  onSendMessage={chat.sendMessage}
  renderMessage={(message) => {
    // Render quiz results as a structured card
    if (message.role === 'assistant' && isQuizResult(message)) {
      return <QuizResultCard key={message.id} result={parseQuizResult(message)} />
    }

    // Fall back to default rendering
    return <MessageBubble key={message.id} message={message} />
  }}
/>
```

This handles ~80% of customization needs. The `message` object has this shape:

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: ContentBlock[]    // Array of content blocks
  timestamp: string
}
```

---

## Handling Different Content Block Types

Each `Message` contains a `content: ContentBlock[]` array. Blocks can be text, tool use, tool results, or thinking blocks:

```typescript
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: 'thinking'; thinking: string }
```

Render based on block type:

```tsx
function MessageContent({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'text':
            return <p key={i}>{block.text}</p>
          case 'tool_use':
            return <ToolCallBadge key={i} name={block.name} />
          case 'thinking':
            return <ThinkingBlock key={i} content={block.thinking} />
          default:
            return null
        }
      })}
    </>
  )
}
```

---

## Splitting Messages with `useMessageSplitter`

Sometimes a single agent message contains both tool results and text content that belong in different parts of your UI — for example, structured data that should go into a form panel alongside explanatory text that stays in chat.

`useMessageSplitter` splits `ContentBlock[]` arrays into named segments based on delimiters you define:

```tsx
import { useMessageSplitter } from '@kedge-agentic/react-sdk'

function SplitMessageView({ message }) {
  const { segments } = useMessageSplitter({
    blocks: message.content,
    splitOn: 'tool_result',           // Split when a tool_result block appears
    segmentNames: ['intro', 'result', 'followup']
  })

  return (
    <div>
      {/* Text before the tool result */}
      <ChatBubble blocks={segments.intro} />

      {/* Tool result rendered as a structured card */}
      <ResultCard blocks={segments.result} />

      {/* Text after the tool result */}
      <ChatBubble blocks={segments.followup} />
    </div>
  )
}
```

Use `useMessageSplitter` when one message needs to feed multiple UI zones. If you just want to style tool calls differently, iterate over blocks directly instead.

---

## Streaming: Displaying In-Progress Responses

While the agent is responding, `useAgentChat` provides `currentStreamContent` — a string with the partial text received so far.

```tsx
const chat = useAgentChat({ connection, tenantId: 'default' })

// chat.currentStreamContent: string — empty when not streaming
// chat.messages: Message[] — only contains completed messages
```

Show a typing indicator and partial content:

```tsx
function ChatView() {
  const { messages, currentStreamContent } = chat
  const { isProcessing } = status

  return (
    <div>
      {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}

      {/* Live streaming text */}
      {currentStreamContent && (
        <div className="message assistant streaming">
          <p>{currentStreamContent}</p>
          <span className="cursor-blink" />
        </div>
      )}

      {/* Processing state without content yet */}
      {isProcessing && !currentStreamContent && (
        <div className="typing-indicator">
          <span /><span /><span />
        </div>
      )}
    </div>
  )
}
```

`currentStreamContent` resets to an empty string when the message completes and appears in `messages`.

---

## Building a Fully Custom Chat UI

If `ChatPanel` doesn't fit your layout at all, drop down to the raw hooks. This gives you complete control at the cost of wiring everything yourself.

```tsx
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus
} from '@kedge-agentic/react-sdk'

function CustomChatUI() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my-solution'
  })

  const chat = useAgentChat({ connection, tenantId: 'default' })
  const status = useAgentStatus({ connection })

  const [input, setInput] = useState('')

  const handleSend = () => {
    if (input.trim()) {
      chat.sendMessage(input)
      setInput('')
    }
  }

  return (
    <div className="custom-chat">
      {/* Your message list */}
      <div className="messages">
        {chat.messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content.map((block, i) =>
              block.type === 'text' ? <p key={i}>{block.text}</p> : null
            )}
          </div>
        ))}

        {chat.currentStreamContent && (
          <div className="message assistant">{chat.currentStreamContent}</div>
        )}
      </div>

      {/* Status bar */}
      {status.isProcessing && (
        <div className="status">
          {status.activeTools.map(tool => (
            <span key={tool.id}>Running {tool.name}...</span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={status.isProcessing}
        />
        <button onClick={handleSend} disabled={status.isProcessing || !connection.connected}>
          Send
        </button>
      </div>
    </div>
  )
}
```

**When is this worth it?** When your layout is genuinely incompatible with `ChatPanel` — e.g., a split-screen application where the chat occupies a narrow sidebar alongside a large canvas editor. For most solutions, `ChatPanel` + `renderMessage` is simpler and easier to maintain.
