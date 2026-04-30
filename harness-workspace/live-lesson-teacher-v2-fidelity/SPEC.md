# SPEC — live-lesson-teacher-v2-fidelity

## Objective

Rewrite TeacherShell to **high-fidelity match** the `teacher.html` reference design, and **completely remove all mock/demo fallback data** so that 100% of displayed data comes from the real backend via `classroomState` prop.

## Artifact Scope

```
solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
solutions/business/live-lesson/frontend/src/styles/teacher.css
solutions/business/live-lesson/frontend/src/components/teacher/   (new sub-components OK)
```

Only these files may be created or modified. Everything else is **frozen**.

## Design Reference (Truth)

| What | Path (relative to `solutions/business/live-lesson/`) |
|------|------|
| Teacher V2 HTML | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/teacher.html` |
| Design tokens | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/colors_and_type.css` |
| Teacher design doc | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/docs/teacher-dashboard-design.md` |
| Student modal doc | `.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/docs/student-modal-redesign.md` |

## Existing System (Read-Only)

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useClassroom.ts` | `ClassroomState` type + `useTeacherStream` hook |
| `backend/src/classroom/classroom.service.ts` | API response format |
| `frontend/src/pages/TeacherPage.tsx` | Page component that renders TeacherShell |

### ClassroomState Type (from useClassroom.ts)

```typescript
export interface ClassroomState {
  currentStep: number
  students: Array<{
    id: string
    name: string
    currentTask: number
    currentPhase: string
    stepStartedAt: string
    submissions: Record<number, { step: number; data: any; score: any; submittedAt: string }>
  }>
  metrics: { total: number; submitted: number; inProgress: number }
  stepMetrics: Record<number, { currentCount: number; completedCount: number; completionRate: number; avgScore: number }>
  questions: Array<{ studentId: string; studentName: string; step: number; question: string; timestamp: string }>
}
```

### Backend API (Already Working)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/classroom/sessions` | Create session `{ lessonId }` |
| POST | `/api/classroom/:code/join` | Student joins `{ name }` |
| POST | `/api/classroom/:code/submit` | Submit `{ studentId, step, data }` → score |
| GET | `/api/classroom/:code/state` | Full state snapshot |
| GET | `/api/classroom/:code/stream` | SSE real-time push |
| POST | `/api/classroom/:code/ai/ask` | AI question `{ studentId, question, step }` |

## Core Rules

### Rule 1: Delete ALL Mock Fallback

Delete every hardcoded data constant:
- `DEMO_STUDENTS` (26 fake students)
- `MOCK_QUEUE` (7 mock questions)
- `MOCK_QUIZ_SUB`, `MOCK_MATCH_SUB`, `MOCK_MATRIX_SUB`, etc.
- Any other `MOCK_*` or `DEMO_*` constants

**Verification**: `grep -c "DEMO_STUDENTS\|MOCK_QUEUE\|MOCK_.*_SUB" TeacherShell.tsx` must return 0.

### Rule 2: 100% Data from classroomState

Every piece of displayed data must derive from the `classroomState` prop:
- Health cards → computed from `classroomState.students` + `classroomState.stepMetrics`
- Step cards → computed from `classroomState.students` + `classroomState.stepMetrics`
- Student dots → from `classroomState.students[].currentTask`
- Question queue → from `classroomState.questions`
- Student modal → from `classroomState.students[i].submissions`
- Step detail → from `classroomState.stepMetrics[step]`

### Rule 3: Empty State When No Students

When `classroomState` is null or `students.length === 0`:
- Display "等待学生加入…" message
- Show the session code prominently (from `sessionCode` prop)
- Do NOT display fake data or placeholder students

### Rule 4: High-Fidelity Match teacher.html

CSS class naming, layout structure, colors, and typography must closely match the reference design.

## Layout Specification (from teacher.html)

### Band (`.band`, 44px height)

```
[R mark] 课堂观察台 [mode-badge: 观察模式] [self-badge: 学生自主推进] ─── spacer ─── [class-info: 班级/人数] [live-indicator: 绿色脉冲点 + "实时同步中"]
```

- Background: var(--surface)
- Border bottom: 1px solid var(--border)
- Mark: 20×20px rounded green square with "R"
- Mode badge: background var(--blue-bg), color var(--blue), font-size 11px
- Self badge: similar style
- Live indicator: 6px green dot with pulse animation + "实时同步中" text

### Timeline (`.timeline`, 40px height)

```
[prev ◁] [time display] [track: filled portion + thumb + step markers] [total] [LIVE label] [next ▷] [live btn]
```

- Visual-only component (no real time control needed)
- Track: gray background with blue fill
- 5 step markers at equal intervals
- Thumb: 8px white circle at current position
- "LIVE" badge with red dot

