# Live Lesson - AI Interactive Teaching System

## Overview
AI-driven interactive teaching system with dynamic blackboard and Socratic dialogue.

## Architecture
- **SQLite DB** (`backend/data/live-lesson.db`): Lessons + classroom_sessions + reading_students + reading_submissions tables, WAL mode. DB path is resolved from `backend/` as cwd.
- **MCP Server**: State machine backed by SQLite, 8 board control tools, session restore on startup
- **Solution Backend** (port 3007): NestJS + TypeORM server — lesson API + classroom API (session-based)
- **Frontend**: React + Vite (port 5283), boardState from output_update events, classroom data via SSE
- **Skill**: socratic-teacher - behavior guide for AI teacher

## Session Model
Each lesson run creates a **ClassroomSession** with a 6-char code (e.g. `HX3KM7`). All classroom operations (join, submit, stream, etc.) use the session code instead of lessonId. This enables multiple instances of the same lesson running concurrently.

## Key Files
- `data/lessons/math-linear-eq-intro/manifest.json` - Lesson data (13 nodes, 5 phases)
- `mcp-server/src/db.ts` - SQLite init, seed, CRUD operations
- `mcp-server/src/state-manager.ts` - Factory-based state machine with DB persistence
- `mcp-server/src/index.ts` - 8 MCP tools, DB init + session restore on startup
- `backend/src/main.ts` - NestJS bootstrap (port 3007)
- `backend/src/entities/classroom-session.entity.ts` - Session entity (code, lessonId, status)
- `backend/src/classroom/classroom.service.ts` - Session lifecycle, join, submit, state, SSE broadcast
- `backend/src/lesson/lesson.controller.ts` - Lesson list + manifest API
- `frontend/src/hooks/useClassroom.ts` - Session create/lookup, student session, teacher/student SSE hooks
- `frontend/src/hooks/useLiveLesson.ts` - boardState accumulation hook
- `frontend/src/pages/JoinPage.tsx` - Student entry: code input → name input → classroom
- `skills/socratic-teacher/SKILL.md` - AI teacher behavior guide

## Manifest & DB Seed

Lesson manifests live in `data/lessons/<id>/manifest.json` and are seeded into `backend/data/live-lesson.db` on backend startup (insert-if-not-exists). After editing a manifest:

```bash
# Re-seed: update the DB record from the manifest file
cd backend && node -e "
const fs=require('fs'),path=require('path'),DB=require('better-sqlite3');
const raw=fs.readFileSync(path.resolve('..','data/lessons/ideal-beauty-reading/manifest.json'),'utf-8');
const m=JSON.parse(raw);
const db=new DB(path.resolve('data/live-lesson.db'));
db.prepare('UPDATE lessons SET manifest_json=? WHERE id=?').run(raw,m.id);
db.close(); console.log('updated',m.id);
"
# Then restart the backend
```

The seed logic (`lesson.service.ts`) only inserts if the row doesn't exist — it never updates. So manifest edits require manual DB update or deleting the row first.

**Frontend reads manifest from the backend API** (`/api/lessons/<id>/manifest`), proxied via Vite dev server. There is no static copy — the DB is the single source of truth.

## Dev Commands
```bash
# MCP server
cd mcp-server && npm install && npm run build

# Solution backend (NestJS)
cd backend && npm install --legacy-peer-deps && npx nest build && node dist/main.js

# Frontend
cd frontend && npm install && npm run dev
```

## Ports
- Frontend: 5283
- Solution Backend: 3007 (lesson API + classroom API + SSE stream)
- CCAAS Backend: 3001 (required)

## API Proxy Architecture

Frontend uses **relative paths** for all solution backend API calls (`/api/...`). Never hardcode `http://localhost:3007` in frontend code.

### Dev (Vite proxy)

`frontend/vite.config.ts` proxies `/api` → `http://localhost:3007`:

```ts
server: {
  proxy: { '/api': 'http://localhost:3007' },
}
```

### Production deployment

Production needs a reverse proxy (nginx/Caddy/etc.) to route `/api` to the solution backend:

