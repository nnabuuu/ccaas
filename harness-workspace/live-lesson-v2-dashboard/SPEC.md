# SPEC — live-lesson-v2-dashboard

## Objective

Upgrade the live-lesson system to V2: backend data layer enhancements (manifest answer keys, auto-grading, progress tracking) + Teacher Swimlane Dashboard + Student 4-Phase task flow. AI-related features use empty states only.

## Artifact Scope

```
solutions/business/live-lesson/backend/src/   # Backend service changes
solutions/business/live-lesson/data/           # Manifest answer key additions
solutions/business/live-lesson/frontend/       # Frontend V2 rewrite
```

## Design References

| What | Path (relative to `solutions/business/live-lesson/`) |
|------|------|
| Teacher V2 HTML | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/teacher.html` |
| Student V2 JSX | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/student-app.jsx` |
| Student wrapper | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/student.html` |
| Demo orchestrator | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/demo.html` |
| Design tokens | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/colors_and_type.css` |
| Teacher design doc | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/docs/teacher-dashboard-design.md` |
| Student modal doc | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/docs/student-modal-redesign.md` |
| Manifest | `data/lessons/ideal-beauty-reading/manifest.json` |
| Backend service | `backend/src/classroom/classroom.service.ts` |
| Backend entities | `backend/src/entities/` |
| Solution CLAUDE.md | `CLAUDE.md` |

## Existing System

### Backend (NestJS on :3007)
- `ClassroomService`: session lifecycle, join, submit, SSE broadcast, step control
- Entities: `ClassroomSession`, `Student`, `Submission`, `Lesson`
- SSE stream at `GET /api/classroom/:code/stream`
- State snapshot at `GET /api/classroom/:code/state`
- Submit at `POST /api/classroom/:code/submit` with `{ studentId, step, data }`
- AI question at `POST /api/classroom/:code/ai/ask` with `{ studentId, question, step }`

### Frontend (React + Vite on :5283)
- `TeacherShell.tsx` — current teacher dashboard
- `StudentShell.tsx` — current student view
- `useClassroom.ts` — session hooks + SSE
- `useLiveLesson.ts` — board state accumulation
- `useReadingLesson.ts` — reading lesson data hook
- Routes: `/join`, `/teacher/:lessonId`, `/student/:lessonId`, `/demo/:lessonId`, `/board/:lessonId`, `/lesson/:lessonId`

## Changes Required

### Phase 1: Manifest Answer Key

Add `answerKey` field to each task step's exercise data in `manifest.json`. The answer key defines the correct answers for auto-grading.

**Format by exercise type:**

```jsonc
// Task 1 (quiz — 3 MCQ questions)
"answerKey": {
  "type": "quiz",
  "answers": [
    { "questionIdx": 0, "correct": 1 },   // option index
    { "questionIdx": 1, "correct": 2 },
    { "questionIdx": 2, "correct": 0 }
  ]
}

// Task 2 (match — 4 paragraph-section pairs)
"answerKey": {
  "type": "match",
  "answers": [
    { "pairIdx": 0, "left": "¶1-2", "correct": "Phenomenon" },
    { "pairIdx": 1, "left": "¶3-4", "correct": "History" },
    { "pairIdx": 2, "left": "¶5-7", "correct": "Culture" },
    { "pairIdx": 3, "left": "¶8", "correct": "Conclusion" }
  ]
}

// Task 3 (matrix — 6 rows: 1 demo + 5 fill-in)
"answerKey": {
  "type": "matrix",
  "answers": [
    { "rowIdx": 0, "place": "Ancient Egypt", "practice": "kohl eye paint", "reason": "status", "isDemo": true },
    { "rowIdx": 1, "place": "1600s Europe", "practice": "plump and pale-skinned", "reason": "wealth" },
    { "rowIdx": 2, "place": "Borneo", "practice": "tattoos", "reason": "diary of events" },
    { "rowIdx": 3, "place": "NZ Maori", "practice": "tā moko", "reason": "position in society" },
    { "rowIdx": 4, "place": "Myanmar", "practice": "metal neck rings", "reason": "beauty/identity" },
    { "rowIdx": 5, "place": "Indonesia", "practice": "sharpened teeth", "reason": "cultural identity" }
  ]
}

// Task 4 (stance — position + evidence)
"answerKey": {
  "type": "stance",
  "validPositions": ["agree", "partly", "disagree"],
  "minEvidence": 2
}

