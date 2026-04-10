# Design Plan: Article Analyzer Solution

## 完整类型定义

### Backend Types (article.types.ts)

```typescript
// --- DTOs ---
export interface CreateArticleDto {
  title: string;
  inputType: 'topic' | 'draft';
  initialInput: string;
}

export interface ArticleResponse {
  id: string;
  title: string;
  inputType: 'topic' | 'draft';
  initialInput: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  latestRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunResponse {
  id: string;
  articleId: string;
  taskId: string;
  status: string;
  finalScore: number | null;
  totalIterations: number;
  exitReason: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface IterationResponse {
  id: number;
  runId: string;
  iteration: number;
  score: number | null;
  articleText: string | null;
  analysisReport: unknown | null;
  writerNotes: unknown | null;
  dimensionScores: DimensionScore[] | null;
  tokensUsed: number;
  durationMs: number;
  createdAt: string;
}

export interface DimensionScore {
  name: string;
  score: number;
  weight: number;
}
```

### CcaasSessionProvider 实现计划

```typescript
// 内部状态
private sessions = new Map<string, {
  templateId: string;
  metadata?: Record<string, unknown>;
  message?: string;
}>();
private ccaasBaseUrl: string;  // e.g. 'http://localhost:3001'
private tenantId: string;

// skill slug 映射
private skillMap: Record<string, string> = {
  'article-writer': 'article-writer',
  'article-analyzer': 'article-analyzer',
};

// waitForCompletion 流程:
// 1. POST /api/v1/sessions/${sessionId}/messages
//    body: { tenantId, message, enabledSkills: [skillSlug], autoClose: true }
//    Accept: text/event-stream
// 2. 逐行读取 SSE 流:
//    - data: {"seq":1,"event":{"type":"text_delta","delta":"..."}}
//    - data: {"seq":2,"event":{"type":"agent_status","status":"idle"}}
// 3. 收集所有 text_delta 拼接为最终文本
// 4. agent_status='idle' 时结束
// 5. 提取 token_usage 事件中的 inputTokens/outputTokens
```

### SqliteRunStore 实现计划

```typescript
// 实现 RunStore 接口，操作 SQLite 的 runs + iterations 表
// 注意: HarnessRun 的 iterations 数组在 SQLite 中是独立的 iterations 表

// createRun: INSERT INTO runs (id, article_id, task_id, status, started_at)
// updateRun: UPDATE runs SET ... WHERE id = ?
// getRun: SELECT * FROM runs WHERE id = ? + SELECT * FROM iterations WHERE run_id = ?
// listRuns: SELECT * FROM runs WHERE task_id = ? (if filter)
// appendIteration: INSERT INTO iterations (...)
// saveStepOutput: 存入 iterations 表的 JSON 字段
// getStepOutput: 从 iterations 表的 JSON 字段读取
// saveArtifact: UPDATE iterations SET article_text = ? WHERE run_id = ? AND iteration = ?
// getLatestArtifact: SELECT article_text FROM iterations WHERE run_id = ? ORDER BY iteration DESC LIMIT 1
```

### HarnessTask 完整定义

```typescript
import type { HarnessTask } from '@kedge-agentic/harness';

export function getArticleTask(): HarnessTask {
  return {
    id: 'article-logic-improvement',
    name: 'Article Logic Improvement',
    mode: 'iterative',
    spec: {
      objective: 'Iteratively improve article quality through writing and analysis cycles',
      frozenConstraints: [
        'Must preserve original thesis/topic direction',
        'Word count should stay within 20% of target',
        'Must maintain academic/professional tone',
      ],
      artifactDescription: 'A polished article with clear thesis, strong evidence, and logical flow',
    },
    agents: [
      { role: 'writer', sessionTemplateId: 'article-writer' },
      { role: 'analyzer', sessionTemplateId: 'article-analyzer' },
    ],
    pipeline: [
      {
        id: 'write',
        type: 'agent',
        role: 'writer',
        contextSources: [
          { type: 'spec' },
          { type: 'prev_output', stepId: 'analyze', outputKey: 'analysis_report' },
          { type: 'progress' },
          { type: 'latest_artifact' },
        ],
        requiredOutputs: [
          { schemaId: 'article-draft-output', outputKey: 'draft' },
        ],
      },
      {
        id: 'analyze',
        type: 'agent',
        role: 'analyzer',
        contextSources: [
          { type: 'spec' },
          { type: 'step_output', stepId: 'write', outputKey: 'draft' },
        ],
        requiredOutputs: [
          { schemaId: 'analysis-report-output', outputKey: 'analysis_report' },
        ],
      },
    ],
    exitConditions: {
      maxIterations: 10,
      scoreThreshold: 85,
      minImprovement: 2,
    },
    outputSchemas: [
      {
        id: 'article-draft-output',
        name: 'Article Draft',
        fields: [
          { key: 'content', type: 'string', required: true, description: 'The article text' },
          { key: 'changes', type: 'array', required: false, description: 'List of changes made' },
          { key: 'wordCount', type: 'number', required: false, description: 'Word count' },
        ],
      },
      {
        id: 'analysis-report-output',
        name: 'Analysis Report',
        fields: [
          { key: 'score', type: 'number', required: true, description: 'Overall score 0-100' },
          { key: 'totalScore', type: 'number', required: true, description: 'Alias for score' },
          { key: 'dimensions', type: 'array', required: true, description: 'Per-dimension scores' },
          { key: 'feedback', type: 'string', required: true, description: 'Detailed feedback' },
          { key: 'topIssue', type: 'string', required: true, description: 'Most critical issue' },
        ],
      },
    ],
  };
}
```

## 参考代码路径

| Component | Reference File |
|-----------|---------------|
| HarnessModule.forRoot | `solutions/mock/harness-demo/src/app.module.ts` |
| SessionProvider 接口 | `packages/harness/src/core/interfaces.ts` |
| MockSessionProvider (参考) | `solutions/mock/harness-demo/src/adapters/mock-session-provider.ts` |
| RunStore 接口 | `packages/harness/src/core/interfaces.ts` |
| InMemoryRunStore (参考) | `packages/harness/src/core/in-memory-run-store.ts` |
| Task 注册 | `solutions/mock/harness-demo/src/adapters/mock-setup.service.ts` |
| Demo Tasks 定义 | `solutions/mock/harness-demo/src/seed/demo-tasks.ts` |
| DatabaseModule (SQLite) | `solutions/business/ideal-beauty-poc/backend/src/database/database.module.ts` |
| NestJS main.ts | `solutions/mock/harness-demo/src/main.ts` |
| CCAAS Session API | `packages/backend/src/sessions/sessions.controller.ts` |
| SSE 事件格式 | `packages/backend/src/protocol/events.ts` |

## 前端技术栈

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "recharts": "^2.10.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

## Backend 依赖

```json
{
  "dependencies": {
    "@kedge-agentic/harness": "file:../../../../packages/harness",
    "@nestjs/common": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-express": "^10.4.22",
    "@nestjs/swagger": "^7.0.0",
    "better-sqlite3": "^11.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.9",
    "@nestjs/schematics": "^10.2.3",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.3.0"
  }
}
```
