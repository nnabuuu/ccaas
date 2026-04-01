# Spec: Quiz-Analyzer Analysis Job Queue

## Context

`toolEventTriggers` 的 `field` 字段是 solution.json 里的裸字符串，跨 4 层（solution.json → EventMapper → SSE → frontend）无类型校验，已导致 `parsedQuiz` 拼写 bug。

现在要在 quiz-analyzer solution backend 实现 **SQLite-based Analysis Job Queue**，把 "tool result → output_update" 的触发逻辑从平台字符串配置搬到 solution 后端，实现编译期类型安全 + 运行时进度跟踪 + 失败重试。

## Artifact

- **改动范围**: `solutions/business/quiz-analyzer/backend/` 及 `mcp-server/src/`
- **类型**: NestJS 后端模块（TypeScript 代码 + 测试）

## Goal

在 quiz-analyzer backend 新增 `jobs` 模块，实现 Job Queue 功能，6 轮内 harness 达到 **85+**/100 分。

## 模块清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/src/jobs/jobs.module.ts` | NestJS 模块 |
| `backend/src/jobs/jobs.service.ts` | Job CRUD + step 更新 + 重试 |
| `backend/src/jobs/jobs.controller.ts` | REST: GET /jobs/:id, GET /jobs/:id/progress |
| `backend/src/jobs/entities/analysis-job.entity.ts` | TypeORM entity |
| `backend/src/jobs/entities/job-step.entity.ts` | TypeORM entity |
| `backend/src/jobs/dto/create-job.dto.ts` | CreateJobDto |
| `backend/src/jobs/dto/job-progress.dto.ts` | JobProgressDto |
| `backend/src/jobs/jobs.service.spec.ts` | 单元测试 |
| `scripts/migrations/004-analysis-jobs.sql` | DDL |

### 修改文件

| 文件 | 说明 |
|------|------|
| `backend/src/app.module.ts` | 导入 JobsModule |
| `backend/src/agent/agent-proxy.service.ts` | SSE 流 tap: 解析 output_update → 更新 job step |
| `backend/src/database/database.module.ts` | 注册新 entity |
| `mcp-server/src/common/types.ts` | 确保 SyncField 类型从这里 export |

## DB Schema

```sql
CREATE TABLE analysis_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  template TEXT NOT NULL,          -- analyze-explain / teacher / student / kp-refinement
  status TEXT NOT NULL DEFAULT 'pending', -- pending / running / completed / failed
  total_steps INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_jobs_session ON analysis_jobs(session_id);

CREATE TABLE job_steps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  field TEXT NOT NULL,              -- SyncField value
  status TEXT NOT NULL DEFAULT 'pending', -- pending / completed / failed
  result TEXT,                      -- JSON value
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_steps_job ON job_steps(job_id);
```

## 关键架构决策

### 1. SyncField 类型安全

`SyncField` 类型已在 `mcp-server/src/common/types.ts` 定义（`SYNC_FIELDS` 常量数组 + `SyncField` type）。Backend 的 `job_steps.field` 列必须使用 `SyncField` 类型约束：

- **方案 A**（推荐）: 在 backend 定义对等常量 `VALID_SYNC_FIELDS`，从 `mcp-server/src/common/types.ts` import `SyncField` type，编译期校验
- **方案 B**: 在 backend 定义独立 enum + 测试交叉校验（如果 import 路径不通）

无论哪种方案，`JobStep.field` 的类型必须是 `SyncField`（不是 `string`），编译期拒绝非法值。

### 2. SSE 流拦截

在 `AgentProxyService.streamToResponse()` 的 `res.write(chunk)` 前：
- 用 TextDecoder 逐行解析 SSE `data: {...}` 行
- 提取 `output_update` 事件（`event.type === 'output_update'`）
- 从事件中提取 `field` 和 `value`
- 调用 `JobsService.completeStep(jobId, field, value)` 更新 step
- **原始 chunk 照常写入 response**（backward compatible）

### 3. Job 生命周期

```
Job:   pending → running → completed | failed
Step:  pending → completed | failed
```

- `createJob(sessionId, template, fields: SyncField[])` → 创建 job + 所有 steps（status=pending）
- SSE 拦截到 `output_update` → `completeStep(jobId, field, value)`
- 所有 steps completed → job status = completed
- 任何 step 失败且 retry exhausted → job status = failed

### 4. 重试机制

- step 失败时 `retry_count++`
- `retry_count < MAX_RETRIES (2)` → step 可以 retry（status 回到 pending）
- `retry_count >= MAX_RETRIES` → step status = failed → 触发 job 失败检查

### 5. Entity 模式

沿用现有 quiz-analyzer 模式：
- String PK（UUID v4）
- ISO timestamp text 列（不用 Date 类型）
- JSON text 列（`result` 存 JSON string）
- TypeORM `@Entity()` + `@Column()` 装饰器

### 6. 不改平台代码

所有改动限制在 `solutions/business/quiz-analyzer/` 目录内，不修改 `packages/` 下任何文件。

## Frozen Constraints

1. **不修改平台代码**: `packages/` 下任何文件不改
2. **不修改前端代码**: solution frontend 不改
3. **不修改 Zod schemas**: `mcp-server/src/common/schemas.ts` 验证规则不变
4. **不删除现有功能**: SSE 流照常透传给前端
5. **保持 DB 兼容**: 现有表结构不变，只新增表
6. **保持向后兼容**: solution.json 的 `toolEventTriggers` 暂时保留（平台仍需读取）
7. **Entity 模式**: 沿用 string PK + ISO timestamp text + JSON text

## 验证方式

- **Pre-gate**: `cd backend && npx tsc --noEmit` 必须通过
- **测试**: `cd backend && npx jest --no-coverage jobs` 必须全部通过
- **覆盖率**: `cd backend && npx jest --coverage jobs` 行覆盖率 ≥ 80%
- **类型安全**: 将 `field` 改为非法值 → `tsc` 编译失败