### Health Cards (`.health`, 4-column grid)

| Card | Primary | Secondary |
|------|---------|-----------|
| 最快进度 | `Step N` | `N人` (count at fastest step) |
| 中位进度 | `Step N` | `N%` (% of students at median) |
| 卡点学生 | `N人` | `TN` (most-stuck task number) |
| AI 对话 | `N轮` | `N人` (unique AI users) |

- Each card: `.hcard` with `.hcard-label`, `.hcard-val`, `.hcard-sub`
- All data computed from `classroomState`

### Step Cards (`.step-cards`, replaces swimlane rows)

**This is the key structural change.** Current code uses `.swim-row` (single row per step). Reference uses **Step Card** structure:

```html
<div class="step-card" data-step="1">
  <div class="sc-header">
    <span class="sc-sn">01</span>
    <span class="sc-name">Step Name</span>
    <span class="sc-type type-quiz">quiz</span>
    <span class="sc-badge badge-active">N人进行中</span>
    <span class="sc-badge badge-done">N人完成</span>
  </div>
  <div class="sc-metrics">
    <div class="sc-bar"><div class="sc-bar-fill" style="width:75%"></div></div>
    <span class="sc-metric">AI N轮</span>
    <span class="sc-metric">N人</span>
  </div>
  <div class="sc-dots">
    <!-- student dots here -->
  </div>
</div>
```

- 5 step cards, one per task
- Header: step number (01-05) + name + type badge + active/done count badges
- Metrics strip: accuracy bar (width = avgScore%) + AI round count + student count
- Dots: colored by status (done=green, in-progress=blue, stuck=amber, not-reached=grey)
- Click step card → update right column step detail
- Active card has highlighted border

### Step Detail (right column, `.step-detail`)

When a step card is clicked:
- Summary stats: student count, avg score, completion rate
- Quality bars: per-dimension accuracy visualization
- Issues list: students with low scores or stuck
- Students-in-step list

### Patterns Section (`.patterns`)

4 pattern cards with type (alert/info) and metric boxes. For V2, can show empty state "暂无观察模式" if no pattern data.

### Coaching Section (`.coaching`)

Collapsible section with arrow rotation animation:
- Header with toggle arrow
- Body: cue cards + quick actions
- Empty state: "暂无教学建议"

### Question Queue (`.queue-section`)

- Grouped by step
- Each question: student name + question text + timestamp
- Priority indicators (high/medium/low)
- Aggregate similar questions

### Student Modal

Click student dot → modal overlay:

1. **Header**: student name + current step + phase + time spent
2. **Journey Strip**: 5-step horizontal timeline
   - Each node: step number + status icon (✓完成/△部分正确/●进行中/⚠卡住/○未到达)
   - Click node → switch modal tab to that step's detail
3. **Left column**: Submission detail
   - Quiz: ✓/✗ per question
   - Matrix: table with cell-level error marks
   - Match: pair list with correct/incorrect
4. **Right column**: Class Compare bars
   - 3 bars: 用时 (time), 正确率 (accuracy), AI轮次 (AI rounds)
   - Student value vs class average
5. **AI Chat History**: scrollable list (empty state if no AI interactions)

## CSS Token System

Use these CSS variables (from `colors_and_type.css`):

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
}
```

## Props Interface

```typescript
interface Props {
  manifest: ReadingManifest
  embed?: boolean
  classroomState?: ClassroomState | null
  sessionCode?: string
}
```

The component receives `classroomState` from `TeacherPage.tsx` via `useTeacherStream(session.code)`. It also receives `sessionCode` for display and `manifest` for step names/types.

## Frozen Constraints

```
packages/                                          # DO NOT MODIFY
solutions/business/edu-platform/                   # DO NOT MODIFY
solutions/business/recipe-book/                    # DO NOT MODIFY
solutions/business/live-lesson/mcp-server/src/     # DO NOT MODIFY
solutions/business/live-lesson/backend/src/        # DO NOT MODIFY (backend is complete)
solutions/business/live-lesson/frontend/src/hooks/ # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/pages/ # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/components/student/   # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/components/orchestrator/ # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/types/ # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/App.tsx # DO NOT MODIFY
solutions/business/live-lesson/data/               # DO NOT MODIFY
```

**CAN modify**:
- `solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx`
- `solutions/business/live-lesson/frontend/src/styles/teacher.css`
- `solutions/business/live-lesson/frontend/src/components/teacher/*.tsx` (new sub-components)

## Exit Conditions

- **Target score**: 95/100
- **Max iterations**: 8
- **Diminishing returns**: < 3 points improvement for 2 consecutive iterations
