# Indicator Catalog

> **Indicators** are the "knowledge / misconception" tags an LLM uses to classify dialogue. `IndicatorRegistryService` holds the session-scoped catalog; the Solution pushes it via PUT at session start.

## IndicatorDef shape

```typescript
interface IndicatorDef {
  id: string;            // anchor token like 'K1' / 'M3'; K = knowledge, M = misconception
  type: string;          // 'knowledge' | 'misconception' (platform stores as string; extensible)
  label: string;         // shown on the teacher dashboard
  description: string;   // fed to the LLM classifier prompt
}
```

The `anchor id` is the allowed value set for the `anchors[]` field LLM outputs in ChatTurnService. The LLM can fabricate ids, but the platform drops any id not in the registered set — the **anti-hallucination filter**.

## IndicatorRegistryService — server-side store

`packages/backend/src/workflow/llm/indicator-registry.service.ts`

```typescript
@Injectable()
export class IndicatorRegistryService {
  setIndicators(solutionId, sessionId, indicators): void
  getIndicators(solutionId, sessionId): readonly IndicatorDef[]
  clearSession(sessionId): void              // broad clear (cross-tenant; used by engine teardown)
  clearTenantSession(solutionId, sessionId): void  // tenant-scoped clear (used by DELETE endpoint)
}
```

**Tenant isolation (M5 pass-1 MF3):** the internal map keys by `${solutionId}\x1f${sessionId}` (the `\x1f` ASCII Unit Separator avoids collisions if a slug ever contains whitespace). M6 pass-2 SF3 added `clearTenantSession` so the DELETE endpoint only clears its own tenant's data.

**In-process only:** `Map<string, IndicatorDef[]>`. Wiped on restart; the Solution re-pushes on the next session start.

## Register endpoint: PUT `/api/v1/workflow/sessions/:sessionId/indicators`

```
PUT /api/v1/workflow/sessions/:sessionId/indicators
Authorization: Bearer <chat-scope key>
Content-Type: application/json

{
  "indicators": [
    { "id": "K1", "type": "knowledge", "label": "Identifies key concept", "description": "Student names the concept" },
    { "id": "M1", "type": "misconception", "label": "Reverses cause & effect", "description": "Student confuses direction" }
  ]
}

→ 204 No Content (replace semantics; empty array = clear)
→ 400 validation failure / no tenant bound
```

Idempotent (PUT = replace). Empty array is valid and clears the session catalog.

Solution side: `live-lesson` calls `ClassroomStateService.loadIndicators`, reads `IndicatorDef[]` from the lesson manifest, and fires `WorkflowIndicatorPushService.pushIndicators(sessionId, indicators)` (fire-and-forget).

## End-to-end pipeline

```
Solution starts session
  ↓
loadIndicators reads IndicatorDef[] from manifest
  ↓
WorkflowIndicatorPushService.pushIndicators
  ↓ HTTP PUT /api/v1/workflow/sessions/:id/indicators
  ↓ Platform IndicatorIngestController checks @TenantId() → 400 if no tenant
  ↓ IndicatorRegistryService.setIndicators(solutionId, sessionId, list)
  ↓
For each subsequent chat_turn:
  ChatTurnService.classifyWithLlm:
    indicators = this.indicators.getIndicators(solutionId, sessionId)
    if (indicators.length === 0) return 'no indicators; skip'  ← what happened in prod pre-M5.3a
    ... LLM call with indicator catalog in the system prompt
  ↓
Session end:
  ClassroomService.endSession
    workflowLifecycle.clearSession(sessionId)
    ↓ HTTP DELETE /api/v1/workflow/sessions/:id
    ↓ Platform SessionLifecycleController:
       engine.clearSessionQueue(sessionId)               // drain queue
       indicators.clearTenantSession(solutionId, sessionId)  // tenant-scoped clear
```

## Anti-hallucination filter

ChatTurnService, after the LLM returns `{action, anchors, gist, quote}`:

```typescript
const validIds = new Set(indicators.map(a => a.id));
llmOutput.anchors = (llmOutput.anchors ?? []).filter(a => validIds.has(a));
```

The LLM may fabricate `anchors: ['K99', 'INJECTED']`, but K99 isn't in the registered set → it gets dropped. The `gist` and `quote` text fields are preserved (they're descriptive and don't drive downstream status derivation).

## Failure modes

| Symptom | Cause |
|---|---|
| PUT returns 400 "solutionId not resolved" | API key has no tenant binding; common when using a dev-login admin key |
| chat_turn keeps skipping | Platform IndicatorRegistry empty — see the race-condition note in [Session lifecycle](session-lifecycle.md) |
| Indicators lost after restart | By design: in-memory; the Solution re-pushes on next session |
| Tenant A pushed and tenant B saw it | Should not happen: keyed by `(solutionId, sessionId)` tuple; M5 pass-1 MF3 + dedicated spec covers it |
| DELETE also dropped tenant B's catalog | True in M6 pass-1 (broad cascade); M6 pass-2 SF3 fixed it — DELETE now uses `clearTenantSession` |

## Relevant files

| File | Responsibility |
|---|---|
| `packages/backend/src/workflow/llm/indicator-registry.service.ts` | Server-side in-memory store |
| `packages/backend/src/workflow/indicator-ingest/indicator-ingest.controller.ts` | PUT endpoint + DTO |
| `packages/workflow-client/src/index.ts` `WorkflowClient.setIndicators` | Client-side push method |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-indicator-push.service.ts` | Solution-side wrapper |
| `packages/backend/src/workflow/handlers/chat-turn/chat-turn.service.ts` | Main consumer (anchor anti-hallucination filter lives here) |