```nginx
# Example nginx config
server {
    listen 80;

    # Frontend static files
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Solution backend API + SSE streams
    location /api/ {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;
        # SSE support (classroom stream endpoints)
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### CCAAS SDK connection (exception)

`useLiveLesson.ts` 中 `SERVER_URL` 从 `import.meta.env.VITE_CCAAS_URL` 读取（默认 `http://localhost:3001`）。SDK 使用 Socket.IO/SSE 直连 CCAAS 后端，不走 Vite proxy。生产环境在 `frontend/.env` 设置 `VITE_CCAAS_URL` 后重新构建。

### Checklist

| 路径 | 代理目标 | 说明 |
|------|----------|------|
| `/api/*` | Solution Backend (3007) | lesson API + classroom API + SSE stream |
| CCAAS SDK `serverUrl` | CCAAS Backend (3001) | Socket.IO 直连，不走代理 |

## API Endpoints
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/lessons` | Lesson list |
| GET | `/api/lessons/:id/manifest` | Lesson manifest JSON |
| POST | `/api/classroom/sessions` | Create session `{ lessonId }` → `{ sessionId, code, lessonId, status }` |
| GET | `/api/classroom/sessions/:code` | Lookup/verify session |
| POST | `/api/classroom/sessions/:code/end` | End session |
| POST | `/api/classroom/:code/join` | Student joins `{ name }` → `{ studentId, name, lessonId }` |
| POST | `/api/classroom/:code/submit` | Submit answer `{ studentId, step, data }` → `{ ok }` |
| GET | `/api/classroom/:code/state` | Class state snapshot |
| GET | `/api/classroom/:code/stream` | SSE real-time push |
| POST | `/api/classroom/:code/step` | Teacher set step `{ step }` |
| POST | `/api/classroom/:code/notify` | Teacher notification `{ message, type }` |
| GET | `/api/classroom/:code/steps/:step/exercise` | ExerciseSpec (student-safe; select-evidence keeps grading data for client-side use) |
| POST | `/api/classroom/:code/steps/:step/check` | Check answer `{ studentId, data }` → `{ type, allCorrect, items }` |
| POST | `/api/classroom/sessions/batch-check` | Batch check sessions `{ codes[] }` |
| POST | `/api/classroom/sessions/:code/start` | Start session |
| GET | `/api/classroom/:code/chat-history` | Chat history for continue-chat threads |
| POST | `/api/classroom/:code/ai/ask` | AI question `{ studentId, question, step, messages? }` |
| POST | `/api/classroom/:code/ai/discuss` | Socratic discuss turn `{ studentId, step, message }` |
| POST | `/api/classroom/:code/ai/discuss-complete` | Mark discuss complete `{ studentId, step }` |
| POST | `/api/classroom/:code/personal-touch` | Personal touch feedback `{ studentId, step }` |
| GET | `/api/classroom/:code/bonus/:bonusStep/exercise` | Bonus exercise spec |
| POST | `/api/classroom/:code/bonus/:bonusStep/check` | Check bonus answer `{ studentId, data }` |

## Classroom State API (`GET /api/classroom/:code/state`)

The `getState()` response includes enriched teacher dashboard data:

```typescript
{
  metrics: { total, submitted, inProgress },
  healthCards: { furthest: {step,count}, median: {step}, stuck: {count,location}, aiTotal: {rounds,people} },
  stepMetrics: {
    [taskNum]: {
      currentCount, completedCount, completionRate, avgScore,
      byDimension: Record<string, {good,partial,wrong}>,  // keys are human-readable (Q1, P1, Where, etc.)
      quality: { cols: [{name,good,partial,wrong}] },       // same data in array format
      avgTime: number|null,    // seconds
      medianTime: number|null, // seconds
      aiRounds: number,        // total AI rounds this step
      aiPeople: number,        // unique students using AI this step
      alertTag: string|null,   // e.g. "Q1 错误偏高", "5 人卡住"
      issues: string[],        // e.g. ["7 人Q1 选了 C（应为 B）"]
      questionAggregates: Record<string, {count,isHigh}>,
    }
  },
  students: [{
    id, name, currentTask, currentPhase, stepStartedAt, status,  // status: done/prog/stuck/reading
    submissions: { [step]: { step, data, score, duration, aiRoundsCount } }
  }],
  questions: [...]
}
```

## Shared Schema Layer (`backend/src/schemas/`)

All cross-module types live in `backend/src/schemas/` — both `lesson/` and `classroom/` import from here. **Never import from `classroom/` inside `lesson/`** (that would create a reverse dependency).

```
src/schemas/
├── index.ts                    # barrel export
├── answer-key.schema.ts        # Zod discriminated union for 7 exercise types
├── exercise-spec.schema.ts     # Student-safe spec (no answers)
├── grade-result.schema.ts      # GradeResult { total, byDimension, attemptCounts }
├── task-map.schema.ts          # TaskMap interface
├── manifest.schema.ts          # ReadingStep + Manifest (.passthrough())
└── manifest.utils.ts           # sanitizeAnswerKey() + sanitizeManifest()
```

### Answer Key Types (server-side, contains answers)

7 types via `z.union`: `quiz`, `match`, `matrix`, `stance`, `order`, `select-evidence`, `map`. Each has a typed export (e.g. `QuizAnswerKey`, `MapAnswerKey`). The union is `AnswerKeySchema` / `AnswerKey`.

`validateAnswerKey(unknown)` wraps `safeParse` — returns `{ valid, errors }` for use in `lesson.service.ts` manifest validation.

### ExerciseSpec (student-safe, answers stripped — except select-evidence)

`sanitizeAnswerKey(answerKey) → ExerciseSpec | null` strips answer data before sending to students:

| Type | Keeps | Strips |
|------|-------|--------|
| quiz | `questions[].{idx, text, translate?, options}` | correct, hint, walkthrough |
| match | `pairs[].{idx, left, options}` | correct, hint |
| matrix | demo rows keep practice/reason; non-demo only place/isDemo | hint, non-demo practice/reason |
| stance | stanceQ, stanceQZh, stanceOpts, evidence | validPositions, minEvidence |
| order | items | correctOrder |
| select-evidence | functionOptions, sections.{id,label,range,correctFunction,hint,hintZh,aiCorrect,aiPartial}, paragraphTokens.{t,kind,why} | (nothing stripped — client-side grading) |
| map | prompt, axes, mapItems.{id,label,hint?,refs?}, minReasonLength | expected |

`sanitizeManifest(manifest)` applies `sanitizeAnswerKey` to every `readingSteps[].answerKey` — used by `lesson.service.ts` when serving manifests to frontend.

### Key Rules

- **Quiz `correct` is a numeric index** into `options[]`, not a letter. Submit data uses `{ answers: [0, 1] }` (numbers).
- **`GradingService.grade()`** calls `AnswerKeySchema.safeParse()` — invalid keys return `null`, valid keys are type-narrowed to the specific subtype before dispatching to the grader.
- **Each grader's `key` param is typed** to its specific subtype (e.g. `QuizGrader.grade(key: QuizAnswerKey, ...)`). No `any`.
- **`GradeResult.byDimension`** is `Record<string, boolean | number>`, not `Record<string, any>`.
- **Select-evidence uses client-side grading** — `sanitizeAnswerKey` intentionally keeps `correctFunction`, `hint`, `aiCorrect`/`aiPartial` on sections and `kind`/`why` on tokens. Frontend `_serverCheck` is NOT set for select-evidence. Server `/submit` grade is the source of truth.
- **Old files** (`classroom/schemas/answer-key.schema.ts`, `classroom/exercise-sanitizer.ts`) are thin re-exports — do not add new code there.

### Dependency Direction

```
src/schemas/           ← shared, imports nothing from lesson/ or classroom/
src/lesson/            → imports from src/schemas/ only
src/classroom/         → imports types from src/schemas/, owns graders + metrics
```

## Frontend Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | CourseSelectionPage | Lesson list → create session → navigate |
| `/join` | JoinPage | Student entry: code + name |
| `/session/:sessionId` | SessionPage | Student view (session-centric) |
| `/session/:sessionId/watch` | TeacherPage | Teacher dashboard (session-centric) |
| `/session/:sessionId/demo` | DemoPage | 3-panel demo (session-centric) |
| `/lesson/:lessonId` | LessonPage | Standalone lesson page |
| `/board/:lessonId` | BoardPage | Projection board (no session needed) |
