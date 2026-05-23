# Component Development Guide

> Internal developer onboarding for adding, debugging, and previewing components in the KedgeAgentic monorepo. This is the document to hand a new teammate on day one.

Audience: internal engineers writing new exercise types, observe handlers, scaffold widgets, or student/teacher UI fragments inside `solutions/business/live-lesson/` (and the supporting packages).

For the underlying architecture, read `solutions/business/live-lesson/docs/exercise-plugin-architecture.md` first. This guide is the *how*, that one is the *why*.

---

## 1. What "component" means here

Three different things are casually called a *component*. Pick the right scope before you start:

| Kind | Where it lives | Real example | Adding one = |
| --- | --- | --- | --- |
| **Exercise type plugin** | `backend/src/classroom/exercise/plugins/*.plugin.ts` + `frontend/.../plugins/built-in.tsx` | `quiz`, `matrix`, `guided-discovery` | One backend file + one frontend entry + (optional) stories file |
| **React UI fragment** | `frontend/src/components/<area>/*.tsx` | `HelpButton`, `Timeline`, `Band` | Pure React + Tailwind/CSS; no registry plumbing |
| **Backend service / handler** | `backend/src/classroom/observe/handlers/*.handler.ts`, `observation/handlers/*.ts`, etc. | `MatrixObserveHandler`, `JoinHandler` | `@Injectable()` class wired into the module that hosts that surface |

The single biggest design rule the codebase enforces: **`PracticePhase`, `StudentShell`, `enrich-exercise.ts`, `gradeItemSet`, and `teacher-helpers` are off-limits for new types.** If you find yourself editing any of those to ship a new exercise, you've drifted off the plugin contract — fix the contract instead.

## 2. Design checklist (before any code)

1. **Choose the scope** from the table above. If you're not sure, draft the smallest concrete user-visible artifact and work backwards.
2. **Name it.** Lowercase kebab-case identifier; same string on the backend and the frontend. Examples: `match`, `select-evidence`, `rich-content-quiz`. Name by the *type*, not the implementation (`'matching-pairs'` ✅, `'two-column-drag'` ❌).
3. **Write the answer-key schema first.** For exercise types this is a Zod schema; for handlers it's a TS interface. The schema doubles as documentation for the teacher writing the manifest.
4. **Mark the trust boundary.** Does the spec contain answer data the student must not see? If yes, the plugin's `sanitize()` strips it. (Select-evidence is the deliberate exception — it grades client-side.)
5. **Decide if grading needs the LLM.** Cheap types like `quiz` and `order` are deterministic; richer types route through the §14 L3 path (`buildGradePrompt` + `parseGradeResponse`). The default is "no LLM" — opt in only when text-equivalence or vision rubric work is required.
6. **List the observe surfaces.** Will the teacher see this type in `ObserveDrawer`? If yes, also add `ObserveClassView` + `ObserveStudentView` to the frontend UI plugin.

If you can't write these six bullets in 10 lines on a scratch pad, the design isn't ready.

## 3. Implementation walkthrough

### 3.1 Exercise type plugin (the main case)

Both halves are described step-by-step in [`docs/exercise-plugin-extension-guide.md`](./exercise-plugin-extension-guide.md). Highlights:

- Backend plugin file (one): implements `ExerciseTypePlugin` and is auto-discovered via `@ExerciseType('<type>')`. The methods you implement: `answerKeySchema`, `sanitize`, `grade`, `buildCheckItems`, optionally `buildGradePrompt` + `parseGradeResponse` (the §14 L3 contract).
- Frontend UI plugin entry (one): exports an `ExerciseUIPlugin` with `Component`, `canSubmit`, optionally `localGrade`, `enrichFromApi`/`enrichFromManifest`, `formatSubmitData`, `handleCheckResult`, and the observe lazy components.
- Optional `.stories.mjs` file next to the plugin to enable the `exercise-preview` sandbox.

A complete plugin lands in roughly 200–400 LOC across the two files. If you blow past 600 LOC, the type is probably two types in a trench coat.

### 3.2 Backend handler / service

