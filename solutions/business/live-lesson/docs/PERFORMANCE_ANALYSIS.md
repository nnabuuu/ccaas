# Live-Lesson 后端性能分析报告

> **场景**: 40 名学生 + 1 名教师，教育网 → 阿里云，REST polling 每 3 秒
> **日期**: 2026-05-14
> **状态**: 分析完成，待团队评审

---

## 1. 场景描述

### 1.1 网络拓扑

```
┌─────────────┐    教育网        ┌──────────┐   公网    ┌──────────────┐
│  学校机房     │ ──── CERNET ───→│ 出口网关  │ ───────→ │  阿里云 ECS   │
│  40台 Win7   │   RTT 30-80ms   │          │  10-30ms │  NestJS+SQLite│
│  Chrome 80+  │                 └──────────┘          └──────────────┘
└─────────────┘
     ↑ 教师机也在同一局域网
```

### 1.2 延迟特征

| 路径段 | 典型 RTT | 最差 RTT | 说明 |
|--------|---------|---------|------|
| 校园 LAN → 教育网出口 | 5-15ms | 50ms | 校内拥塞时段波动大 |
| CERNET → 公网穿越 | 20-60ms | 150ms | NAT + 跨运营商 |
| 公网 → 阿里云 | 5-15ms | 30ms | 同区域相对稳定 |
| **端到端** | **30-90ms** | **230ms** | 叠加 DNS、TLS |

**关键约束**: 教育网出口带宽有限，高峰期丢包率可达 2-5%，客户端可能触发自动重试。

### 1.3 流量模型

```
教师端: 1 客户端 poll GET /:code/state 每 3s = ~0.33 req/s
  请求体: ~200 bytes
  响应体: ~15-40 KB (取决于学生数 × 步骤数)

学生端: 40 客户端 poll GET /sessions/:code 每 3s = ~13 req/s
  请求体: ~100 bytes
  响应体: ~200 bytes (仅 session status)
  注: 学生 polling 在 session 变为 active 后停止

总带宽: 0.33 × 40KB + 13 × 0.2KB = ~16 KB/s 下行
         0.33 × 200B + 13 × 100B  = ~1.4 KB/s 上行
```

叠加 AI 请求（`/ai/ask`, `/ai/discuss`）和提交（`/submit`），峰值可达 18-20 req/s。

---

## 2. 瓶颈分析

按严重程度排序。每个瓶颈附代码位置和量化影响。

### B1 (Critical): `getState()` 无缓存，每次 polling 重算全部

**位置**: `backend/src/classroom/classroom-state.service.ts` L92-296

每次 `GET /:code/state` 调用触发:

| 步骤 | 行号 | 操作 | 复杂度 |
|------|------|------|--------|
| 1 | L93-96 | `studentRepo.find({ sessionId })` | O(n) 全表扫描 |
| 2 | L98-100 | `submissionRepo.find({ sessionId, phase: 'exercise' })` | O(n×m) 全表扫描 |
| 3 | L117 | `sessionRepo.findOne({ id })` | O(1) 主键 |
| 4 | L139-142 | `aiQuestionRepo.find({ sessionId })` | O(q) 全表扫描 |
| 5 | L180 | `clusterAggregator.restoreIfNeeded()` | DB 恢复（首次） |
| 6 | L287 | `observationQuery.getObservationDashboard()` | O(obs) 全表扫描 |

之后是 **全量重算**:
- L144: `computeStudentDurations()` — O(students × steps)
- L153: `buildStepMetrics()` — O(students × steps × dimensions)
- L156-158: `computeStudentStatus()` per student
- L161-165: `computeAlertTag()` per task
- L167: `computeHealthCards()` — O(students)

**量化影响**:
- 4-5 个 DB 查询（无并行化，串行执行）
- ~2,500 次 Map/Array 操作 per poll
- 教师端 ~0.33 req/s × ~300ms/req = **~100ms 阻塞时间/秒**（getState 负载较低）
- 学生端 ~13 req/s 走轻量 `GET /sessions/:code`（仅查 status，不触发 getState）

### B2 (Critical): 关键表缺少数据库索引

**位置**: 各 entity 文件

