# Dashboard 契约

> 两个 dashboard endpoint，两种 wire shape：legacy projector + 新 ontology-native。这一章告诉你各自返回什么、何时用哪个、过渡如何收尾。

## 两个 endpoint 并存

| Endpoint | 方法 | shape | 状态 |
|---|---|---|---|
| `GET /api/v1/workflow/sessions/:id/observation-dashboard` | M3 / 现役 | `{logs, alerts, indicatorStats, indicators}` (legacy) | live-lesson 前端读这个 |
| `GET /api/v1/workflow/sessions/:id/dashboard` | M5.2 / 待消费 | `DashboardPayload`（学生中心化） | 等 M5 second pass 前端改写 |

两个 endpoint 都从同一份 `observations` 表 + 同一份 IndicatorRegistry 读取；只是 wire shape 不同。

## Legacy shape: `ObservationDashboardPayload`

```typescript
interface ObservationDashboardPayload {
  logs: StudentLog[];                  // 每学生一行：事件 timeline + system metrics
  alerts: Alert[];                     // 扁平化的告警列表（severity: info/warn/urgent）
  indicatorStats: IndicatorStats[];    // 每 indicator 一行：触发学生数、最近 gist、updatedAt
  indicators: IndicatorCatalogEntry[]; // session indicator 目录（M6.3 增）
}

interface StudentLog {
  studentId: string;
  studentName: string;                 // 从 join lifecycle 取（M5 pass-1 MF1 修）
  events: StudentEvent[];
  systemMetrics: {
    messageCount: number;
    lastActiveAt: number | null;       // ACTIVITY_TYPES + lifecycle fallback（M5 pass-2 S2）
    exerciseCorrectRate: number | null;
    currentStep: number | null;
  };
  status?: string;                     // M4 student_status row 的 status 字段
}
```

由 `ObservationDashboardProjector.project(solutionId, sessionId)` 生成（M5 pass-1 MF3 后强制 tenant 传入）。

**为什么有 alerts 字段（已经在 StudentLog.status）：** legacy 前端期望扁平化 alert 列表（教师面板顶部 banner）。projector 在 buildStudentLog 阶段同时产出 alert，让前端不用再筛一遍。

**为什么 indicatorStats 是单独字段：** legacy 前端期望 indicator 维度的统计（每个 indicator 命中了多少学生），不需要重新 groupBy `indicator_hit` 行。

## 新 shape: `DashboardPayload`

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

- **现在 / live-lesson 现役：** legacy。`WorkflowDashboardFetchService` 用 `WorkflowClient.getObservationDashboard` 拉，3 个 teacher tab 直接消费。
- **M5 second pass 之后：** 改写 3 个 teacher tab 消费 `DashboardPayload`；删 `ObservationDashboardProjector` + `/observation-dashboard` endpoint。当前没排期，PROGRESS.md 标了 outstanding。
- **新 Solution 接入：** 直接用新 shape；legacy 是为了 live-lesson migration 留的。

## 度量算法（两份 implementations 必须一致）

`DashboardService.computeMetrics` + `ObservationDashboardProjector.buildStudentLog` + `StatusChangeService.computeMetrics` 三个地方都算 metrics。**必须一致**，否则 dashboard 显示和 status 派生会漂移。

- `messageCount` = count(indicator_hit rows)
- `misconceptionCount` = sum(anchors.filter(a => a.startsWith('M')).length) over indicator_hit
- `knowledgeCount` = 同上 K
- `exerciseCorrectRate` = round(avg(exercise.score)) ；空集 = null
- `lastActiveAt` = max(createdAt over ACTIVITY_TYPES = {indicator_hit, exercise, progress}) ；空 → 取 lifecycle 兜底；都空 → null

M5 pass-2 S2 把 ACTIVITY_TYPES 抽 const 化的 backlog 仍 outstanding（三份 copy 容易漂）。

## Auth 模型

两个 endpoint 都：

- `@Auth('chat')` —— chat-scope key
- `@TenantId()` 必须解析出 solutionId —— 400 否则
- session 的 observations 行 **不按 tenant 过滤**：projector 用 sessionId 直接查 `getBySession`，因为 sessionId 是 UUID 全局唯一

**潜在 future hardening：** 如果 sessionId 不能保证全局唯一，应在 controller 层加 session ownership check（"这个 sessionId 真的属于我的 tenant 吗"）。今天不需要 because UUID。

## 相关文件

| File | 职责 |
|---|---|
| `packages/backend/src/workflow/handlers/dashboard/observation-dashboard.projector.ts` | legacy projector |
| `packages/backend/src/workflow/handlers/dashboard/observation-dashboard.controller.ts` | legacy GET endpoint |
| `packages/backend/src/workflow/handlers/dashboard/dashboard.service.ts` | 新 projector |
| `packages/backend/src/workflow/handlers/dashboard/dashboard.controller.ts` | 新 GET endpoint |
| `packages/backend/src/workflow/handlers/dashboard/dashboard-payload.types.ts` | 新 shape 类型 + 设计 note |
| `packages/workflow-client/src/index.ts` `getObservationDashboard` | client 端 fetch（legacy shape） |
| `solutions/business/live-lesson/backend/src/adapters/workflow-outbox/workflow-dashboard-fetch.service.ts` | Solution 侧 wrapper + 防御性 narrowPayload |
