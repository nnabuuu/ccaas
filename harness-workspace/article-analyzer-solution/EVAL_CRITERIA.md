# Eval Criteria: Article Analyzer Solution

## Scoring Dimensions

| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| D1 | TypeScript 编译正确性 | 15/100 | backend + frontend `tsc --noEmit` 零错误 |
| D2 | HarnessModule 集成 | 20/100 | forRoot 正确，SessionProvider/RunStore/Task 完整 |
| D3 | Article 管理 API | 20/100 | CRUD + run management，curl 测试 |
| D4 | 前端功能 | 20/100 | 3 页面 + 6 组件存在，编译通过 |
| D5 | SQLite 持久化 | 15/100 | Schema 正确，CRUD 操作正常 |
| D6 | 端到端验证 | 10/100 | backend 启动 + API 可调用 + task 已注册 |

## D1: TypeScript 编译正确性 (15/100)

**5/5 (15 pts)**: backend + frontend 均零 tsc 错误
**4/5 (12 pts)**: 1-3 个 minor 类型错误
**3/5 (9 pts)**: 4-10 个类型错误
**2/5 (6 pts)**: 11-20 个类型错误
**1/5 (3 pts)**: > 20 个类型错误或 tsconfig 缺失

**Detection**:
```bash
cd solutions/business/article-analyzer/backend && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"
cd solutions/business/article-analyzer/frontend && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0"
```

## D2: HarnessModule 集成 (20/100)

检查清单（每项 1 分，共 5 分）：

1. **HarnessModule.forRoot**: `app.module.ts` 正确导入并配置 HarnessModule.forRoot({ sessionProvider, ... })
2. **CcaasSessionProvider**: 实现 SessionProvider 接口，调用 CCAAS Core API（POST /api/v1/sessions/:id/messages）
3. **SqliteRunStore**: 实现 RunStore 接口，读写 SQLite runs/iterations 表
4. **HarnessTask 注册**: `harness-setup.service.ts` 在 OnModuleInit 注册 article-logic-improvement task
5. **OutputSchema 注册**: article-draft-output 和 analysis-report-output 两个 schema 已注册
6. **Session event forwarding**: `CcaasSessionProvider.waitForCompletion` 接受 `opts` 并转发 `text_delta`/`agent_status`/`tool_activity` 事件

**Detection**:
```bash
# 1. forRoot
grep "HarnessModule.forRoot" solutions/business/article-analyzer/backend/src/app.module.ts

# 2. SessionProvider
grep -c "implements SessionProvider" solutions/business/article-analyzer/backend/src/harness/ccaas-session-provider.ts

# 3. RunStore
grep -c "implements RunStore" solutions/business/article-analyzer/backend/src/harness/sqlite-run-store.ts

# 4. Task registration
grep "article-logic-improvement" solutions/business/article-analyzer/backend/src/harness/article-task.ts

# 5. OutputSchema
grep -c "outputSchemas" solutions/business/article-analyzer/backend/src/harness/article-task.ts
```

## D3: Article 管理 API (20/100)

9 个端点，按覆盖率打分：

- **5/5 (20 pts)**: 9/9 端点均实现且返回正确结构
- **4/5 (16 pts)**: 7-8 个端点
- **3/5 (12 pts)**: 5-6 个端点
- **2/5 (8 pts)**: 3-4 个端点
- **1/5 (4 pts)**: < 3 个端点

端点清单：
1. `GET /articles` — 列表 (支持 status query)
2. `POST /articles` — 创建 { title, inputType, initialInput }
3. `GET /articles/:id` — 详情
4. `DELETE /articles/:id` — 删除
5. `POST /articles/:id/run` — 启动 harness 迭代
6. `GET /articles/:id/runs` — 运行历史
7. `GET /runs/:runId/progress` — 实时进度
8. `GET /runs/:runId/iterations` — 所有迭代
9. `GET /runs/:runId/iterations/:n` — 单轮详情

**Detection**:
```bash
grep -E "@(Get|Post|Delete|Put|Patch)\(" solutions/business/article-analyzer/backend/src/article/article.controller.ts | wc -l
```

## D4: 前端功能 (20/100)

检查清单（每项 1 分，共 5 分）：

1. **3 页面存在**: ArticleListPage.tsx + ArticleDetailPage.tsx + RunProgressPage.tsx
2. **6 组件存在**: ArticleForm + ScoreChart + RadarChart + ScorecardTable + VersionDiff + IterationTimeline
3. **React Router**: App.tsx 配置了 3 个路由
4. **API 层**: api.ts 封装了 fetch wrapper
5. **编译通过**: `npx tsc --noEmit` 零错误
6. **SSE consumption**: `RunProgressPage` 通过 SSE 接收实时事件，显示 live step/status 指标，polling 作为降级方案

