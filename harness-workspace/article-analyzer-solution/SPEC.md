# SPEC: Article Analyzer Solution

## Goal
构建 `solutions/business/article-analyzer/` — 一个完整的文章分析与迭代优化 solution，包含 NestJS backend 和 React frontend。用户输入主题或初稿，系统通过 CCAAS Core API 驱动 writer + analyzer 两个 agent 迭代打磨文章，直到达到质量阈值。

## Architecture

Solution 独立部署，通过 CCAAS Core REST API 代理 LLM 调用。使用 `@kedge-agentic/harness` 模块管理迭代编排。

```
solutions/business/article-analyzer/
├── backend/                          # NestJS + better-sqlite3 + HarnessModule
│   ├── package.json
│   ├── tsconfig.json                 # commonjs (跟 harness-demo 一致)
│   ├── nest-cli.json
│   ├── data/                         # SQLite DB (gitignored)
│   └── src/
│       ├── main.ts                   # Bootstrap port 3033, enableCors
│       ├── app.module.ts             # HarnessModule.forRoot + DatabaseModule + ArticleModule
│       ├── database/
│       │   └── database.module.ts    # Global better-sqlite3 provider, WAL mode
│       ├── article/
│       │   ├── article.module.ts
│       │   ├── article.controller.ts # CRUD + run management
│       │   ├── article.service.ts    # Business logic + harness event listener
│       │   └── article.types.ts      # DTOs
│       ├── harness/
│       │   ├── ccaas-session-provider.ts  # SessionProvider → CCAAS Core API
│       │   ├── sqlite-run-store.ts        # RunStore → SQLite
│       │   ├── harness-setup.service.ts   # OnModuleInit: register task + event listener
│       │   └── article-task.ts            # HarnessTask 定义
│       └── prompts/
│           ├── writer-system.ts      # Writer agent system prompt
│           └── analyzer-system.ts    # Analyzer agent prompt (6 维度评分框架)
├── frontend/
│   ├── package.json                  # React 18, Vite, Tailwind, recharts
│   ├── vite.config.ts                # port 5292
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── index.css                 # Tailwind directives
│       ├── App.tsx                   # React Router: / → list, /articles/:id → detail, /runs/:id → progress
│       ├── api.ts                    # fetch wrapper (VITE_API_URL)
│       ├── pages/
│       │   ├── ArticleListPage.tsx   # 文章列表 + 创建
│       │   ├── ArticleDetailPage.tsx # 文章详情 + 版本历史 + 运行记录
│       │   └── RunProgressPage.tsx   # 实时迭代进度
│       └── components/
│           ├── ArticleForm.tsx       # 创建/编辑表单（支持主题或初稿两种模式）
│           ├── ScoreChart.tsx        # 分数走势折线图 (recharts)
│           ├── RadarChart.tsx        # 6 维度雷达图 (recharts)
│           ├── ScorecardTable.tsx    # 迭代记录表格
│           ├── VersionDiff.tsx       # 版本 diff 对比
│           └── IterationTimeline.tsx # 迭代时间线
```

## CcaasSessionProvider 设计

CCAAS Core API 关键点:
- **创建 session**: 不需显式创建，POST `/api/v1/sessions/:sessionId/messages` 时自动创建
- **发送消息**: 同上端点，返回 SSE 事件流（text/event-stream）
- **等待完成**: 消费 SSE 流直到 `agent_status: 'idle'`
- **token 统计**: GET `/api/v1/sessions/:sessionId/token-usage`
- **skill 控制**: 通过 `enabledSkills: ['article-writer']` 或 `enabledSkills: ['article-analyzer']`

```typescript
// SessionProvider 接口映射:
createSession({ templateId, metadata })
  → 生成 UUID 作为 sessionId
  → 存储 templateId 到内部 Map（用于后续 sendMessage 确定用哪个 skill）
  → return { sessionId }

sendMessage(sessionId, content)
  → 存储 message content 到内部 Map（延迟到 waitForCompletion 时发送）

waitForCompletion(sessionId, opts?)
  → POST /api/v1/sessions/${sessionId}/messages
    body: { tenantId, message, enabledSkills: [skillSlug], autoClose: true }
  → 消费 SSE 流，收集 text_delta → 拼接最终文本
  → 等 agent_status: 'idle' → 返回 SessionResult { text, tokensUsed, finishReason }

getTokenUsage(sessionId)
  → GET /api/v1/sessions/${sessionId}/token-usage
  → 返回 { inputTokens, outputTokens }
```