// Task 5 (order — sort 4 strategies)
"answerKey": {
  "type": "order",
  "correctOrder": ["Predict", "Skim", "Scan", "Evaluate"]
}
```

**Where to add**: Each task step (`s1`–`s5`) in `readingSteps` should gain an `answerKey` field inside `studentView` (or at step level).

### Phase 2: Backend — Auto-Grading + Progress Tracking

#### 2a: Submit Auto-Grading (`classroom.service.ts`)

Enhance the `submit` method to:
1. Load the manifest's `answerKey` for the submitted step
2. Compare student's `data` against `answerKey`
3. Calculate per-dimension scores:
   - Quiz: % of correct answers
   - Match: % of correct pairs
   - Matrix: per-column accuracy (place/practice/reason)
   - Stance: has valid position + ≥ 2 evidence
   - Order: all-or-nothing
4. Store the score in the `Submission` entity (add `score` column if needed)
5. Return `{ ok: true, score: { total, byDimension } }` in the response

#### 2b: Student Progress Tracking

Add tracking for each student's current position:
- `currentTask`: which task (1–5) the student is on
- `currentPhase`: which phase (listen/practice/discuss/takeaway)
- `stepStartedAt`: when they started the current task
- `stepCompletedAt`: when they completed (submitted) the current task

This can be stored in an extended `Student` entity or a new `student_progress` column/table.

#### 2c: ClassroomState Enhancement

The state snapshot (`GET /api/classroom/:code/state`) should include:
```jsonc
{
  "students": [
    {
      "id": "...",
      "name": "陈昕妍",
      "currentTask": 3,
      "currentPhase": "practice",
      "stepStartedAt": "2024-01-01T10:00:00Z",
      "submissions": [
        { "step": 1, "score": { "total": 100, "byDimension": { "q0": true, "q1": true, "q2": true } } },
        { "step": 3, "score": { "total": 60, "byDimension": { "place": 80, "practice": 60, "reason": 40 } } }
      ]
    }
  ],
  "stepMetrics": {
    "1": { "currentCount": 0, "completedCount": 42, "completionRate": 100, "avgScore": 95 },
    "3": { "currentCount": 26, "completedCount": 8, "completionRate": 19, "avgScore": 31 }
  },
  "questions": [
    { "studentId": "...", "studentName": "王译文", "step": 3, "question": "Myanmar 在哪里？", "timestamp": "..." }
  ]
}
```

#### 2d: Question Persistence

The `POST /api/classroom/:code/ai/ask` endpoint should persist the question (not the AI answer — that's out of scope). Store: `studentId`, `step`, `question`, `timestamp`.

### Phase 3: Frontend — Design Tokens + CSS

#### Design Token System (from `colors_and_type.css`)

```css
:root {
  --bg: #f4f3ef;
  --surface: #fbfaf7;
  --surface2: #edece7;
  --t1: #1c1c1a;
  --t2: #5c5b56;
  --t3: #9c9a92;
  --border: rgba(28,28,26,.07);
  --blue: #1a5fa0;  --blue-bg: #e4eff8;
  --green: #2d6612; --green-bg: #e6f2dc;
  --amber: #7a4d0e; --amber-bg: #f6edda;
  --red: #942929;   --red-bg: #f8e6e6;
  --purple: #3a3185; --purple-bg: #eceafe;
  --teal: #0d5245;  --teal-bg: #ddf1eb;
  --coral: #6b2a14; --coral-bg: #f7ebe5;
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px;
  --r-pill: 3px; --r-input: 6px; --r-card: 10px; --r-card-lg: 12px;
  --sidebar-w: 232px; --topbar-h: 48px;
}
```

### Phase 4: Frontend — Teacher V2 (Swimlane Dashboard)

Rewrite `TeacherShell.tsx` + `teacher.css` based on `teacher.html`.

#### Layout Structure
```
body (flex column, 100vh, overflow:hidden)
  .band (44px topbar)
    "R" mark | 课堂观察台 | badges | class info | sync status
  .timeline (40px scrubber)
    prev | time | track with task markers + thumb | total | live label | next | live btn
  .body (grid: 1fr 330px)
    .focus (left, overflow-y:auto)
      .health (4-col grid: 最快进度 / 中位进度 / 卡点学生 / AI对话)
      .swimlane (5 rows, one per task)
        Each .swim-row: task label | student dots (.sdot) | completion %
        Dot colors: done=green, prog=blue, stuck=amber, lecture=grey
        AI pip: purple overlay dot for active AI conversations
      .patterns (2×2 observation cards) — empty state for V2
      .coaching (collapsible teaching suggestions) — empty state for V2
    .overview (330px right column)
      #stepDetail (click swim-row → show step detail)
        Per-dimension quality bars (real backend data)
        Issue list
      .ai-section (empty state: "—")
      .queue-section (question queue from backend data)
        Grouped by Task, showing real questions
