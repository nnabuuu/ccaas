# Core Concepts

Understanding these concepts will help you build solutions with KedgeAgentic.

## Conversation vs Session

**User-facing**: "Conversation"
**Technical**: "Session" (database entity)

**They're the same thing** - just different perspectives.

- When talking to users: "Start a new conversation"
- In your code: `Session` interface, `sessionId` field
- In documentation: Both terms are used interchangeably

The platform uses "Session" as the technical entity name because it represents an active or historical dialogue session between a user and the AI agent.

## Session Persistence

Sessions (conversations) are persisted using:

- **Browser**: localStorage stores sessionId under `ccaas_session_{tenantId}`
- **Backend**: Database stores all messages, turns, and metadata

When user refreshes the page:

1. SDK checks localStorage for `ccaas_session_{tenantId}`
2. If found, fetches message history from `/api/v1/sessions/{sessionId}/messages`
3. Conversation continues seamlessly

**sessionId Format**: When using `tenantId` for persistence, sessionId follows the format `conv_{uuid}`. For example: `conv_a1b2c3d4-e5f6-7890-abcd-ef1234567890`.

## Messages and Turns

### Message

A **Message** represents a single utterance from user or assistant.

- Has `messageIndex` (0, 1, 2, ...) for ordering
- Has `role` ("user" or "assistant")
- Has `content` (text)
- Has optional `metadata` (model, tokens, stopReason)

**Why messageIndex?**
Use `messageIndex` for sorting messages, not `createdAt`. The `messageIndex` is a 0-based sequential number that guarantees message order, even if `createdAt` timestamps are identical.

**Example**:
```typescript
const message: Message = {
  id: "msg_123",
  sessionId: "conv_abc",
  role: "assistant",
  content: "Hello!",
  messageIndex: 1,
  metadata: {
    model: "claude-opus-4.5",
    totalTokens: 150,
    stopReason: "end_turn"
  },
  createdAt: "2026-02-15T10:00:00Z"
}
```

### Turn

A **Turn** represents one complete exchange in a conversation.

- User message (even index) + Assistant response (odd index)
- Example: Turn 0 = Message[0] (user) + Message[1] (assistant)
- Used for analytics: tokens per turn, cost per turn

**Why Turns?**
Turns enable per-exchange analytics and cost tracking. Instead of aggregating tokens across the entire session, you can analyze performance and cost for each individual Q&A pair.

**Example**:
```typescript
const turn: Turn = {
  id: "turn_123",
  sessionId: "conv_abc",
  turnNumber: 0,
  userMessageId: "msg_0",
  assistantMessageId: "msg_1",
  totalTokens: 250,
  durationMs: 1500,
  createdAt: "2026-02-15T10:00:00Z",
  completedAt: "2026-02-15T10:00:01.5Z"
}
```

## ConversationContext

**ConversationContext** captures "reproducibility metadata" at session start.

Purpose: Recreate exact same conversation conditions later for debugging.

Captured metadata:
- System prompt hash
- Skill configurations
- MCP tools list
- Model version
- Workspace directory

**Example**:
```typescript
const context: ConversationContext = {
  id: "ctx_123",
  sessionId: "conv_abc",
  tenantId: "my-app",
  systemPromptHash: "sha256:abc123...",
  skillConfigHashes: [
    { slug: "code-reviewer", hash: "sha256:def456..." }
  ],
  mcpToolsList: ["read_file", "grep", "bash"],
  model: "claude-opus-4.5",
  createdAt: "2026-02-15T10:00:00Z"
}
```

## Session States

| Status | Meaning |
|--------|---------|
| `idle` | No active processing |
| `processing` | Agent is thinking/running |
| `error` | Processing failed |
| `completed` | Session successfully completed |
| `cancelling` | User requested cancellation |

**Note**: A session with status `completed` doesn't mean it's permanently closed. Users can still send new messages to continue the conversation.

## Message Branching (Future)

The `Message` interface includes fields for conversation branching:

- `parentMessageId`: Links to the message this branches from
- `branchId`: Groups messages in the same branch

**Current Status**: Not yet implemented in the platform, but the schema supports it for future features like exploring alternative responses.

## Best Practices

### Sorting Messages

Always sort messages by `messageIndex`:

```typescript
// ✅ Correct
const sortedMessages = messages.sort((a, b) => a.messageIndex - b.messageIndex)

// ❌ Avoid
const sortedMessages = messages.sort((a, b) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
)
```

### Session Lifecycle

1. **Create Session**: User opens app, SDK creates or recovers session
2. **Load History**: Fetch messages from backend if sessionId exists
3. **User Interaction**: User sends messages, agent responds
4. **Persistence**: SDK saves sessionId to localStorage on each message
5. **Refresh/Reconnect**: User refreshes page, SDK recovers session

### Cost Tracking

Use `Turn` entities for per-exchange cost tracking:

```typescript
// Get cost per turn
const costPerTurn = turns.map(turn => ({
  turnNumber: turn.turnNumber,
  tokens: turn.totalTokens,
  estimatedCost: turn.totalTokens * COST_PER_TOKEN
}))

// Total session cost
const totalCost = turns.reduce((sum, turn) =>
  sum + (turn.totalTokens * COST_PER_TOKEN), 0
)
```

## Related Documentation

- [Conversation Persistence Guide](./conversation-persistence.md) - Detailed implementation guide
- [React SDK README](../../packages/react-sdk/README.md) - React integration examples
- [Vue SDK README](../../packages/vue-sdk/README.md) - Vue integration examples
- [API Reference](../api/README.md) - REST API documentation
