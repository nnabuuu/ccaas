# Trigger + Workflow 引擎

> Phase 5 引入的 Palantir-Carbon 风格 **声明式触发层**：声明 TriggerDef + ActionDef，让平台 WorkflowEngine 在事件 / 状态变更 / 对象集变化时自动调度 Action。

## TriggerDef — 三种触发方式

```typescript
type TriggerDef =
  | { kind: 'event';        watch: { stream } }
  | { kind: 'state-change'; watch: { state; equals?; transitionsTo? } }
  | { kind: 'object-set-change'; watch: { objectSet; on: 'added'|'removed'|'any' } };
```

每种 TriggerDef 都包含：

- `apiName` / `manifest` / `semantic` —— 声明属性
- `watch` —— 监听什么（stream 名 / state 路径 / ObjectSet 名）
- `when?` —— 可选的纯函数 predicate（O(1) 过滤，predicate 内不构建 accessor）
- `then.action: ActionRef` —— 命中后调度哪个 ActionDef
- `then.args: (input) => Record<string, unknown>` —— input → action params 的纯映射
- `then.as?` —— 默认 `'agent'` role，可改为 `'admin'`
- `cascadeBudget?` / `priority?` —— 可选 cascade 深度上限 / 调度优先级

### event 触发

最常用。当某 stream 收到 payload 时，predicate 通过则触发 action。

```typescript
const CHAT_TURN_TRIGGER: TriggerDef = {
  apiName: 'on_chat_turn_classify_indicators',
  manifest: 'LessonSession',
  semantic: '收到 chat_turn 时，用 LLM 分类匹配 indicators。',
  kind: 'event',
  watch: { stream: 'events' },
  when: (input) => (input.event?.payload as any)?.type === 'chat_turn',
  then: {
    action: 'workflow-actions-chat-turn.classify_chat_turn_indicators',
    args: (input) => ({
      entityId: (input.event!.payload as any).studentId,
      student: (input.event!.payload as any).student,
      ai: (input.event!.payload as any).ai,
      triggerEventId: input.cascade.correlationId,
    }),
    as: 'admin',
  },
};
```

### state-change 触发

当 manifest 的某 state field 写入时触发。可选 `equals` / `transitionsTo` 收窄。

### object-set-change 触发 (Phase 4)

当 ObjectSetDef 命中的对象集变化（添加 / 删除 / 任意）时触发。Phase 4 ship 了 ObjectSetDef + SetFilter 但 trigger kind 还没有真实消费者；保留 schema + bootstrap warn-skip。

## WorkflowEngine 调度流程

`WorkflowEngineService` 在 `onApplicationBootstrap` 注册 trigger（通过 `@WorkflowTrigger(def)` 装饰器或 `engine.registerTrigger(def)` 编程式 API），然后在两类入口接事件：

1. **HTTP ingest** (`POST /api/v1/workflow/sessions/:id/events`) —— 跨进程入口
2. **In-process cascade** (`engine.cascadeEvent(...)`) —— Action handler 内部触发的下游事件

不论入口，都走相同 dispatch 流水线：

```
input event
  ↓
WorkflowRegistry.lookup(manifest, {kind, stream/state/objectSet})
  ↓
对每个匹配 trigger:
  ↓ predicate(input) — 失败则 metrics inc + 跳过
  ↓ then.args(input) — 计算 action 参数
  ↓ getAccessorFor({sessionId, solutionId, manifest, role}) — 构建带 boundary 的 ManifestAccessor
  ↓ accessor.invokeAction(action, args) — 进 Phase 3 桥 / ToolCallerProxy / boundary check / audit
  ↓ 写入 observation row / 发 stream 事件 / 触发 cascade
```

## Cascade — 一次调度的连锁反应

ChatTurnService 写完 `indicator_hit` 后调 `engine.cascadeEvent(...)` 把事件再喂回引擎。StatusChangeTrigger 命中 → 重新派生 student_status → 发 student_alerts。下面是 M4 实际跑起来的完整链路：

```
   外部 HTTP ingest                   或同进程发起
   POST /workflow/.../events
            │
            ▼
   ┌─────────────────────────────┐
   │ engine.ingestEvent          │  ◀── withRootCascade(stream)
   │   depth = 0                 │      新建 correlationId
   │   payload.type = chat_turn  │
   └────────────┬────────────────┘
                │
                ▼  WorkflowRegistry.lookup(manifest, kind=event, stream=events)
                │  per-session FIFO enqueueDispatch
                ▼
   ┌─────────────────────────────┐
   │ ChatTurnTrigger             │
   │   when(input) → true        │
   └────────────┬────────────────┘
                │ predicate 命中
                ▼
   ┌─────────────────────────────┐
   │ classify_chat_turn_         │  ◀── 走 Phase 3 桥:
   │ indicators Action  (LLM)    │      ToolCallerProxy + boundary + audit
   │   ├─ writes indicator_hit   │
   │   └─ engine.cascadeEvent ───┼─┐
   └─────────────────────────────┘ │ withChildCascade
                                   │   depth = 1
                                   │   correlationId 保持
                                   ▼
                          ┌──────────────────────────────┐
                          │ StatusChangeTrigger          │
                          │  when payload.type ===       │
                          │    student_observation_      │
                          │    changed                   │
                          └────────────┬─────────────────┘
                                       │ predicate 命中
                                       ▼
                          ┌──────────────────────────────┐
                          │ derive_student_status        │
                          │ Action  (LLM 或启发式)        │
                          │   ├─ writes student_status   │
                          │   └─ accessor.publish        │  ◀── student_alerts
                          │      (subscribers only,       │      是终点
                          │       不再进引擎)             │
                          └──────────────────────────────┘
```

