# Live Lesson - AI Interactive Teaching System

## Overview
AI-driven interactive teaching system with dynamic blackboard and Socratic dialogue.

## Architecture
- **SQLite DB** (`backend/data/live-lesson.db`): Lessons + classroom_sessions + students + submissions + snapshots tables, WAL mode. DB path is resolved from `backend/` as cwd.
- **MCP Server**: State machine backed by SQLite, 8 board control tools, session restore on startup
- **Solution Backend** (port 3007): NestJS + TypeORM server — lesson API + classroom API (session-based)
- **Frontend**: React + Vite (port 5283), boardState from output_update events, classroom data via **REST polling** (3s interval)
- **Observation Engine**: `@kedge-agentic/observer-engine` integration — 6 event handlers emit observations consumed by teacher dashboard
- **Skill**: socratic-teacher - behavior guide for AI teacher

## Communication Protocol

Frontend uses **REST polling** for classroom state updates — both teacher and student poll `GET /api/classroom/:code/state` every 3 seconds.

| Client | Endpoint | Interval | Purpose |
|--------|----------|----------|---------|
| Teacher | `GET /:code/state` | 3s | Full state with metrics, students, stepMetrics |
| Student | `GET /:code/state` | 3s | Current step, notifications, phase |

The SSE endpoint (`GET /:code/stream`) still exists in code but is **dead code** — no frontend consumer uses it.

CCAAS SDK (`useLiveLesson.ts`) still uses Socket.IO/SSE to connect to CCAAS backend (port 3001) for the board flow — this is separate from the classroom polling.

## Session Model
Each lesson run creates a **ClassroomSession** with a 6-char code (e.g. `HX3KM7`). All classroom operations (join, submit, stream, etc.) use the session code instead of lessonId. This enables multiple instances of the same lesson running concurrently.

## Backend Service Decomposition

The classroom module is split into focused services:

| Service | File | Purpose |
|---------|------|---------|
| `ClassroomService` | `classroom.service.ts` | Session lifecycle (create, start, end), step transitions, notify |
| `ClassroomStateService` | `classroom-state.service.ts` | State aggregation — `getState()`, surfaces, observe registry |
| `ClassroomBroadcastService` | `classroom-broadcast.service.ts` | SSE transport (dead code), snapshot persistence |
| `StudentSubmissionService` | `student-submission.service.ts` | Join, submit, grade, progress — emits observer events |
| `ManifestCacheService` | `manifest-cache.service.ts` | Cached manifest/taskMap lookups |
| `MetricsAggregator` | `metrics-aggregator.ts` | Per-step metrics: completion rate, score, dimension breakdown |
| `CoachingService` | `coaching.service.ts` | Discussion highlights + LLM-generated coaching insights |
| `AiPromptBuilder` | `ai-prompt-builder.ts` | Shared prompt construction for all AI features |
| `GradingService` | `exercise/grading.service.ts` | Type-safe grading dispatch to 7 graders |
| `ObserveRegistry` | `observe/observe-registry.ts` | Auto-discovers observe handlers by exercise type |
| `ObservationQueryService` | `observation/observation-query.service.ts` | Aggregates observation records into dashboard data |
| `ClusterClassifier` | `socratic-discuss/cluster-classifier.ts` | LLM-based classification of student discuss messages |
| `ClusterAggregator` | `socratic-discuss/cluster-aggregator.ts` | Aggregates classify results into cluster stats per step |
| `DiscussService` | `socratic-discuss/discuss.service.ts` | Socratic discussion turn logic |
| `PersonalizationService` | `personal-touch/personalization.service.ts` | Per-student personalized feedback |
| `TranslateService` | `translate/translate.service.ts` | Vocabulary translation + follow-up chat |
| `AiAskService` | `ai-ask/ai-ask.service.ts` | Student AI question answering |

## Observation Engine

Integrates `@kedge-agentic/observer-engine` to monitor classroom events in real-time.

### Event Handlers (`observation/handlers/`)

6 handlers process different classroom events:

| Handler | Trigger |
|---------|---------|
| `JoinHandler` | Student joins the session |
| `ExerciseHandler` | Student submits an exercise |
| `ChatTurnHandler` | AI ask / discuss message |
| `StatusChangeHandler` | Student status changes (stuck, idle) |
| `StepCompleteHandler` | Student completes a step |
| `SystemEventHandler` | System-level events (session start/end) |

### Observe Handlers (`observe/handlers/`)

Per-exercise-type observation renderers for the teacher's observe drawer:

| Handler | Exercise Type |
|---------|---------------|
| `McHandler` | Quiz (multiple choice) |
| `MatrixHandler` | Matrix exercises |
| `EvidenceHandler` | Select-evidence |
| `MapHandler` | Map exercises |
| `DiscussHandler` | Socratic discussion |

### ObservationQueryService

Aggregates raw observations into:
- **Student logs**: per-student event timeline
- **Alerts**: idle/stuck/struggling detection
- **Indicator stats**: progress tracking per observation indicator

