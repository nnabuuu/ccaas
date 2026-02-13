# ADR-0002: REST Resource Naming Principles

**Status**: Accepted
**Date**: 2026-02-13
**Decision Maker**: @niex
**Related Issue**: ChatModule refactoring

---

## Background (Context)

### The Problem

The CCAAS backend had a `ChatModule` with a `ChatController` that violated REST naming principles:

**Architectural Issues**:
```
chat/
├── ChatModule          ← Mixed WebSocket + health check
├── ChatGateway         ← WebSocket gateway
├── ChatController      ← Only health/status endpoints (misleading!)
├── SessionModule       ← Extracted to break circular deps
├── SessionService      ← Process management
└── EventMapperService  ← Event mapping

sessions/
└── SessionsController  ← REST API (separated from SessionService!)
```

**Problems**:
1. **REST Principle Violation**: `/api/v1/chat` implied "chat" is a resource entity, but it's not
2. **Misleading Names**: `ChatController` only had health checks, not chat functionality
3. **Code Fragmentation**: Session code split across `chat/` and `sessions/` directories
4. **Module Confusion**: `ChatModule` imported `SessionModule` but provided no chat features
5. **Circular Dependencies**: Forced creation of separate `SessionModule` to break cycles

### What is REST Resource Naming?

REST API design principle: **URL paths should represent resources (nouns), not actions (verbs)**

**Good Examples**:
- `/users` - Resource: user entities
- `/sessions` - Resource: session entities
- `/health` - Resource: system health status

**Bad Examples**:
- `/chat` - Not a resource (chat is an action via WebSocket)
- `/send` - Verb, not a resource
- `/cancel` - Verb, not a resource

---

## Decision

**We decided**: URL paths in REST APIs **MUST represent actual resources (entities or system status)**, not actions or implementation details.

### Architecture Principle

> **REST Endpoints** = Resources (nouns) that represent entities or system state
>
> **Non-Resource Functionality** = Use WebSocket events or domain-appropriate protocols
>
> **Never use implementation details in URL paths**

### Detailed Rules

**Allowed URL Patterns**:
- ✅ `/api/v1/{resource}` - Collection of entities (e.g., `/sessions`, `/skills`)
- ✅ `/api/v1/{resource}/{id}` - Specific entity (e.g., `/sessions/abc123`)
- ✅ `/api/v1/{resource}/{id}/{subresource}` - Sub-resource (e.g., `/sessions/abc/messages`)
- ✅ `/api/v1/health`, `/api/v1/status` - System-level resources

**Forbidden URL Patterns**:
- ❌ `/api/v1/chat` - "chat" is an action, not a resource
- ❌ `/api/v1/send` - Verb, not a resource
- ❌ `/api/v1/cancel` - Verb, not a resource
- ❌ `/api/v1/{implementation-detail}` - URLs should not expose internal architecture

### Implementation

**Renamed Modules**:
- `ChatModule` → `SessionsModule` (unified session management)
- `ChatGateway` → `SessionsGateway` (WebSocket gateway for sessions)

**Created Modules**:
- `HealthModule` - System health monitoring (top-level system resource)

**Deleted Endpoints**:
```
❌ GET /api/v1/chat/health
❌ GET /api/v1/chat/status
```

**New Endpoints**:
```
✅ GET /api/v1/health       - System health check
✅ GET /api/v1/status       - Detailed system status
```

**Unchanged** (already correct):
```
✅ POST /api/v1/sessions/:id/completion
✅ GET /api/v1/sessions/:id
✅ DELETE /api/v1/sessions/:id
```

---

## Alternatives Considered

### Alternative A: Keep `/chat` Path

**Description**: Keep existing `/api/v1/chat/*` endpoints

**Pros**:
- ✅ No breaking changes for consumers
- ✅ Familiar to existing developers

**Cons**:
- ❌ Violates REST principles (chat is not a resource)
- ❌ Confusing for new developers ("Where do I send messages?")
- ❌ Inconsistent with other endpoints

**Why Not Chosen**: Technical debt compounds over time, better to fix early

---