### Cascade 深度 + ceiling

| 帧 | 怎么进 | depth |
|---|---|---|
| 根 | `engine.ingestEvent` (HTTP) 或 `engine.cascadeEvent` (in-process root) | 0 |
| 子 | Action handler 内调 `engine.cascadeEvent` | 父 +1 |
| 跌出 | `depth >= cascadeBudget ?? maxCascadeDepth` (默认 5) | 该 trigger 丢弃 + `cascade_depth_exceeded` 计数 |

深度通过 Node `AsyncLocalStorage`（`cascade-context.ts` 的 `withChildCascade` / `withRootCascade`）跟踪；`correlationId` 横跨整条 cascade 不变，方便审计串联。

### 关键陷阱：`cascadeEvent` vs `accessor.publish`

| 用法 | 谁会触发 | 适合做什么 |
|---|---|---|
| `engine.cascadeEvent(...)` | 进入引擎调度（命中 event-kind triggers）+ 同时 publish 到 subscribers | Action handler 内发起下游事件，希望触发后续 trigger |
| `accessor.publish(...)` | 只 fanout 到 subscribers，**不进引擎** | 发 stream 给前端 SSE / debug console / 不需要后续 trigger 的事件（如 `student_alerts`） |

**M4 pass-1 MF1 就是踩了这个：** 当时 ChatTurnService 用 `accessor.publish` 发 `student_observation_changed`，结果 StatusChangeTrigger 永远没触发；前端看不出来，因为 `accessor.publish` 还是把事件给了 subscribers。修复后 `cascadeEvent` 走 `withChildCascade` 保留 depth tracking。如果你的下游事件需要 trigger 反应——一定用 `cascadeEvent`。

## Per-Session FIFO 队列 + 回压

每个 sessionId 一个 tail-promise 队列，保证同 session 的 trigger 顺序执行（避免两个 cascade 同时改 student_status 行）；不同 session 之间并发。

容量 `maxQueuePerSession = 100`；超出后 `drop_oldest`（匹配 stream 的 `backpressure` 声明）+ `events_dropped_queue_full` metrics 计数。

## 注册触发器

两种方式：

**装饰器（推荐用于单一 ActionDef 的 service）**：

```typescript
@Injectable()
@WorkflowTrigger(CHAT_TURN_TRIGGER)
export class ChatTurnService implements OnApplicationBootstrap { ... }
```

`WorkflowEngineService.discoverDecoratorTriggers()` 在 bootstrap 时扫描所有 `@Injectable()` provider 的 metadata。

**编程式（推荐用于多 trigger 的 service）**：

```typescript
async onApplicationBootstrap() {
  this.engine.registerTrigger(CHAT_TURN_TRIGGER);
  this.engine.registerTrigger(STATUS_CHANGE_TRIGGER);
}
```

参考：[`packages/backend/src/workflow/handlers/`](../../../../packages/backend/src/workflow/handlers/) 下的 5 个 service 各自注册 trigger。

## 故障模式 + 观测

`WorkflowMetricsService` 计数器（process-lifetime）：

| Counter | 含义 |
|---|---|
| `triggers_fired` | trigger 被分发的总次数 |
| `triggers_predicate_rejected` | predicate 返回 false 或抛错 |
| `triggers_action_failed` | action invoke 失败（boundary / validation / handler error） |
| `triggers_action_not_found` | action 在 ToolCallerRegistry 找不到（通常 namespace 配置漏） |
| `cascade_depth_exceeded` | cascade depth >= ceiling → 触发被丢弃 |
| `events_dropped_queue_full` | per-session queue 满 → drop_oldest |
| `events_dropped_duplicate` | HTTP ingest dedup 命中 |

## 实现源码地图

| 文件 | 职责 |
|---|---|
| `workflow-engine.service.ts` | 主调度器；event/state-change 路由；cascade；队列 |
| `workflow-registry.ts` | trigger 索引 Map，按 (manifest, kind, watchKey) 查找 |
| `cascade-context.ts` | AsyncLocalStorage 包装；`withChildCascade` / `withRootCascade` |
| `workflow-metrics.service.ts` | 计数器 + reset for test |
| `event-ingest/event-ingest.controller.ts` | `POST /workflow/sessions/:id/events` |
| `indicator-ingest/indicator-ingest.controller.ts` | `PUT /workflow/sessions/:id/indicators` |
| `session-lifecycle/session-lifecycle.controller.ts` | `DELETE /workflow/sessions/:id` (M6 pass-2) |
| `handlers/` | 6 个 handler service（lifecycle / exercise / progress / chat-turn / status-change / dashboard projector） |
