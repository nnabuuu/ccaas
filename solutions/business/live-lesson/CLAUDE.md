# Live Lesson - AI Interactive Teaching System

## Overview
AI-driven interactive teaching system. Two product surfaces:
- **Classroom**: REST-polled teacher/student dashboards for live lessons (the main app).
- **Creator** (port 5284): rich-chat-card editor for authoring lesson manifests via ccaas. Talks to ccaas via the `creator-mcp-server/` stdio MCP server + the `creator` session template.

An earlier "AI Socratic blackboard" feature line (`mcp-server/`, `LessonPage.tsx`, `useLiveLesson.ts`, `teaching` session template, `socratic-teacher` skill) was removed in commit purging dead chain on 2026-05-28 — it was unrouted and unused.

## Architecture
- **SQLite DB** (`backend/data/live-lesson.db`): Lessons + classroom_sessions + students + submissions + snapshots tables, WAL mode. DB path is resolved from `backend/` as cwd.
- **Solution Backend** (port 3007): NestJS + TypeORM server — lesson API + classroom API (session-based) + ccaas proxy controllers for creator.
- **Frontend** (port 5283): React + Vite classroom UI, classroom data via **REST polling** (3s interval).
- **Creator** (port 5284): separate Vite app for authoring lesson plans against ccaas (rich chat cards via `creator-mcp-server/`).
- **Observation Engine**: `@kedge-agentic/observer-engine` integration — 6 event handlers emit observations consumed by teacher dashboard.

## Communication Protocol

Frontend uses **REST polling** for classroom state updates — both teacher and student poll `GET /api/classroom/:code/state` every 3 seconds.

| Client | Endpoint | Interval | Purpose |
|--------|----------|----------|---------|
| Teacher | `GET /:code/state` | 3s | Full state with metrics, students, stepMetrics |
| Student | `GET /:code/state` | 3s | Current step, notifications, phase |

The SSE endpoint (`GET /:code/stream`) still exists in code but is **dead code** — no frontend consumer uses it.

## Session Model
Each lesson run creates a **ClassroomSession** with a 6-char code (e.g. `HX3KM7`). All classroom operations (join, submit, stream, etc.) use the session code instead of lessonId. This enables multiple instances of the same lesson running concurrently.

## Backend Architecture (Clean Architecture Layers)

`backend/src/` is organized into four layers — see `docs/component-development-guide.md` for the rationale:

```
backend/src/
├── domain/                 # Pure business — no I/O, no NestJS framework concerns
│   ├── exercise-types/     # 11 per-type folders (quiz, match, matrix, ...) each holding
│   │                       #   plugin + grader + observe + sanitizer + spec + tests
│   ├── classroom/          # Session/metrics/validate-code/task-map/cluster-classifier
│   ├── discussion/         # cluster-aggregator
│   └── shared/             # Plugin/observe interfaces + decorators + grader interface
├── application/            # Use cases — orchestrate domain via repos and ports
│   ├── classroom/          # Session lifecycle, state, submission, manifest cache
│   ├── exercise/           # Type registry, grading, exercise-spec/check, plugin tests
│   ├── observation/        # Observe registry, query, coaching, depth, discuss-observe
│   ├── ai/                 # Prompt builder, discuss, ai-ask, translate, personal-touch
│   └── lesson/             # Lesson seeding + manifest serving
├── adapters/               # Outside-world I/O
│   ├── http/               # 7 controllers + dto/
│   ├── persistence/        # TypeORM entities
│   ├── observer-engine/    # Handlers + sinks + gateways
│   └── transport/          # SSE broadcast + state cache
├── infra/                  # NestJS module wiring (app.module, classroom.module, lesson.module)
└── schemas/                # Shared cross-module Zod (single answer-key union, per-type
                            #   split deferred)
```