| 表 | 文件 | 缺失索引 | 被 polling 命中 |
|----|------|----------|----------------|
| `reading_students` | `entities/student.entity.ts` | `sessionId` | 每 3s，全表扫描 |
| `reading_submissions` | `entities/submission.entity.ts` | `(sessionId, phase)` | 每 3s，全表扫描 |
| `reading_ai_questions` | `entities/ai-question.entity.ts` | `(sessionId, askedAt)` | 每 3s，全表扫描 |
| `classroom_sessions` | `entities/classroom-session.entity.ts` | `(status, endedAt)` | 清理任务 |
| `discuss_highlights` | `entities/discuss-highlight.entity.ts` | `(sessionId, detectedAt)` | coaching 恢复 |
| `discuss_target_hits` | `entities/discuss-target-hit.entity.ts` | `(sessionId, hitAt)` | coaching 恢复 |

**已有索引的表** (无需修改):
- `chat_messages`: `@Index(['sessionId'])` ✓
- `classroom_snapshots`: `@Index(['sessionId', 'capturedAt'])` ✓

**量化影响**: 无索引时 SQLite 全表扫描，每个查询额外 7-14ms。索引缺失影响所有走 sessionId 查询的端点（getState、submit、join 等），总计 ~14 req/s × 10ms = **~140ms/s 额外阻塞**。

### B3 (High): `buildStepMetrics()` 每次从零重算

**位置**: `backend/src/classroom/metrics-aggregator.ts` L17-174

```
Hot loop (L30-84):
for taskNum = 1..maxTask:        // 8 tasks
  for student in students:       // 40 students
    lookup submission            // Map.get
    aggregate dimensions         // 3 dimensions × get/set
    aggregate attempts           // get/set
    collect durations            // push
```

单次调用: 8 × 40 × ~8 ops = **~2,560 次操作**。

额外计算:
- L122-129: `durations.sort()` per task — O(n log n) × 8
- L132: `questions.filter(q => q.step === stepIdx)` per task — O(tasks × questions)
- L162-165: `computeAlertTag()` per task — O(tasks × students)

**无缓存，无 dirty 检测** — 即使数据未变也全量重算。

### B4 (High): `getObservationDashboard()` 每次重建

**位置**: `backend/src/classroom/observation/observation-query.service.ts` L40-51, L58-71

每次 `getState()` 调用触发 L287:
```typescript
await this.observationQuery.getObservationDashboard(sessionId)
```

内部执行:
1. `loadGroupedObservations()` — `observationRepo.find({ sessionId })` 全表扫描
2. `buildStudentLogs()` — 遍历所有 observation 记录
3. `buildAlerts()` — 二次遍历
4. `computeIndicatorStats()` — 三次遍历 + idle/struggle/cruising 检测

**量化**: 假设 500 条 observation 记录/session，~0.33 req/s（仅教师 poll）× 500 × 3 passes = **~500 次记录扫描/秒**。

### B5 (High): N+1 问题 — 重复过滤 questions 数组

**位置**: `classroom-state.service.ts` L224, L232

```typescript
// Per student × per step — 重新遍历 questions 数组:
aiRoundsCount: questions.filter(q => q.studentId === s.id && q.step === stepNum).length
```

这个过滤在 `metrics-aggregator.ts` L132 已经做过一次。

**量化**: 40 students × 8 steps × N questions = O(320N) 次 filter 操作/poll。当 N=100 时，每次 poll 32,000 次无谓遍历。

### B6 (Medium): `better-sqlite3` 单线程同步 I/O

**位置**: `backend/src/typeorm/typeorm.module.ts` L17-23

```typescript
TypeOrmModule.forRoot({
  type: 'better-sqlite3',
  database: path.resolve(process.cwd(), 'data/live-lesson.db'),
  synchronize: process.env.NODE_ENV !== 'production',
  logging: false,
})
```

`better-sqlite3` 特性:
- **同步阻塞**: 所有 DB 操作阻塞 Node.js 事件循环
- **无连接池**: 单文件、单线程访问
- **WAL 模式**: 允许并发读，但写操作仍串行

getState ~0.33 req/s × 4 queries × ~5ms/query + 学生端 ~13 req/s × 1 query × ~2ms = **~33ms/s 事件循环阻塞** (仅 DB I/O)。

