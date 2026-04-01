# v1 Changelog

## 修改摘要
从零创建完整的 Analysis Job Queue 模块骨架，包含 Entity、Service、Controller、SSE 拦截和 27 个单元测试。

## 修改详情

### 新增文件
- `backend/src/jobs/entities/analysis-job.entity.ts` — AnalysisJob TypeORM entity，沿用项目 string PK + ISO text timestamp 模式
- `backend/src/jobs/entities/job-step.entity.ts` — JobStep entity，`field` 列类型为 `SyncField`（非 string），从 mcp-server types import
- `backend/src/jobs/dto/create-job.dto.ts` — CreateJobDto，fields 参数类型为 `SyncField[]`
- `backend/src/jobs/dto/job-progress.dto.ts` — JobProgressDto + StepProgress 接口
- `backend/src/jobs/jobs.service.ts` — 核心服务：createJob、startJob、completeStep、failStep、getJob、getJobProgress、findActiveJobForSession、isValidSyncField
- `backend/src/jobs/jobs.controller.ts` — REST: GET /api/v1/jobs/:id、GET /api/v1/jobs/:id/progress
- `backend/src/jobs/jobs.module.ts` — NestJS 模块，exports JobsService
- `backend/src/jobs/jobs.service.spec.ts` — 27 个单元测试覆盖所有 5 个维度
- `scripts/migrations/004-analysis-jobs.sql` — DDL for analysis_jobs + job_steps 表

### 修改文件
- `backend/src/app.module.ts` — 导入 JobsModule
- `backend/src/database/database.module.ts` — 注册 AnalysisJob + JobStep entities
- `backend/src/agent/agent-proxy.service.ts` — 添加 SSE 流 output_update 事件拦截，调用 JobsService.completeStep()

## 对应维度
- D1 (Job Lifecycle): 完整实现 pending→running→completed/failed 状态机，createJob/startJob/completeStep/failStep 全链路，auto-complete 当所有 steps 完成
- D2 (SyncField 类型安全): JobStep.field 类型为 `SyncField`（import from mcp-server/types），isValidSyncField() 运行时校验，测试交叉验证所有 SYNC_FIELDS 值
- D3 (SSE 拦截): AgentProxyService.interceptOutputUpdates() 方法解析 SSE data 行，提取 output_update 事件，调用 completeStep()，原始 chunk 照常透传
- D4 (重试): failStep() 实现 retry_count++ 逻辑，MAX_RETRIES=2，exhausted 时 step→failed→触发 job failure 检查
- D5 (测试覆盖率): 27 个测试覆盖 createJob、startJob、completeStep（含幂等、auto-complete）、failStep（含 retry、exhausted、job failure）、getJob、getJobProgress、findActiveJobForSession、SyncField 校验、边界情况

## 验证结果
- `npx tsc --noEmit` — 通过（0 errors）
- `npx jest --no-coverage jobs` — 27 passed
- `npx jest --no-coverage` — 全量 61 tests passed（0 regressions）

## 预期效果
首轮完整骨架，预期 D1-D5 各维度都有实质覆盖。如有扣分，预期主要在 D3（SSE 拦截的集成测试覆盖）和 D5（边界 case 覆盖率细节）。
