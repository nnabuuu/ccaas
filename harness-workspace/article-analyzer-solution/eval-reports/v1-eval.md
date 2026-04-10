# Evaluation Report: v1

## Per-Dimension Scores

### D1: TypeScript 编译正确性 (Weight: 15/100)
**Score: 5/5** → 15/15 points
**backend errors**: 0
**frontend errors**: 0
**Justification**: Both `solutions/business/article-analyzer/backend` and `solutions/business/article-analyzer/frontend` pass `npx tsc --noEmit` with zero errors. tsconfig.json files are well-configured for their respective environments (CommonJS/NestJS backend, ESNext/Vite frontend).
**Suggestion**: None needed for compilation. However, backend tsconfig.json is missing `esModuleInterop: true` which causes a runtime failure (see D6).

### D2: HarnessModule 集成 (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Checklist**:
- ✅ HarnessModule.forRoot — `app.module.ts:31` correctly calls `HarnessModule.forRoot({ sessionProvider, mcpClient, runStore })`
- ✅ CcaasSessionProvider — `ccaas-session-provider.ts:14` implements `SessionProvider` with `createSession`, `sendMessage`, `waitForCompletion`, `getTokenUsage`
- ✅ SqliteRunStore — `sqlite-run-store.ts:9` implements `RunStore` with `createRun`, `updateRun`, `getRun`, `listRuns`, `appendIteration`, `saveStepOutput`, `getStepOutput`, `saveArtifact`, `getLatestArtifact`
- ✅ Task registration — `harness-setup.service.ts:9-14` registers `article-logic-improvement` task via `TaskRegistry` in `OnModuleInit`
- ✅ OutputSchema registration — `article-task.ts:63-124` defines both `article-draft-output` and `analysis-report-output` schemas with correct field definitions

**Justification**: All 5 integration points are correctly implemented. The CcaasSessionProvider handles SSE streaming from the CCAAS Core API. The task definition includes a well-structured pipeline with writer→analyzer steps, exit conditions, and frozen constraints.
**Suggestion**: `saveStepOutput`/`getStepOutput` and `saveArtifact`/`getLatestArtifact` use in-memory Maps instead of SQLite — these will be lost on restart. Consider persisting to SQLite for durability.

### D3: Article 管理 API (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Endpoints**: 9/9 present
**Missing**: None
**Checklist**:
1. ✅ `GET /articles` — `article.controller.ts:34-37` with `@Query('status')` filter
2. ✅ `POST /articles` — `article.controller.ts:39-41` accepts `CreateArticleDto`
3. ✅ `GET /articles/:id` — `article.controller.ts:44-51` with 404 handling
4. ✅ `DELETE /articles/:id` — `article.controller.ts:53-59` with 404 handling
5. ✅ `POST /articles/:id/run` — `article.controller.ts:62-69` validates article exists, calls `orchestrator.startRun`
6. ✅ `GET /articles/:id/runs` — `article.controller.ts:71-74` returns run history
7. ✅ `GET /runs/:runId/progress` — `article.controller.ts:87-112` (RunController) with score trajectory
8. ✅ `GET /runs/:runId/iterations` — `article.controller.ts:114-117` (RunController)
9. ✅ `GET /runs/:runId/iterations/:n` — `article.controller.ts:119-129` (RunController) with 404

**Justification**: All 9 endpoints implemented across two controllers (`ArticleController` + `RunController`). Proper HTTP status codes (404 for not found). The `RunController` correctly injects `HARNESS_RUN_STORE` to read run progress with score trajectory.
**Suggestion**: The `POST /articles/:id/run` endpoint doesn't return a standardized response — it returns the raw `HarnessRun` object. Consider wrapping in a `RunResponse` DTO for consistency.