### B7 (Medium): `fs.readFileSync()` 阻塞事件循环

**位置**: `classroom-state.service.ts` L353-357

```typescript
const diskPath = path.resolve(process.cwd(), '../data/lessons', lessonId, 'manifest.json');
if (fs.existsSync(diskPath)) {
  const diskManifest = JSON.parse(fs.readFileSync(diskPath, 'utf-8'));
```

Manifest cache miss 时同步读文件。大 manifest (500KB+) 可阻塞事件循环 10-50ms。

**触发频率**: 低（60s TTL 缓存命中率高），但首次加载或 TTL 过期时影响所有并发请求。

### B8 (Medium): LLM 调用无统一超时

**位置**: `backend/src/classroom/ai-prompt-builder.ts` L472-518

| 调用方 | 超时 | 风险 |
|--------|------|------|
| `AiAskService` L58, L61 | **无** | 教育网抖动时无限挂起 |
| `DiscussService` L83-85 | **无** | 同上 |
| `ClusterClassifier` L124 | 3s | ✓ 已设 |
| `PersonalizationService` L115 | **无** | 低频但仍危险 |
| `PersonalizationService` L297 | 5s | ✓ 已设 |
| `parseOrRepairDiscussResponse()` L420 | **无** | JSON 修复重试无限等待 |

**影响**: 教育网到 DeepSeek API 的链路不稳定时，无超时的 LLM 调用可能挂起 30s+，占用连接和内存。

### B9 (Low): 提交同步阻塞评分

**位置**: `backend/src/classroom/student-submission.service.ts` L60-84

`POST /:code/submit` → `gradeSubmission()` 同步执行。

`select-evidence` 类型: O(evidence_items × sections × paragraphs)。
`map` / `matrix` 类型: 可能触发 LLM 调用。

5 名学生同时提交 = 5 个阻塞评分操作排队。

### B10 (Low): SSE 端点存在但未使用

**位置**: `classroom.controller.ts` L187-191

```typescript
@Get(':code/stream')
async stream(@Param('code') code: string, @Res() res: Response) {
  const session = await this.classroomService.resolveSession(validateCodeOrId(code));
  this.classroomService.subscribe(session.id, res);
}
```

前端使用 REST polling 而非 SSE。SSE 可减少 ~90% 的无效请求（大多数 poll 返回相同数据）。

---

## 3. 优化方案

分 5 个 Phase，按 ROI（投入/产出比）从高到低排序。

### Phase 1: 数据库索引 + 查询并行化 + N+1 修复

**ROI: 极高 | 改动量: 小 | 风险: 极低**

#### 1a. 添加缺失索引

在各 entity 文件中添加 `@Index` 装饰器:

| Entity | 索引 | 预期收益 |
|--------|------|---------|
| `Student` | `@Index(['sessionId'])` | polling 查询从全表扫描 → 索引查找 |
| `Submission` | `@Index(['sessionId', 'phase'])` | 同上 |
| `AiQuestion` | `@Index(['sessionId', 'askedAt'])` | 同上 |
| `ClassroomSession` | `@Index(['status', 'endedAt'])` | 清理任务加速 |
| `DiscussHighlight` | `@Index(['sessionId', 'detectedAt'])` | coaching 恢复加速 |
| `DiscussTargetHit` | `@Index(['sessionId', 'hitAt'])` | 同上 |

**预期收益**: 每个查询 -7~14ms → polling 整体 -30~60ms/req

#### 1b. N+1 修复 — 预构建 questions 索引（已实现）

```typescript
// 替代 L224 的 questions.filter(...)
const aiCountByStudentStep = new Map<string, number>();
for (const q of questions) {
  const key = `${q.studentId}:${q.step}`;
  aiCountByStudentStep.set(key, (aiCountByStudentStep.get(key) ?? 0) + 1);
}

// 使用时: O(1)
aiRoundsCount: aiCountByStudentStep.get(`${s.id}:${stepNum}`) ?? 0
```

#### 1c. `getState()` 查询并行化

当前 L93-142 是 4 个串行 `await`，改为 `Promise.all`:

```typescript
const [students, submissions, session, questions] = await Promise.all([
  this.studentRepo.find({ where: { sessionId }, order: { joinedAt: 'ASC' } }),
  this.submissionRepo.find({ where: { sessionId, phase: 'exercise' } }),
  this.sessionRepo.findOne({ where: { id: sessionId } }),
  this.aiQuestionRepo.find({ where: { sessionId }, order: { askedAt: 'ASC' } }),
]);
```

> **注意**: `better-sqlite3` 是同步的，`Promise.all` 在 SQLite 场景下不会真正并行执行 DB 查询。此优化的真正价值在于：(a) 减少 `await` 调度开销，(b) 为未来迁移 PostgreSQL 做准备。

### Phase 2: `getState()` 结果缓存 + dirty 标记

**ROI: 高 | 改动量: 中 | 风险: 低**

#### 2a. 引入 StateCache

```typescript
// 概念设计
class StateCache {
  private cache = new Map<string, { state: any; version: number; builtAt: number }>();
  private dirty = new Map<string, boolean>();

  markDirty(sessionId: string) { this.dirty.set(sessionId, true); }

  get(sessionId: string): CachedState | null {
    const entry = this.cache.get(sessionId);
    if (!entry) return null;
    if (this.dirty.get(sessionId)) return null;  // 需要重算
    if (Date.now() - entry.builtAt > 3000) return null;  // TTL 3s
    return entry;
  }
}
```

在写入操作（submit, join, phase change）时调用 `markDirty(sessionId)`。

**预期收益**: 教师端 ~0.33 req/s 已经很低，缓存主要防止多教师同时查看或未来增加 polling 频率时的重复计算。

#### 2b. N+1 修复 — ~~预构建 questions 索引~~

> **已在 Phase 1 中实现**（见 1b）。

### Phase 3: LLM 调用加固

**ROI: 中 | 改动量: 小 | 风险: 低**

#### 3a. 统一超时

在 `callLlm()` 和 `callLlmConversation()` 中添加 `AbortController`:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? 10_000);

