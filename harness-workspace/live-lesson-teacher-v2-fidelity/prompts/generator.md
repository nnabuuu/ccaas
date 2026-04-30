## Critical Premise — Fresh Context

You are running via `claude -p` with ZERO memory of previous iterations.
The following files are your COMPLETE memory — read them in order:

1. `harness-workspace/live-lesson-teacher-v2-fidelity/SPEC.md` — what to build
2. Current artifact code — what exists now
3. `harness-workspace/live-lesson-teacher-v2-fidelity/eval-reports/v{N-1}-eval.md` — what's wrong (if exists)
4. `harness-workspace/live-lesson-teacher-v2-fidelity/progress.md` — iteration history
5. Design reference files listed in SPEC.md — design truth

If a file doesn't exist yet (e.g., first iteration), skip it.

---

# Generator — live-lesson-teacher-v2-fidelity

You are the implementation agent for rewriting TeacherShell to high-fidelity match the teacher.html reference design, while removing all mock data.

## Step 0: Read Context

1. Read `harness-workspace/live-lesson-teacher-v2-fidelity/SPEC.md` — full specification
2. Read `harness-workspace/live-lesson-teacher-v2-fidelity/progress.md` — iteration history
3. Read the latest eval report in `harness-workspace/live-lesson-teacher-v2-fidelity/eval-reports/` (if exists)

## Step 1: Read Design References

Read ALL of these files — they are your design truth:

```
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/teacher.html
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/surfaces/colors_and_type.css
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/docs/teacher-dashboard-design.md
solutions/business/live-lesson/.herness-workspace/live-lesson-v2/reference/LiveLesson-V2/docs/student-modal-redesign.md
```

Also read the existing code you'll be modifying:

```
solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
solutions/business/live-lesson/frontend/src/styles/teacher.css
solutions/business/live-lesson/frontend/src/hooks/useClassroom.ts   (READ ONLY — understand ClassroomState type)
solutions/business/live-lesson/frontend/src/pages/TeacherPage.tsx   (READ ONLY — understand props passed)
```

## Step 2: Core Task

### 2a: Delete All Mock Data

Search TeacherShell.tsx for these patterns and DELETE them entirely:
- `DEMO_STUDENTS` constant
- `MOCK_QUEUE` constant
- `MOCK_QUIZ_SUB`, `MOCK_MATCH_SUB`, `MOCK_MATRIX_SUB` and any `MOCK_*_SUB` constants
- Any other `const DEMO_*` or `const MOCK_*` arrays/objects
- Any fallback logic that uses these mocks (e.g., `students.length === 0 ? DEMO_STUDENTS : ...`)

**Verification**: Run `grep -c "DEMO_STUDENTS\|MOCK_QUEUE\|MOCK_.*_SUB" solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx` — must return 0.

### 2b: Rewrite TeacherShell — Step Card Structure

Replace the current swim-row layout with the Step Card structure from teacher.html:

**Band** (44px):
```
mark + "课堂观察台" + mode-badge("观察模式") + self-badge("学生自主推进") + spacer + class-info + live-indicator(green pulse + "实时同步中")
```

**Timeline** (40px):
```
Visual-only: prev/next buttons + time display + track with markers + "LIVE" badge
```

**Health Cards** (4-column grid):
- 最快进度: highest `currentTask` among students + count at that task
- 中位进度: median `currentTask` + % of students at median
- 卡点学生: count stuck > 3min + most-common stuck task
- AI 对话: total questions count + unique questioners count

**Step Cards** (5 cards, one per task):
```tsx
<div className="step-card" data-step={stepNum} onClick={() => setActiveStep(stepNum)}>
  <div className="sc-header">
    <span className="sc-sn">{String(stepNum).padStart(2,'0')}</span>
    <span className="sc-name">{step.teacherView?.title || step.title}</span>
    <span className={`sc-type type-${exerciseType}`}>{exerciseType}</span>
    <span className="sc-badge badge-active">{activeCount}人进行中</span>
    <span className="sc-badge badge-done">{doneCount}人完成</span>
  </div>
  <div className="sc-metrics">
    <div className="sc-bar"><div className="sc-bar-fill" style={{width:`${avgScore}%`}}/></div>
    <span className="sc-metric">AI {aiCount}轮</span>
    <span className="sc-metric">{studentCount}人</span>
  </div>
  <div className="sc-dots">
    {students.filter(s => s.currentTask === stepNum).map(s => (
      <span className={`sdot ${dotColor(s, stepNum)}`} title={s.name} onClick={(e) => { e.stopPropagation(); openModal(s); }} />
    ))}
  </div>
</div>
```

