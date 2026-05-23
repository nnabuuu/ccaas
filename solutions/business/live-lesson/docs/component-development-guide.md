# Component Development Guide

> Internal developer onboarding for adding a new exercise / interaction type to live-lesson. This is the document to hand a new teammate on day one.

Audience: internal engineers shipping a new `<type>` like `rich-content-quiz` or `guided-discovery` into `solutions/business/live-lesson/`.

For the underlying architecture, read the sibling [`exercise-plugin-architecture.md`](./exercise-plugin-architecture.md). For the step-by-step code skeleton, read [`exercise-plugin-extension-guide.md`](./exercise-plugin-extension-guide.md). This guide is the *map*: it tells you which surfaces a new type touches, in what order, and which ones you *can't* extend.

---

## §1. What "component" means here

In live-lesson, a **component** = **a new exercise / interaction type**. Authoring one is not a one-file task — it crosses five surfaces:

1. The teacher-authoring **schema** (what a teacher writes in `manifest.json`).
2. The **backend plugin** (validation, sanitization, grading, optional §14 L3 prompts).
3. The **student frontend, left column** (the task / practice area).
4. The **student frontend, right column** (per-type guide + interactions with the reading text panel, if any).
5. The **observation pipeline + teacher observe drawer** (per-type teacher-side view of student work).

Authoring a one-off React widget or a backend service is a strict subset — if that's all you're doing, you only execute steps §5 or §4 below. Most real work is "I'm adding a new exercise type and need to know every file that has to change."

---

## §2. The five surfaces at a glance

