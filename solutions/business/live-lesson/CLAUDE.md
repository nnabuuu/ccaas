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
| POST | `/api/classroom/:code/ai/ask` | AI question `{ studentId, question, step }` |

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

## Frontend Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/join` | JoinPage | Student entry: code + name |
| `/teacher/:lessonId` | TeacherPage | Auto-creates session, shows code |
| `/demo/:lessonId` | DemoPage | Auto-creates session, 3-panel demo |
| `/board/:lessonId` | BoardPage | Projection board (no session needed) |
| `/student/:lessonId` | StudentPage | Redirects to /join |