## Teacher Dashboard

3-tab architecture on `TeacherPage`:

| Tab | Component | Data Source |
|-----|-----------|-------------|
| 讨论洞察 | `DiscussInsightTab` | `ClusterAggregator` stats + observation logs + questions |
| 学生分析 | `SummaryTab` | Quadrants, candidates, weak dimensions |
| 课堂状态 | `ClassroomStatusTab` | Alerts + coaching tips + LLM insights + indicators |

Additional features:
- **Timeline**: `Timeline.tsx` — snapshot replay, scrub through session history via `GET /:code/snapshots`
- **Band**: `Band.tsx` — student progress band visualization
- **Observe Drawer**: per-step exercise-type-specific observation views

## Student UI Structure

### Phase Flow

Students progress through phases within each step:

`Listen → Practice → Discuss → Takeaway → PersonalTouch → Bonus`

Each phase has a dedicated component under `components/student/`:
- `exercise/PracticePhase.tsx` — exercise interaction
- `discuss/DiscussPhase.tsx` — Socratic discussion
- `personal-touch/` — personalized feedback

### Toolbar Components

- `HelpButton.tsx` + `HelpGuide.tsx` — contextual help overlay
- `TranslateButton.tsx` — select text → translate with context-aware AI
- `ai-ask/` — AI question panel
- `StudentGuide.tsx` — first-visit welcome modal (per-student localStorage key)
- `AudioButton.tsx` — text-to-speech for reading content

### Key Components

- `StudentShell.tsx` — layout shell for student view
- `TaskPanel.tsx` — current task display with phase routing
- `TextPanel.tsx` — reading text display with `BoardInline.tsx`

## AI Features

| Feature | Backend | Frontend | Purpose |
|---------|---------|----------|---------|
| AI Ask | `ai-ask/ai-ask.service.ts` | `ai-ask/` | Student asks free-form questions |
| Socratic Discuss | `socratic-discuss/discuss.service.ts` | `discuss/DiscussPhase.tsx` | Multi-turn guided discussion |
| Translate | `translate/translate.service.ts` | `TranslateButton.tsx` | Context-aware vocabulary translation + follow-up |
| Personal Touch | `personal-touch/personalization.service.ts` | `personal-touch/` | Per-student personalized feedback |
| Coaching | `coaching.service.ts` | `CoachingPanel.tsx` | Teacher coaching insights from discussion highlights |
| Cluster Classification | `socratic-discuss/cluster-classifier.ts` | `CoachingPanel.tsx` | Classify student discuss messages into predefined clusters |

## Key Files
- `data/lessons/ideal-beauty-reading/manifest.json` - Lesson manifest (reading lesson)
- `mcp-server/src/db.ts` - SQLite init, seed, CRUD operations
- `mcp-server/src/state-manager.ts` - Factory-based state machine with DB persistence
- `mcp-server/src/index.ts` - 8 MCP tools, DB init + session restore on startup
- `backend/src/main.ts` - NestJS bootstrap (port 3007)
- `backend/src/entities/classroom-session.entity.ts` - Session entity (code, lessonId, status)
- `backend/src/classroom/classroom.service.ts` - Session lifecycle, step transitions, notify
- `backend/src/classroom/classroom-state.service.ts` - State aggregation, getState(), surfaces
- `backend/src/classroom/student-submission.service.ts` - Join, submit, grade, progress
- `backend/src/classroom/metrics-aggregator.ts` - Per-step metrics computation
- `backend/src/classroom/coaching.service.ts` - Discussion highlights + coaching insights
- `backend/src/classroom/observe/observe-registry.ts` - Auto-discover observe handlers
- `backend/src/classroom/observation/observation-query.service.ts` - Observation dashboard aggregation
- `backend/src/lesson/lesson.controller.ts` - Lesson list + manifest API
- `frontend/src/hooks/useClassroom.ts` - Session create/lookup, student/teacher polling hooks (3s)
- `frontend/src/hooks/useLiveLesson.ts` - boardState accumulation hook
- `frontend/src/pages/JoinPage.tsx` - Student entry: code input → name input → classroom
- `frontend/src/components/student/StudentGuide.tsx` - First-visit welcome guide
- `frontend/src/components/student/TranslateButton.tsx` - Context-aware translate
- `frontend/src/components/teacher/ObservationPanel.tsx` - Teacher observation dashboard
- `frontend/src/components/teacher/CoachingPanel.tsx` - Teacher coaching insights
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

# Type-check frontend (use `npm run build`, NOT `tsc --noEmit`)
cd frontend && npm run build
```

## Ports
- Frontend: 5283
- Solution Backend: 3007 (lesson API + classroom API)
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

    # Solution backend API (REST polling, no SSE buffering needed)
    location /api/ {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;
    }
}
```

### CCAAS SDK connection (exception)

`useLiveLesson.ts` 中 `SERVER_URL` 从 `import.meta.env.VITE_CCAAS_URL` 读取（默认 `http://localhost:3001`）。SDK 使用 Socket.IO/SSE 直连 CCAAS 后端，不走 Vite proxy。生产环境在 `frontend/.env` 设置 `VITE_CCAAS_URL` 后重新构建。

