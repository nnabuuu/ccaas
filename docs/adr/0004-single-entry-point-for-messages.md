# ADR-0004: Single Entry Point for Messages

**Status**: Accepted
**Date**: 2026-02-13
**Decision Maker**: @niex
**Related Issue**: API simplification

---

## Background (Context)

### The Problem

**Multiple Overlapping Endpoints** for sending messages:

```
POST /api/v1/chat/send              # ChatController.send()
POST /api/v1/chat/agent/chat        # ChatController.agentChat()
POST /api/v1/sessions/:id/completion # SessionsController.completion()
```

**Similar duplication for other operations**:
```
POST /api/v1/chat/cancel
DELETE /api/v1/sessions/:id/completion

GET /api/v1/chat/sessions/:id/status
GET /api/v1/sessions/:id

POST /api/v1/chat/sessions/:id/restart
POST /api/v1/sessions/:id/restart
```

**Impact**:
1. **Developer Confusion**: Which endpoint should I use?
2. **Inconsistent Behavior**: Different endpoints may have subtle differences
3. **Maintenance Burden**: Bug fixes must be applied to multiple places
4. **Documentation Overhead**: Must document all variations
5. **Testing Complexity**: Must test all code paths

### Root Cause Analysis

**Historical Evolution**:
- Phase 1: `ChatController` created for quick prototyping
- Phase 2: `SessionsController` created following REST principles
- Phase 3: Forgot to remove `ChatController` endpoints
- Result: Code duplication and confusion

**Why This Happened**:
- No clear guideline: "Use SessionsController for all session operations"
- `ChatController` kept health checks → developer assumed it was still needed
- No deprecation process for old endpoints

---

## Decision

**We decided**: All session-related operations **MUST** go through SessionsController. ChatController is **only for monitoring** (health checks).

### Architecture Principle

> **One Feature = One Entry Point**
>
> **SessionsController** = All session management + message sending
>
> **ChatController** = Health checks and monitoring only (public endpoints)
>
> **Never duplicate functionality across controllers**

### Standard API (After Simplification)

**SessionsController** (Primary API):
```
POST   /api/v1/sessions/:id/completion   # Send message
DELETE /api/v1/sessions/:id/completion   # Cancel operation
GET    /api/v1/sessions/:id              # Get session info
POST   /api/v1/sessions/:id/restart      # Restart session
```

**ChatController** (Monitoring Only):
```
GET /api/v1/chat/health    # Health check (public)
GET /api/v1/chat/status    # Server statistics (public)
```

### Deleted Endpoints

**From ChatController**:
```
❌ POST   /api/v1/chat/send
❌ POST   /api/v1/chat/agent/chat
❌ POST   /api/v1/chat/cancel
❌ GET    /api/v1/chat/sessions/:id/status
❌ POST   /api/v1/chat/sessions/:id/restart
❌ GET    /api/v1/chat/sessions/:id/details
```

**Code Removed**: ~200 lines from ChatController

---

## Alternatives Considered

### Alternative A: Keep Both Endpoints

**Description**: Maintain backward compatibility by keeping all endpoints

**Pros**:
- ✅ No breaking changes for existing consumers
- ✅ No migration effort required

**Cons**:
- ❌ Continued confusion for developers
- ❌ Maintenance burden (bug fixes in 2 places)
- ❌ Testing complexity
- ❌ Documentation overhead

**Why Not Chosen**: Technical debt compounds over time, better to fix early

---

### Alternative B: Deprecate Gradually

**Description**: Mark old endpoints as deprecated, remove after grace period

**Pros**:
- ✅ Gives consumers time to migrate
- ✅ Clear migration path

**Cons**:
- ❌ Analysis showed **no direct API consumers** (all use react-sdk)
- ❌ Delays addressing the problem
- ❌ More code to maintain during deprecation period

**Why Not Chosen**: No consumers to migrate (react-sdk already uses SessionsController)

---

### Alternative C: Remove Immediately ⭐ **Selected Approach**

**Description**: Delete duplicate endpoints, keep only SessionsController

