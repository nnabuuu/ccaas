# Evaluation Report: v3

## Per-Dimension Scores

### D1: TypeScript 编译正确性 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**harness errors**: 0
**demo errors**: 0
**Justification**: Both `packages/harness` and `solutions/mock/harness-demo` compile cleanly with `tsc --noEmit`. Zero type errors. Unchanged from v2.

### D2: 架构模式对齐 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**Checklist**:
- ✅ Three-layer directories: `core/`, `nestjs/`, `client/` all exist
- ✅ forRoot pattern: `HarnessModule.forRoot(options)` present
- ✅ exports map: 4 required entries
- ✅ core isolation: 0 `@nestjs` imports in `core/`, 0 `@kedge-agentic/backend` imports
- ✅ ESM convention: 0 missing `.js` suffix violations

**Justification**: Architecture unchanged. Dead code (`composite-emitter.ts`) removed — this improves cleanliness but doesn't affect the score.

### D3: 核心编排逻辑 (Weight: 25/100)
**Score: 5/5** → 25/25 points
**Sub-checks**:
- ✅ 1. Orchestrator iteration loop
- ✅ 2. AgentStep execution
- ✅ 3. AsyncMcpStep execution
- ✅ 4. Exit conditions
- ✅ 5. Context assembly
- ✅ 6. **Session event forwarding**: `orchestrator.ts:283` passes `onEvent` to `waitForCompletion()`, wrapping each `SessionEvent` as `HarnessEvent { type: 'session_event', data: { sessionId, iteration, stepId, eventType, payload } }`. The forwarded events correctly include `text_delta`, `agent_status`, `tool_activity` types.

**Justification**: Sub-check 6 was already implemented in v1 but `SessionEvent.type` union was incomplete (only `'progress' | 'tool_call' | 'message'`). v3 adds the 3 missing types to the union, making the type system consistent with runtime behavior.

### D4: REST API 完整性 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**Endpoints**: 15/15 present (plus bonus endpoints)
| # | Endpoint | Status |
|---|----------|--------|
| 1-14 | (same as v2) | ✅ |
| 15 | `GET /harness/runs/:runId/events` | ✅ SSE stream via `HarnessStreamService` with ring buffer replay, heartbeat, and NaN-guarded `lastEventId` |

**Justification**: The SSE endpoint was implemented in v1. v3 fixes the `lastEventId` NaN guard at `harness.controller.ts:105` — `parseInt` of non-numeric strings now correctly falls back to `undefined` instead of passing `NaN` to `getBufferedEvents()`.

### D5: Mock Demo 生命周期 (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Justification**: Unchanged from v2. All 3 scenarios + extra credit items still pass.

### D6: 测试覆盖 (Weight: 10/100)
**Score: 5/5** → 10/10 points
**Components with tests**:
- ✅ `task-registry.spec.ts` — 6 tests
- ✅ `exit-evaluator.spec.ts` — 7 tests
- ✅ `output-extractor.spec.ts` — 7 tests
- ✅ `async-poller.spec.ts` — 4 tests
- ✅ `orchestrator.spec.ts` — 3 tests
- ✅ `event-stream.spec.ts` — 10 tests (NEW: emit/subscribe, ring buffer overflow, seq filtering, unsubscribe, error isolation, subscriberCount, registry CRUD)

**Test results**: 6 suites, 41 tests, 41 passing
**Justification**: New `event-stream.spec.ts` adds 10 tests covering both `RunEventStream` and `RunEventStreamRegistry`. Ring buffer overflow test verifies events 1-10 are dropped when 210 events are emitted (buffer size 200). Error isolation test confirms one throwing subscriber doesn't affect others.

## Penalty Deductions
- **P1**: core imports @nestjs → **0 violations** → No penalty
- **P2**: harness imports @kedge-agentic/backend → **0 violations** → No penalty
- **P3**: tsc errors > 20 → **0 errors** → No penalty
- **P4**: moduleResolution → **"NodeNext"** ✅ → No penalty
- **P5**: missing .js suffix → **0 violations** → No penalty
- **P6**: Controller missing @ApiTags → **present** ✅ → No penalty
- **P7**: SessionEvent.type missing actual event types → **Fixed**: union now includes `text_delta | agent_status | tool_activity` → No penalty
- **P8**: RunEventStreamRegistry memory leak → **Fixed**: delayed cleanup (60s) after terminal events when subscriberCount=0 → No penalty

## Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 | 5/5 | 15/15 |
| D2 | 5/5 | 15/15 |
| D3 | 5/5 | 25/25 |
| D4 | 5/5 | 15/15 |
| D5 | 5/5 | 20/20 |
| D6 | 5/5 | 10/10 |

**Penalties**: -0
**总分: 100/100**

## v2 → v3 Improvements
| Issue | Category | Fix Applied |
|-------|----------|-------------|
| `SessionEvent.type` union incomplete | P7 fix | Added `text_delta`, `agent_status`, `tool_activity` to union |
| RunEventStreamRegistry memory leak | P8 fix | 60s delayed cleanup after terminal events |
| `lastEventId` NaN propagation | D4 robustness | NaN guard with fallback to `undefined` |
| Dead code `composite-emitter.ts` | Cleanup | Deleted file + removed all exports/imports |
| No event-stream tests | D6 gap | 10 new tests in `event-stream.spec.ts` |
| React useEffect dependency churn | Frontend fix | `useRef` for callbacks + split polling effect |

## What's Working Well
1. **Complete event streaming pipeline**: Session events flow from `CcaasSessionProvider → orchestrator onEvent → routingEmitter → per-run RunEventStream → SSE endpoint → frontend`. Type-safe at every boundary now that `SessionEvent.type` union matches actual emissions.
2. **Robust SSE lifecycle**: Ring buffer (200 events) enables reconnection replay, NaN-guarded `lastEventId` prevents bad reconnection state, delayed cleanup prevents memory leaks while still allowing late reconnections within 60s.
