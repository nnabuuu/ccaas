# Dashboard 契约

> 一个 dashboard endpoint，一种 wire shape。M5.2a 之前是两个 endpoint 并存（legacy projector + 新 ontology-native）；M5.2a 删了 legacy。本章描述当前 `/dashboard` endpoint 的 `DashboardPayload`，以及 live-lesson 前端 M5.2b 改写前的 Solution-side 适配层。

## 当前 endpoint

| Endpoint | 方法 | shape |
|---|---|---|
| `GET /api/v1/workflow/sessions/:id/dashboard` | GET | `DashboardPayload`（学生中心化） |

读自同一份 `observations` 表 + 同一份 IndicatorRegistry，按 `(solutionId, sessionId)` 做租户隔离。

> **历史：** M3 ship 了 legacy `/observation-dashboard` 端点 + `ObservationDashboardProjector`，emit `{logs, alerts, indicatorStats, indicators}`。M5.2 加了新 `/dashboard` endpoint。M5.2a 删了 legacy；live-lesson 前端继续读 4-array shape，由 Solution 端 `DashboardPayloadAdapter` 临时转换（M5.2b 删除）。

## Solution-side 适配层 (transitional, M5.2a → M5.2b)

live-lesson 后端的 `WorkflowDashboardFetchService` 拉新 endpoint 后过 `DashboardPayloadAdapter`：

```typescript
client.getDashboard(sessionId)
  → outcome.payload  (unknown)
  → parseDashboardPayload(payload)  → DashboardPayload | null
  → adaptDashboardPayload(payload)  → { logs, alerts, indicatorStats, indicators }
  → return to frontend via /api/classroom/:code/state
```

`DashboardPayloadAdapter`（`solutions/business/live-lesson/backend/src/adapters/workflow-outbox/dashboard-payload-adapter.ts`）做四件事：

1. **派生 logs[]** —— 把 `students[].observations[]` 平铺成 legacy `StudentLog.events[]`，按 type 渲染 Chinese gist
2. **派生 alerts[]** —— 过滤 `status.current ∈ {stuck, struggling, idle}` 的 student → 单条 Alert
3. **groupBy indicatorStats[]** —— 把所有 `indicator_hit` 按 anchor 聚合
4. **filter indicators[]** —— 把平台开放的 `type: string` 收窄成 `'knowledge' | 'misconception'` 联合（防御性，未来 schema 进化时不会漂）

**Gist 渲染表**（lifted from 已删除的 `ObservationQueryService`，恢复了 M6.3 删除时丢失的同步）：

| obs.type | data.action | Template |
|---|---|---|
| `lifecycle` | `join` | `${studentName} 加入课堂` |
| `lifecycle` | `leave` | `${studentName} 离开课堂` |
| `lifecycle` | `translate_request` | `查词：${data.text}` |
| `lifecycle` | `discuss_complete` | `完成讨论` |
| `lifecycle` | `continue_chat_turn` | `继续追问` |
| `exercise` | n/a | `提交 Step ${step} 答案，得分 ${score}%` |
| `progress` | n/a | `完成 Task ${taskNum}，进入 Task ${nextTask}` |
| `indicator_hit` | n/a | `data.gist`（LLM 出的，pass-through） |
| `student_status` | — | **不进 events**，仅 driver alert |
| 任意其他 | — | `obs.type`（fallback；保证不 undefined） |

M5.2b 前端改写后，这个文件 + 它的 spec 直接删掉。

## Legacy shape（历史，仅由 adapter 内部使用）

M5.2a 之前的 wire shape。`ObservationDashboardProjector` 删除后，这个 shape 只在 live-lesson 后端 → 前端 之间的 `state.observation` 字段里存在（adapter 派生）。

```typescript
interface ObservationDashboardPayload {
  logs: StudentLog[];                  // 每学生一行：事件 timeline + system metrics
  alerts: Alert[];                     // 扁平化的告警列表（severity: info/warn/urgent）
  indicatorStats: IndicatorStats[];    // 每 indicator 一行：触发学生数、最近 gist、updatedAt
  indicators: IndicatorCatalogEntry[]; // session indicator 目录
}

interface StudentLog {
  studentId: string;
  studentName: string;                 // 从 join lifecycle 取
  events: StudentEvent[];
  systemMetrics: {
    messageCount: number;
    lastActiveAt: number | null;
    exerciseCorrectRate: number | null;
    currentStep: number | null;
  };
  status?: string;
}
```

**为什么 alerts 是平铺数组（而非每学生筛）：** legacy 前端期望扁平化 alert 列表（教师面板顶部 banner）。adapter 在 `adaptDashboardPayload` 内同时产出 alert，让前端不用再筛一遍。

**为什么 indicatorStats 是单独字段：** legacy 前端期望 indicator 维度的统计（每个 indicator 命中了多少学生），不需要重新 groupBy `indicator_hit` 行。

## 新 shape: `DashboardPayload`（当前 wire shape）

```typescript
interface DashboardPayload {
  sessionId: string;
  indicators: DashboardIndicatorDef[];  // session 目录
  students: DashboardStudentSlice[];    // 学生中心化的视图
  generatedAt: number;
}

interface DashboardStudentSlice {
  studentId: string;
  studentName: string;
  status: DashboardStudentStatus | null;   // 派生状态 + 转换前 status
  metrics: DashboardStudentMetrics;        // 与 status row 内 metrics 同义
  observations: DashboardObservationView[]; // 原始行（按 createdAt ASC）
}
```

**和 legacy 的关键差异：**