### D4: 前端功能 (Weight: 20/100)
**Score: 5/5** → 20/20 points
**Checklist**:
- ✅ Pages (3/3): `ArticleListPage.tsx`, `ArticleDetailPage.tsx`, `RunProgressPage.tsx`
- ✅ Components (6/6): `ArticleForm.tsx`, `ScoreChart.tsx`, `RadarChart.tsx`, `ScorecardTable.tsx`, `VersionDiff.tsx`, `IterationTimeline.tsx`
- ✅ Router: `App.tsx` configures 3 routes (`/`, `/articles/:id`, `/runs/:id`)
- ✅ API layer: `api.ts` exists with typed fetch wrapper and 9 API functions
- ✅ Compilation: `npx tsc --noEmit` passes with 0 errors

**Justification**: Complete frontend implementation. ArticleListPage supports status filtering. RunProgressPage has 3-second polling with auto-stop on completion. ScoreChart uses recharts LineChart, RadarChart uses recharts RadarChart. VersionDiff provides side-by-side text comparison with iteration selectors. IterationTimeline has expand/collapse with analysis report display. API layer types match backend DTOs.
**Suggestion**: VersionDiff is a plain text side-by-side view, not a true diff. Consider a diff library (e.g., `diff` or `react-diff-viewer`) for highlighting changes.

### D5: SQLite 持久化 (Weight: 15/100)
**Score: 4/5** → 12/15 points
**Checklist**:
- ❌ DatabaseModule: `database.module.ts` is a stub — only exports `DATABASE_TOKEN` constant (line 1). No Module class, no provider setup. WAL mode IS enabled in `main.ts:12` (`db.pragma('journal_mode = WAL')`), and the DB provider IS registered in `app.module.ts:39`, but `database.module.ts` itself is not a proper NestJS module.
- ✅ Schema: 3 tables (`articles`, `runs`, `iterations`) + 2 indexes created in `main.ts:15-56`. Correct column types, foreign keys, CHECK constraints, UNIQUE constraint on `(run_id, iteration)`.
- ✅ SqliteRunStore.createRun: `sqlite-run-store.ts:16-28` correctly inserts into `runs` table with article_id extracted from trigger entity context.
- ✅ SqliteRunStore.appendIteration: `sqlite-run-store.ts:134-184` correctly inserts into `iterations` with `INSERT OR REPLACE`, extracts article text from writer step output and analysis report from analyzer step output.
- ✅ ArticleService CRUD: `article.service.ts` has INSERT (line 26-31), SELECT (lines 46-48, 54-65), DELETE (lines 69-72), UPDATE (lines 77-90). Complete CRUD with proper column mapping.

**Justification**: All persistence logic works correctly. The only deduction is that `database.module.ts` is not a real DatabaseModule — it's just a token constant. Schema creation, WAL, and provider registration are scattered between `main.ts` and `app.module.ts` instead of being encapsulated in a proper `DatabaseModule`.
**Suggestion**: Create a proper `DatabaseModule` with a factory provider that initializes better-sqlite3, enables WAL, creates the schema, and provides the `DATABASE_TOKEN`. This consolidates DB lifecycle management.

### D6: 端到端验证 (Weight: 10/100)
**Score: 1/5** → 2/10 points
**Scenarios**:
- ✅ Build: `nest build` succeeds with no errors
- ❌ Start: Server crashes immediately with `TypeError: better_sqlite3_1.default is not a constructor`
- ❌ GET /harness/tasks: Cannot test — server not running
- ❌ POST /articles: Cannot test — server not running
- ❌ GET /articles: Cannot test — server not running

**Justification**: The backend builds successfully but crashes on startup. Root cause: `main.ts:11` uses `import Database from 'better-sqlite3'` (default import), but `tsconfig.json` has `allowSyntheticDefaultImports: true` WITHOUT `esModuleInterop: true`. This means tsc type-checks pass, but the compiled CommonJS output uses `better_sqlite3_1.default` which doesn't exist on the `better-sqlite3` module (it uses `module.exports = Database`, not `exports.default = Database`).
**Suggestion**: Add `"esModuleInterop": true` to `tsconfig.json` compilerOptions. This is a **1-line fix** that would make the entire backend functional.