Standard NestJS. The conventions to follow:

- One `@Injectable()` per file; one file per responsibility.
- Inject `AiPromptBuilder` for LLM access — never call `fetch` to a model endpoint directly.
- New controllers MUST have `@ApiTags(...)`. Swagger drift is the most common code-review nit.
- Repositories are TypeORM; use `getRepositoryToken(Entity)` in tests, never construct repositories by hand.

Place graders under `classroom/exercise/graders/`, observe handlers under `classroom/observe/handlers/`, and observation handlers (the LLM-driven dashboard surfaces) under `classroom/observation/handlers/`. The trio looks similar; the difference is which event triggers them.

### 3.3 React UI fragment

The student tree is in `frontend/src/components/student/`, teacher in `components/teacher/`. Both follow the same pattern:

- Stateful logic and side effects → a custom hook in `hooks/` (so it can be unit-tested without the DOM).
- Pure parse / format helpers → a separate `*.ts` file next to the component (so it can be unit-tested without React).
- Component file imports both and stays declarative.

When you touch a component, also check the parent for duplicate rendering — a recurring class of bug. If your component supports the review-restore flow, follow the recipe in `frontend/CLAUDE.md` (`useReviewRestore` hook + a pure `parseXxxReview` export + unit test in `exercise/__tests__/review-restore.test.ts`).

### 3.4 Tests are not optional

The convention is:
- **Backend**: Jest. Place specs next to source (`foo.service.ts` ↔ `foo.service.spec.ts`). Aim for ≥80% statement coverage on the new file; the project as a whole sits at ~91%.
- **Frontend**: Vitest. Place tests in `__tests__/` folders. UI components without DOM tests are acceptable; pure helpers and hooks must have tests.
- **E2E**: Playwright. New observable behaviors get a spec under `e2e/specs/`. The `e2e/helpers/api-client.ts` mirrors the frontend's API surface — extend it when you add a new endpoint.
- Run the full suites before AND after a non-trivial change. The post-implementation checklist in the root `CLAUDE.md` is the source of truth.

## 4. Debugging

### 4.1 Backend

| Symptom | First place to look |
| --- | --- |
| Endpoint 500s | `backend.log` (run `tail -f`) — NestJS prints the full stack |
| Wrong grade | The grader's `grade()` return + the manifest's `answerKey` shape; mismatch is almost always a schema drift |
| Missing observe data | The handler's `compute()` early-returns when `ctx.answerKey?.type !== '<expected>'`; double-check the type guard |
| LLM not called | `AiPromptBuilder.callLlm`/`callVisionLlm` log every call; if you don't see your prompt in the log, your codepath didn't reach the call site |

`AiPromptBuilder` writes per-request traces into `data/llm-trace/`. Pull a recent file when an LLM-backed feature misbehaves — the input, the response, and the model name are all there.

Useful one-shots:
```bash
# Re-seed lessons after editing a manifest.json (the seeder only inserts if missing):
cd solutions/business/live-lesson/backend
node -e "const fs=require('fs'),p=require('path'),DB=require('better-sqlite3');\
  const raw=fs.readFileSync(p.resolve('..','data/lessons/ideal-beauty-reading/manifest.json'),'utf-8');\
  const m=JSON.parse(raw); const db=new DB(p.resolve('data/live-lesson.db'));\
  db.prepare('UPDATE lessons SET manifest_json=? WHERE id=?').run(raw,m.id); db.close();"

# Live-reload a single Jest file in watch mode:
cd solutions/business/live-lesson/backend && npx jest <file-pattern> --watch
```

### 4.2 Frontend

- Vite HMR usually keeps state across edits. When state restoration breaks, force a full reload (`Cmd+Shift+R`).
- React DevTools shows the `useExerciseUIPlugin(type)` lookup result on the `ExerciseHost` component — if a type renders as the fallback "未实现" placeholder, the plugin didn't register.
- The browser Network panel is the cheapest way to validate frontend ↔ backend contracts. If a request goes to `http://localhost:3001` instead of port 3007, the `serverUrl` for the CCAAS SDK is misconfigured (see the rule in `CLAUDE.md`).
- For SSE / polling debugging, the polling endpoints (`GET /:code/state`) are idempotent — refresh in DevTools Console:
  ```js
  await (await fetch('/api/classroom/<CODE>/state')).json()
  ```

