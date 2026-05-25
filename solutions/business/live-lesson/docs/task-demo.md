# `/task-demo` — shareable single-task sessions

A heavier sibling of [`/exercise-demo`](./exercise-plugin-preview-design.md):
where `/exercise-demo` shows a bundle file with answers thrown away on refresh,
`/task-demo` spins up a real backend session with persistent per-customer answer
histories you can scrub through later. Built for sales / 招生 — share a URL,
multiple customers try the same exercise, you watch each one's attempts unfold.

## URL surface

| URL | Mode | Who opens |
|---|---|---|
| `/task-demo/:code` | Answer (name picker if no `?user=`) | Customer trying the exercise |
| `/task-demo/:code?user=alice` | Answer, auto-claim as "alice" | Customer trying the exercise (preset name) |
| `/task-demo/:code/replay?user=alice` | Read-only submit-by-submit scrubber | You watching alice's attempts |
| `/task-demo/:code/admin` | Respondents table + share link copy | You picking which respondent to replay |

## Quick walkthrough

```bash
# 1. Create a session (admin / sales)
curl -X POST http://localhost:3007/api/task-demo/create \
  -H 'content-type: application/json' \
  -d '{"lessonId":"ideal-beauty-reading","step":1}'
# → { "code": "HX3KM7", ... }

# 2. Share the URL — different customers each get their own answer history
open "http://localhost:5283/task-demo/HX3KM7?user=alice"
open "http://localhost:5283/task-demo/HX3KM7?user=bob"

# 3. Watch what they did
open "http://localhost:5283/task-demo/HX3KM7/admin"
```

## How identity works

- One ClassroomSession (existing entity, 6-char code) per task-demo
- One Student row per (sessionId, **normalized name**). `?user=Alice`,
  `?user=  alice  `, `?user=ALICE` all collapse to the same studentId —
  whichever the URL contains, the rest of the system uses
  `trim().toLowerCase().slice(0,40)`
- The studentId is cached in `localStorage` under
  `task-demo:<code>:<normalized-user>` so reload doesn't bounce through the
  name picker. The cache is a fast-path, not a contract — server-side
  `/claim` is idempotent by name
- Multiple customers under the same URL never collide: each browser /
  user-name combo gets its own studentId

## How replay works

`POST /api/task-demo/:code/submit` appends a row to `task_demo_attempts`
(NEW table). Existing `Submission` has `UNIQUE(sessionId, studentId, step,
phase)` and only keeps the latest answer — that's wrong for our needs, so we
have a dedicated history table.

`GET /api/task-demo/:code/replay/:studentId` returns the attempts ascending
by attempt number, each carrying `{ data, score, checkItems, submittedAt }`.

`ReplayMode.tsx` mounts the production exercise component with `key={attempt}`
so React remounts on scrub; `useReviewRestore` then runs the per-type
parse function fresh (parseQuizReview / parseMatchReview / …) and the
component renders frozen in the state captured by that attempt — selected
options, ✓/✗ marks, hints, partial-correctness colors.

## API reference

All routes unauthenticated (matches existing `/api/classroom/*` posture).
**Admin route gating is out of scope for v1** — add a token guard before
public deploy (`?token=<jwt>` on `/respondents` + `/replay/:studentId`).

| Method | Route | Body | Response |
|---|---|---|---|
| `POST` | `/api/task-demo/create` | `{ lessonId, step }` | `{ code, sessionId, lessonId, step }` |
| `POST` | `/api/task-demo/:code/claim` | `{ user }` | `{ studentId, name }` (idempotent by normalized name) |
| `GET` | `/api/task-demo/:code/exercise` | — | sanitized `ExerciseSpec ∪ { step }` |
| `POST` | `/api/task-demo/:code/submit` | `{ studentId, data }` | `{ attempt, score, allCorrect, items, submittedAt }` |
| `GET` | `/api/task-demo/:code/respondents` | — | `Respondent[]` |
| `GET` | `/api/task-demo/:code/replay/:studentId` | — | `ReplayEntry[]` (asc by attempt) |

## Critical files