**Detection**:
```bash
# 1. Pages
ls solutions/business/article-analyzer/frontend/src/pages/{ArticleListPage,ArticleDetailPage,RunProgressPage}.tsx 2>&1

# 2. Components
ls solutions/business/article-analyzer/frontend/src/components/{ArticleForm,ScoreChart,RadarChart,ScorecardTable,VersionDiff,IterationTimeline}.tsx 2>&1

# 3. Router
grep -c "Route" solutions/business/article-analyzer/frontend/src/App.tsx

# 4. API layer
test -f solutions/business/article-analyzer/frontend/src/api.ts && echo "exists"

# 5. Compilation
cd solutions/business/article-analyzer/frontend && npx tsc --noEmit 2>&1
```

## D5: SQLite 持久化 (15/100)

检查清单（每项 1 分，共 5 分）：

1. **DatabaseModule**: better-sqlite3 provider 存在，WAL mode 开启
2. **Schema 创建**: articles + runs + iterations 三表 + 索引
3. **SqliteRunStore.createRun**: 正确插入 runs 表
4. **SqliteRunStore.appendIteration**: 正确插入 iterations 表（含 status 字段）
5. **ArticleService CRUD**: articles 表的增删查正确
6. **SqliteRunStore.mapIterationRow**: 从 step_outputs 表重建 steps，从 DB 读取 iteration status

**Detection**:
```bash
# 1. DatabaseModule
grep "journal_mode = WAL" solutions/business/article-analyzer/backend/src/database/database.module.ts

# 2. Schema
grep -c "CREATE TABLE" solutions/business/article-analyzer/backend/src/database/database.module.ts

# 3-5. RunStore + ArticleService
grep -c "INSERT INTO\|SELECT\|DELETE FROM\|UPDATE" solutions/business/article-analyzer/backend/src/harness/sqlite-run-store.ts
grep -c "INSERT INTO\|SELECT\|DELETE FROM\|UPDATE" solutions/business/article-analyzer/backend/src/article/article.service.ts
```

## D6: 端到端验证 (10/100)

如果 D1 通过（tsc 零错误）：

- **5/5 (10 pts)**: backend 启动成功 + GET /harness/tasks 返回 task + POST /articles 返回 201 + GET /articles 返回列表
- **4/5 (8 pts)**: backend 启动成功 + 3/4 验证通过
- **3/5 (6 pts)**: backend 启动成功 + 2/4 验证通过
- **2/5 (4 pts)**: backend 启动成功但 API 调用失败
- **1/5 (2 pts)**: backend 启动失败

如果 D1 不通过，D6 = 1/5 with note "Cannot test — build fails"。

**Detection**:
```bash
cd solutions/business/article-analyzer/backend && npm run build && timeout 15 node dist/main.js &
sleep 5

# Task registered
curl -s http://localhost:3033/harness/tasks | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log('Tasks:',JSON.parse(d).length)"

# Create article
curl -s -X POST http://localhost:3033/articles -H 'Content-Type: application/json' -d '{"title":"Test","inputType":"topic","initialInput":"AI trends"}'

# List articles
curl -s http://localhost:3033/articles

kill %1 2>/dev/null
```

## Penalty Rules

| ID | Severity | Trigger | Deduction |
|----|----------|---------|-----------|
| P1 | Fatal | 修改 packages/ 目录 | -100 |
| P2 | Fatal | 修改其他 solutions/ | -100 |
| P3 | Blocker | tsc 错误 > 20 | 先修复再评 |
| P4 | Major | Controller 无 @ApiTags | -5 |
| P5 | Minor | package.json 缺关键依赖 | -3 |
| P6 | Minor | 前端组件缺失 | -2/个 |
| P7 | Major | CcaasSessionProvider 静默吞异常（连接失败返回空数据而非抛出） | -5 |
| P8 | Major | SqliteRunStore.mapIterationRow 返回 steps: [] 或 status 硬编码 | -5 |

## Score Formula

```
总分 = Σ(dimension_score × weight) - penalties
```

每个 dimension 按 1-5 分打分，乘以权重得到分数。

例：D1=5/5 → 15pts, D2=4/5 → 16pts, D3=3/5 → 12pts, D4=4/5 → 16pts, D5=3/5 → 9pts, D6=3/5 → 6pts = 74 - penalties

## Threshold
- **Pass**: 75/100
- **Target**: 90/100
