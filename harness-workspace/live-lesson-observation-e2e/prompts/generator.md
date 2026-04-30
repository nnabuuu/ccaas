## Critical Premise — Fresh Context

You are running via `claude -p` with ZERO memory of previous iterations.
The following files are your COMPLETE memory — read them in order:

1. `harness-workspace/live-lesson-observation-e2e/SPEC.md` — what to build
2. Current artifact code — what exists now
3. `harness-workspace/live-lesson-observation-e2e/eval-reports/v{N-1}-eval.md` — what's wrong (if exists)
4. `harness-workspace/live-lesson-observation-e2e/progress.md` — iteration history

If a file doesn't exist yet (e.g., first iteration), skip it.

---

# Generator — live-lesson-observation-e2e

You are the implementation agent for the observation system: event pipeline, state derivation, real-time push, and teacher observation panel.

## Step 0: Read Context

1. Read `harness-workspace/live-lesson-observation-e2e/SPEC.md` — full specification
2. Read `harness-workspace/live-lesson-observation-e2e/progress.md` — iteration history
3. Read the latest eval report in `harness-workspace/live-lesson-observation-e2e/eval-reports/` (if exists)

## Step 1: Read Current Code

Read ALL artifact files:

```
solutions/business/live-lesson/backend/src/classroom/observation.service.ts
solutions/business/live-lesson/backend/src/classroom/observation.service.spec.ts
solutions/business/live-lesson/backend/src/classroom/classroom.service.ts
solutions/business/live-lesson/frontend/src/hooks/useClassroom.ts
solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
solutions/business/live-lesson/frontend/src/styles/teacher.css
solutions/business/live-lesson/data/lessons/ideal-beauty-reading/manifest.json
```

Also read (READ ONLY — understand types/props):
```
solutions/business/live-lesson/backend/src/classroom/classroom.module.ts
solutions/business/live-lesson/backend/src/entities/observation-event.entity.ts
solutions/business/live-lesson/frontend/src/pages/TeacherPage.tsx
```

## Step 2: Implementation (5 Phases)

### Phase 1: Event Pipeline Hardening

**observation.service.ts** — `addSystemEvent`:
- Ensure `await` before any DB save call (sync persistence, not fire-and-forget)
- The method must return after the event is persisted

**classroom.service.ts** — `submit()`:
- After processing a submission, call `observeTurn()` with the student's answer data
- Pass the full conversation history (all existing events for this student), not just the latest event
- Include enriched systemContext with real `exerciseCorrectRate` computed from student submission metrics

**classroom.service.ts** — Step transitions:
- When a step changes, call `addSystemEvent('step_complete', { step: currentStep, ... })`

### Phase 2: State Derivation Enhancement

**observation.service.ts** — `deriveStatus`:
- Consider K-prefixed anchor IDs (knowledge anchors) when determining student status
- If student has mostly K-anchor events, they are progressing well
- Extract magic number thresholds to named constants:
  ```typescript
  const IDLE_THRESHOLD_MS = 120_000;       // 2 minutes
  const STRUGGLE_EVENT_COUNT = 3;           // events before flagging struggle
  const PROGRESS_ANCHOR_MIN = 2;            // min K-anchors for "on-track"
  ```
- Handle mixed signals: events containing both K (knowledge) and M (misconception) anchor types

**observation.service.ts** — `generateAlerts`:
- Severity levels: `urgent` (≥3 students struggling), `warning` (1-2 struggling), `info` (progress milestone)
- Each alert has: `{ severity, message, studentIds, anchorId?, timestamp }`

**observation.service.ts** — `computeAnchorStats`:
- Return `{ anchorId, anchorType, studentCount, description }` for each anchor
- `studentCount` = number of distinct students with events referencing that anchor

### Phase 3: Real-time Push

**classroom.service.ts** — After `observeTurn` completes:
- Call the existing broadcast/emit method to push updated state to SSE stream
- The broadcast payload must include an `observation` field with current observation state

**classroom.service.ts** — Broadcast payload:
- Add `observation: { students: [...], alerts: [...], anchorStats: [...] }` to the SSE state

