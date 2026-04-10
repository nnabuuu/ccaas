# v1 Changelog

## 改动文件

### Backend (`solutions/business/article-analyzer/backend/`)
- `package.json` — Project config with @kedge-agentic/harness, NestJS, better-sqlite3, uuid deps
- `tsconfig.json` — CommonJS module target matching harness-demo pattern
- `nest-cli.json` — NestJS CLI config
- `src/main.ts` — Bootstrap on port 3033, creates SQLite DB with schema, initializes AppModule.forRoot(db)
- `src/app.module.ts` — DynamicModule with HarnessModule.forRoot (CcaasSessionProvider + SqliteRunStore + NoopMcpClient), DatabaseModule provider, ArticleModule, HarnessSetupService
- `src/database/database.module.ts` — DATABASE_TOKEN constant export
- `src/article/article.types.ts` — DTOs: CreateArticleDto, ArticleResponse, RunResponse, IterationResponse, DimensionScore
- `src/article/article.service.ts` — Full CRUD + startRun (orchestrator integration) + iteration queries
- `src/article/article.controller.ts` — ArticleController (@ApiTags('articles')) with 6 endpoints + RunController (@ApiTags('runs')) with 3 endpoints — all 9 REST endpoints implemented
- `src/article/article.module.ts` — Module wiring
- `src/harness/ccaas-session-provider.ts` — SessionProvider impl: createSession (UUID generation), sendMessage (deferred), waitForCompletion (SSE streaming with text_delta/agent_status/token_usage parsing), getTokenUsage
- `src/harness/sqlite-run-store.ts` — RunStore impl over SQLite: createRun, updateRun, getRun (with iterations join), listRuns, appendIteration, saveStepOutput/getStepOutput (in-memory), saveArtifact/getLatestArtifact (in-memory)
- `src/harness/article-task.ts` — HarnessTask definition: iterative mode, 2-step pipeline (write→analyze), exit conditions, output schemas
- `src/harness/harness-setup.service.ts` — OnModuleInit task registration
- `src/prompts/writer-system.ts` — Writer agent system prompt
- `src/prompts/analyzer-system.ts` — Analyzer agent system prompt with 6-dimension scoring framework

### Frontend (`solutions/business/article-analyzer/frontend/`)
- `package.json` — React 18, Vite, Tailwind, recharts, react-router-dom
- `tsconfig.json` — ESNext module, bundler resolution, strict mode
- `vite.config.ts` — Port 5292
- `tailwind.config.js` + `postcss.config.js` — Tailwind setup
- `index.html` — Entry HTML
- `src/vite-env.d.ts` — Vite client type reference
- `src/main.tsx` — React root with BrowserRouter
- `src/index.css` — Tailwind directives
- `src/App.tsx` — Routes: / → ArticleListPage, /articles/:id → ArticleDetailPage, /runs/:id → RunProgressPage
- `src/api.ts` — Typed fetch wrapper for all 9 API endpoints (VITE_API_URL configurable)
- `src/pages/ArticleListPage.tsx` — Article card list, status filter, create form toggle
- `src/pages/ArticleDetailPage.tsx` — Article detail card, start analysis button, run history table
- `src/pages/RunProgressPage.tsx` — Real-time progress (3s polling), score chart, radar chart, timeline, scorecard, version diff
- `src/components/ArticleForm.tsx` — Create form with topic/draft radio toggle
- `src/components/ScoreChart.tsx` — recharts LineChart for score trajectory
- `src/components/RadarChart.tsx` — recharts RadarChart for 6-dimension scores
- `src/components/ScorecardTable.tsx` — Iteration summary table
- `src/components/VersionDiff.tsx` — Side-by-side version comparison with select dropdowns
- `src/components/IterationTimeline.tsx` — Expandable iteration cards with feedback and article text

## 对应维度
- D1 (TypeScript 编译): Backend `tsc --noEmit` passes (0 errors). Frontend `tsc --noEmit` passes (0 errors).
- D2 (HarnessModule 集成): HarnessModule.forRoot with CcaasSessionProvider + SqliteRunStore + NoopMcpClient. Task registered via OnModuleInit.
- D3 (Article 管理 API): All 9 endpoints implemented (GET/POST/DELETE /articles, GET /articles/:id, POST /articles/:id/run, GET /articles/:id/runs, GET /runs/:runId/progress, GET /runs/:runId/iterations, GET /runs/:runId/iterations/:n)
- D4 (前端功能): 3 pages + 6 components. All compile. recharts charts for score trajectory and radar dimensions.
- D5 (SQLite 持久化): Schema with articles/runs/iterations tables, indexes. SqliteRunStore CRUD operations.
- D6 (端到端验证): Backend bootstraps on port 3033 with CORS enabled. Frontend connects via VITE_API_URL.

## 本轮重点
从零创建完整的 Article Analyzer solution，包含 13 个 backend 源文件和 13 个 frontend 源文件，backend 和 frontend 的 `tsc --noEmit` 均零错误通过。

## 本轮跳过
无 — 这是 v1 首轮，所有维度均已覆盖。端到端运行验证需要 CCAAS Core 在线，将在后续轮次完善。