| # | Surface | Primary file(s) | Required? | One-line contract |
| - | --- | --- | --- | --- |
| 1 | [Schema](#3-surface-1--schema-teacher-authoring) | `backend/src/schemas/answer-key.schema.ts` + plugin's `answerKeySchema` | ✅ | A Zod schema discriminated by `type: z.literal('<type>')` |
| 2 | [Backend plugin](#4-surface-2--backend-plugin) | `backend/src/classroom/exercise/plugins/<type>.plugin.ts` | ✅ | `@Injectable() @ExerciseType('<type>')` implementing `ExerciseTypePlugin` |
| 3 | [Frontend task area](#5-surface-3--frontend-task-area-left-column) | `frontend/src/components/student/exercise/<Type>Exercise.tsx` + plugin entry in `plugins/built-in.tsx` | ✅ | `ExerciseUIPlugin` with `Component` + `canSubmit` |
| 4 | [Frontend right side](#6-surface-4--frontend-right-side-guide--text-panel) | `<Type>Guide.tsx`; rarely `TextPanel.tsx` | optional / bespoke | Per-type guide is a convention, not a framework |
| 5 | [Observe pipeline + drawer](#7-surface-5--observation--teacher-observe-drawer) | `backend/src/classroom/observe/handlers/<type>.handler.ts` + plugin's `ObserveClassView/StudentView` | optional | Plugin declares `observeType` + lazy views; backend declares `@ObserveType('<type>')` |

What is **not** on this list and **cannot be extended**: the teacher dashboard's tab strip. See [§8](#8-boundaries-what-you-cannot-extend).

---

## §3. Surface 1 — Schema (teacher-authoring)

### What the teacher writes

A `manifest.json` `readingStep` with `type: "task"` carries an `answerKey` whose `type` field selects your exercise. Example from `data/lessons/math-difference-of-squares/manifest.json` (the `rich-content-quiz` step):

```json
{
  "answerKey": {
    "type": "rich-content-quiz",
    "subType": "calculation",
    "aiSystemPrompt": "你是一位初中数学教师助手...",
    "parts": [
      {
        "id": "q1",
        "prompt": "(1) 计算 $(y+2)(y-2)$",
        "expression": "$(y+2)(y-2)$",
        "rubric": [
          { "id": "c1", "label": "计算正确", "weight": 100,
            "criteria": "最终答案为 y²-4 即满分。" }
        ],
        "sampleSolution": "$$ y^2 - 4 $$",
        "accepts": ["y^2-4", "y²-4"],
        "maxImages": 1,
        "scaffold": { "threshold": 1, "levels": [ /* hint levels */ ] }
      }
    ]
  }
}
```

Design rule of thumb: keep teacher-authored property names natural and self-documenting (`prompt`, `rubric`, `sampleSolution`), not implementation-leaking (`promptString`, `rubricArr`).

### Where the schema lives

- The Zod schema is exposed two ways:
  - As the plugin's `answerKeySchema` field (the source of truth, lives next to the plugin in `backend/src/classroom/exercise/plugins/<type>.plugin.ts`).
  - Re-exported from `backend/src/schemas/answer-key.schema.ts` so callers can import it without pulling the whole plugin.
- The schema **must** start with a `z.literal('<type>')` discriminator on the `type` field — the composed union dispatcher needs this.
- **Don't** use `.transform()` / `.preprocess()` / `.pipe()` that changes the output type. The registry forwards the raw validated object to plugin methods; transforms would cause a divergence between what the plugin sees and what callers see. Use `.refine()` for validation only.

### Validation + sanitization

- **Validation at seed time:** `lesson.service.ts` calls `validateAnswerKey()` per step when seeding lessons. Failures **log a warning but do not block seeding** — be honest about this with your teacher users. (See `schemas/answer-key.schema.ts`.)
- **Sanitization at serve time:** `sanitizeAnswerKey()` in `backend/src/schemas/manifest.utils.ts` strips answer data before the student sees the manifest. For `rich-content-quiz`, that means dropping `aiSystemPrompt`, per-part `accepts[]`, rubric `criteria`, and `sampleSolution`. The exception is `select-evidence`, which keeps grading data on the wire because it grades client-side.

---

## §4. Surface 2 — Backend plugin

One file: `backend/src/classroom/exercise/plugins/<type>.plugin.ts`. Auto-discovered through `@Injectable()` + `@ExerciseType('<type>')` decorators — the `ExerciseTypeRegistry.onModuleInit()` walks NestJS providers with `DiscoveryService` and registers anything decorated.

### The contract — `ExerciseTypePlugin`

From `backend/src/classroom/exercise/exercise-type-plugin.interface.ts:65`:

```ts
export interface ExerciseTypePlugin {
  readonly type: string;
  readonly answerKeySchema: z.ZodType<unknown>;
  grade(ctx: GradeContext): GradeResult | Promise<GradeResult>;

  sanitize?(ctx: SanitizeContext): ExerciseSpec | null;
  buildCheckItems?(ctx: CheckItemContext): Array<Record<string, unknown>>;

  // §14 L3 two-stage grade (optional)
  buildGradePrompt?(ctx: GradeContext): GradePromptSpec[];
  parseGradeResponse?(responses: string[], ctx: GradeContext):
    GradeResult | Promise<GradeResult>;
}
```

**Required:** `type`, `answerKeySchema`, `grade`.
**Expected:** `sanitize`, `buildCheckItems`. They're typed as optional only because the migration left a legacy fallback in `schemas/manifest.utils.ts` — for any new type, implement them.
**Recommended (for richer types):** `buildGradePrompt` + `parseGradeResponse` — the §14 L3 two-stage contract. This is what powers the admin playground's "edit the LLM prompt, re-parse without burning tokens" inspector loop.

### Dispatch

`GradingService.grade(type, key, data)` resolves the plugin from the registry, validates `key` against `plugin.answerKeySchema`, and calls `plugin.grade(ctx)`. No per-type `switch` lives anywhere else in the backend — that was deleted as part of the registry migration.

### Composition

You can reuse another plugin's grader internally. `rich-content-quiz` constructs an `ImageUploadGrader` in its own constructor and delegates `grade()` to it:

```ts
// rich-content-quiz.plugin.ts:95-148 (excerpted)
constructor(private readonly aiPromptBuilder: AiPromptBuilder) {
  this.legacyGrader = new ImageUploadGrader(aiPromptBuilder);
}
grade(ctx: GradeContext): Promise<GradeResult> {
  return this.legacyGrader.grade(ctx.key as any, ctx.data);
}
```

When your new type is "X but with a different schema / sanitize," reach for this pattern before writing a fresh grader.

---

## §5. Surface 3 — Frontend task area (left column)

This is the practice / exercise zone — what the student sees while working through the step.

### Where it renders

`frontend/src/components/student/exercise/PracticePhase.tsx:333` is the single dispatch site:

```tsx
const plugin = getExerciseType(ex.type)
if (!plugin) return <div>...no plugin registered...</div>
const PluginComp = plugin.Component
return <PluginComp exercise={ex} ans={ans} setAns={...} ... />
```

No per-type `switch` in `PracticePhase`. If you find yourself reaching into `PracticePhase` to special-case the new type, stop — that's the regression the plugin contract is designed to prevent.

### The contract — `ExerciseUIPlugin`

From `frontend/src/components/student/exercise/plugins/types.ts:128`:

```ts
export interface ExerciseUIPlugin {
  readonly type: string                    // matches backend @ExerciseType
  readonly Component: ComponentType<ExercisePluginProps>
  canSubmit(...): boolean
  formatSubmitData(...): Record<string, any>
  handleCheckResult(...): CheckResultHandlerOutput

  readonly selfManagedSubmit?: boolean     // plugin owns its submit button
  readonly serverCheck?: boolean           // false → client-side grading
  localGrade?(...): LocalGradeResult | null
  enrichFromApi?(exercise, spec): void     // API spec → component fields
  enrichFromManifest?(exercise, ak): void  // raw manifest → component fields

  readonly ObserveClassView?: ComponentType<ObserveClassViewProps>
  readonly ObserveStudentView?: ComponentType<ObserveStudentViewProps>
  readonly observeType?: string | null
}
```

Reference implementation: `built-in.tsx:889` registers `richContentQuizPlugin` with `selfManagedSubmit: true`, `observeType: 'image-upload'` (alias — reuses image-upload's observe views), `enrichFromApi` + `enrichFromManifest` that copy the per-part schema into render-ready exercise fields.

### Recipe for a new type

1. Add `<Type>Exercise.tsx` next to its siblings — a pure renderer that takes ans / setAns / allDone / reviewData props.
2. Add the plugin entry to `built-in.tsx`. The file is intentionally long because every entry sits next to its peers — find the section for a similar type, copy its shape, and adapt.
3. If your component supports review-restore (most do), follow the recipe in `frontend/CLAUDE.md`: a `useReviewRestore` hook + pure `parseXxxReview` function exported next to the component, plus a unit test row in `exercise/__tests__/review-restore.test.ts`.

---

## §6. Surface 4 — Frontend right side (guide + text panel)

The right column of the student screen has two things a new type may touch. Neither is auto-discovered.

### Per-type guide modal (the common case)

`RcqGuide.tsx`, `MapGuide.tsx`, `MatrixGuide.tsx`, etc. — a contextual help overlay imported **by the exercise component itself**. There is no central registry; your component owns `const [guideOpen, setGuideOpen] = useState(false)` and the corresponding `<HelpButton>` trigger.

Recipe: copy `RcqGuide.tsx`, adapt the copy, import it in your `<Type>Exercise.tsx`, wire a `HelpButton` in the toolbar area. ~50–80 lines of work; type-safe via the props shape on the guide component.

### Right-side reading text panel (the rare case)

`TextPanel.tsx` + `BoardInline.tsx` render the reading content. Most exercise types don't touch this surface. The exception is `select-evidence`, which highlights spans in the right-side text by reading `paragraphTokens` from the sanitized spec.

If your new type needs the right-side text to react to student actions in the left-side exercise (e.g. "highlight the sentence the student just clicked"), that wire-up is **bespoke today** — there is no generic surface for it. Don't invent one without architectural review; the existing select-evidence path is the precedent worth studying first.

---

## §7. Surface 5 — Observation + teacher observe drawer

### Event emission (no per-type work)

`student-submission.service.ts` dispatches `exercise_result` events through `@kedge-agentic/observer-engine` after every grade. The observation handlers under `backend/src/classroom/observation/handlers/` (`ExerciseHandler`, `JoinHandler`, etc.) are **global**, not per-type. You normally don't add a new file here.

### Backend observe handler (per-type teacher data)

This is the per-type surface for "what the teacher sees in the observe drawer for this step." File: `backend/src/classroom/observe/handlers/<type>.handler.ts`.

Auto-registration mirrors the plugin registry. From `backend/src/classroom/observe/observe-registry.ts:24`:

```ts
onModuleInit() {
  for (const wrapper of this.discoveryService.getProviders()) {
    const type = this.reflector.get<string>(OBSERVE_TYPE_KEY, wrapper.metatype);
    if (type && wrapper.instance) {
      this.handlers.set(type, wrapper.instance as ObserveHandler);
    }
  }
}
```

Reference impl: `matrix.handler.ts` and `mc.handler.ts`. Each is `@Injectable() @ObserveType('<type>')` implementing `ObserveHandler.compute(ctx) → <Type>ObserveData`. The aggregation does roll-ups across all students for the step — class-wide stats + per-student detail in one return value.

Two opt-out paths:
- **Reuse another type's handler** by setting the plugin's `observeType` to a string alias (e.g. `rich-content-quiz` aliases to `'image-upload'` — see `observe-registry.ts:52`).
- **Hide the observe button entirely** by setting `observeType: null` on the plugin (`fill-blank` does this).

### Frontend observe drawer integration

The drawer at `frontend/src/components/teacher/observe/ObserveDrawer.tsx` calls `getObserveView(type)` from `observe-view-registry.tsx`. That registry walks the plugin registry by `observeType ?? plugin.type`:

```ts
// observe-view-registry.tsx — findPluginByObserveType()
for (const type of getRegisteredTypes()) {
  const plugin = getExerciseType(type)
  if (plugin.observeType === null) continue
  const effective = plugin.observeType ?? plugin.type
  if (effective !== observeType) continue
  if (plugin.ObserveClassView && plugin.ObserveStudentView) return plugin
}
```

So the contract for the frontend side is: declare `ObserveClassView` + `ObserveStudentView` as lazy-loaded components on your plugin (`built-in.tsx`), set the right `observeType`, and the drawer picks them up automatically. Encourage aliasing over duplication.

---

## §8. Boundaries — what you cannot extend

Be honest with yourself about these before you start. None of them are pluggable today.

- **Teacher dashboard tabs.** `TeacherShell.tsx:415–448` hardcodes the right-pane tab structure (`DiscussInsightTab`, `SummaryTab`, `ClassroomStatusTab`, plus a `depth` panel). A new exercise type can contribute *data* — `stepMetrics`, `clusterStats`, `observation.indicatorStats`, etc. flow through the existing tabs — but it cannot add a fifth tab. If you think you need one, that's a framework change, not a plugin change.
- **`PracticePhase` / `StudentShell` / `enrich-exercise.ts` / `gradeItemSet` / `teacher-helpers`.** Off-limits for new types. If you find yourself editing any of these to ship a new exercise, the plugin contract has a gap — fix the contract, don't bypass it.
- **Observation event types.** Adding a new event kind (beyond `exercise_result`, `chat_turn`, etc.) is a framework-level change to `@kedge-agentic/observer-engine`. Don't do it as part of a new exercise type.

---

## §9. Debugging

### Backend

| Symptom | First place to look |
| --- | --- |
| Endpoint 500s | `backend.log` (`tail -f`) — NestJS prints the full stack |
| Wrong grade | Plugin's `grade()` return + the manifest's `answerKey` shape; mismatch is almost always schema drift |
| Missing observe data | The handler's `compute()` early-returns when `ctx.answerKey?.type !== '<expected>'` — check the type guard |
| LLM not called | `AiPromptBuilder.callLlm` / `callVisionLlm` logs every call; absence in the log = your codepath didn't reach the call site |
| Type registered but not dispatched | The registry only sees classes Nest *constructed*. If your `.module.ts` doesn't list your plugin in `providers`, the decorator scan never runs |

`AiPromptBuilder` writes per-request traces into `data/llm-trace/`. Pull a recent file when an LLM-backed feature misbehaves — the input, the response, and the model name are all there.

Useful one-shots:

```bash
# Re-seed lessons after editing a manifest.json (the seeder only inserts if missing):
cd solutions/business/live-lesson/backend
node -e "const fs=require('fs'),p=require('path'),DB=require('better-sqlite3');\
  const raw=fs.readFileSync(p.resolve('..','data/lessons/ideal-beauty-reading/manifest.json'),'utf-8');\
  const m=JSON.parse(raw); const db=new DB(p.resolve('data/live-lesson.db'));\
  db.prepare('UPDATE lessons SET manifest_json=? WHERE id=?').run(raw,m.id); db.close();"

# Watch a single Jest file:
cd solutions/business/live-lesson/backend && npx jest <file-pattern> --watch
```

### Frontend

- React DevTools shows `PracticePhase`'s `getExerciseType()` lookup. If your type renders the "no plugin registered" fallback, the side-effect import in `built-in.tsx` didn't reach `registerExerciseType()`.
- DevTools Network panel is the cheapest way to validate frontend ↔ backend contracts. If a request goes to `http://localhost:3001` instead of port 3007, the CCAAS SDK's `serverUrl` is misconfigured (see the rule in `CLAUDE.md`).
- For polling debugging, the polling endpoints are idempotent — refresh manually in DevTools Console:
  ```js
  await (await fetch('/api/classroom/<CODE>/state')).json()
  ```

### Common failure modes

- **`Cannot find module 'fs'` in a Jest test**: switch to `jest.mock('fs')` at file top + `const fs = require('fs') as jest.Mocked<typeof import('fs')>`. Newer Node makes `existsSync` non-configurable, so `jest.spyOn` fails.
- **`'sub:CODE:0'` localStorage entries persist across vitest runs**: `vi.stubGlobal('localStorage', …)` in `beforeEach` + restore in `afterEach`. See `submission-cache.test.ts`.
- **Playwright `400 name must be ≤20 characters`**: backend caps student names; keep test fixtures short.
- **E2E hangs on FAB click**: the StudentGuide modal is likely overlapping. Dismiss it explicitly before interacting with the toolbar.

---

## §10. Preview

### Local dev (the day-to-day loop)

```bash
# Terminal 1 — solution backend (port 3007)
cd solutions/business/live-lesson/backend && npm install --legacy-peer-deps && node dist/main.js

# Terminal 2 — solution frontend (port 5283)
cd solutions/business/live-lesson/frontend && npm install && npm run dev

# Terminal 3 — main CCAAS backend, only needed if you're touching the chat / agent flow (port 3001)
npm run dev:backend
```

Browse `http://localhost:5283/`, choose a lesson, take the join code, open a second tab on `/join`. You're now a teacher and a student in the same room — round-trip everything from both sides.

### Exercise plugin preview (no full app)

The `packages/exercise-preview` package boots a lightweight iframe sandbox that renders any plugin against a `.stories.mjs` file. Use this when iterating on the UI of a new exercise type without spinning up the whole classroom:

```bash
cd packages/exercise-preview
npm run build
node dist/cli/index.js --port 43451 bundles/<your-bundle>
# Open http://127.0.0.1:43451
```

A `Share Link` button in the admin playground mints short codes you can paste into Slack to share a single story snapshot.

### E2E preview (Playwright UI)

```bash
cd solutions/business/live-lesson/e2e
npm install
BACKEND_URL=http://localhost:3007 FRONTEND_URL=http://localhost:5283 npx playwright test --ui
```

The `--ui` flag opens Playwright's time-travel debugger. Spec `14-real-llm-integration.spec.ts` is a good template when you need to verify a new endpoint round-trips through the live model.

---

## §11. Post-implementation checklist (mandatory)

After ANY code changes, run these IN ORDER before claiming the task is done — skipping any step is a workflow violation per the root `CLAUDE.md`:

1. **Tests**
   - Backend: `cd solutions/business/live-lesson/backend && npx jest --no-coverage`
   - Frontend: `cd solutions/business/live-lesson/frontend && npm test`
   - E2E (only when you touched user-visible behavior): `cd solutions/business/live-lesson/e2e && npx playwright test`
2. **Code review**: run the `code-reviewer` agent on every changed file.
3. **Harness**: `bash scripts/harness-checks.sh` from the repo root.

If review finds issues, fix them before proceeding. Harness is the final gate.

---

## §12. When in doubt

- Memory and conventions: `/Users/niex/.claude/projects/.../memory/MEMORY.md` is loaded into every Claude session and lists the recurring gotchas (serverUrl pitfall, commit-message format, harness rule).
- Architectural decisions: repo-root `docs/adr/` and the sibling [`exercise-plugin-architecture.md`](./exercise-plugin-architecture.md).
- A specific past PR's reasoning: `git log -p` is the truth; commit messages in this repo are written to be load-bearing.

Still stuck? Spin up a 15-minute pairing block — three eyes beat any tutorial.