| Legacy | 新 |
|---|---|
| `logs[]` 平铺 + `alerts[]` 平铺 + `indicatorStats[]` 平铺 + `indicators[]` 平铺 | `students[]` 一个数组，按 student 聚合 status + metrics + observations |
| `events[]` 是已经"翻译"过的 StudentEvent（带 Chinese gist 等） | `observations[]` 是原始 Observation 行；前端自己渲染 |
| `alerts` 单独平铺 | filter students by `status.current in [stuck, struggling, idle]` |
| `indicatorStats` 算好 | 前端按 indicator_hit row 自己 groupBy（少数 case 需要） |

新 shape 一次取所有数据；前端有更多自由决定如何 render。

### 一图看结构变化（4 个平铺 vs 1 棵学生 tree）

```
Legacy: 4 个 sibling 数组，前端要 JOIN
GET /api/v1/workflow/sessions/:id/observation-dashboard

   ObservationDashboardPayload
   ├── logs[]                                ◀── per-student
   │     { studentId, studentName, events[], systemMetrics, status }
   │
   ├── alerts[]                              ◀── per-alert (扁平)
   │     { studentId, studentName, severity, message, indicatorId }
   │
   ├── indicatorStats[]                      ◀── per-indicator
   │     { indicatorId, label, type, studentCount, latestGist }
   │
   └── indicators[]                          ◀── session catalog
         { id, type, label, description }

   想拼出某学生的完整画像？
     1. logs.find(l => l.studentId === X)
     2. alerts.filter(a => a.studentId === X)
     3. indicatorStats 不按 student 索引 → 看 logs[X].events 里有哪些 anchor
     4 个数组、3 次 join、前端自己粘合


New: 1 students 树，无 join
GET /api/v1/workflow/sessions/:id/dashboard

   DashboardPayload
   ├── sessionId
   ├── generatedAt
   ├── indicators[]                          ◀── session catalog（仍是 flat）
   │     { id, type, label, description }
   │
   └── students[]                            ◀── 学生中心化的 tree
         {
           studentId, studentName,
           status: {                          ◀── 嵌进 student
             current: 'struggling',
             previous: 'active',
             derivedAt, summary, alertMessage,
           },
           metrics: {
             messageCount, knowledgeCount, misconceptionCount,
             exerciseCorrectRate, lastActiveAt, currentStep,
           },
           observations: [                    ◀── 原始 row（不是翻译过的 StudentEvent）
             { id, type, data, createdAt, ... },
             ...
           ],
         }

   想拼出某学生的完整画像？
     students.find(s => s.studentId === X)     完事
```

**等价导出：** 如果前端代码还想保持 legacy 风格的 4 个数组用法（M5 second pass 之前），可以从新 shape 一次性派生：

```typescript
const logs           = payload.students;
const alerts         = payload.students.filter(s =>
                          ['stuck', 'struggling', 'idle']
                          .includes(s.status?.current ?? ''));
const indicatorStats = groupBy(payload.students.flatMap(s =>
                          s.observations.filter(o => o.type === 'indicator_hit')
                       ), o => o.data.anchors);
const indicators     = payload.indicators;
```

## 何时用哪个

- **新 Solution 接入：** 直接用新 `/dashboard` endpoint + 自家前端按 `DashboardPayload` 渲染。
- **live-lesson（现状）：** 后端 `WorkflowDashboardFetchService` 拉新 endpoint，由 `DashboardPayloadAdapter` 派生 legacy 4-array shape 给前端消费。**等 M5.2b 前端改写后** adapter + 这份历史 shape 一起删除。

## 度量算法（两份 implementations 必须一致）

`DashboardService.computeMetrics` + `StatusChangeService.computeMetrics` 两个地方都算 metrics。**必须一致**，否则 dashboard 显示和 status 派生会漂移。（M5.2a 之前 `ObservationDashboardProjector` 还有第三份，删除后只剩这两份。）

- `messageCount` = count(indicator_hit rows)
- `misconceptionCount` = sum(anchors.filter(a => a.startsWith('M')).length) over indicator_hit
- `knowledgeCount` = 同上 K
- `exerciseCorrectRate` = round(avg(exercise.score)) ；空集 = null
- `lastActiveAt` = max(createdAt over ACTIVITY_TYPES = {indicator_hit, exercise, progress}) ；空 → 取 lifecycle 兜底；都空 → null

M5 pass-2 S2 把 ACTIVITY_TYPES 抽 const 化的 backlog 仍 outstanding（三份 copy 容易漂）。

## Auth 模型

- `@Auth('chat')` —— chat-scope key
- `@TenantId()` 必须解析出 solutionId —— 400 否则
- session 的 observations 行 **不按 tenant 过滤**：`DashboardService` 用 sessionId 直接查 `getBySession`，因为 sessionId 是 UUID 全局唯一
- IndicatorRegistry 按 `(solutionId, sessionId)` 元组隔离 —— 见 [Session 生命周期](session-lifecycle.md) §租户隔离

**潜在 future hardening：** 如果 sessionId 不能保证全局唯一，应在 controller 层加 session ownership check。今天不需要 because UUID。

## 相关文件

| File | 职责 |
|---|---|
| `packages/backend/src/workflow/handlers/dashboard/dashboard.service.ts` | 产 `DashboardPayload` |
| `packages/backend/src/workflow/handlers/dashboard/dashboard.controller.ts` | `GET /dashboard` endpoint |
| `packages/backend/src/workflow/handlers/dashboard/dashboard-payload.types.ts` | wire shape 类型 + 设计 note |
| `packages/workflow-client/src/index.ts` `getDashboard` | client 端 HTTP 拉 |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-dashboard-fetch.service.ts` | Solution 侧 wrapper |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/dashboard-payload-adapter.ts` | **过渡期**：新 → legacy 4-array shape 派生 + gist 渲染（M5.2b 删除） |
