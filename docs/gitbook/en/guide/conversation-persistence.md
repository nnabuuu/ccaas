# Conversation Persistence

This guide explains how CCAAS implements conversation persistence, enabling users to continue conversations across page refreshes.

## Overview

CCAAS uses a frontend-driven persistence model where the `conversationId` is stored in tenant-scoped `localStorage` and message history is automatically loaded from the backend on reconnection.

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
  +--> Connect WebSocket with conversationId
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

## Key Concepts

### Conversation vs RuntimeSession

| Concept | Scope | Lifetime | ID Format |
|---------|-------|----------|-----------|
| **Conversation** | User-facing, persistent | Until user creates new conversation | `conv_{uuid}` |
| **RuntimeSession** | Backend process | 30-min idle TTL, then recycled | Internal |

A single conversation can span multiple runtime sessions. When a runtime session expires due to inactivity, the next message in the same conversation triggers a new runtime session, but the conversation (and its message history) persists.

### Tenant Isolation

Each `tenantId` gets its own localStorage key and conversation scope:

```
localStorage:
  ccaas_session_default                -> conv_abc123    (ccaas-demo)
  ccaas_session_lesson-plan-designer   -> conv_def456    (lesson-plan-designer)
```

Different Solutions running on the same origin do not share conversations.

## Frontend Integration Guide

### Step 1: Enable Persistence

Replace `sessionPrefix` with `tenantId` in `useAgentConnection`:

```typescript
// Before (ephemeral sessions)
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  sessionPrefix: 'my-app',
})

// After (persistent conversations)
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  tenantId: 'my-app',
})
```

### Step 2: Show Loading State

`useAgentChat` returns `isLoadingHistory` while fetching message history:

```typescript
const chat = useAgentChat({ connection, tenantId: 'my-app' })

if (chat.isLoadingHistory) {
  return <LoadingSpinner text="Loading conversation..." />
}
```

### Step 3: Add "New Conversation" Button

Use `clearConversation()` to start fresh:

```typescript
<button onClick={() => chat.clearConversation()}>
  New Conversation
</button>
```

`clearConversation()` does three things:
1. Clears local message state
2. Removes the conversationId from localStorage
3. Generates a new `conv_{uuid}`, disconnects, and reconnects

### Step 4: Force New Conversation on Mount (Optional)

If your Solution should always start fresh (e.g., a one-time wizard):

```typescript
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  tenantId: 'my-wizard',
  forceNewConversation: true,
})
```

## Backend APIs

### Message History

```
GET /api/v1/sessions/{conversationId}/messages?limit=100
```

**Authentication**: Optional (`@OptionalAuth`) — API Key is validated if provided, anonymous access is allowed if not. The SDK does not send an API Key for this endpoint, so no changes are needed in your frontend code.

Returns messages in chronological order. The `limit` parameter caps the number of messages returned (default: 100).

### Conversation Metadata

```
GET /api/v1/admin/sessions/{conversationId}
```

Returns session metadata including `messageCount`, `totalTokens`, `estimatedCost`, `createdAt`, `lastActivity`.

## localStorage Format

**Key**: `ccaas_session_{tenantId}`
**Value**: `conv_{uuid}` (plain string, not JSON)

The SDK uses safe localStorage wrappers that gracefully handle:
- localStorage disabled (private browsing)
- Storage quota exceeded
- Permission errors

Only the conversationId is stored in localStorage, never message content. This minimizes XSS exposure risk.

## Migration from Old SDK Usage

### Before (v1.x pattern)

```typescript
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  sessionPrefix: 'my-app',
})

const chat = useAgentChat({ connection, tenantId: 'my-app' })

// Manual restart
const restart = () => {
  chat.clearMessages()
}
```

### After (v2.x pattern with persistence)

```typescript
const connection = useAgentConnection({
  serverUrl: BACKEND_URL,
  tenantId: 'my-app',  // Changed from sessionPrefix
})

const chat = useAgentChat({ connection, tenantId: 'my-app' })

// Proper new conversation (clears storage + reconnects)
const newConversation = () => {
  chat.clearConversation()
}
```

**Key differences**:
- `sessionPrefix` replaced by `tenantId` (opt-in persistence)
- `clearMessages()` still exists for clearing UI only (keeps same conversation)
- `clearConversation()` is the new method for starting a fresh conversation
- `isLoadingHistory` is a new state for showing loading indicators
- `connection.startNewConversation()` is available for lower-level control

## Listing Conversations by Template

For Solutions with multiple roles or templates (e.g., a "farmer advisor" and a "bank assessor"), use the `templateName` query parameter on the conversations API to filter by template:

```
GET /api/v1/conversations?templateName=farmer-advisor&limit=50
```

This returns only conversations that were created under the `farmer-advisor` session template. The `templateName` is automatically persisted when the first message is processed.

See [REST API — Conversation Management](../api/rest.md#conversation-management-conversationscontroller) for full endpoint documentation.

## Troubleshooting

### Messages don't persist after refresh

1. Verify `tenantId` is provided to `useAgentConnection` (not `sessionPrefix`)
2. Check localStorage in browser DevTools: look for `ccaas_session_{tenantId}`
3. Verify the backend returns messages from `GET /api/v1/sessions/{id}/messages`

### Loading takes too long

The message history endpoint has a default limit of 100 messages. For long conversations, older messages are truncated. This is by design to prevent performance issues.

### Conversations leak between Solutions

Ensure each Solution uses a unique `tenantId`. Two Solutions with the same `tenantId` on the same origin will share a conversation.

### localStorage not available

The SDK gracefully falls back to ephemeral sessions when localStorage is unavailable (private browsing, permissions blocked). No error is thrown.
