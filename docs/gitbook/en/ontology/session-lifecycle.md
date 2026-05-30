# Session Lifecycle

> What signals the Solution and the platform exchange between session start and end, and how to avoid leaks. This page covers the PUT indicators → DELETE session lifecycle protocol.

## Signal order

```
[Solution starts session]
   ↓
PUT /api/v1/workflow/sessions/:id/indicators   ← push indicator catalog (M5.3a)
   │ replace semantics; idempotent
   ↓
[Solution + platform steady state: Solution pushes events, platform runs triggers/cascade, dashboard reads platform]
   ↓
[Solution ends session]
   ↓
DELETE /api/v1/workflow/sessions/:id           ← teardown signal (M6 pass-1/2)
   │ tenant-scoped; idempotent; empty ok
   ↓
[Platform IndicatorRegistry frees the catalog, engine queue drains]
```

## PUT `/indicators`

See [Indicator catalog](indicator-catalog.md). Highlights:

- Solution invokes once at session start
- replace semantics (multiple calls on the same session: last write wins)
- on failure the platform LLM cascade falls back to `'no indicators; skip'` — doesn't block session start; the next session start re-pushes

## DELETE `/api/v1/workflow/sessions/:sessionId`

```
DELETE /api/v1/workflow/sessions/:sessionId
Authorization: Bearer <chat-scope key>

→ 204 No Content
→ 400 validation failure / no tenant bound
```

Platform internals:

```typescript
async clearSession(sessionId, @TenantId() solutionId) {
  if (!solutionId) throw 400;
  this.engine.clearSessionQueue(sessionId);                   // drain queue (tenant-agnostic)
  this.indicators.clearTenantSession(solutionId, sessionId);  // only my tenant's catalog
}
```

**Why `clearSessionQueue` instead of `clearSession`:** the latter cascades into `IndicatorRegistry.clearSession`, which is sessionId-broad (drops all tenants). Tenant A's DELETE shouldn't accidentally clear tenant B's catalog. M6 pass-2 SF3 added `clearSessionQueue` (only drain queue) + `clearTenantSession` (only the requesting tenant) so the DELETE controller takes the narrow path.

## Live-lesson side call sites

```typescript
// solutions/business/live-lesson/backend/src/application/classroom/classroom.service.ts

async endSession(code: string) {
  const session = await this.resolveSession(code);

  // M6 pass-2 SF2: fire BEFORE the already-ended early-return.
  // The previous endSession may have failed to reach the platform;
  // retrying here is idempotent server-side.
  void this.workflowLifecycle.clearSession(session.id);

  if (session.status === 'ended') {
    return { ok: true, status: 'ended' };
  }
  // ... rest of local cleanup
}

private async cleanupStaleSessions(): Promise<void> {
  // M6 pass-2 SF1: crash-path also signals the platform.
  // process kill / abandoned endSession bypasses the call above.
  for (const session of staleSessions) {
    this.stateService.cleanupSession(session.id, session.lessonId);
    this.broadcastService.cleanupSession(session.id);
    void this.workflowLifecycle.clearSession(session.id);
  }
}
```

`WorkflowSessionLifecycleService.clearSession(sessionId)` wraps `WorkflowClient.clearSession`, fire-and-forget; the platform's 4xx is terminal (no retry); transient 5xx awaits the next endSession / cleanupStaleSessions naturally.

## Two clear APIs for two boundaries

The platform has two clear APIs serving different purposes:

| API | Scope | Caller |
|---|---|---|
| `IndicatorRegistryService.clearSession(sessionId)` | Cross-tenant (sessionId suffix match) | `WorkflowEngineService.clearSession` — engine-internal teardown |
| `IndicatorRegistryService.clearTenantSession(solutionId, sessionId)` | Only the `(solutionId, sessionId)` tuple | `SessionLifecycleController` — external HTTP DELETE |
| `WorkflowEngineService.clearSession(sessionId)` | Drain queue + broad indicator clear | Future SessionService teardown (not yet wired) |
| `WorkflowEngineService.clearSessionQueue(sessionId)` | Only drain queue | `SessionLifecycleController` — external DELETE |

**Why two:** the engine teardown runs in-process and trusts sessionIds to be globally unique (UUIDs); the broad clear is cheaper. The external HTTP DELETE crosses the auth boundary, so it must be tenant-scoped.

## Race condition: indicator push in flight + chat_turn already arrives

Immediately after session start:
1. `pushIndicators(...)` HTTP PUT in flight
2. The first `chat_turn` event in flight

Race window: if chat_turn reaches the platform before the PUT, ChatTurnService sees an empty catalog → `'no indicators; skip'` → this chat_turn is uncategorized.

**Today's approach:** accept the small window. Session start order is typically session create → indicator push → students join → first chat at least hundreds of ms later. M5.3a doesn't handle this explicitly.

**Optional hardening (not implemented):** synchronously await the indicator-push HTTP at the platform side before returning; or have the frontend show a "indicator catalog empty" banner when the dashboard sees that state.

## Failure modes

| Symptom | Cause |
|---|---|
| DELETE 400 "solutionId not resolved" | API key has no tenant binding (dev-login admin keys do this) |
| Session ended but IndicatorRegistry still holds the catalog | Platform never received DELETE or it failed; M6 pass-2 SF1 + SF2 cover most cases |
| Cross-tenant data was wiped together | True in M6 pass-1 (broad cascade); fixed in M6 pass-2 SF3 |
| Tenant B sees data pushed by tenant A | Should not happen: keyed by `(solutionId, sessionId)`; M5 pass-1 MF3 + a dedicated spec |

## Relevant files

| File | Responsibility |
|---|---|
| `packages/backend/src/workflow/session-lifecycle/session-lifecycle.controller.ts` | DELETE endpoint (M6 pass-1/2) |
| `packages/backend/src/workflow/llm/indicator-registry.service.ts` `clearTenantSession` | Tenant-scoped clear (M6 pass-2 SF3) |
| `packages/backend/src/workflow/workflow-engine.service.ts` `clearSessionQueue` | Drain queue only (M6 pass-2 SF3) |
| `packages/workflow-client/src/index.ts` `clearSession` | Client-side DELETE method |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-session-lifecycle.service.ts` | Solution-side wrapper |
| `solutions/business/live-lesson/backend/src/application/classroom/classroom.service.ts` endSession + cleanupStaleSessions | Call sites (happy-path + crash-path) |
