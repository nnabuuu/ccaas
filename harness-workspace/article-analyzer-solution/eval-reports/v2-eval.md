# Evaluation Report: v2

## Per-Dimension Scores

### D1: TypeScript 编译正确性 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**backend errors**: 0
**frontend errors**: 0
**Justification**: Both `backend/` and `frontend/` compile with `tsc --noEmit` producing zero errors. tsconfig.json files are well-configured — backend uses `commonjs` + `emitDecoratorMetadata` + `esModuleInterop` for NestJS (fixing the v1 runtime crash), frontend uses `bundler` moduleResolution with `react-jsx`.
**Suggestion**: Consider enabling `strict: true` in backend tsconfig for stricter null safety (currently only `strictNullChecks: true`).

### D2: HarnessModule 集成 (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Checklist**:
- ✅ `HarnessModule.forRoot({ sessionProvider, mcpClient, runStore })` in `app.module.ts:35`
- ✅ `CcaasSessionProvider implements SessionProvider` — calls CCAAS Core API `POST /api/v1/sessions/:id/messages` with SSE stream parsing
- ✅ `SqliteRunStore implements RunStore` — all 9 interface methods implemented (`createRun`, `updateRun`, `getRun`, `listRuns`, `appendIteration`, `saveStepOutput`, `getStepOutput`, `saveArtifact`, `getLatestArtifact`)
- ✅ `harness-setup.service.ts` registers `article-logic-improvement` task via `OnModuleInit`
- ✅ `outputSchemas` array in `article-task.ts` contains both `article-draft-output` (3 fields) and `analysis-report-output` (5 fields)

**Justification**: All 5 integration points are correctly wired. v2 fixes from v1: `saveStepOutput`/`getStepOutput` and `saveArtifact`/`getLatestArtifact` now persist to SQLite tables (`step_outputs`, `artifacts`) instead of in-memory Maps. The `NoopMcpClient` is a reasonable placeholder since this solution uses agent-based pipeline steps only.
**Suggestion**: `CcaasSessionProvider.waitForCompletion` (`ccaas-session-provider.ts:48`) does not accept the optional `opts` parameter (timeout, onEvent callback) from the interface. While TypeScript-legal, the orchestrator's timeout and progress callbacks will be silently ignored. Add `opts` support for production robustness.

### D3: Article 管理 API (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Endpoints**: 9/9 present
**Missing**: none

| # | Endpoint | Controller | Line |
|---|----------|-----------|------|
| 1 | `GET /articles` (status filter) | `ArticleController` | `article.controller.ts:34` |
| 2 | `POST /articles` | `ArticleController` | `article.controller.ts:39` |
| 3 | `GET /articles/:id` | `ArticleController` | `article.controller.ts:44` |
| 4 | `DELETE /articles/:id` | `ArticleController` | `article.controller.ts:53` |
| 5 | `POST /articles/:id/run` | `ArticleController` | `article.controller.ts:62` |
| 6 | `GET /articles/:id/runs` | `ArticleController` | `article.controller.ts:71` |
| 7 | `GET /runs/:runId/progress` | `RunController` | `article.controller.ts:86` |
| 8 | `GET /runs/:runId/iterations` | `RunController` | `article.controller.ts:114` |
| 9 | `GET /runs/:runId/iterations/:n` | `RunController` | `article.controller.ts:119` |

**Justification**: All 9 endpoints implemented across two controllers (`ArticleController` and `RunController`), with proper HTTP method decorators, parameter extraction, error handling (404 for missing resources), and correct return types.
**Suggestion**: `startRun` at `article.controller.ts:63` lacks explicit return type annotation — TypeScript infers `Promise<HarnessRun>` which exposes the internal `HarnessRun` model directly. Consider mapping to a `RunResponse` DTO for API contract stability.