| Service | File | Purpose |
|---------|------|---------|
| `ClassroomService` | `application/classroom/classroom.service.ts` | Session lifecycle (create, start, end), step transitions, notify |
| `ClassroomStateService` | `application/classroom/classroom-state.service.ts` | State aggregation — `getState()`, surfaces, observe registry |
| `ClassroomBroadcastService` | `adapters/transport/classroom-broadcast.service.ts` | SSE transport (dead code), snapshot persistence |
| `StudentSubmissionService` | `application/classroom/student-submission.service.ts` | Join, submit, grade, progress — emits observer events |
| `ManifestCacheService` | `application/classroom/manifest-cache.service.ts` | Cached manifest/taskMap lookups |
| `MetricsAggregator` | `domain/classroom/metrics-aggregator.ts` | Per-step metrics: completion rate, score, dimension breakdown |
| `CoachingService` | `application/observation/coaching.service.ts` | Discussion highlights + LLM-generated coaching insights |
| `AiPromptBuilder` | `application/ai/ai-prompt-builder.ts` | Shared prompt construction for all AI features |
| `GradingService` | `application/exercise/grading.service.ts` | Dispatches grade to ExerciseTypeRegistry |
| `ExerciseTypeRegistry` | `application/exercise/exercise-type-registry.ts` | Auto-discovers `@ExerciseType('<type>')` plugins, dispatches sanitize/grade/checkItems |
| `ObserveRegistry` | `application/observation/observe-registry.ts` | Auto-discovers observe handlers by exercise type |
| `ObservationQueryService` | `application/observation/observation-query.service.ts` | Aggregates observation records into dashboard data |
| `ClusterClassifier` | `domain/classroom/cluster-classifier.ts` | LLM-based classification of student discuss messages |
| `ClusterAggregator` | `domain/discussion/cluster-aggregator.ts` | Aggregates classify results into cluster stats per step |
| `DiscussService` | `application/ai/discuss.service.ts` | Socratic discussion turn logic |
| `PersonalizationService` | `application/ai/personalization.service.ts` | Per-student personalized feedback |
| `TranslateService` | `application/ai/translate.service.ts` | Vocabulary translation + follow-up chat |
| `AiAskService` | `application/ai/ai-ask.service.ts` | Student AI question answering |

## Observation Engine

Integrates `@kedge-agentic/observer-engine` to monitor classroom events in real-time.

### Event Handlers (`adapters/observer-engine/handlers/`)

6 handlers process different classroom events:

| Handler | Trigger |
|---------|---------|
| `JoinHandler` | Student joins the session |
| `ExerciseHandler` | Student submits an exercise |
| `ChatTurnHandler` | AI ask / discuss message |
| `StatusChangeHandler` | Student status changes (stuck, idle) |
| `StepCompleteHandler` | Student completes a step |
| `SystemEventHandler` | System-level events (session start/end) |

### Observe Handlers (per-type, inside `domain/exercise-types/<type>/<type>.observe.ts`)

Per-exercise-type observation renderers for the teacher's observe drawer. Each lives in its own type folder; the discuss observe handler (not type-specific) lives in `application/observation/discuss.observe.ts`.

| Handler | File |
|---------|------|
| `QuizObserveHandler` | `domain/exercise-types/quiz/quiz.observe.ts` |
| `MatrixObserveHandler` | `domain/exercise-types/matrix/matrix.observe.ts` |
| `SelectEvidenceObserveHandler` | `domain/exercise-types/select-evidence/select-evidence.observe.ts` |
| `MapObserveHandler` | `domain/exercise-types/map/map.observe.ts` |
| `ImageUploadObserveHandler` | `domain/exercise-types/image-upload/image-upload.observe.ts` |
| `GuidedDiscoveryObserveHandler` | `domain/exercise-types/guided-discovery/guided-discovery.observe.ts` |
| `DiscussObserveHandler` | `application/observation/discuss.observe.ts` |