**useClassroom.ts** — Frontend reception:
- Extend the ClassroomState type to include `observation?` field
- The SSE event handler must pick up the observation data from the broadcast

**Heartbeat safety**:
- Verify that heartbeat/keepalive events do NOT reset or clear observation state in memory

### Phase 4: Teacher Observation Panel

**TeacherShell.tsx** — Add observation section:
- **Glance view**: Row of student dots, each colored by observation status:
  - Green (`.obs-dot-ok`): on-track / progressing
  - Yellow (`.obs-dot-warn`): idle or slow
  - Red (`.obs-dot-alert`): struggling or misconception
- **Anchor progress**: For each K-anchor, show a progress bar + `studentCount` label
- **Misconception list**: M-anchors sorted descending by impacted student count
- **Alert list**: Sorted by severity (urgent first), each with a severity badge
- **Alert badge**: A small count badge showing number of urgent alerts

**teacher.css** — Add observation styles:
```css
.obs-dot { width:10px; height:10px; border-radius:50%; display:inline-block; margin:2px }
.obs-dot-ok { background:var(--green, #22c55e) }
.obs-dot-warn { background:var(--amber, #f59e0b) }
.obs-dot-alert { background:var(--red, #ef4444) }
.obs-anchor-bar { height:6px; border-radius:3px; background:var(--surface2, #e5e7eb) }
.obs-anchor-fill { height:100%; border-radius:3px; background:var(--blue, #3b82f6) }
.obs-alert-badge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; border-radius:9px; font-size:11px; font-weight:600 }
.obs-alert-urgent { background:var(--red, #ef4444); color:white }
.obs-alert-warning { background:var(--amber, #f59e0b); color:white }
.obs-alert-info { background:var(--blue, #3b82f6); color:white }
```

### Phase 5: Test Extension

**observation.service.spec.ts** — Add ≥5 new test cases:
1. `addSystemEvent persists synchronously` — verify await behavior
2. `deriveStatus with mixed K+M anchors` — mixed signal handling
3. `computeAnchorStats counts distinct students` — per-anchor student count
4. `generateAlerts produces correct severity` — threshold-based severity
5. `observeTurn receives enriched context` — exerciseCorrectRate in systemContext

Ensure ALL existing 33 tests still pass after changes.

## Step 3: Validation

After completing changes, run:
```bash
cd solutions/business/live-lesson/backend && npx nest build
cd solutions/business/live-lesson/backend && npx jest observation --no-coverage
cd solutions/business/live-lesson/frontend && npx tsc --noEmit
cd solutions/business/live-lesson/frontend && npx vite build
```

ALL four MUST pass. If they fail, fix the errors before writing the changelog.

## Frozen Directories — DO NOT MODIFY

```
packages/
solutions/business/edu-platform/
solutions/business/recipe-book/
solutions/business/live-lesson/mcp-server/
solutions/business/live-lesson/backend/src/entities/
solutions/business/live-lesson/backend/src/lesson/
solutions/business/live-lesson/backend/src/classroom/dto/
solutions/business/live-lesson/backend/src/classroom/classroom.module.ts
solutions/business/live-lesson/backend/src/main.ts
solutions/business/live-lesson/frontend/src/pages/
solutions/business/live-lesson/frontend/src/components/student/
solutions/business/live-lesson/frontend/src/App.tsx
```

You CAN ONLY modify:
- `backend/src/classroom/observation.service.ts`
- `backend/src/classroom/observation.service.spec.ts`
- `backend/src/classroom/classroom.service.ts`
- `frontend/src/hooks/useClassroom.ts`
- `frontend/src/components/teacher/TeacherShell.tsx`
- `frontend/src/styles/teacher.css`
- `data/lessons/ideal-beauty-reading/manifest.json`

## Changelog

After completing all changes, write a changelog to the path specified in the injected iteration context. Format:

```markdown
# Changelog v{N}

## Changes
- Hardened addSystemEvent with await persistence
- Added submit→observeTurn integration in classroom.service
- ...

## Files Modified
- `backend/src/classroom/observation.service.ts`
- `backend/src/classroom/classroom.service.ts`
- ...

## Known Issues
- ...
```
