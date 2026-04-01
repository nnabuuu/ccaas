# Evaluation Criteria — Analysis Job Queue

> 你是一位独立的后端代码质量审查员。你没有参与代码编写，只评估最终实现。
> 按照以下标准严格评分。

## Pre-Scoring Gate

**`cd backend && npx tsc --noEmit` 必须通过。** 如果 TypeScript 编译失败，直接 0 分，跳过所有维度评估。

## Scoring Dimensions

### D1: Job Lifecycle 正确性 (Weight: 25/100)

**What to evaluate**: Job 和 Step 的状态机是否正确实现，CRUD 操作是否完整。

| Score | Description |
|-------|-------------|
| 5/5 | createJob 正确创建 job + steps；completeStep 更新 step 并自动更新 job 进度；all-steps-done → job completed；failure path 触发 job failed |
| 4/5 | 基本 CRUD 正确，但 job 自动状态转换有小问题（如 completed_at 未设置） |
| 3/5 | createJob 和 completeStep 基本工作，但状态机不完整（缺 failure path 或 completed 判断） |
| 2/5 | 只有 createJob，缺 completeStep 或状态转换 |
| 1/5 | JobsService 存在但功能严重不完整 |

**Detection method**:
1. 读 `jobs.service.ts` 检查 `createJob()`, `completeStep()`, `getJob()`, `getJobProgress()` 方法
2. 读 `jobs.service.spec.ts` 检查测试是否覆盖 happy path + failure path
3. 运行 `cd backend && npx jest jobs.service` 验证测试通过

---

### D2: SyncField 类型安全 (Weight: 20/100)

**What to evaluate**: `SyncField` 类型是否贯穿 backend，编译期能否捕获拼写错误。

| Score | Description |
|-------|-------------|
| 5/5 | JobStep.field 类型是 SyncField（非 string）；CreateJobDto.fields 类型是 SyncField[]；completeStep 参数类型是 SyncField；非法 field 值导致 tsc 报错 |
| 4/5 | 类型定义正确，但某个入口点（如 DTO）退化为 string |
| 3/5 | 使用了 SyncField 类型但存在 `as any` 或 type assertion 绕过 |
| 2/5 | 定义了 SyncField 相关常量但实际 field 列类型仍是 string |
| 1/5 | 完全没有使用 SyncField 类型，field 全是 string |

**Detection method**:
1. 读 entity、DTO、service 文件，检查 `field` 相关类型声明
2. 搜索 `as any`、`as string`、`// @ts-ignore` 等绕过
3. 验证: 将测试中某个 field 值改为 `'invalidField'`，运行 `tsc --noEmit`，确认编译失败
4. 检查是否从 `mcp-server/src/common/types.ts` import 或等价定义

---

### D3: SSE 流拦截 & 进度跟踪 (Weight: 20/100)

**What to evaluate**: AgentProxyService 是否正确拦截 SSE 流，提取 output_update 事件更新 job step，且不影响原始流。

| Score | Description |
|-------|-------------|
| 5/5 | SSE chunk 被正确解析；output_update 事件触发 completeStep；原始 chunk 照常写入 response；测试覆盖 mock SSE 流场景 |
| 4/5 | 拦截逻辑正确但缺少边缘情况处理（如 chunk 跨行、非 JSON data 行） |
| 3/5 | 拦截逻辑存在但解析不完整（如只处理单行 chunk，忽略 multi-line） |
| 2/5 | 有 TODO 注释或 stub 但未实现拦截 |
| 1/5 | AgentProxyService 未被修改 |

**Detection method**:
1. 读 `agent-proxy.service.ts` 检查 SSE 解析逻辑
2. 搜索 `output_update` 关键字
3. 检查是否注入了 `JobsService`
4. 读测试文件检查是否有 mock SSE chunk 的测试

---

### D4: 重试 & 错误处理 (Weight: 15/100)

**What to evaluate**: step 失败后的重试逻辑，max retry 后的 job 失败处理。

| Score | Description |
|-------|-------------|
| 5/5 | step 失败时 retry_count 递增；retry_count < MAX_RETRIES 时 step 可重试（status 回 pending）；超过 MAX_RETRIES 时 step=failed → 触发 job 失败检查；有 error 信息记录 |
| 4/5 | 重试逻辑正确但 error 信息记录不完整 |
| 3/5 | 有重试计数但状态转换不正确（如不回到 pending） |
| 2/5 | 有 MAX_RETRIES 常量但逻辑未实现 |
| 1/5 | 无重试机制 |

**Detection method**:
1. 读 `jobs.service.ts` 检查 `failStep()` 或 `retryStep()` 方法
2. 搜索 `MAX_RETRIES`、`retry_count`
3. 读测试文件检查是否覆盖重试 + max-retry-exceeded 场景

---

### D5: 测试覆盖率 (Weight: 20/100)

**What to evaluate**: jobs 模块的单元测试质量和覆盖率。

| Score | Description |
|-------|-------------|
| 5/5 | `npx jest --coverage jobs` 行覆盖率 ≥ 80%；覆盖 happy path + failure path + edge cases；mock 隔离干净 |
| 4/5 | 覆盖率 70-79%；主要路径覆盖但缺少边缘情况 |
| 3/5 | 覆盖率 60-69%；有测试但只覆盖 happy path |
| 2/5 | 覆盖率 40-59%；测试存在但很少 |
| 1/5 | 覆盖率 < 40% 或测试无法运行 |

**Detection method**:
1. 运行 `cd backend && npx jest --coverage --collectCoverageFrom='src/jobs/**/*.ts' --no-coverage -- jobs`
   - 如果上述命令不可用，运行 `cd backend && npx jest --coverage jobs`
2. 检查 Stmts/Branch/Lines 覆盖率
3. 读测试文件检查测试用例的质量（不只是数量）

---

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| `as any` 绕过类型检查 | -5/处 | 代码中使用 `as any` 绕过 SyncField 类型 |
| 硬编码 field 字符串 | -3/处 | service/controller 中直接写字符串而非 SyncField 常量 |
| 测试中 `@ts-ignore` | -3/处 | 测试文件中使用 `@ts-ignore` 跳过类型检查 |
| 破坏现有功能 | -15 | `npx jest --no-coverage` 全量测试有失败（非 jobs 模块的测试） |
| 未写迁移 SQL | -5 | 缺少 `scripts/migrations/` 下的 DDL 文件 |

## Score Calculation

1. 每个维度: `(score / 5) * weight`
   - 例: D1 Job Lifecycle 得 4/5 → (4/5) * 25 = 20
   - 例: D2 SyncField 得 5/5 → (5/5) * 20 = 20
2. 基础分: 五个维度加权分之和
3. 扣分: Penalty 扣分
4. **总分 = 基础分 - Penalty 扣分**（满分 100，最低 0）
5. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Thresholds

- **Pass**: 70/100
- **Target**: 85/100
- **Estimated baseline**: ~30/100（第一轮可能只有基本骨架）