Note: the `@ObserveType('mc')` and `@ObserveType('evidence')` decorator strings are preserved for routing-contract compatibility — the file/class names changed (`mc.handler` → `quiz.observe`, `evidence.handler` → `select-evidence.observe`) but the string IDs sent over the wire did not.

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

### Exercise Review Restore Pattern

Each exercise component self-manages its review restore via the `useReviewRestore` hook. PracticePhase only constructs and passes `reviewData`.

**Architecture:**
- `hooks/useReviewRestore.ts` — shared hook: `useReviewRestore<T>(reviewData, parse, onDone?) → T | null`
- `ReviewData` type: `{ data: Record<string, unknown>; checkItems?: CheckItem[] }`
- Each component exports a **pure parse function** (`parseXxxReview`) that converts `ReviewData → { state: T, allDone: boolean }`
- Hook runs parse once at mount via `useState` initializer; result is stable across re-renders
- Components overlay: `const effectiveAns = restored?.ans ?? ans` — hook result overrides props when in review mode

**PracticePhase responsibilities (minimal):**
- Constructs `reviewPayload: ReviewData | undefined` from `prevSubmission`
- Passes `reviewData={reviewPayload}` to each exercise component
- Keeps `effectiveAllDone = reviewMode || allDone` as a defensive prop

**Adding a new exercise type checklist:**
1. Add `reviewData?: ReviewData` to component Props
2. Export `parseXxxReview(review: ReviewData, ...extras) → ReviewRestoreResult<T>` — pure function, no React
3. Call `useReviewRestore(reviewData, parse)` at top of component
4. Overlay: `const effective* = restored?.* ?? prop*`
5. Add unit tests in `exercise/__tests__/review-restore.test.ts`
6. Add integration test in `exercise/__tests__/review-restore-integration.test.ts`

**Test files:**
- `exercise/__tests__/review-restore.test.ts` — unit tests for all 11 parse functions
- `exercise/__tests__/review-restore-integration.test.ts` — CachedSubmission → ReviewData → parse → state verification

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
- `creator-mcp-server/src/index.ts` - 3 emit_*_card stdio MCP tools used by the creator app
- `backend/src/main.ts` - NestJS bootstrap (port 3007)
- `backend/src/infra/app.module.ts` - top-level NestJS module composition
- `backend/src/adapters/persistence/entities/classroom-session.entity.ts` - Session entity (code, lessonId, status)
- `backend/src/application/classroom/classroom.service.ts` - Session lifecycle, step transitions, notify
- `backend/src/application/classroom/classroom-state.service.ts` - State aggregation, getState(), surfaces
- `backend/src/application/classroom/student-submission.service.ts` - Join, submit, grade, progress
- `backend/src/domain/classroom/metrics-aggregator.ts` - Per-step metrics computation
- `backend/src/application/observation/coaching.service.ts` - Discussion highlights + coaching insights
- `backend/src/application/observation/observe-registry.ts` - Auto-discover observe handlers
- `backend/src/application/observation/observation-query.service.ts` - Observation dashboard aggregation
- `backend/src/application/exercise/exercise-type-registry.ts` - Auto-discover `@ExerciseType` plugins
- `backend/src/adapters/http/lesson.controller.ts` - Lesson list + manifest API
- `backend/src/application/lesson/lesson.service.ts` - Lesson seeding + sanitize-manifest dispatch
- `frontend/src/hooks/useClassroom.ts` - Session create/lookup, student/teacher polling hooks (3s)
- `frontend/src/pages/JoinPage.tsx` - Student entry: code input → name input → classroom
- `frontend/src/components/student/StudentGuide.tsx` - First-visit welcome guide
- `frontend/src/components/student/TranslateButton.tsx` - Context-aware translate
- `frontend/src/components/teacher/ObservationPanel.tsx` - Teacher observation dashboard
- `frontend/src/components/teacher/CoachingPanel.tsx` - Teacher coaching insights

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