Dot colors:
- `done` (green): student has submission for this step with score
- `prog` (blue): student is currently on this step
- `stuck` (amber): student on this step for > 3 minutes
- `grey`: student hasn't reached this step

**Step Detail** (right column):
- Shows for `activeStep`
- Summary: student count, avg score, completion rate from `stepMetrics[activeStep]`
- Quality bars (accuracy visualization)
- Issues list (students with low scores)
- Students-in-step list

### 2c: Student Modal

Implement the modal that opens when clicking a student dot:

**Journey Strip**: 5-step horizontal timeline
- Each node: step number + status icon
  - ✓ = completed with good score (>80%)
  - △ = completed with partial score (40-80%)
  - ● = currently working on
  - ⚠ = stuck (>3 min on step)
  - ○ = not reached yet
- Click node → switch displayed step detail

**Left column**: Submission detail for selected step
- Quiz: show each question with ✓ (correct) or ✗ (wrong)
- Matrix: table with error-marked cells
- Match: pair list with correct/incorrect

**Right column**: Class Compare bars
- 3 horizontal bars comparing student vs class average
- Time spent, accuracy, AI rounds
- Student value highlighted, class avg shown

### 2d: Empty State

When `classroomState` is null or `students.length === 0`:
```tsx
<div className="empty-state">
  <div className="empty-icon">👥</div>
  <h2>等待学生加入…</h2>
  <p>课堂码: <strong>{sessionCode}</strong></p>
  <p>学生可通过 /join 页面输入课堂码加入</p>
</div>
```

### 2e: Patterns + Coaching + Question Queue

**Patterns**: 4 pattern cards or empty state "暂无观察模式"
**Coaching**: Collapsible section with arrow rotation
**Question Queue**: Grouped by step, from `classroomState.questions[]`

## Step 3: CSS

Rewrite `teacher.css` to match `teacher.html` styles:
- Use CSS variables from `colors_and_type.css`
- Band: 44px, flexbox, background var(--surface)
- Timeline: 40px, flexbox with track
- Health cards: 4-column grid
- Step cards: vertical stack with header + metrics + dots
- Body: CSS grid `1fr 340px`
- Modal: fixed overlay with z-index
- Animations: pulse for live dot, rotate for coaching arrow

## Frozen Directories — DO NOT MODIFY

```
packages/
solutions/business/edu-platform/
solutions/business/recipe-book/
solutions/business/live-lesson/mcp-server/src/
solutions/business/live-lesson/backend/src/
solutions/business/live-lesson/frontend/src/hooks/
solutions/business/live-lesson/frontend/src/pages/
solutions/business/live-lesson/frontend/src/components/student/
solutions/business/live-lesson/frontend/src/components/orchestrator/
solutions/business/live-lesson/frontend/src/types/
solutions/business/live-lesson/frontend/src/App.tsx
solutions/business/live-lesson/data/
```

You CAN ONLY modify:
- `solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx`
- `solutions/business/live-lesson/frontend/src/styles/teacher.css`
- `solutions/business/live-lesson/frontend/src/components/teacher/*.tsx` (new sub-components)

## Validation

After completing changes, run:
```bash
cd solutions/business/live-lesson/frontend && npx tsc --noEmit
cd solutions/business/live-lesson/frontend && npx vite build
```

Both MUST pass. If they fail, fix the errors before writing the changelog.

## Changelog

After completing all changes, write a changelog to the path specified in the injected iteration context. Format:

```markdown
# Changelog v{N}

## Changes
- Deleted DEMO_STUDENTS, MOCK_QUEUE, all MOCK_*_SUB constants
- Rewrote TeacherShell to Step Card structure matching teacher.html
- ...

## Files Modified
- `frontend/src/components/teacher/TeacherShell.tsx`
- `frontend/src/styles/teacher.css`
- ...

## Known Issues
- ...
```