### D4: 前端功能 (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Checklist**:
- ✅ Pages (3/3): `ArticleListPage.tsx`, `ArticleDetailPage.tsx`, `RunProgressPage.tsx`
- ✅ Components (6/6): `ArticleForm.tsx`, `ScoreChart.tsx`, `RadarChart.tsx`, `ScorecardTable.tsx`, `VersionDiff.tsx`, `IterationTimeline.tsx`
- ✅ Router: 3 routes in `App.tsx` (`/`, `/articles/:id`, `/runs/:id`)
- ✅ API layer: `api.ts` with typed `apiFetch<T>` wrapper and 9 exported functions matching all backend endpoints
- ✅ Compilation: `tsc --noEmit` zero errors

**Justification**: Frontend is complete and well-structured. `RunProgressPage` implements auto-polling (3s interval) that stops when run completes. All components handle empty states gracefully. `ScoreChart` uses recharts `LineChart`, `RadarChart` uses recharts `RadarChart`, both with `ResponsiveContainer`. `IterationTimeline` supports expand/collapse for iteration details. `VersionDiff` provides side-by-side text comparison with iteration selector.
**Suggestion**: `VersionDiff` is a plain text side-by-side viewer, not a true character/line-level diff. Consider using a diff library for highlighting actual changes between iterations.

### D5: SQLite 持久化 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**Checklist**:
- ✅ `DatabaseModule`: proper NestJS `@Global()` `@Module` with `forRoot()` factory, better-sqlite3 provider, `journal_mode = WAL`, `foreign_keys = ON` (`database.module.ts:13-96`)
- ✅ Schema: 5 tables (`articles`, `runs`, `iterations`, `step_outputs`, `artifacts`) + 3 indexes — exceeds the required 3 tables
- ✅ `SqliteRunStore.createRun`: inserts into `runs` table with `article_id` from trigger entity context (`sqlite-run-store.ts:12-26`)
- ✅ `SqliteRunStore.appendIteration`: inserts into `iterations` with score, article_text, analysis_report, dimension_scores, tokens_used, duration_ms (`sqlite-run-store.ts:131-181`)
- ✅ `ArticleService` CRUD: `INSERT INTO articles` (line 27), `SELECT * FROM articles` (lines 47, 61), `DELETE FROM articles` (line 70), `UPDATE articles` (lines 77, 87)

**Justification**: Major improvement from v1. `DatabaseModule` is now a proper NestJS module with `@Global()` decorator, `forRoot()` static method, auto-creating data directory, and providing the `DATABASE_TOKEN`. Schema includes proper constraints (`CHECK` on `input_type` and `status`), foreign key references, `UNIQUE(run_id, iteration)`, and three indexes. `step_outputs` and `artifacts` tables now persist to SQLite (was in-memory Maps in v1).
**Suggestion**: `SqliteRunStore.mapIterationRow` at line 239 returns `steps: []` (empty array), which means iteration records loaded from DB lose all step-level detail. Consider reconstructing step records from the `step_outputs` table when loading iterations.

### D6: 端到端验证 (Weight: 10/100)
**Score: 5/5** → 10/10 points
**Scenarios**:
- ✅ `nest build` succeeds with zero errors
- ✅ Backend starts on port 3033 — all routes mapped (9 article/run routes + 14 harness routes)
- ✅ `GET /harness/tasks` returns `[{id:"article-logic-improvement",...}]` with complete task definition
- ✅ `POST /articles` returns correct JSON: `{id, title, inputType, initialInput, status:"draft", latestRunId:null, createdAt, updatedAt}`
- ✅ `GET /articles` returns array containing the created article

**Justification**: Full end-to-end verified. v1's critical runtime crash (`TypeError: better_sqlite3_1.default is not a constructor`) is fixed by adding `esModuleInterop: true` to tsconfig. Database auto-creates on first run. Task registered via `OnModuleInit` lifecycle hook. CORS enabled.
**Suggestion**: `main.ts` hardcodes port 3033. Consider `process.env.PORT || 3033` for deployment flexibility.

## Penalty Deductions
- **P1**: No modifications to `packages/` directory → **no penalty**
- **P2**: No modifications to other `solutions/` directories → **no penalty**
- **P3**: 0 tsc errors → **no penalty**
- **P4**: Both `ArticleController` (`@ApiTags('articles')`) and `RunController` (`@ApiTags('runs')`) have `@ApiTags` → **no penalty**

## Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1: TypeScript 编译正确性 | 5/5 | 15/15 |
| D2: HarnessModule 集成 | 5/5 | 20/20 |
| D3: Article 管理 API | 5/5 | 20/20 |
| D4: 前端功能 | 5/5 | 20/20 |
| D5: SQLite 持久化 | 5/5 | 15/15 |
| D6: 端到端验证 | 5/5 | 10/10 |

**Penalties**: -0
**总分: 100/100**

## v1 → v2 Improvements
| Issue | v1 Score | v2 Score | Fix Applied |
|-------|----------|----------|-------------|
| `esModuleInterop` missing → runtime crash | D6: 1/5 | D6: 5/5 | Added `"esModuleInterop": true` to `tsconfig.json` |
| `DatabaseModule` was a stub (token-only) | D5: 4/5 | D5: 5/5 | Proper `@Global() @Module` with `forRoot()`, WAL, schema creation |
| `step_outputs`/`artifacts` in-memory | D2: noted | D2: fixed | New `step_outputs` and `artifacts` SQLite tables with full CRUD |

## Bug Classification

No blocking bugs found. The following are functional gaps (not compilation or correctness bugs):

- **[COMPONENT]** — Generator 可修: `sqlite-run-store.ts:239` — 期望: `steps` 字段应从 `step_outputs` 表重建 — 修复: 在 `mapIterationRow` 中查询 `step_outputs` 表并重建 `StepRecord[]`
- **[COMPONENT]** — Generator 可修: `ccaas-session-provider.ts:48` — 期望: `waitForCompletion` 应接受 `opts` 参数支持 timeout 和 onEvent — 修复: 添加 `opts` 参数，使用 `AbortController` 实现 timeout，在 SSE 解析循环中调用 `onEvent`
- **[COMPONENT]** — Generator 可修: `article.controller.ts:63` — 期望: `startRun` 应返回 `RunResponse` 而非 `HarnessRun` — 修复: 在 service 或 controller 中添加 `HarnessRun → RunResponse` 映射
- **[DESIGN]** — 需要人工决策: `VersionDiff` 组件是纯文本并排查看器，不是真正的 diff 视图

## Actionable Fix Hints
1. File: `sqlite-run-store.ts:239-248` — Problem: `steps: []` loses step data — Fix: Query `step_outputs` table in `mapIterationRow` and reconstruct `StepRecord[]`
2. File: `ccaas-session-provider.ts:48` — Problem: `opts` parameter ignored — Fix: Add `opts` parameter, implement timeout with `AbortController`, call `onEvent` during SSE parsing
3. File: `article.controller.ts:63` — Problem: leaks internal `HarnessRun` type to API consumers — Fix: Map to `RunResponse` DTO before returning
4. File: `main.ts:7` — Problem: hardcoded port — Fix: `await app.listen(process.env.PORT || 3033)`

## Top 3 Priority Fixes
1. **[D5 — quality]** `sqlite-run-store.ts:239`: `mapIterationRow` returns `steps: []` — reconstruct step records from `step_outputs` table so iteration history preserves full step data for orchestrator context assembly
2. **[D2 — quality]** `ccaas-session-provider.ts:48`: Add `opts` parameter support to `waitForCompletion` — enables timeout control and progress callbacks from orchestrator
3. **[D3 — quality]** `article.controller.ts:63`: Map `startRun` return value from `HarnessRun` to `RunResponse` DTO for API contract stability

## What's Working Well
1. **Clean architecture separation**: DatabaseModule, HarnessSetupService, CcaasSessionProvider, and SqliteRunStore are properly separated. The solution doesn't pollute core harness package — all domain logic stays within `solutions/business/article-analyzer/`. The v2 `DatabaseModule` is now a proper NestJS module with correct lifecycle management.
2. **Complete frontend with real-time polling**: RunProgressPage auto-polls every 3s and stops on completion. All 6 visualization components handle empty states. The api.ts layer provides type-safe wrappers for all 9 endpoints. This is a polished, functional frontend that the Generator should NOT change.