| Concern | Path |
|---|---|
| Entity | `backend/src/adapters/persistence/entities/task-demo-attempt.entity.ts` |
| Repo port | `backend/src/domain/ports/task-demo-attempt-repo.port.ts` |
| Repo impl | `backend/src/adapters/persistence/repositories/task-demo-attempt.repository.ts` |
| Service | `backend/src/application/task-demo/task-demo.service.ts` |
| Controller | `backend/src/adapters/http/task-demo.controller.ts` |
| Module wiring | `backend/src/infra/classroom.module.ts` (controllers + providers) |
| TypeORM entity registration | `backend/src/typeorm/typeorm.module.ts` |
| Frontend router | `frontend/src/pages/TaskDemoPage.tsx` |
| Answer mode | `frontend/src/pages/task-demo/AnswerMode.tsx` |
| Replay mode | `frontend/src/pages/task-demo/ReplayMode.tsx` |
| Admin mode | `frontend/src/pages/task-demo/AdminMode.tsx` |
| Name picker | `frontend/src/pages/task-demo/NamePicker.tsx` |
| API client | `frontend/src/pages/task-demo/useTaskDemoApi.ts` |
| E2E spec | `solutions/business/live-lesson/e2e/specs/15-task-demo.spec.ts` |
| Unit tests | `backend/src/application/task-demo/__tests__/task-demo.service.spec.ts` |

## Sanitize / security

- `/exercise` goes through `ExerciseService.getExerciseSpec` →
  `ExerciseTypeRegistry.sanitize` — the same path production uses. Answer
  keys are stripped from quiz/match/matrix/order/map/image-upload; only
  `select-evidence` keeps grading data client-side (existing convention).
- Submit response ships only `score.total` + per-item correctness booleans;
  internal grading rubric never leaves the backend.
- localStorage scope is per `(code, user)` so two customers on the same
  laptop in different tabs don't trample each other.

## Backlog

### 🚨 Public-deploy blockers — must land before exposing URL externally

- [ ] **Auth gate on admin routes** (`/respondents`, `/replay/:studentId`) —
      a 6-char code (≈730M space, but discoverable via forwarded links /
      screenshots) is not access control. Add `Authorization: Bearer
      <token>` or query-param token; even a static env-var secret is enough
      for v1.
- [ ] **Auth gate on `/create`** — anyone can spin up unlimited
      `classroom_sessions` rows + exhaust the 30^6 code namespace. Same
      token requirement as above.
- [ ] **Rate limit on `/submit`** — `@nestjs/throttler` 10/min per IP +
      per-student soft cap (e.g. 200 attempts → 429) protects against
      script loops bloating `task_demo_attempts`.

### Known gaps

- [ ] **Rich-content-quiz scaffold flow is unsupported in AnswerMode.**
      Production `POST /submit` returns `scaffold` / `partId` /
      `nextPartId` / `sampleSolution` which drive the multi-part
      walkthrough. `/api/task-demo/:code/submit` returns only
      `{attempt, score, allCorrect, items}`, so the scaffold branch
      no-ops and every submit jumps to "correct". For now, sales should
      not share a rich-content-quiz `/task-demo` link with customers —
      use `/exercise-demo` (bundle-based) instead, or stick to
      quiz / match / select-evidence / matrix / map / stance / order /
      fill-blank / guided-discovery.
- [ ] **`sanitizeManifest` is block-list based** — it strips
      `discuss.systemPrompt` / `discuss.goal` + per-step answerKey, but
      anything new added to the manifest (e.g. `teacherView`,
      `instructorNotes`, `evalRubric`, lesson-level `coachingPrompt`)
      will leak through to the unauthenticated task-demo URL. Switch to
      an allow-list, or add a `sanitizeForPublicShare()` wrapper.

### Nice-to-have

- [ ] Session lifecycle: nothing currently transitions a task-demo
      session to `status='ended'`. Add `POST /api/task-demo/:code/end` so
      the cleanup job has a signal to GC by.
- [ ] Cleanup job: archive `task_demo_attempts` rows for ended sessions
      (the `submittedAt` index landed in v1 so the GC query is cheap).
- [ ] Session-list endpoint: "show all my active task-demos in one place"
      for sales dashboard.
- [ ] Print/control-char guard on `user` (`@Matches(/^[\p{L}\p{N}\s._-]+$/u)`)
      so weird Unicode doesn't leak into URL bar titles / log lines.
- [ ] `task-demo` vs `classroom` separation: both currently use
      `ClassroomSession`. If a regular classroom workflow ever calls
      `sessionRepo.update(id, { currentStep })` on a task-demo session,
      grading silently shifts to a different step. Either add a `kind`
      discriminator column or split into a dedicated `task_demo_sessions`
      table.
- [ ] Name-collision UX: two customers literally named "li" share a
      studentId today (acceptable for sales demos). Surface
      "name-taken-pick-another" in the `NamePicker` when relevant.
- [ ] Email / Slack notification when a customer submits.
- [ ] Aggregate analytics across sessions ("60% of customers picked answer
      B on Q1 across all 12 demos").
