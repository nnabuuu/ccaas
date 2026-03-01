# 聊天集成深度指南

`ChatPanel` 开箱即用地覆盖大多数场景——标准设置请参见[前端集成](frontend.md)。本指南介绍当你需要超出默认行为时该怎么做。

## 使用时机

**直接使用 `ChatPanel`（无需阅读本指南）** 当默认消息渲染对你的 solution 来说已经足够时。`ChatPanel` 自动处理流式输出、工具状态、子 agent 跟踪和布局。

**阅读本指南当：**
- 你需要以不同方式渲染特定消息类型（例如，将测验结果显示为表格而非文字气泡）
- 一条消息同时包含工具输出和文本，需要在 UI 的不同位置展示
- 你想完全不用 `ChatPanel`，从头构建自定义聊天 UI

---

## 传输层：SSE（默认）

SDK 使用 **SSE（Server-Sent Events）作为默认传输层**。SSE 通过单个 HTTP 连接流式传输 agent 回复——无需 WebSocket。

SSE 是默认值——无需额外配置：

```tsx
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  sessionPrefix: 'demo'
  // transport: 'sse' 是默认值
})
```

---

## 用 `renderMessage` 自定义渲染

自定义消息展示最简单的方式是 `renderMessage` prop。它让你拦截单条消息并按需渲染，同时 `ChatPanel` 仍然处理布局、输入框和状态。

```tsx
import { ChatPanel, MessageBubble } from '@kedge-agentic/react-sdk'

<ChatPanel
  messages={chat.messages}
  isProcessing={status.isProcessing}
  connected={connection.connected}
  onSendMessage={chat.sendMessage}
  renderMessage={(message) => {
    // 将测验结果渲染为结构化卡片
    if (message.role === 'assistant' && isQuizResult(message)) {
      return <QuizResultCard key={message.id} result={parseQuizResult(message)} />
    }

    // 回退到默认渲染
    return <MessageBubble key={message.id} message={message} />
  }}
/>
```

这处理了约 80% 的自定义需求。`message` 对象的结构如下：

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: ContentBlock[]    // 内容块数组
  timestamp: string
}
```

---

## 处理不同的内容块类型

每条 `Message` 包含一个 `content: ContentBlock[]` 数组。块的类型可以是文本、工具调用、工具结果或思考块：

```typescript
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: 'thinking'; thinking: string }
```

根据块类型渲染：

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

## 用 `useMessageSplitter` 做内容分段

有时一条 agent 消息同时包含工具结果和文本内容，需要在 UI 的不同区域展示——例如，结构化数据应该进入表单面板，而解释性文字留在聊天中。

`useMessageSplitter` 根据你定义的分隔符，将 `ContentBlock[]` 数组分割为命名片段：

```tsx
import { useMessageSplitter } from '@kedge-agentic/react-sdk'

function SplitMessageView({ message }) {
  const { segments } = useMessageSplitter({
    blocks: message.content,
    splitOn: 'tool_result',           // 遇到 tool_result 块时分割
    segmentNames: ['intro', 'result', 'followup']
  })

  return (
    <div>
      {/* 工具结果之前的文字 */}
      <ChatBubble blocks={segments.intro} />

      {/* 工具结果渲染为结构化卡片 */}
      <ResultCard blocks={segments.result} />

      {/* 工具结果之后的文字 */}
      <ChatBubble blocks={segments.followup} />
    </div>
  )
}
```

当一条消息需要向多个 UI 区域提供内容时使用 `useMessageSplitter`。如果只是想对工具调用进行不同的样式处理，直接遍历块即可。

---

## 流式渲染：显示进行中的回复

当 agent 正在回复时，`useAgentChat` 提供 `currentStreamContent`——一个包含目前已接收到的部分文本的字符串。

```tsx
const chat = useAgentChat({ connection, tenantId: 'default' })

// chat.currentStreamContent: string — 不在流式传输时为空字符串
// chat.messages: Message[] — 只包含已完成的消息
```

显示打字指示器和部分内容：

```tsx
function ChatView() {
  const { messages, currentStreamContent } = chat
  const { isProcessing } = status

  return (
    <div>
      {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}

      {/* 实时流式文字 */}
      {currentStreamContent && (
        <div className="message assistant streaming">
          <p>{currentStreamContent}</p>
          <span className="cursor-blink" />
        </div>
      )}

      {/* 还没有内容时的处理中状态 */}
      {isProcessing && !currentStreamContent && (
        <div className="typing-indicator">
          <span /><span /><span />
        </div>
      )}
    </div>
  )
}
```

当消息完成并出现在 `messages` 中后，`currentStreamContent` 重置为空字符串。

---

## 完全自定义聊天 UI

如果 `ChatPanel` 完全不适合你的布局，可以下沉到原始 hooks。这给你完全的控制权，代价是需要自己连接所有东西。

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
      {/* 消息列表 */}
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

      {/* 状态栏 */}
      {status.isProcessing && (
        <div className="status">
          {status.activeTools.map(tool => (
            <span key={tool.id}>正在运行 {tool.name}...</span>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div className="input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={status.isProcessing}
        />
        <button onClick={handleSend} disabled={status.isProcessing || !connection.connected}>
          发送
        </button>
      </div>
    </div>
  )
}
```

**什么时候值得这样做？** 当你的布局与 `ChatPanel` 真的不兼容——例如聊天占据窄侧边栏、旁边是大型画布编辑器的分屏应用。对于大多数 solution，`ChatPanel` + `renderMessage` 更简单，也更易维护。
