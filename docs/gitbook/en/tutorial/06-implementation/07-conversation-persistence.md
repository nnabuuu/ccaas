# 6.7 Conversation Persistence

## What You Will Build

In this section, you will add conversation persistence to the Lesson Plan Designer Solution. After this, users can refresh the page or close the browser and return to find their previous conversation intact.

By the end of this section, you will have:

- Persistent conversations stored in the CCAAS backend database
- Automatic message history loading on page refresh
- A "New Conversation" button for starting fresh
- Tenant-scoped isolation so conversations do not leak between Solutions

## Understanding the Persistence Model

CCAAS uses a **frontend-driven persistence model**. The key insight is that only the `conversationId` is stored in the browser -- all message content lives in the backend database.

```
Page Load
  |
  v
useAgentConnection({ tenantId })
  |
  +--> Check localStorage for ccaas_session_{tenantId}
  |      |
  |      +--> Found: Use saved conversationId
  |      +--> Not found: Generate conv_{uuid}, save to localStorage
  |
  +--> Connect via SSE with conversationId
  |
  v
useAgentChat({ connection, tenantId })
  |
  +--> GET /api/v1/sessions/{conversationId}/messages?limit=100
  |
  +--> Populate messages[] state
  |
  v
User sees previous conversation
```

### Conversation vs RuntimeSession

These two concepts are distinct:

| Concept | Scope | Lifetime | ID Format |
|---------|-------|----------|-----------|
| **Conversation** | User-facing, persistent | Until user creates a new one | `conv_{uuid}` |
| **RuntimeSession** | Backend AgentEngine process | 30-min idle TTL | Internal |

A single conversation can span multiple runtime sessions. When a runtime session expires due to inactivity, the next message in the same conversation creates a new runtime session, but the conversation and its message history persist.

### Tenant Isolation

Each `tenantId` gets its own localStorage key:

```
localStorage:
  ccaas_session_lesson-plan-designer  -> conv_a1b2c3d4...
  ccaas_session_lesson-plan-designer   -> conv_e5f6g7h8...
```

Two Solutions running on the same origin with different `tenantId` values do not share conversations.

## Step 1: Enable Persistence in useAgentConnection

Open your main session hook (or the component where you initialize the connection) and replace `sessionPrefix` with `tenantId`:

```typescript
// src/hooks/useLessonPlanSession.ts

import {
  useAgentConnection,
  useAgentChat,
} from '@kedge-agentic/react-sdk'

const SOCKET_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'

export function useLessonPlanSession() {
  // Enable persistence by providing tenantId
  const connection = useAgentConnection({
    serverUrl: SOCKET_URL,
    tenantId: 'lesson-plan-designer',  // ← This enables persistence
    autoConnect: true,
  })

  const chat = useAgentChat({
    connection,
    tenantId: 'lesson-plan-designer',
  })

  return { connection, chat }
}
```

When `tenantId` is provided:
1. The SDK generates a `conv_{uuid}` session ID (instead of a random prefix-based ID)
2. The session ID is saved to `localStorage` under the key `ccaas_session_lesson-plan-designer`
3. On the next page load, the SDK reads this key and reconnects with the same `conversationId`
4. `useAgentChat` automatically fetches message history from the backend

{% hint style="info" %}
If you omit `tenantId` and use `sessionPrefix` instead, conversations are ephemeral -- they are lost on page refresh. This is fine for prototyping but not for production.
{% endhint %}

## Step 2: Handle the Loading State

While message history is being fetched, the `isLoadingHistory` flag is `true`. Show a loading indicator during this time:

```typescript
// src/components/ChatPanel.tsx

export function ChatPanel() {
  const { chat } = useLessonPlanSession()

  if (chat.isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading conversation...</p>
      </div>
    )
  }

  return (
    <div>
      {chat.messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  )
}
```

The loading state is brief -- the backend returns the last 100 messages in a single request. Once loaded, the messages appear instantly.

## Step 3: Add a "New Conversation" Button

Users need a way to start fresh. The `clearConversation()` function handles this:

```typescript
<button
  onClick={() => chat.clearConversation()}
  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
>
  New Conversation
</button>
```

`clearConversation()` performs three actions:
1. Clears the local messages array
2. Removes the `conversationId` from localStorage
3. Generates a new `conv_{uuid}`, disconnects, and reconnects with it

After calling `clearConversation()`, the chat panel is empty and ready for a new conversation. The old conversation is still stored in the database and can be accessed through the admin API.

### clearConversation vs clearMessages

| Method | Clears UI | Clears Storage | Reconnects | Use Case |
|--------|-----------|----------------|------------|----------|
| `clearMessages()` | Yes | No | No | Clear the display only; same conversation continues |
| `clearConversation()` | Yes | Yes | Yes | Start a completely new conversation |

## Step 4: Integrate with Your Solution Logic

In the Lesson Plan Designer, you likely want to clear the conversation when the user creates a new task project or switches contexts. Here is how the lesson-plan-designer Solution handles this pattern:

```typescript
// When the user creates a new project, start a fresh conversation
const createNewProject = useCallback(async (input: CreateProjectInput) => {
  const project = await api.createProject(input)

  // Clear form state
  resetFormState()

  // Start a new conversation for this project
  chat.clearConversation()

  return project
}, [api, resetFormState, chat])
```

This ensures that the AI Agent does not carry over context from a previous project into the new one.

## Step 5: Force New Conversation on Mount (Optional)

If your Solution should always start with a fresh conversation (for example, a one-time setup wizard), use `forceNewConversation`:

```typescript
const connection = useAgentConnection({
  serverUrl: SOCKET_URL,
  tenantId: 'lesson-plan-wizard',
  forceNewConversation: true,  // Always start fresh
})
```

This clears any saved `conversationId` on mount and generates a new one. Use this sparingly -- most Solutions benefit from persistence.

## How It Works Under the Hood

### Message Storage

When you send a message, the backend stores it in the `messages` table:

```
messages table:
  id          | sessionId         | role      | content              | messageIndex
  msg_001     | conv_a1b2c3d4...  | user      | "Create a task..."   | 0
  msg_002     | conv_a1b2c3d4...  | assistant | "I'll create..."     | 1
  msg_003     | conv_a1b2c3d4...  | user      | "Set priority high"  | 2
  msg_004     | conv_a1b2c3d4...  | assistant | "Done, priority..."  | 3
```

Messages are indexed by `sessionId` and `messageIndex` for fast retrieval.

### Session Recovery Flow

When the user refreshes the page:

1. `useAgentConnection` reads `ccaas_session_lesson-plan-designer` from localStorage
2. Gets `conv_a1b2c3d4...` as the conversationId
3. Establishes an SSE connection with this conversationId
4. `useAgentChat` calls `GET /api/v1/sessions/conv_a1b2c3d4.../messages?limit=100`
5. The backend returns messages in chronological order
6. Messages are populated into the `messages[]` state
7. The user sees their previous conversation

### RuntimeSession Expiry

If the user returns after 30 minutes of inactivity:

1. The old RuntimeSession has been recycled (the AgentEngine process was stopped)
2. The conversationId (`conv_a1b2c3d4...`) is still in localStorage
3. The SDK reconnects with the same conversationId
4. Message history loads from the database
5. When the user sends a new message, the backend spawns a fresh AgentEngine process
6. The AgentEngine uses `--resume` to pick up the conversation context

The user does not notice any difference -- they see their message history and can continue the conversation seamlessly.

### localStorage Security

Only the `conversationId` string is stored in localStorage, never message content. This minimizes risk from XSS attacks. The SDK uses safe wrappers that handle:

- localStorage disabled (private browsing) -- falls back to ephemeral sessions
- Storage quota exceeded -- graceful degradation
- Permission errors -- no exceptions thrown

## Backend APIs for Conversation Management

The CCAAS backend provides APIs for managing conversations programmatically:

```
GET    /api/v1/conversations              # List conversations (paginated)
GET    /api/v1/conversations/search       # Search by title
PATCH  /api/v1/conversations/:id          # Update title or pin status
DELETE /api/v1/conversations/:id          # Soft delete
GET    /api/v1/conversations/:id/turns    # Per-turn analytics
```

These are admin-level APIs useful for building a conversation list UI or analytics dashboard.

## Checkpoint

Before moving to the next section, verify:

- [ ] Sending a message, then refreshing the page shows the previous conversation
- [ ] The `isLoadingHistory` flag is `true` during message loading and `false` after
- [ ] Clicking "New Conversation" clears the chat and starts fresh
- [ ] The new conversation gets a different `conv_{uuid}` (check localStorage)
- [ ] Two Solutions with different `tenantId` values do not share conversations

## Common Mistakes

### 1. Using sessionPrefix instead of tenantId

```typescript
// Wrong: no persistence
const connection = useAgentConnection({
  serverUrl: SOCKET_URL,
  sessionPrefix: 'lesson-plan',
})

// Correct: persistence enabled
const connection = useAgentConnection({
  serverUrl: SOCKET_URL,
  tenantId: 'lesson-plan-designer',
})
```

### 2. Forgetting isLoadingHistory

If you do not handle the loading state, users see an empty chat panel for a brief moment before messages appear. Always show a loading indicator.

### 3. Using clearMessages instead of clearConversation

`clearMessages()` only clears the UI. The next page refresh will reload the same conversation. Use `clearConversation()` when you want to start a genuinely new conversation.

### 4. Same tenantId across different Solutions

If two Solutions use `tenantId: 'default'`, they will share the same conversation. Always use a unique, descriptive `tenantId` for each Solution.

## Summary

In this section you added:

- Conversation persistence using `tenantId` in `useAgentConnection`
- Automatic message history loading via `useAgentChat`
- A loading state with `isLoadingHistory`
- A "New Conversation" button using `clearConversation()`
- Understanding of the Conversation vs RuntimeSession distinction

Conversation persistence is what makes a CCAAS Solution feel like a real application rather than a disposable chat window. Users can leave, return, and pick up exactly where they left off.

---

**Next:** [7. Deployment](../07-deployment.md)
**Previous:** [6.6 Testing](06-testing.md)