### 4.3 Common failure modes

- **`Cannot find module 'fs'` in a Jest test**: you used `import` for the `fs` mock; change to `jest.mock('fs')` at the top + `const fs = require('fs') as jest.Mocked<typeof import('fs')>`. Newer Node makes `existsSync` non-configurable, so `jest.spyOn` fails.
- **`'sub:CODE:0'` localStorage entry persists across tests**: `vi.stubGlobal('localStorage', …)` in `beforeEach` + restore in `afterEach` (see `submission-cache.test.ts`).
- **Playwright fails with `400 name must be ≤20 characters`**: backend caps student name length; keep test fixtures short.
- **E2E hangs on FAB click**: the StudentGuide modal is likely overlapping. Dismiss it explicitly before interacting with the toolbar.

## 5. Preview

### 5.1 Local dev (the day-to-day loop)

```bash
# Terminal 1 — solution backend (port 3007)
cd solutions/business/live-lesson/backend && npm install --legacy-peer-deps && node dist/main.js

# Terminal 2 — solution frontend (port 5283)
cd solutions/business/live-lesson/frontend && npm install && npm run dev

# Terminal 3 — main CCAAS backend, only needed if you're touching the chat / agent flow (port 3001)
npm run dev:backend
```

Browse `http://localhost:5283/`, choose a lesson, take the join code that pops up, open a second tab on `http://localhost:5283/join`. You're now a teacher and a student in the same room — round-trip everything from both sides.

### 5.2 Exercise plugin preview (no full app needed)

The `packages/exercise-preview` package boots a lightweight iframe sandbox that renders any plugin against a `.stories.mjs` file. Use this when iterating on a new exercise type's UI without spinning up the whole classroom:

```bash
cd packages/exercise-preview
npm run build
node dist/cli/index.js --port 43451 bundles/<your-bundle>
# Then open http://127.0.0.1:43451
```

A `Share Link` button in the admin playground mints short codes you can paste into Slack to share a single story snapshot.

### 5.3 E2E preview (Playwright UI)

```bash
cd solutions/business/live-lesson/e2e
npm install
BACKEND_URL=http://localhost:3007 FRONTEND_URL=http://localhost:5283 npx playwright test --ui
```

The `--ui` flag opens Playwright's time-travel debugger — pick a spec, watch the browser drive itself, and step through DOM snapshots. The real-LLM integration spec (`14-real-llm-integration.spec.ts`) is a good template when you need to verify a new endpoint round-trips through the live model.

## 6. The post-implementation checklist (mandatory)

After ANY code changes, run these IN ORDER before claiming the task is done. Skipping any step is a workflow violation per the root `CLAUDE.md`:

1. **Tests**
   - Backend: `cd packages/backend && npx jest --no-coverage` (or `solutions/business/live-lesson/backend`)
   - Frontend: `cd solutions/business/live-lesson/frontend && npm test`
   - E2E (only when you touched anything user-visible): `cd solutions/business/live-lesson/e2e && npx playwright test`
2. **Code review**: run the `code-reviewer` agent on every changed file.
3. **Harness**: `bash scripts/harness-checks.sh` from the repo root.

If review finds issues, fix before proceeding. The harness step is the final gate on whether the commit goes out.

## 7. When in doubt

- Memory and conventions: `/Users/niex/.claude/projects/.../memory/MEMORY.md` is loaded into every Claude session and lists the recurring gotchas (serverUrl pitfall, commit-message format, harness rule).
- Architectural decisions: `docs/adr/` and `solutions/business/live-lesson/docs/exercise-plugin-architecture.md`.
- A specific past PR's reasoning: `git log -p` is the truth; commit messages in this repo are written to be load-bearing.

If you're still stuck, the right move is to spin up a 15-minute pairing block — three eyes beat a tutorial.
