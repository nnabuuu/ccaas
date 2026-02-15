# ADR-0009: Conversation Persistence Architecture

**Status**: Accepted
**Date**: 2026-02-15
**Decision By**: @niex
**Related Issue**: Conversation Persistence Phase 1

---

## Background (Context)

CCAAS originally treated sessions as ephemeral runtime processes. Each page load generated a new `sessionId`, and no message history was preserved across browser refreshes. This created a poor user experience compared to modern AI chat applications (ChatGPT, Claude.ai) where users expect:

- Conversations survive page refreshes
- Message history is visible when returning to a conversation
- Users can explicitly start a "new conversation"

The key challenge was that CCAAS already had a `Session` entity tied to the runtime process lifecycle (AgentEngine process with 30-min idle TTL). We needed to introduce conversation persistence without conflicting with the existing runtime session semantics.

---

## Decision

**We decided**: Adopt a "Conversation-first" design where the user-facing `conversationId` is the primary identifier, persisted in tenant-scoped localStorage, with automatic message history recovery on reconnection.

**Key design choices**:

1. **ConversationId format**: `conv_${uuid}` when `tenantId` is provided; falls back to `${sessionPrefix}_${uuid}` for backward compatibility
2. **Storage**: Tenant-scoped localStorage key `ccaas_session_${tenantId}` persists the conversationId across page refreshes
3. **History loading**: `useAgentChat` automatically fetches message history via `GET /api/v1/sessions/:id/messages?limit=100` on connection
4. **New conversation**: `clearConversation()` clears localStorage, generates a new `conv_${uuid}`, disconnects and reconnects with fresh state
5. **Backward compatibility**: When no `tenantId` is provided, the SDK behaves exactly as before (no persistence)

---

## Alternatives Considered

### Option A: Pure Session-Based (Status Quo)

**Description**: Keep sessions ephemeral, no persistence.

**Pros**:
- No changes needed
- Simple mental model

**Cons**:
- Poor UX - conversation lost on every refresh
- No conversation history
- Does not match user expectations from modern AI chat apps

**Why not chosen**: Unacceptable UX for production use.

---

### Option B: Separate Conversation Entity

**Description**: Create a dedicated `Conversation` entity distinct from `Session`.

**Pros**:
- Clean separation of concerns
- Conversation can span multiple sessions
- Supports conversation title, pinning, archiving

**Cons**:
- Significant backend refactoring
- Complex migration path
- Two IDs to manage (conversationId + sessionId)

**Why not chosen**: Over-engineered for Phase 1. The existing Session entity can carry conversation metadata with minimal changes.

---

### Option C: Reuse Session with Tenant-Scoped Persistence (Chosen)

**Description**: Add `tenantId` to `useAgentConnection`, persist sessionId in localStorage, auto-load message history.

**Pros**:
- Minimal backend changes (add columns to existing Session entity)
- Frontend-driven - SDK handles persistence transparently
- Backward compatible - opt-in via `tenantId`
- Works immediately with existing backend APIs

**Cons**:
- Session entity carries both runtime and conversation semantics
- localStorage has XSS exposure risk (mitigated by storing only the ID, not messages)

**Why chosen**: Best balance of UX improvement, implementation effort, and backward compatibility.

---

## Consequences

### Positive
- Users can refresh the page and continue their conversation
- Message history is automatically loaded on reconnection
- Solutions opt-in with a single `tenantId` parameter
- Zero breaking changes for existing solutions that don't use `tenantId`

### Negative
- Session entity now carries dual semantics (runtime process + conversation)
- localStorage dependency means conversations are device/browser-specific

### Important Notes
- The `conv_${uuid}` format clearly distinguishes persistent conversations from legacy sessions
- RuntimeSession TTL (30 min idle) is independent of conversation persistence; a conversation can span multiple runtime sessions
- Message history limit of 100 prevents performance issues on long conversations
- Future phases can add conversation listing, search, and cross-device sync via backend APIs

---

## Implementation Guide

**Frontend integration (2 lines of change)**:

```typescript
// Before (ephemeral)
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  sessionPrefix: 'my-app',
})

// After (persistent)
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  tenantId: 'my-app',
})
```

**New conversation button**:
```typescript
const chat = useAgentChat({ connection, tenantId: 'my-app' })

// Start fresh conversation (clears storage, new sessionId, reconnects)
chat.clearConversation()
```

**Loading state**:
```typescript
// Show spinner while loading history
if (chat.isLoadingHistory) {
  return <Spinner />
}
```

**Checklist**:
- [ ] Replace `sessionPrefix` with `tenantId` in `useAgentConnection`
- [ ] Add "New Conversation" button calling `chat.clearConversation()`
- [ ] Show loading state while `chat.isLoadingHistory` is true
- [ ] Test: refresh page, verify messages persist
- [ ] Test: click "New Conversation", verify clean slate

---

## References

- `packages/react-sdk/src/hooks/useAgentConnection.ts` - Tenant-scoped localStorage persistence
- `packages/react-sdk/src/hooks/useAgentChat.ts` - Message history auto-loading, clearConversation
- `solutions/ccaas-demo/src/hooks/useDemoSession.ts` - Reference integration (ccaas-demo)
- `solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts` - Reference integration (lesson-plan-designer)

---

## Update History

- **2026-02-15**: Initial version - Phase 1 conversation persistence