```

#### Data Binding
- Health cards: `最快进度` / `中位进度` from `stepMetrics` max/median
- Health cards: `卡点学生` count students stuck > 3min on same step
- Swimlane dots: position from `students[].currentTask`, color from submission score
- Step detail bars: from `stepMetrics[step].avgScore` breakdown
- Question queue: from `state.questions[]` grouped by step

#### Student Detail Modal
Click student dot → modal showing:
- Header: name, current step, phase, time spent, submission count
- Left: submission data (e.g., matrix table with error marks)
- Right: AI chat history (empty state if no AI)

### Phase 5: Frontend — Student V2 (4-Phase Task Flow)

Rewrite `StudentShell.tsx` based on `student-app.jsx`.

#### Layout Structure
```
.root (flex column, 100vh)
  .topBar (44px)
  .progRow (5 progress dots with connecting lines)
  .mainWrap (flex row)
    .leftCol (scrollable)
      TaskView → phaseNav (sticky) + scrollable phases
        ListenPhase: task intro text
        PracticePhase: exercise (quiz/match/matrix/stance/order)
        DiscussPhase (unlocked after Practice submit)
        TakeawayPhase (unlocked after Discuss)
    TextPanel (right col)
      Sticky header + paragraph scroll
      Focused paragraphs at full opacity, others dimmed
      Signal word highlighting
    AIFloat (fixed FAB, bottom-right)
      Preset Q&A chips + free text input
```

#### Exercise Types (from student-app.jsx)
1. **Quiz**: radio MCQ, retry on wrong, lock on correct, attempt counter
2. **Match**: left label → pick from options, same retry/lock
3. **Matrix**: 6-row table with text inputs, submit sends to backend for grading
4. **Stance**: agree/partly/disagree buttons + evidence checkboxes (≥1 required)
5. **Order**: click-to-select ordering, retry on wrong

#### Phase Progression
- `PHASE_IDS = ['listen', 'practice', 'discuss', 'takeaway']`
- Sticky tab bar with lock icons for unreached phases
- IntersectionObserver tracks viewport phase
- Practice completion → unlocks Discuss
- Discuss completion → unlocks Takeaway
- Takeaway has "Next Task" button

#### Backend Integration
- On exercise submit: `POST /api/classroom/:code/submit { studentId, step, data }`
- Backend returns score → show feedback
- On AI question: `POST /api/classroom/:code/ai/ask { studentId, question, step }`
- Progress tracked via submit events (backend updates `currentTask`)

### Phase 6: Integration

- SSE real-time sync: student submit → teacher dashboard updates
- Health cards update on new submissions
- Swimlane dots move/recolor on student progress
- Question queue updates on ai/ask
- Legacy `/lesson/:lessonId` route continues to work
- CourseSelectionPage reading card navigation works

## Frozen Constraints

```
packages/                              # Platform code — DO NOT MODIFY
solutions/business/edu-platform/       # Other solutions — DO NOT MODIFY
solutions/business/recipe-book/        # Other solutions — DO NOT MODIFY
solutions/business/live-lesson/mcp-server/src/  # MCP server — DO NOT MODIFY
```

**NOT frozen**: `backend/src/`, `data/`, `frontend/` — these are the artifact.

## Prerequisites

### Preflight (runs once before loop)
| Check | Command | On Failure |
|-------|---------|------------|
| claude CLI | `which claude` | ABORT: install claude |
| jq | `which jq` | ABORT: `brew install jq` |
| Node.js | `node --version` | ABORT: install node |
| npm | `npm --version` | ABORT: install npm |
| Core backend deps | `ls packages/backend/node_modules` | RUN: `npm install` |
| Solution backend deps | `ls solutions/business/live-lesson/backend/node_modules` | RUN: `npm install --legacy-peer-deps` |
| Frontend deps | `ls solutions/business/live-lesson/frontend/node_modules` | RUN: `npm install` |

### Health (between iterations, optional)
| Check | Command | On Failure |
|-------|---------|------------|
| Core backend | `curl -s http://localhost:3001/api/v1/health` | RESTART |
| Lesson backend | `curl -s http://localhost:3007/api/lessons` | RESTART |
| Frontend | `curl -s http://localhost:5283` | RESTART |

## Estimated Resource Usage
- ~10 iterations × ~$12/iteration = ~$120 estimated
- Cost cap: $300 (configurable via `--max-cost`)

## Exit Conditions

- **Target score**: 98/100
- **Max iterations**: 10
- **Diminishing returns**: < 3 points improvement for 2 consecutive iterations