## Penalty Deductions
- P1 (packages/ modified): None — `git diff --name-only | grep "^packages/"` returned empty → No penalty
- P2 (other solutions/ modified): None — `git diff --name-only | grep "^solutions/" | grep -v article-analyzer` returned empty → No penalty
- P3 (tsc > 20 errors): 0 errors → No penalty
- P4 (missing @ApiTags): Both controllers have `@ApiTags` — `ArticleController` has `@ApiTags('articles')` (line 25), `RunController` has `@ApiTags('runs')` (line 77) → No penalty

## Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| D1 | 5/5 | 15/15 |
| D2 | 5/5 | 20/20 |
| D3 | 5/5 | 20/20 |
| D4 | 5/5 | 20/20 |
| D5 | 4/5 | 12/15 |
| D6 | 1/5 | 2/10 |

**Penalties**: 0
**总分: 89/100**

## Bug Classification
- **[COMPONENT]** — Generator 可修: `backend/tsconfig.json:1` — 期望: `esModuleInterop: true` 使 better-sqlite3 默认导入在 CJS 运行时正常 — 修复: 在 compilerOptions 中添加 `"esModuleInterop": true`
- **[COMPONENT]** — Generator 可修: `backend/src/database/database.module.ts:1` — 期望: 完整的 NestJS DatabaseModule，包含 provider factory、WAL 配置、schema 创建 — 修复: 将 main.ts 中的 DB 初始化逻辑迁移到 DatabaseModule
- **[COMPONENT]** — Generator 可修: `backend/src/harness/sqlite-run-store.ts:10-11` — 期望: stepOutputs 和 artifacts 持久化到 SQLite — 修复: 创建 step_outputs 和 artifacts 表替代 in-memory Map

## Actionable Fix Hints
1. File: `backend/tsconfig.json` — Problem: Missing `esModuleInterop: true` causes `better-sqlite3` default import to fail at runtime (`TypeError: better_sqlite3_1.default is not a constructor`) — Fix: Add `"esModuleInterop": true` to `compilerOptions`
2. File: `backend/src/database/database.module.ts` — Problem: File is a stub (only exports a token constant), not a proper NestJS module — Fix: Create a `@Module` class with a factory provider that initializes the DB, enables WAL, and creates schema (move logic from `main.ts:10-56`)
3. File: `backend/src/harness/sqlite-run-store.ts:10-11` — Problem: `stepOutputs` and `artifacts` are in-memory Maps, lost on restart — Fix: Create `step_outputs` and `artifacts` tables in the schema and persist there

## Top 3 Priority Fixes
1. **[D6 — +8 pts]** Add `"esModuleInterop": true` to `backend/tsconfig.json` compilerOptions. This single-line fix resolves the runtime crash and would bring D6 from 1/5 to potentially 5/5, adding up to 8 points.
2. **[D5 — +3 pts]** Refactor `database.module.ts` into a proper NestJS `DatabaseModule` with factory provider. Move DB initialization, WAL pragma, and schema creation from `main.ts` into the module. This would bring D5 from 4/5 to 5/5.
3. **[Quality]** Persist `stepOutputs` and `artifacts` in SQLite instead of in-memory Maps in `SqliteRunStore`. This ensures run data survives restarts and is consistent with the rest of the persistence layer.

## What's Working Well
1. **HarnessModule integration is exemplary** — Clean separation between task definition (`article-task.ts`), session provider (`ccaas-session-provider.ts`), and run store (`sqlite-run-store.ts`). The SSE streaming implementation in CcaasSessionProvider is production-quality.
2. **Frontend architecture is complete and well-organized** — All 6 components use proper TypeScript typing, the API layer cleanly mirrors backend DTOs, and the RunProgressPage polling logic correctly auto-stops when the run completes. The recharts visualizations (LineChart + RadarChart) are appropriate choices.