const response = await fetch(url, {
  ...options,
  signal: controller.signal,
});
clearTimeout(timeoutId);
```

默认 20s，`/ai/ask` 可设 15s，`/ai/discuss` 可设 30s。

#### 3b. 重试策略

教育网链路不稳定，增加 1 次重试（指数退避）:

```
失败 → 等待 1s → 重试 1 次 → 失败则返回 fallback 回复
```

### Phase 4: 推送替代 Polling

**ROI: 高（长期）| 改动量: 大 | 风险: 中**

#### 4a. 启用 SSE 端点

SSE 端点已存在（`GET /:code/stream`），但前端未接入。

**方案**:
1. 后端: 在 submit/join/phase-change 时广播 state 事件
2. 前端: 建立 SSE 连接，收到事件后更新 state
3. 保留 polling 作为 fallback（教育网可能断开 SSE 长连接）

**预期收益**:
- 请求量: ~13 req/s (学生端 polling) → 事件驱动推送
- 延迟: 从最差 3s（polling 间隔）→ 实时（~100ms）

#### 4b. 教育网适配

教育网特殊处理:
- SSE 心跳间隔 15s（教育网代理可能在 30s 无数据时断开）
- 连接断开自动重连 + 版本号 diff（避免丢失事件）
- 降级策略: SSE 连续失败 3 次 → 回退 polling

### Phase 5: 数据库迁移（可选）

**ROI: 中（仅大规模场景）| 改动量: 大 | 风险: 高**

当前 `better-sqlite3` 的限制:
- 单线程同步 I/O，无法利用多核
- 无连接池，所有请求排队
- 40 学生场景足够，但 100+ 学生或多教室并发时会成为瓶颈

**迁移目标**: PostgreSQL（阿里云 RDS）

**适用条件**:
- 同时在线 > 100 学生 **或** 多个教室并发
- Phase 1-4 优化后仍有性能问题

**不建议当前迁移**: SQLite 在 40 学生场景下完全够用，加索引和缓存后余量充足。

---

## 4. 量化预期

| 阶段 | 优化项 | 当前 | 优化后 | 改善幅度 |
|------|--------|------|--------|---------|
| Phase 1 | DB 索引 | ~10ms/query | ~1ms/query | **-90%** |
| Phase 1 | 查询并行 | ~40ms (串行) | ~15ms (并行*) | **-60%** |
| Phase 2 | State 缓存 | ~0.33 次计算/s | 按需 (dirty) | **防止重复计算** |
| Phase 1 | N+1 修复 | O(320N) filter | O(1) Map lookup | **-99%** |
| Phase 3 | LLM 超时 | 无限等待 | 最多 10s | **消除挂起风险** |
| Phase 4 | SSE 替代 polling | ~13 req/s (学生端) | 事件驱动 | **-90% 学生端请求量** |

> *SQLite 场景下并行化收益有限，主要为代码准备度。

**预估 Phase 1+2 完成后**: `getState()` 响应时间从 ~300ms 降至 ~30ms。教师端 ~0.33 req/s 负载下事件循环阻塞可忽略，优化主要改善代码质量和为未来扩展做准备。

---

## 5. 不做的事

| 项目 | 原因 |
|------|------|
| 迁移 PostgreSQL | 40 学生 + SQLite 足够，索引 + 缓存优先 |
| 引入 Redis 缓存层 | 单机部署，`Map` 缓存足够；Redis 增加运维复杂度 |
| WebSocket 替代 SSE | SSE 更简单，单向推送已满足需求；教育网对 WS 支持不一定更好 |
| 前端虚拟滚动优化 | 40 学生数据量小，DOM 不是瓶颈 |
| CDN / 边缘计算 | 单一学校场景，无分发需求 |
| 微服务拆分 | 单体 + 单 DB 在此规模下是正确选择 |
| 数据库读写分离 | SQLite 不支持；迁移 PG 前无意义 |
| LLM 请求批处理 | 学生请求是独立会话，无法合并 |
| gRPC 替代 REST | 教育网老浏览器不支持，REST 是正确选择 |

---

## 附录 A: 关键文件索引

| 文件 | 路径（相对于 `solutions/business/live-lesson/backend/src/`）| 角色 |
|------|------|------|
| `classroom-state.service.ts` | `classroom/classroom-state.service.ts` | 状态聚合（polling 热路径） |
| `metrics-aggregator.ts` | `classroom/metrics-aggregator.ts` | 指标计算 |
| `observation-query.service.ts` | `classroom/observation/observation-query.service.ts` | 观察数据聚合 |
| `ai-prompt-builder.ts` | `classroom/ai-prompt-builder.ts` | LLM 调用封装 |
| `classroom.controller.ts` | `classroom/classroom.controller.ts` | REST 端点 |
| `student-submission.service.ts` | `classroom/student-submission.service.ts` | 提交 + 评分 |
| `manifest-cache.service.ts` | `classroom/manifest-cache.service.ts` | Manifest 缓存 (60s TTL) |
| `cluster-aggregator.ts` | `classroom/socratic-discuss/cluster-aggregator.ts` | 聚类状态（内存） |
| `coaching.service.ts` | `classroom/coaching.service.ts` | LLM 洞察缓存 (30s 节流) |
| `typeorm.module.ts` | `typeorm/typeorm.module.ts` | DB 配置 |

## 附录 B: Entity 索引现状

| Entity | 表名 | 已有索引 | 缺失索引 |
|--------|------|---------|---------|
| `ClassroomSession` | `classroom_sessions` | PK(`id`), Unique(`code`) | `(status, endedAt)` |
| `Student` | `reading_students` | PK(`id`), Unique(`sessionId, name`) | `(sessionId)` |
| `Submission` | `reading_submissions` | PK(`id`), Unique(`sessionId, studentId, step, phase`) | `(sessionId, phase)` |
| `AiQuestion` | `reading_ai_questions` | PK(`id`) | `(sessionId, askedAt)` |
| `ChatMessage` | `chat_messages` | PK(`id`), Index(`sessionId`), Unique(`sessionId, studentId, threadId, seq`) | — |
| `ClassroomSnapshot` | `classroom_snapshots` | PK(`id`), Index(`sessionId, capturedAt`) | — |
| `DiscussHighlight` | `discuss_highlights` | PK(`id`), Unique(`sessionId, studentId, taskNum, clusterId`) | `(sessionId, detectedAt)` |
| `DiscussTargetHit` | `discuss_target_hits` | PK(`id`), Unique(`sessionId, studentId, taskNum, targetPointId`) | `(sessionId, hitAt)` |
