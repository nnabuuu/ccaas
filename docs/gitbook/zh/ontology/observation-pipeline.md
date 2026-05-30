# Observation 管线

> 一节课中所有学生的 **可观察事件 + LLM 派生结论** 都写到平台的 `observations` 表。这一章解释 `Observation` 类型、5 种 type、各 handler 的输入输出、observer-engine 退役时间线。

## `Observation` —— 数据库行 + 业务事件双重身份

```typescript
interface Observation {
  id: string;             // UUID
  sessionId: string;
  entityId: string;       // 一般是 studentId（也可以是 sessionId 表示 session-level）
  solutionId: string;     // 租户隔离用
  type: string;           // 5 种 type，见下
  data: Record<string, unknown>;   // type-specific payload
  triggerEventId: string;          // 触发本 observation 的 event/correlation id（cascade 跟踪）
  createdAt: number;               // epoch ms
  updatedAt: number;               // epoch ms（cascade 重写时会变）
}
```

存储：`packages/backend/src/workflow/persistence/observation-repository.ts`（TypeORM + SQLite/PG）。包级 `@kedge-agentic/observer-engine` 只剩这个 entity 类 + 类型定义（M6.4 trimmed）。

## 5 种 type

| type | 写入者 | data 主字段 | 说明 |
|---|---|---|---|
| `lifecycle` | LifecycleObservationService (M2/M3) | `action: 'join' \| 'translate_request' \| 'discuss_complete' \| 'continue_chat_turn'` + `studentName?` | session/student 生命周期事件 |
| `exercise` | ExerciseObservationService (M3) | `step` + `score: number` (0–100) | 学生提交练习的结果 |
| `progress` | ProgressObservationService (M3) | `step` + `taskNum` + `nextTask` | 学生完成一个 step、进入下一个 |
| `indicator_hit` | ChatTurnService (M4) | `anchors: string[]` + `gist` + `quote?` + `action: 'append' \| 'update'` | LLM 把一轮 chat 分类到一个或多个 indicator |
| `student_status` | StatusChangeService (M4) | `status: 'active' \| 'struggling' \| 'stuck' \| 'idle' \| 'cruising'` + `previousStatus` + computed metrics + `alertMessage?` | 全 session 状态派生（cascade 自 indicator_hit） |

## M4 cascade 端到端

```
chat_turn event 进 events 流 (HTTP ingest OR in-process)
  ↓
ChatTurnTrigger predicate 命中 (payload.type === 'chat_turn')
  ↓
classify_chat_turn_indicators Action (LLM)
  ├─ 读 IndicatorRegistry 拿到 (solutionId, sessionId) 的 indicator 目录
  ├─ 读现有 indicator_hit observations 决定 append vs update
  ├─ LLM 调用 → 解析 {action, anchors, gist, quote}
  ├─ 过滤幻觉的 anchor（必须在已注册 indicator id 集合内）
  ├─ 写 indicator_hit observation
  └─ engine.cascadeEvent({type: 'student_observation_changed', ...})  ← 关键：cascade 入引擎
  ↓
StatusChangeTrigger predicate 命中 (payload.type === 'student_observation_changed')
  ↓
derive_student_status Action
  ├─ 读全部 observations
  ├─ 算 metrics（messageCount / misconception/knowledge count / exerciseCorrectRate / lastActiveAt）
  ├─ LLM 派生 status（若 indicator 已注册）else 启发式
  ├─ 写 OR 更新 student_status row
  └─ 若 status 转为 alertable（stuck/struggling/idle）→ publish student_alerts stream
```

## 启发式 status fallback

LLM 不可用 / 失败 / 返回错乱时，`StatusChangeService.heuristicStatus()` 用这套规则：

| 条件 | status |
|---|---|
| `Date.now() - metrics.lastActiveAt > 3 min` | `idle` |
| `misconceptionCount >= 3` | `struggling` |
| `exerciseCorrectRate >= 80%` 且 `messageCount <= 2` | `cruising` |
| 其他 | `active` |

`lastActiveAt` 只统计 ACTIVITY_TYPES = {indicator_hit, exercise, progress} 的 `createdAt`，**不含** student_status（防 cascade 自我推高）和 lifecycle（join 不算"活动"）。M4 pass-1 MF2 是这个 bug；M5 pass-2 S2 又补了 lifecycle 作为兜底降级（join-only student 不会 NaN）。

## observer-engine 退役时间线

| Phase | 状态 |
|---|---|
| M1–M2 | platform 接 ingest endpoint；live-lesson 仍单写 observer-engine |
| M3 | live-lesson **双写** observer-engine + workflow client；dashboard 仍读本地 observation 表 |
| M5.3b | dashboard cutover 到平台 projector（HTTP fetch）；本地 fallback 兜底 |
| M6.1 | live-lesson 删 `engine.dispatch` 调用（单写 workflow） |
| M6.2 | live-lesson 删 observer-engine handler 目录 + classroom.module 的 OBSERVER_ENGINE factory |
| M6.3 | live-lesson 删 ObservationQueryService + dashboard local fallback |
| M6.4 | `@kedge-agentic/observer-engine` 包砍到存储层（保 entity + 类型，删 engine/nestjs/store） |

完整 commit 记录见 `docs/ontology/PROGRESS.md`。

## 数据迁移注意事项

- 平台 `observations` 表是新表，从 M2 开始写入。
- live-lesson 本地 `observations` 表在 M6 前一直双写；M6.2 后停写，M6 pass-1 S6 移除了 entity 注册（新启动的 live-lesson DB 不再创建这两张表）。
- 现有 live-lesson 数据库保留遗留表 —— 不带迁移；DROP TABLE 由 ops 选时机执行。

## 故障排查 cheatsheet

| 现象 | 可能原因 | 排查路径 |
|---|---|---|
| Dashboard 上某学生消息数为 0 | indicator_hit 没写入；可能 IndicatorRegistry 没 push | 查 `WorkflowIndicatorPushService` 日志 + 平台 IndicatorRegistry |
| status 永远 active 不会变 idle | lastActiveAt 算上了 student_status row | M4 pass-1 MF2 / M5 pass-2 S2 已修，确认上游版本 |
| student_observation_changed cascade 没触发 status 派生 | accessor.publish 没进引擎 | M4 pass-1 MF1 已修 —— 必须用 `engine.cascadeEvent` |
| chat_turn 一直 "no indicators registered; skip" | platform IndicatorRegistry 空 | M5.3a 之前真的空；之后查 PUT `/indicators` 端点 + live-lesson `WorkflowIndicatorPushService` |
