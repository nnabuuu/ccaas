# 跨进程事件推送

> Solution backend（独立 NestJS 进程）通过 HTTP 把事件推到平台 WorkflowEngine。`@kedge-agentic/workflow-client` + outbox + 重试 + dedup 让这个通道可靠。

## 为什么要跨进程

Solution backend（如 live-lesson :3007）和平台 backend（:3001）跑在不同进程。Phase 5 之前每个 Solution 自己跑一份本地 observer-engine；Phase 5 之后引擎归一到平台侧。`@kedge-agentic/workflow-client` 是这两个进程间的稳定 HTTP 接口。

## `@kedge-agentic/workflow-client` —— framework-free 客户端

```typescript
import { WorkflowClient } from '@kedge-agentic/workflow-client';

const client = new WorkflowClient({
  baseUrl: 'http://localhost:3001',
  apiKey: process.env.CCAAS_API_KEY!,
  timeoutMs: 5000,
  // onBehalfOfSolutionId: ...,  // 可选，多 tenant 共用 admin key 时用
});

// 1. 推事件（M2 起）
await client.pushEvent('sess-123', {
  eventId: randomUUID(),                  // 用于 dedup
  manifestName: 'LessonSession',
  streamApiName: 'events',
  entityId: 'student-abc',
  payload: { type: 'student_joined', studentId: 'student-abc', classroomCode: 'HX3KM7' },
});

// 2. PUT indicators（M5.3a 起）
await client.setIndicators('sess-123', [
  { id: 'K1', type: 'knowledge', label: '...', description: '...' },
]);

// 3. GET dashboard（M5.3b 起）
const outcome = await client.getObservationDashboard('sess-123');

// 4. DELETE session（M6 pass-1/2 起）
await client.clearSession('sess-123');
```

零 NestJS，零 TypeORM，仅 `globalThis.fetch`（Node 18+）。Solution 自己用任何架构 wrap 它。

## 返回 outcome（不抛错）

`WorkflowClient.*` 全部返回 discriminated union outcome：

```typescript
type WorkflowPushOutcome =
  | { status: 'accepted'; eventId }                        // 平台接受，trigger 异步触发
  | { status: 'duplicate'; eventId }                       // 同 eventId 已见过；幂等
  | { status: 'disabled'; eventId }                        // WORKFLOW_INGEST=disabled
  | { status: 'failed'; httpStatus?; error; retryable };   // 上游 4xx/5xx/网络
```

Caller 自己处理 outcome（accepted/duplicate/disabled → mark delivered；failed retryable → backoff + 重试；failed terminal → poison 行）。

## Outbox + Drain Worker 模式（推荐）

事件不能在请求线程同步推 —— 平台短暂下线会丢事件。Live-lesson 用的模式：

```
Application service (e.g. ClassroomService.join)
  ↓ enqueue
WorkflowOutboxRepository (TypeORM 表 ontology_event_outbox)
  ↓ 持久化
WorkflowOutboxDrainService (setInterval 2s)
  ↓ findPendingDue(now, 50)
  ↓ for each row:
       client.pushEvent → outcome
       handleOutcome:
         accepted/duplicate/disabled → markDelivered
         failed retryable + nextAttempts < POISON_AFTER → markRetry + exp backoff
         failed terminal OR > POISON_AFTER → markPoisoned
```

参考：
- `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-outbox-drain.service.ts`
- `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-dispatch.service.ts`

Backoff schedule：attempt N 失败 → `min(2^(2N-1), 600)` 秒后再试；8 次后 poison（> 10 分钟）。

Re-entrancy guard：drain tick 在 flight 时，下一次 interval 跳过（防 setInterval 重叠 + 同行多写）。

## 平台 ingest endpoint：POST `/api/v1/workflow/sessions/:sessionId/events`

```
POST /api/v1/workflow/sessions/:sessionId/events
Authorization: Bearer <chat-scope key>
Content-Type: application/json

{
  "eventId": "evt_018b1d3a-...",          // 必填；dedup key
  "manifestName": "LessonSession",
  "streamApiName": "events",
  "entityId": "student-abc",
  "payload": { ... },                     // 必须匹配 stream.payloadSchema (Zod)
  "correlationId": "..."                  // 可选，跨进程 trace
}

→ 202 Accepted ({accepted: true, eventId})
→ 200 OK ({accepted: false, dropped: 'duplicate', eventId})
→ 202 ({accepted: false, dropped: 'disabled', eventId})  if WORKFLOW_INGEST != enabled
→ 400 校验失败（manifest/stream/payload schema）
```

控制器内部顺序：
1. `@Auth('chat')` + `@TenantId()` （没 tenant → 抛）
2. 校验 manifest + stream + payload schema （Zod）
3. dedup：`observerEvents.hasEvent(eventId)` 先查；并发 race 时 unique-constraint catch 兜底
4. 持久化 `observer_events` 行（**先于** engine.ingestEvent —— 中途崩溃靠 dedup 重放）
5. `WORKFLOW_INGEST=enabled` 时 fire-and-forget `engine.ingestEvent(...)`

## Auth + tenant 模型

- `@Auth('chat')` —— chat-scope API key
- `@TenantId()` —— 解析出当前 key 的 tenant UUID；进 `event.solutionId` 字段
- Solution 配置：`CCAAS_API_KEY` + `CCAAS_URL` 在 Solution backend 的 env

Solution-scope key 推荐做法：用 `scripts/create-dev-api-key.ts <slug>` 给每个 Solution 单独 mint 一个 chat-scope key，绑定到 Solution 自己的 tenant。Admin-scope key 不要塞到 Solution env（可以 PUT/DELETE 任意 tenant 数据）。

## metrics

`WorkflowMetricsService` 计数器（参见 [Trigger + Workflow 引擎](trigger-and-workflow-engine.md) §故障模式）。HTTP ingest 触发：`events_dropped_duplicate` / `triggers_fired` / `triggers_action_failed`。

## 相关 endpoint 总览

| Endpoint | 方法 | 用途 | 章节 |
|---|---|---|---|
| `/api/v1/workflow/sessions/:id/events` | POST | 事件 ingest | 本页 |
| `/api/v1/workflow/sessions/:id/indicators` | PUT | indicator 目录 | [Indicator 目录](indicator-catalog.md) |
| `/api/v1/workflow/sessions/:id` | DELETE | session 生命周期 | [Session 生命周期](session-lifecycle.md) |
| `/api/v1/workflow/sessions/:id/observation-dashboard` | GET | dashboard (legacy) | [Dashboard 契约](dashboard-contract.md) |
| `/api/v1/workflow/sessions/:id/dashboard` | GET | dashboard (新) | [Dashboard 契约](dashboard-contract.md) |
| `/api/v1/ontology/schema` | GET | ontology schema digest + ETag | (Phase 3) |