## HarnessTask 定义

```
Task ID: article-logic-improvement
Mode: iterative
Pipeline:
  1. write (agent, role=writer)
     - contextSources: [spec, prev_output(analyze, analysis_report), progress, latest_artifact]
     - requiredOutputs: [{ schemaId: 'article-draft-output', outputKey: 'draft' }]
  2. analyze (agent, role=analyzer)
     - contextSources: [spec, step_output(write, draft)]
     - requiredOutputs: [{ schemaId: 'analysis-report-output', outputKey: 'analysis_report' }]
Exit: maxIterations=10, scoreThreshold=85, minImprovement=2

Agents:
  - { role: 'writer', sessionTemplateId: 'article-writer' }
  - { role: 'analyzer', sessionTemplateId: 'article-analyzer' }
```

## SQLite Schema

```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'topic' CHECK(input_type IN ('topic','draft')),
  initial_input TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','running','completed','failed')),
  latest_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id),
  task_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  final_score REAL,
  total_iterations INTEGER DEFAULT 0,
  exit_reason TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id),
  iteration INTEGER NOT NULL,
  score REAL,
  article_text TEXT,
  analysis_report TEXT,    -- JSON
  writer_notes TEXT,       -- JSON
  dimension_scores TEXT,   -- JSON: [{name, score, weight}]
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, iteration)
);

CREATE INDEX idx_runs_article ON runs(article_id);
CREATE INDEX idx_iterations_run ON iterations(run_id);
```

## REST API 端点

**Article 管理 (ArticleController)**:
```
GET    /articles                     → 列表 (status filter)
POST   /articles                     → 创建 { title, inputType, initialInput }
GET    /articles/:id                 → 详情 (含最新运行状态)
DELETE /articles/:id                 → 删除
POST   /articles/:id/run             → 启动 harness 迭代
GET    /articles/:id/runs            → 运行历史
GET    /runs/:runId/progress         → 实时进度 (from Orchestrator)
GET    /runs/:runId/iterations       → 所有迭代结果
GET    /runs/:runId/iterations/:n    → 单轮详情 (含文章文本 + 分析报告)
```

**Harness 端点 (HarnessController，来自 @kedge-agentic/harness)**:
```
GET    /harness/tasks
POST   /harness/runs
POST   /harness/callback/output
...其余端点
```

## 6 维度评分框架 (Analyzer Agent)

| Dim | Name | Weight | /5 Scale |
|-----|------|--------|----------|
| D1 | Thesis Clarity (论点清晰度) | 0.20 | 1-5 |
| D2 | Evidence Coverage (论据覆盖度) | 0.20 | 1-5 |
| D3 | Logic Chain (逻辑链连贯性) | 0.20 | 1-5 |
| D4 | Ink Allocation (笔墨分配) | 0.15 | 1-5 |
| D5 | Reader Journey (阅读旅程) | 0.15 | 1-5 |
| D6 | Conclusion (结论扎实度) | 0.10 | 1-5 |

总分 = Σ(dim_score/5 × weight × 100)，满分 100。

## 前端页面

**ArticleListPage**:
- 文章卡片列表（title, status badge, latest score, created date）
- 右上角 "新建文章" 按钮
- 支持按 status 筛选

**ArticleDetailPage**:
- 文章信息卡（title, type, initial input）
- "开始分析" 按钮（启动 harness run）
- 运行历史表格（每行: run ID, status, final score, iterations, duration）
- 点击某次运行 → 跳转 RunProgressPage

**RunProgressPage**:
- 顶部: 当前状态 (running/completed) + 进度 (iteration 3/10)
- 分数走势折线图 (recharts LineChart)
- 最新迭代的 6 维度雷达图 (recharts RadarChart)
- 迭代时间线（每轮: 分数, 关键改动, top issue）
- 可展开查看: 当前版本文章全文 + 分析报告
- 版本 diff 对比（选择两个版本，side-by-side diff）
- 运行中时每 3s 轮询刷新

## 输入模式

两种输入模式:
1. **主题模式 (topic)**: 用户输入文章主题，writer 从零生成初稿
2. **初稿模式 (draft)**: 用户粘贴已有文章，writer 在此基础上迭代改进

## Frozen Constraints

- 不修改 `packages/` 目录（harness 模块已有）
- 不修改 `solutions/` 下其他 solution
- backend 使用 commonjs (跟 harness-demo 一致)
- Controller 必须有 `@ApiTags` decorator
- 前端使用 Vite + React 18 + Tailwind + recharts