### Checklist

| 路径 | 代理目标 | 说明 |
|------|----------|------|
| `/api/*` | Solution Backend (3007) | lesson API + classroom API (REST polling) |
| CCAAS SDK `serverUrl` | CCAAS Backend (3001) | Socket.IO 直连，不走代理 |

## API Endpoints
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/lessons` | Lesson list |
| GET | `/api/lessons/:id/manifest` | Lesson manifest JSON |
| POST | `/api/classroom/sessions` | Create session `{ lessonId }` → `{ sessionId, code, lessonId, status }` |
| GET | `/api/classroom/sessions` | List sessions (with optional filters) |
| GET | `/api/classroom/sessions/:code` | Lookup/verify session |
| POST | `/api/classroom/sessions/:code/start` | Start session |
| POST | `/api/classroom/sessions/:code/end` | End session |
| POST | `/api/classroom/sessions/batch-check` | Batch check sessions `{ codes[] }` |
| POST | `/api/classroom/:code/join` | Student joins `{ name }` → `{ studentId, name, lessonId }` |
| POST | `/api/classroom/:code/submit` | Submit answer `{ studentId, step, data }` → `{ ok }` |
| POST | `/api/classroom/:code/phase` | Student phase transition `{ studentId, step, phase }` |
| GET | `/api/classroom/:code/state` | Class state snapshot (polled every 3s) |
| GET | `/api/classroom/:code/stream` | SSE stream (dead code — unused by frontend) |
| GET | `/api/classroom/:code/snapshots` | Snapshot timeline for replay |
| GET | `/api/classroom/:code/steps/:step/surfaces` | Observation surfaces for a step |
| GET | `/api/classroom/:code/steps/:step/observe/:type` | Observe drawer data by exercise type |
| GET | `/api/classroom/:code/students/:studentId/submissions/:step` | Single submission detail |
| GET | `/api/classroom/:code/students/:studentId/progress` | Student progress summary |
| GET | `/api/classroom/:code/chat-history` | Chat history for continue-chat threads |
| POST | `/api/classroom/:code/step` | Teacher set step `{ step }` |
| POST | `/api/classroom/:code/notify` | Teacher notification `{ message, type }` |
| GET | `/api/classroom/:code/steps/:step/exercise` | ExerciseSpec (student-safe; select-evidence keeps grading data for client-side use) |
| POST | `/api/classroom/:code/steps/:step/check` | Check answer `{ studentId, data }` → `{ type, allCorrect, items }` |
| POST | `/api/classroom/:code/ai/ask` | AI question `{ studentId, question, step, messages? }` |
| POST | `/api/classroom/:code/ai/discuss` | Socratic discuss turn `{ studentId, step, message }` |
| POST | `/api/classroom/:code/ai/discuss-complete` | Mark discuss complete `{ studentId, step }` |
| POST | `/api/classroom/:code/personal-touch` | Personal touch feedback `{ studentId, step }` |
| GET | `/api/classroom/:code/bonus/:bonusStep/exercise` | Bonus exercise spec |
| POST | `/api/classroom/:code/bonus/:bonusStep/check` | Check bonus answer `{ studentId, data }` |
| POST | `/api/classroom/:code/translate` | Translate text `{ studentId, text, step, sourceContext, phase? }` → `{ definition, contextAnalysis, suggestedQuestions }` |
| POST | `/api/classroom/:code/translate/chat` | Translate follow-up `{ studentId, step, originalText, question, sourceContext }` → `{ reply }` |

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
| `/how-to-join` | HowToJoinPage | QR code / instructions for students to join |
| `/sessions` | SessionListPage | List all sessions with status |

## E2E Tests

Test specs in `e2e/specs/`:

| Spec | Coverage |
|------|----------|
| `01-smoke.spec.ts` | Basic server health |
| `02-session-lifecycle.spec.ts` | Create → start → end session |
| `03-student-join.spec.ts` | Student join flow |
| `04-exercise-check.spec.ts` | Exercise grading |
| `05-submit-progression.spec.ts` | Submit + step progression |
| `06-teacher-dashboard.spec.ts` | Teacher state/metrics |
| `07-ai-endpoints.spec.ts` | AI ask/discuss endpoints |
| `08-snapshot.spec.ts` | Snapshot timeline |
| `09-discuss-recovery.spec.ts` | Discuss session recovery |
| `10-observe-drawer.spec.ts` | Observe drawer data |
| `11-coaching-panel.spec.ts` | Coaching highlights/insights |
| `12-rest-polling.spec.ts` | REST polling correctness |
| `13-translate.spec.ts` | Translate + follow-up chat |
| `full-student-walkthrough.spec.ts` | End-to-end student flow |
| `teacher-observe-walkthrough.spec.ts` | End-to-end teacher observation |

## Design Docs

Frontend design documents live in `frontend/design/` — HTML mockups and architecture references.