The seed logic (`application/lesson/lesson.service.ts`) only inserts if the row doesn't exist — it never updates. So manifest edits require manual DB update or deleting the row first.

**Frontend reads manifest from the backend API** (`/api/lessons/<id>/manifest`), proxied via Vite dev server. There is no static copy — the DB is the single source of truth.

## Dev Commands
```bash
# Creator MCP server (emit_*_card tools)
cd creator-mcp-server && npm install && npm run build

# Solution backend (NestJS)
cd backend && npm install --legacy-peer-deps && npx nest build && node dist/main.js

# Frontend (classroom)
cd frontend && npm install && npm run dev

# Creator app
cd creator && npm install && npm run dev

# Type-check frontend (use `npm run build`, NOT `tsc --noEmit`)
cd frontend && npm run build
```

## Ports
- Frontend (classroom): 5283
- Creator (course editor): 5284 — see `creator/vite.config.ts`
- Solution Backend: 3007 (lesson API + classroom API + project artifacts API)
- CCAAS Backend: 3001 (required)

## Creator app env

The course-editor creator app at `creator/` consumes the ccaas agent-runtime via **same-origin proxy** through the live-lesson backend — the browser never holds a ccaas key. One env var:

| Var | Default | Purpose |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3007` | Vite proxy target for `/api/*` → live-lesson backend |

No `VITE_*` browser-exposed env vars. The ccaas key + URL live on the **backend** side (see `backend/.env`):

| Var | Required | Purpose |
|---|---|---|
| `CCAAS_API_KEY` | yes | Tenant API key — backend uses it as Bearer / `?token=` on every upstream ccaas call. The browser must never see this. |
| `CCAAS_URL` | no (`http://localhost:3001`) | Upstream ccaas base URL. |

See `creator/.env.example` + backend `.env.example` for templates.

### ccaas proxy controllers (browser → live-lesson → ccaas)

`backend/src/adapters/http/`:

| Controller | Routes | Notes |
|---|---|---|
| `CcaasProxyController` | `GET /api/projects/:id/changes` (SSE), `POST /api/projects/:id/invalidate` | The original proxy. SSE uses `?token=` query string (EventSource can't set headers). |
| `CcaasChatProxyController` | `GET /api/sessions/:sid/messages` (history), `POST /api/sessions/:sid/messages` (chat SSE, raw Express because `@Sse()` is GET-only), `POST /api/sessions/:sid/bind-project` | Added for the v7 chat UI. Uses `Authorization: Bearer`. Injects `tenantId` server-side via `CcaasUpstream.resolveTenantId()` so the browser body carries only the user's intent. |
| `CcaasUpstream` (service) | shared helper | `resolveCcaas()` + `resolveTenantId()` (lazy single-flight cache) + `scrubToken()` (redacts both `?token=` and `Bearer` forms before any log/error message). |

Memory pointer: `~/.claude/projects/.../memory/ccaas-proxy-pattern.md` captures the platform-wide rule + the "parallel-work flag" caveat that originally caused this leak.

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

### Checklist

| 路径 | 代理目标 | 说明 |
|------|----------|------|
| `/api/*` | Solution Backend (3007) | lesson API + classroom API (REST polling) + ccaas proxy controllers for creator |
| Creator app `/api/*` | Solution Backend (3007) | same-origin proxy — creator never holds CCAAS_API_KEY (see Creator app env section) |

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
### Dependency Direction (clean-arch layers)

```
domain/        ← pure business; depends on nothing
schemas/       ← shared Zod definitions; depends on nothing
application/   → domain + schemas (use cases orchestrating domain)
adapters/      → application + domain + schemas (controllers / IO)
infra/         → everything (NestJS module wiring)
```

`schemas/answer-key.schema.ts` is still a single union file (per-type split into `domain/exercise-types/<type>/<type>.schema.ts` is on the backlog). Until that lands, plugin authors define their schema inline in `<type>.plugin.ts` and the shared union stays in `schemas/`.

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