### Alternative B: Use Resource-Based Naming ⭐ **Selected Approach**

**Description**: Rename paths to match actual resources

**Pros**:
- ✅ Follows REST principles
- ✅ Clear, self-documenting API
- ✅ Consistent with industry standards
- ✅ Easier to understand and maintain

**Cons**:
- ❌ Breaking change for direct API consumers
- ❌ Requires documentation updates

**Why Chosen**: Long-term clarity > short-term convenience

---

### Alternative C: Keep Both (Deprecation Period)

**Description**: Support both old and new paths during migration

**Pros**:
- ✅ No immediate breaking changes
- ✅ Gradual migration possible

**Cons**:
- ❌ More code to maintain
- ❌ Confusing to have two ways to do the same thing
- ❌ Delays addressing the problem

**Why Not Chosen**: Analysis showed no direct consumers of old endpoints (all use react-sdk)

---

## Consequences

### Positive Impacts

- ✅ **REST Compliance**: URLs now represent actual resources
- ✅ **Clear Responsibility**: SessionsModule = sessions, HealthModule = monitoring
- ✅ **Code Co-location**: All session code in `sessions/` directory
- ✅ **Proper Naming**: Components named after what they do, not implementation details
- ✅ **System-Level Monitoring**: `/health` and `/status` are clearly system endpoints

### Negative Impacts

- ❌ **Breaking Changes**: External consumers calling old endpoints must update
- ⚠️ **Migration Effort**: All import paths updated (33 files)

### Measured Impact

**Before**:
- 2 endpoints under `/chat` (only health checks)
- Session code split across 2 directories
- Confusing module names

**After**:
- 2 endpoints under `/health` and `/status` (system-level)
- All session code in `sessions/` directory
- Clear module responsibilities

**Consumer Impact**:
- ✅ **react-sdk**: No changes needed (already uses SessionsController)
- ✅ **lesson-plan-designer**: No changes needed (uses react-sdk)
- ✅ **ccaas-demo**: No changes needed (uses react-sdk)

---

## Implementation Guide

### Naming Checklist

**Before creating a new REST endpoint**:
- [ ] Is this a resource (entity or system status)?
- [ ] Or is this an action/verb?
- [ ] If action → Use WebSocket event or POST to resource
- [ ] If resource → Use appropriate HTTP method on resource path

**Examples**:

```typescript
// ❌ BAD: Verb in URL
POST /api/v1/send-message
POST /api/v1/cancel-operation

// ✅ GOOD: Resource-based
POST /api/v1/sessions/:id/completion     // "Send message" = POST to completion
DELETE /api/v1/sessions/:id/completion   // "Cancel" = DELETE completion
```

### Module Organization

**Good Pattern**:
```
feature/
├── feature.module.ts       # Module for the resource
├── feature.controller.ts   # REST endpoints for the resource
├── feature.service.ts      # Business logic
├── feature.gateway.ts      # WebSocket (if needed)
└── entities/
    └── feature.entity.ts   # Database entity
```

**Bad Pattern**:
```
implementation-detail/      # ❌ Don't name by implementation
├── various-controllers/    # ❌ Don't mix unrelated features
└── split-services/         # ❌ Don't fragment related code
```

### URL Design Rules

1. **Resources are nouns**: `/users`, `/sessions`, `/skills`
2. **Actions use HTTP methods**: `POST`, `GET`, `PUT`, `DELETE`
3. **Hierarchy for relationships**: `/sessions/:id/messages`
4. **System resources at root**: `/health`, `/status`, `/metrics`
5. **No verbs in URLs**: Never `/send`, `/cancel`, `/execute`

---

## References

- Original implementation: `docs/internal/implementation-summaries/CHAT_MODULE_REFACTORING_COMPLETE.md`
- REST API Design Guidelines: https://restfulapi.net/resource-naming/
- Microsoft REST API Guidelines: https://github.com/microsoft/api-guidelines
- Related: ADR-0004 (Single entry point for messages)

---

## Update History

- **2026-02-13**: Initial implementation (ChatModule refactoring)
- **2026-02-14**: Formalized as ADR-0002 during documentation cleanup
