# API Endpoint Fix - WebSocket 404 Error

**Date**: 2026-02-08
**Status**: ✅ Fixed

---

## Problem

User reported WebSocket connection failure with 404 error:

```
POST /api/v1/sessions/quiz_441301ed-9dcf-495a-8222-a2538e5beba6/completion: 404
```

### Root Cause

**Mismatch between react-sdk and CCAAS backend endpoints:**

- **react-sdk** (`useAgentChat.ts` line 357) expects:
  ```typescript
  POST /api/v1/sessions/${sessionId}/completion
  ```

- **CCAAS backend** only had:
  ```typescript
  POST /api/v1/chat/send
  POST /api/v1/chat/agent/chat
  ```

The `/api/v1/sessions/:sessionId/completion` endpoint did not exist.

---

## Solution

Created a new **SessionsController** to handle session-specific routes that react-sdk expects.

### Files Created

**`packages/backend/src/chat/sessions.controller.ts`**

- New controller at `/api/v1/sessions/*`
- Implements `POST /api/v1/sessions/:sessionId/completion` endpoint
- Maps to existing `SessionService.sendFollowUp()` and `ensureCLIProcess()` logic
- Validates `clientId` and `message` parameters
- Finds WebSocket connection via `ChatGateway.getClientSocket()`
- Streams response via WebSocket events

### Files Modified

**`packages/backend/src/chat/chat.module.ts`**

- Added `SessionsController` to controllers array
- Imported new controller

---

## Technical Details

### Request Payload (from react-sdk)

```typescript
{
  clientId: string         // Required: WebSocket client ID
  message: string          // Required: User message
  tenantId?: string        // Optional: Tenant ID
  mcpServers?: Record<string, unknown>  // Optional: MCP server config
  skillPath?: string       // Optional: Skill directory path
  enabledSkillSlugs?: string[]  // Optional: Enabled skills
  attachments?: Array<{    // Optional: File attachments
    name: string
    content: string
    mimeType: string
  }>
}
```

### Response

```json
{
  "success": true,
  "sessionId": "quiz_441301ed-9dcf-495a-8222-a2538e5beba6"
}
```

The actual AI response streams via WebSocket events (`agent_status`, `text_delta`, `tool_activity`, etc.)

---

## Verification

### Test Endpoint Availability

```bash
curl -X POST http://localhost:3001/api/v1/sessions/test-session/completion \
  -H "Content-Type: application/json" \
  -d '{"clientId": "test", "message": "test"}'
```

**Expected Response** (400 Bad Request):
```json
{
  "message": "Client not connected via WebSocket",
  "error": "Bad Request",
  "statusCode": 400
}
```

This confirms the endpoint exists and validates the WebSocket requirement.

### Frontend Test

1. Open http://localhost:5282
2. Paste a quiz in the input field
3. Click "分析题目" or press Ctrl+Enter
4. Should see:
   - WebSocket connection established
   - "AI正在分析..." loading state
   - Analysis results appear when complete

---

## Architecture Diagram

```
┌─────────────────┐
│  Frontend       │
│  (quiz-analyzer)│
└────────┬────────┘
         │
         │ POST /api/v1/sessions/:id/completion
         │ { clientId, message, tenantId, ... }
         ↓
┌─────────────────────────────────────┐
│  CCAAS Backend (port 3001)          │
│                                     │
│  SessionsController                 │
│  ├─ POST /sessions/:id/completion  │ ← NEW
│  └─ validates clientId              │
│      ↓                              │
│  ChatGateway                        │
│  ├─ getClientSocket(clientId)      │
│  └─ socket.emit(event)             │
│      ↓                              │
│  SessionService                     │
│  ├─ getOrCreateSession()           │
│  ├─ ensureCLIProcess() / sendFollowUp() │
│  └─ streams events via callback    │
└─────────────────────────────────────┘
         │
         │ WebSocket events
         │ (agent_status, text_delta, ...)
         ↓
┌─────────────────┐
│  Frontend       │
│  useAgentChat   │
│  hook           │
└─────────────────┘
```

---

## Backward Compatibility

The existing `/api/v1/chat/send` endpoint remains unchanged. Both endpoints now coexist:

- **New**: `/api/v1/sessions/:sessionId/completion` (for react-sdk)
- **Legacy**: `/api/v1/chat/send` (for direct REST API usage)

Both route to the same `SessionService` logic.

---

## Future Improvements

1. **Add attachments field to SendMessageDto**
   Currently, react-sdk sends `attachments` but it's not in the official DTO.

2. **Consider deprecating duplicate endpoints**
   Once all solutions migrate to react-sdk, we could deprecate `/chat/send`.

3. **Add OpenAPI/Swagger docs**
   Document the `/sessions/:id/completion` endpoint in Swagger UI.

---

## Commit Message

```
fix(backend): add /sessions/:id/completion endpoint for react-sdk

- Create SessionsController to handle session-specific routes
- Add POST /api/v1/sessions/:sessionId/completion endpoint
- Maps to existing SessionService logic for WebSocket streaming
- Fixes 404 error from @ccaas/react-sdk useAgentChat hook

Resolves WebSocket connection failure in quiz-analyzer and other
solutions using @ccaas/react-sdk.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Related Files

**Backend**:
- `packages/backend/src/chat/sessions.controller.ts` (NEW)
- `packages/backend/src/chat/chat.module.ts` (MODIFIED)
- `packages/backend/src/chat/chat.controller.ts` (reference)
- `packages/backend/src/chat/session.service.ts` (reference)

**Frontend SDK**:
- `packages/react-sdk/src/hooks/useAgentChat.ts` (line 357)

**Quiz Analyzer**:
- `solutions/quiz-analyzer/frontend/src/App.tsx` (uses react-sdk)
- `solutions/quiz-analyzer/frontend/src/hooks/useQuizSession.ts` (uses react-sdk)

---

**Status**: ✅ **READY FOR TESTING**

The fix has been deployed. User should test the quiz analysis workflow end-to-end.