**Pros**:
- ✅ Immediate clarity for developers
- ✅ Reduced maintenance burden
- ✅ Simpler testing and documentation
- ✅ No breaking changes (verified no direct consumers)

**Cons**:
- ❌ Would break direct API consumers (but none exist)

**Why Chosen**: Analysis showed all solutions use react-sdk, which already uses SessionsController

---

## Consequences

### Positive Impacts

- ✅ **API Clarity**: One clear way to send messages
- ✅ **Reduced HTTP Requests**: lesson-plan-designer previously polled via HTTP (~30 req/min), now uses WebSocket (0 req/min)
- ✅ **Simpler Documentation**: Swagger shows one "Primary API"
- ✅ **Easier Maintenance**: Bug fixes in one place
- ✅ **Better Testing**: Single code path to test
- ✅ **Consistent Architecture**: SessionsController = session management

### Negative Impacts

- ❌ **Breaking Changes**: Direct API consumers must update (but analysis showed none exist)

### Measured Impact

**Endpoint Reduction**:
| Operation | Before | After | Change |
|-----------|--------|-------|--------|
| Send message | 3 endpoints | 1 endpoint | -67% |
| Get status | 2 endpoints | 1 endpoint | -50% |
| Cancel | 2 endpoints | 1 endpoint | -50% |

**HTTP Traffic** (lesson-plan-designer):
- Before: ~30 HTTP requests/minute (polling subAgent status)
- After: 0 HTTP requests (uses WebSocket events)
- Reduction: **-100%**

**Code Complexity**:
- ChatController methods: 8 → 2 (-75%)
- Lines of code: ~200 lines removed

### Consumer Impact Analysis

**✅ No Breaking Changes**:
- `react-sdk`: Already uses SessionsController
- `lesson-plan-designer`: Uses react-sdk
- `ccaas-demo`: Uses react-sdk
- No direct API consumers found

---

## Implementation Guide

### For Solution Developers (Recommended)

**Use react-sdk hooks** (handles all complexity):
```typescript
import { useAgentConnection, useAgentChat } from '@ccaas/react-sdk'

const connection = useAgentConnection({ serverUrl, tenantId })
const { sendMessage, cancelProcessing } = useAgentChat({ connection })

// Automatically uses SessionsController
await sendMessage({ message: 'Hello' })
```

### Direct HTTP API (Advanced Use Cases)

**Only if you cannot use react-sdk**:

```typescript
// Send message
POST /api/v1/sessions/:sessionId/completion
{
  "message": "Hello, Claude!"
}

// Cancel operation
DELETE /api/v1/sessions/:sessionId/completion

// Get session info
GET /api/v1/sessions/:sessionId

// Restart session
POST /api/v1/sessions/:sessionId/restart
```

**Important**: These endpoints require WebSocket connection management. Use react-sdk for best results.

### Migration Guide (If You Were Using ChatController)

**Replace**:
```typescript
// ❌ OLD (no longer works)
POST /api/v1/chat/send
POST /api/v1/chat/agent/chat
POST /api/v1/chat/cancel
```

**With**:
```typescript
// ✅ NEW (use react-sdk)
import { useAgentChat } from '@ccaas/react-sdk'
const { sendMessage, cancelProcessing } = useAgentChat({ connection })
```

**Or direct HTTP**:
```typescript
// ✅ NEW (direct HTTP)
POST /api/v1/sessions/:sessionId/completion
DELETE /api/v1/sessions/:sessionId/completion
```

### Monitoring Endpoints (Unchanged)

```
GET /api/v1/chat/health    # Health check for load balancers
GET /api/v1/chat/status    # Server statistics for monitoring
```

Both endpoints are **public** (no authentication required).

---

## References

- Original implementation: `docs/internal/implementation-summaries/API_SIMPLIFICATION_COMPLETE.md`
- Related: ADR-0002 (REST resource naming principles)
- Backend controller: `packages/backend/src/sessions/sessions.controller.ts`
- react-sdk hooks: `packages/react-sdk/src/hooks/useAgentChat.ts`

---

## Update History

- **2026-02-13**: Initial implementation (API simplification)
- **2026-02-14**: Formalized as ADR-0004 during documentation cleanup
