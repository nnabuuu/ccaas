# Linear Backlog: Conversation Persistence Enhancements

**Date**: 2026-02-15
**Status**: Ready for Linear Issue Creation

This document contains the remaining conversation persistence features that should be tracked in Linear for future iterations. Copy each section to create a new Linear issue.

---

## High Priority Issues

### Issue 1: Add E2E Tests for Conversation Persistence

**Title**: Add E2E Tests for Conversation Persistence Flow

**Priority**: High

**Labels**: testing, conversation-persistence, e2e

**Estimate**: 1 day

**Description**:
Create end-to-end tests that verify the complete conversation persistence user journey works correctly.

**Acceptance Criteria**:
- [ ] Test: User sends message → refresh page → messages reload from DB
- [ ] Test: User clicks "Clear Conversation" → new conv_${uuid} generated
- [ ] Test: RuntimeSession expires (30 min) → messages load → can continue
- [ ] Test: Workspace expires → messages load → read-only mode
- [ ] Test: Multi-tenant isolation (Tenant A can't see Tenant B conversations)
- [ ] Test: Turn tracking records token usage and duration correctly
- [ ] All tests run in CI/CD pipeline

**Technical Notes**:
- Use Playwright or Cypress for E2E testing
- Mock backend with test data
- Test files: `packages/react-sdk/e2e/conversation-persistence.spec.ts`
- Cover both happy path and error scenarios

**Related**:
- Conversation Persistence Implementation Status: `docs/CONVERSATION_PERSISTENCE_IMPLEMENTATION_STATUS.md`
- Conversation Persistence Guide: `docs/CONVERSATION_PERSISTENCE.md`

---

## Medium Priority Issues

### Issue 2: Message History Pagination

**Title**: Add Pagination to Message History Loading

**Priority**: Medium

**Labels**: frontend, conversation-persistence, enhancement

**Estimate**: 2 days

**Description**:
Currently, message history loads the last 100 messages on page refresh. For conversations with 1000+ messages, this can be slow and wasteful. Add pagination to load older messages on-demand.

**Acceptance Criteria**:
- [ ] Frontend: "Load More" button at top of message list
- [ ] Frontend: Virtual scrolling for large conversations (>500 messages)
- [ ] Backend: Add `offset` query param to `GET /api/v1/sessions/:id/messages`
- [ ] Backend: Return `hasMore` flag in response
- [ ] UX: Show loading spinner while fetching older messages
- [ ] UX: Scroll position preserved after loading more
- [ ] Tests: Unit + integration tests for pagination logic

**Technical Notes**:
- Update `useAgentChat` hook with `loadMoreMessages()` function
- Backend endpoint: `GET /api/v1/sessions/:id/messages?limit=100&offset=100`
- Use React Virtuoso or react-window for virtual scrolling
- Cache loaded messages in memory to avoid re-fetching

**Files to Modify**:
- `packages/react-sdk/src/hooks/useAgentChat.ts`
- `packages/backend/src/messages/messages.controller.ts`
- `packages/backend/src/messages/messages.service.ts`

**Related**:
- React SDK README: `packages/react-sdk/README.md` (update with pagination docs)

---

### Issue 3: Multi-Device Sync

**Title**: Real-Time Conversation Sync Across Multiple Devices

**Priority**: Medium

**Labels**: backend, frontend, conversation-persistence, realtime, feature

**Estimate**: 5 days

**Description**:
Enable users to open the same conversation on multiple devices (e.g., mobile + laptop) and see real-time message updates across all devices.

**Acceptance Criteria**:
- [ ] Backend: Track multiple active sessions per conversation
- [ ] Backend: Broadcast message events to all connected clients for same conversationId
- [ ] Frontend: Auto-update message list when other device sends message
- [ ] Frontend: Show "Active on 2 devices" indicator
- [ ] UX: Handle conflicts gracefully (last write wins)
- [ ] Tests: Multi-client WebSocket test (2 browsers, same conversation)

**Technical Notes**:
**Backend Changes**:
- Add `ActiveSession` entity: `{ conversationId, deviceId, socketId, connectedAt }`
- Track in `SessionService.activeSessions: Map<conversationId, Set<socketId>>`
- Broadcast `text_delta` events to all sockets in conversation
- Clean up on disconnect

**Frontend Changes**:
- Add `deviceId` to localStorage (generated once per browser)
- Subscribe to WebSocket room: `conversation:{conversationId}`
- Handle incoming messages from other devices
- Show visual indicator when multi-device active

**Files to Modify**:
- `packages/backend/src/sessions/session.service.ts`
- `packages/backend/src/sessions/sessions.gateway.ts`
- `packages/react-sdk/src/hooks/useAgentConnection.ts`
- `packages/react-sdk/src/hooks/useAgentChat.ts`

**Considerations**:
- Conflict resolution: Last write wins (simple approach)
- Race conditions: Message ordering via timestamp
- Offline handling: Queue messages, sync on reconnect

**Related**:
- ADR 0009: `docs/adr/0009-conversation-persistence-architecture.md` (update with multi-device design)

---

## Low Priority Issues

### Issue 4: Full-Text Search in Message Content

**Title**: Add Full-Text Search Within Conversation Messages

**Priority**: Low

**Labels**: backend, conversation-persistence, search, enhancement

**Estimate**: 3 days

**Description**:
Currently, conversation search only matches against titles. Add full-text search capability to search within message content for better discoverability.

**Acceptance Criteria**:
- [ ] Backend: Enable SQLite FTS5 on `messages.content` column
- [ ] Backend: Add `GET /api/v1/conversations/search?q=<query>&searchIn=messages`
- [ ] Backend: Return ranked results with highlighted snippets
- [ ] Frontend: Search UI with "Search in titles" vs "Search in messages" toggle
- [ ] UX: Show message preview with search term highlighted
- [ ] Tests: Search accuracy tests (exact match, partial, ranking)

**Technical Notes**:
**Backend (SQLite FTS5)**:
```sql
-- Migration: 010-add-fts-search.sql
CREATE VIRTUAL TABLE messages_fts USING fts5(content, content_rowid=id);
INSERT INTO messages_fts(rowid, content) SELECT id, content FROM messages;

-- Triggers to keep FTS index synced
CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
```

**Backend Service**:
- Update `ConversationsController.searchConversations()` to query FTS table
- Use `MATCH` operator for full-text search
- Use `snippet()` function to generate previews with highlighting
- Rank by relevance using `rank` column

**Frontend**:
- Add toggle: "Search in titles" | "Search in messages"
- Display results with `<mark>` tags for highlighted terms
- Click result → jump to message in conversation

**Files to Create/Modify**:
- `packages/backend/migrations/010-add-fts-search.sql`
- `packages/backend/src/sessions/conversations.controller.ts`
- `packages/backend/src/messages/messages.service.ts`
- `packages/react-sdk/src/hooks/useConversationSearch.ts` (NEW)

**Related**:
- SQLite FTS5 Docs: https://www.sqlite.org/fts5.html

---

### Issue 5: Conversation Sharing with Share Tokens

**Title**: Share Conversations via Public Link

**Priority**: Low

**Labels**: backend, frontend, conversation-persistence, sharing, feature

**Estimate**: 2 days

**Description**:
Enable users to share conversations with colleagues via a public link. The shared conversation should be read-only with an expiration date.

**Acceptance Criteria**:
- [ ] Backend: `POST /api/v1/conversations/:id/share` → returns `{ shareToken, expiresAt, url }`
- [ ] Backend: `GET /api/v1/conversations/shared/:token` → returns read-only conversation
- [ ] Backend: Validate share token expiry and revocation
- [ ] Frontend: "Share" button generates link and copies to clipboard
- [ ] Frontend: Read-only view for shared conversations (no input box)
- [ ] UX: Show "Shared by {user} on {date}" banner
- [ ] Tests: Token generation, expiry, revocation, access control

**Technical Notes**:
**Backend**:
- Add `ConversationShare` entity: `{ id, conversationId, shareToken, createdBy, expiresAt, revokedAt }`
- Generate share token: `share_${crypto.randomBytes(16).hex()}`
- Endpoint: `POST /api/v1/conversations/:id/share` (requires `chat` scope)
- Endpoint: `GET /api/v1/conversations/shared/:token` (public, no auth required)
- Validate: Check expiry and revocation before serving

**Frontend**:
- Add "Share" button to conversation header
- Modal with share link and copy button
- Route: `/shared/:token` → Read-only conversation view
- Disable message input, show banner

**Files to Create/Modify**:
- `packages/backend/src/admin/entities/conversation-share.entity.ts` (NEW)
- `packages/backend/src/sessions/conversations.controller.ts`
- `packages/react-sdk/src/components/ConversationShareModal.tsx` (NEW)

**Security Considerations**:
- Share tokens are unguessable (16 bytes of entropy)
- Rate limit share link creation (max 10 per conversation)
- Auto-expire after 30 days if not specified
- Allow users to revoke share links

**Use Cases**:
- Educational demos (share example conversations)
- Customer support (share conversation history with support team)
- Team collaboration (share debugging sessions)

---

### Issue 6: Conversation Export (JSON/MD/PDF)

**Title**: Export Conversations as JSON, Markdown, or PDF

**Priority**: Low

**Labels**: backend, frontend, conversation-persistence, export, feature

**Estimate**: 3 days

**Description**:
Allow users to download their conversation history in multiple formats for archival, sharing, or offline viewing.

**Acceptance Criteria**:
- [ ] Backend: `GET /api/v1/conversations/:id/export?format=json|markdown|pdf`
- [ ] Backend: Generate JSON export with full message metadata
- [ ] Backend: Generate Markdown export with readable formatting
- [ ] Backend: Generate PDF export with styling (optional)
- [ ] Frontend: "Export" dropdown with format options
- [ ] Frontend: Download file with conversation title as filename
- [ ] Tests: Export output format validation

**Technical Notes**:
**JSON Export**:
```json
{
  "conversationId": "conv_abc123",
  "title": "Python Debugging Session",
  "createdAt": "2026-01-01T10:00:00Z",
  "messages": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ],
  "turns": [
    { "turnNumber": 0, "tokens": 1500, "durationMs": 2000 }
  ]
}
```

**Markdown Export**:
```markdown
# Python Debugging Session

**Conversation ID**: conv_abc123
**Created**: 2026-01-01 10:00 AM

---

**User** (10:00 AM):
> Help me debug this Python script

**Assistant** (10:01 AM):
> I'll help you debug that. Let me analyze the script...

---

**Statistics**:
- Total Turns: 5
- Total Tokens: 7,500
- Duration: 10 minutes
```

**PDF Export** (Optional, Complex):
- Use library like `puppeteer` or `pdfkit`
- Render Markdown to HTML, then HTML to PDF
- Include conversation metadata in footer
- May increase bundle size significantly

**Files to Create/Modify**:
- `packages/backend/src/sessions/conversations.controller.ts`
- `packages/backend/src/sessions/services/conversation-export.service.ts` (NEW)
- `packages/react-sdk/src/components/ConversationExportButton.tsx` (NEW)

**Frontend**:
- Dropdown: "Export as... → JSON | Markdown | PDF"
- Fetch blob from backend, trigger download

**Libraries**:
- Markdown: Use `marked` library
- PDF: Use `puppeteer` (heavy) or `jspdf` (lighter)

---

### Issue 7: Conversation List UI Component

**Title**: Pre-Built Conversation List Component for React SDK

**Priority**: Low

**Labels**: frontend, conversation-persistence, ui-component, enhancement

**Estimate**: 2 days

**Description**:
Provide a pre-built React component for displaying a list of conversations with sorting, filtering, and search.

**Acceptance Criteria**:
- [ ] Component: `<ConversationList>` with search, sort, filter UI
- [ ] Features: Search by title, filter by pinned, sort by lastActivity/createdAt
- [ ] Features: "Pin" button, "Delete" button, click to open conversation
- [ ] UI: Loading state, empty state, error state
- [ ] Responsive: Mobile-friendly layout
- [ ] Tests: Component tests with mock data

**Technical Notes**:
**Component API**:
```tsx
import { ConversationList } from '@ccaas/react-sdk'

<ConversationList
  tenantId="my-solution"
  serverUrl="http://localhost:3001"
  onSelectConversation={(conv) => setActiveConv(conv)}
  renderConversation={(conv) => (
    <div>{conv.title}</div>  // Custom render (optional)
  )}
  enableSearch={true}
  enablePinning={true}
  enableDelete={true}
/>
```

**Features**:
- Fetches conversations via `GET /api/v1/conversations`
- Search box with debounce
- Sort dropdown: "Last Activity" | "Created Date" | "Title"
- Filter: "All" | "Pinned Only"
- Actions: Pin/Unpin, Delete
- Infinite scroll pagination

**Styling**:
- Use Tailwind CSS (matches admin-next)
- Responsive: Stack on mobile, sidebar on desktop

**Files to Create**:
- `packages/react-sdk/src/components/ConversationList.tsx` (NEW)
- `packages/react-sdk/src/hooks/useConversationList.ts` (NEW)
- `packages/react-sdk/src/components/ConversationListItem.tsx` (NEW)

**Documentation**:
- Update `packages/react-sdk/README.md` with usage examples

---

### Issue 8: Conversation Tags and Categories

**Title**: Add Tags/Categories to Organize Conversations

**Priority**: Low

**Labels**: backend, frontend, conversation-persistence, organization, feature

**Estimate**: 2 days

**Description**:
Allow users to organize conversations using tags or categories for better navigation and filtering.

**Acceptance Criteria**:
- [ ] Backend: Add `tags` column to `sessions` table (JSON array)
- [ ] Backend: `PATCH /api/v1/conversations/:id` → accepts `tags` field
- [ ] Backend: `GET /api/v1/conversations?tags=debugging,python` → filter by tags
- [ ] Frontend: Tag input component (autocomplete with existing tags)
- [ ] Frontend: Tag badges in conversation list
- [ ] Frontend: Filter by tag in ConversationList
- [ ] Tests: Tag CRUD, filtering, multi-tag queries

**Technical Notes**:
**Database Schema**:
```typescript
@Column({ type: 'simple-json', nullable: true })
tags: string[] | null;  // ["debugging", "python", "backend"]
```

**Backend**:
- Update `UpdateConversationDto` with `tags?: string[]`
- Update `ListConversationsQuery` with `tags?: string` (comma-separated)
- Filter: `WHERE tags LIKE '%debugging%'` (SQLite JSON functions)

**Frontend**:
- Tag input with autocomplete (suggest popular tags)
- Tag badges (click to filter)
- Color-coded tags

**Files to Modify**:
- `packages/backend/src/admin/entities/session.entity.ts`
- `packages/backend/src/sessions/conversations.controller.ts`
- `packages/react-sdk/src/components/ConversationTagInput.tsx` (NEW)

**Enhancement**:
- Auto-suggest tags based on conversation content (ML-based, future)

---

### Issue 9: Conversation Import

**Title**: Import Conversations from JSON File

**Priority**: Low

**Labels**: backend, frontend, conversation-persistence, import, feature

**Estimate**: 2 days

**Description**:
Allow users to import previously exported conversations (JSON format) to migrate data or restore from backups.

**Acceptance Criteria**:
- [ ] Backend: `POST /api/v1/conversations/import` → accepts JSON file
- [ ] Backend: Validate JSON schema before import
- [ ] Backend: Generate new IDs for imported conversations (avoid conflicts)
- [ ] Frontend: "Import" button with file upload dialog
- [ ] Frontend: Show import progress (X/Y conversations imported)
- [ ] UX: Handle errors gracefully (skip invalid, report errors)
- [ ] Tests: Valid import, invalid JSON, schema mismatch

**Technical Notes**:
**Import Endpoint**:
```typescript
POST /api/v1/conversations/import
Content-Type: multipart/form-data
Body: { file: <conversation.json> }

Response:
{
  "imported": 5,
  "skipped": 2,
  "errors": [
    { "line": 10, "error": "Invalid message format" }
  ]
}
```

**Validation**:
- Use Zod schema to validate JSON structure
- Check required fields: `conversationId`, `messages[]`, `createdAt`
- Reject if tenant mismatch

**ID Handling**:
- Generate new `conversationId` (don't reuse from file)
- Preserve original ID in metadata for reference
- Update foreign keys (messageId, turnId)

**Frontend**:
- File upload with drag-and-drop
- Progress bar during import
- Success/error summary modal

**Files to Create/Modify**:
- `packages/backend/src/sessions/conversations.controller.ts`
- `packages/backend/src/sessions/services/conversation-import.service.ts` (NEW)
- `packages/react-sdk/src/components/ConversationImportButton.tsx` (NEW)

**Security**:
- Limit file size (max 10MB)
- Validate file is JSON before parsing
- Rate limit imports (max 1 per minute per tenant)

---

## Summary

**Total Backlog Items**: 9 issues

| Priority | Count | Total Estimate |
|----------|-------|----------------|
| High | 1 | 1 day |
| Medium | 2 | 7 days |
| Low | 6 | 14 days |
| **Total** | **9** | **22 days** |

**Next Steps**:
1. Create these issues in Linear
2. Assign to appropriate team members
3. Prioritize based on user feedback and roadmap
4. Add to sprint backlog as capacity allows

**Note**: Estimates are rough and should be refined during sprint planning.
