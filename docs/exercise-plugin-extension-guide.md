# Adding a New Exercise Type — Extension Guide

Promised by `exercise-plugin-architecture.md §7`; here's the concrete walkthrough.

The plugin system was designed so that adding a new exercise type means writing **one backend plugin file + one frontend UI plugin entry + (optionally) one stories file** — no edits in `PracticePhase`, `enrich-exercise.ts`, `StudentShell`, `gradeItemSet`, or `teacher-helpers`. If you find yourself opening any of those during this work, file an issue — that's a regression on the audit promises (A1, B5, B6, B7, B8 in `/Users/niex/.claude/plans/kind-exploring-mango.md`).

This guide assumes you've read `solutions/business/live-lesson/docs/exercise-plugin-architecture.md` for the high-level model. It focuses on the *mechanics* of getting from zero to a registered, working type.

---

## Mental model

A complete exercise type has three artifacts living in three different packages:

| Artifact | Lives in | Implements | Required? |
| --- | --- | --- | --- |
| **Backend plugin** | `solutions/business/live-lesson/backend/src/classroom/exercise/plugins/<type>.plugin.ts` | `ExerciseTypePlugin` | Yes — grading + sanitize + checkItems happen here |
| **Frontend UI plugin** | `solutions/business/live-lesson/frontend/src/components/student/exercise/plugins/built-in.tsx` (one entry per type) | `ExerciseUIPlugin` | Yes — render + canSubmit + localGrade + enrich + handleCheckResult |
| **Stories file** *(optional)* | next to the plugin source, suffix `.stories.ts` | `defineStories` + named `Story` exports | Optional — only needed to preview in `exercise-preview` |

The backend's `ExerciseTypeRegistry` auto-discovers any class decorated with `@ExerciseType('<type>')`. The frontend's `getExerciseType` reads from a Map populated by side-effect imports in `built-in.tsx`. So registration is just "import the file"; no central wire-up.

---

## Step 1 — Pick the type identifier

`'long-division'`, `'matching-pairs'`, etc. Lowercase kebab-case. It must be unique across the codebase; the registry warns on duplicates and overrides last-writer-wins.

Conventions:
- Use the same string for both backend and frontend (`plugin.type === uiPlugin.type`).
- Don't name it after the implementation (`'three-column-table'` ❌); name it after the *exercise type* (`'matrix'` ✅).

---

## Step 2 — Backend plugin

```ts
// solutions/business/live-lesson/backend/src/classroom/exercise/plugins/long-division.plugin.ts
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ExerciseType } from '../exercise-type.decorator';
import type {
  ExerciseTypePlugin,
  GradeContext,
  CheckItemContext,
  SanitizeContext,
  GradePromptSpec,
} from '../exercise-type-plugin.interface';
import type { GradeResult } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';

// ─── 1. Schema: define what an answerKey for your type looks like.
//     This is the source of truth — the composed registry schema
//     (used by `validateAnswerKey()` and the lesson manifest validator)
//     is a union of these.
const LongDivisionAnswerKeySchema = z.object({
  type: z.literal('long-division'),
  dividend: z.string(),
  divisor: z.string(),
  steps: z.array(z.object({ partial: z.string(), remainder: z.string() })),
});

type LongDivisionKey = z.infer<typeof LongDivisionAnswerKeySchema>;

// ─── 2. Plugin class. NestJS DI + the `@ExerciseType` decorator wire it
//     into the registry at module init.
@Injectable()
@ExerciseType('long-division')
export class LongDivisionPlugin implements ExerciseTypePlugin {
  readonly type = 'long-division';
  readonly answerKeySchema = LongDivisionAnswerKeySchema;

  // 2a. sanitize(): strip answer-bearing fields before sending the spec to
  // the student. Return null when the answerKey doesn't match this plugin
  // (shouldn't happen post-discriminator, but defensive).
  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey as LongDivisionKey;
    return {
      type: 'long-division',
      label: ctx.exerciseLabel || '',
      dividend: ak.dividend,
      divisor: ak.divisor,
      // `steps` contains the answer — strip it.
    };
  }

  // 2b. grade(): the heart of the type. Sync or async. Return a GradeResult.
  grade(ctx: GradeContext): GradeResult {
    const key = ctx.key as unknown as LongDivisionKey;
    const studentSteps = (ctx.data.steps ?? []) as Array<{ partial: string; remainder: string }>;
    const byDimension: Record<string, boolean> = {};
    let correct = 0;
    for (let i = 0; i < key.steps.length; i++) {
      const isOk =
        studentSteps[i]?.partial === key.steps[i].partial &&
        studentSteps[i]?.remainder === key.steps[i].remainder;
      byDimension[`s${i}`] = isOk;
      if (isOk) correct++;
    }
    const total = key.steps.length > 0 ? Math.round((correct / key.steps.length) * 100) : 0;
    return { total, byDimension };
  }

  // 2c. buildCheckItems(): per-step feedback items for the student.
  //     The frontend's PracticePhase applies these after a server check.
  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const key = ctx.key as unknown as LongDivisionKey;
    return key.steps.map((_, i) => ({
      idx: i,
      correct: ctx.gradeResult.byDimension?.[`s${i}`] === true,
    }));
  }

  // 2d. (optional) §14 L3 two-stage grade — exposes the LLM call (if any)
  //     to the admin Inspector for prompt-edit + rerun debugging.
  //     For deterministic plugins (no LLM), return [] from buildGradePrompt
  //     and just re-run grade() in parseGradeResponse. See `quiz.plugin.ts`
  //     for that pattern.
  buildGradePrompt(_ctx: GradeContext): GradePromptSpec[] {
    return [];
  }
  parseGradeResponse(_responses: string[], ctx: GradeContext): GradeResult {
    return this.grade(ctx);
  }
}
```

Then register the class with the NestJS module so the discovery scan picks it up. Open `solutions/business/live-lesson/backend/src/classroom/exercise/exercise.module.ts` (or whichever module hosts the plugins — search the codebase for an existing `*.plugin.ts` import) and add `LongDivisionPlugin` to its `providers` array.

**That's it on the backend.** No edits in `GradingService`, no edits in `student-submission.service.ts`, no edits in `exercise.service.ts` — they all dispatch through `ExerciseTypeRegistry`.

---

## Step 3 — Frontend UI plugin

```tsx
// solutions/business/live-lesson/frontend/src/components/student/exercise/plugins/built-in.tsx
// ... at the bottom, before registerExerciseType() calls:

const longDivisionPlugin: ExerciseUIPlugin = {
  type: 'long-division',

  // 3a. observeType — backend observer alias. Defaults to plugin.type.
  //     Use `null` to suppress the teacher-observe button entirely.
  observeType: null,

  // 3b. Render. Reads from the consolidated `pluginState` bag — never from
  //     `ans` for transient UI state. PracticePhase routes everything
  //     through a single <PluginComp/> call.
  Component: function LongDivisionComp(props: ExercisePluginProps) {
    const { exercise, ans, setAns, allDone, reviewData } = props
    return (
      <LongDivisionExercise
        dividend={exercise.dividend}
        divisor={exercise.divisor}
        ans={ans}
        setAns={setAns as any}
        disabled={allDone}
        reviewData={reviewData}
      />
    )
  },

  // 3c. canSubmit — the submit button is greyed out when this returns false.
  canSubmit(exercise, ans) {
    return Array.isArray(ans.steps) && ans.steps.length === (exercise.steps?.length ?? 0)
  },

  // 3d. formatSubmitData — owns the wire format. Reads ans + pluginState bag.
  //     The backend grader's `data.<field>` lookups must match what you emit here.
  formatSubmitData(ans) {
    return { steps: ans.steps ?? [] }
  },

  // 3e. handleCheckResult — apply server check results to PracticePhase state.
  //     Use the `current.pluginState` bag for transient UI; emit `reportItems`
  //     so PracticePhase fires the student_attempt telemetry postMessages
  //     (the legacy `reportAttempt(...)` is invoked centrally for you).
  handleCheckResult(result, _exercise, current) {
    return {
      checkResultState: { ...(current.pluginState ?? {}) },
      allDone: !!result.allCorrect,
      softDone: true,
      reportItems: [
        { qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: !!result.allCorrect },
      ],
    }
  },

  // 3f. (optional) enrichFromApi / enrichFromManifest — hydrate the
  //     TaskExercise object from the API spec or the raw manifest answerKey.
  //     This is what makes "new types don't touch enrich-exercise.ts" true.
  enrichFromApi(ex, spec) {
    if (spec.dividend) ex.dividend = spec.dividend
    if (spec.divisor) ex.divisor = spec.divisor
  },
  enrichFromManifest(ex, ak) {
    if (ak.dividend) ex.dividend = ak.dividend
    if (ak.divisor) ex.divisor = ak.divisor
    if (ak.steps) ex.steps = ak.steps
  },
}

registerExerciseType(longDivisionPlugin) // ← add this line near the others
```

**Key rules:**

- **Never use the `ans` bag for transient UI state.** That bag is reserved for the canonical answer payload that gets keyed numerically by other plugins. Use `pluginState` (read via `checkResultState`, write via `setCheckResultState`).
- **Always forward `reviewData`** to the underlying exercise component, otherwise review-mode replay will break for your type.
- **`handleCheckResult` is pure.** Side effects like `reportAttempt` are wired centrally — emit `reportItems[]` instead.

---

## Step 4 — Stories file (optional, for preview)

If you want to author drafts in the admin Playground or run `exercise-preview` locally:

```ts
// long-division.stories.ts (next to long-division.plugin.ts, or anywhere
// that `exercise-preview` will scan)
import { defineStories } from '@kedge-agentic/exercise-preview'
import type { Story } from '@kedge-agentic/exercise-preview/core'
import { LongDivisionPlugin } from './long-division.plugin'

export default defineStories({
  plugin: new LongDivisionPlugin(),
  meta: {
    title: 'Long Division',
    description: 'Polynomial long division for grade 8',
    tags: ['math', 'grade-8'],
  },
})

export const Default: Story = {
  name: 'Default — clean division',
  answerKey: {
    type: 'long-division',
    dividend: 'x^3 - 2x^2 + 4',
    divisor: 'x - 1',
    steps: [{ partial: 'x^2', remainder: '-x^2' }],
  },
  initialAns: { steps: [] },
}
```

See `packages/exercise-preview/bundles/quiz-demo/` for a complete minimal example.

---

## Step 5 — Verify

```sh
# Backend
cd solutions/business/live-lesson/backend
npx nest build                   # type-check
npx jest --no-coverage           # all tests pass

# Frontend
cd solutions/business/live-lesson/frontend
npm run build                    # type-check via tsc -b
npm test -- --run                # all tests pass

# Preview (only if you wrote a stories file)
cd packages/exercise-preview
npx vitest run

# Manual smoke
npx exercise-preview path/to/your/stories  # http://localhost:4321
```

The plugin should now appear:

1. **In the manifest validator** — `validateAnswerKey({ type: 'long-division', ... })` returns `{ valid: true }`.
2. **At the `/check` endpoint** — `POST /api/classroom/:code/steps/:step/check` with a matching answerKey grades correctly.
3. **In the teacher dashboard** — if `observeType !== null`, an observe button appears on the step card.
4. **In the admin playground** — if you wrote a stories file, the bundle shows up in the bundle tree.
5. **In the Inspector tab** — L1/L2 traces fire on every grade; L3 build-prompt + edit + rerun works if you implemented those methods.

---

## What you don't have to touch

For the audit to stay honest, this is the list of files **a new exercise type should not require you to open**:

- `solutions/business/live-lesson/backend/src/classroom/exercise/exercise-type-registry.ts` — autoregisters via `@ExerciseType()`
- `solutions/business/live-lesson/backend/src/classroom/exercise/grading.service.ts` — dispatches through registry
- `solutions/business/live-lesson/backend/src/classroom/exercise/exercise.service.ts` — dispatches through registry
- `solutions/business/live-lesson/backend/src/classroom/student-submission.service.ts` — dispatches through registry
- `solutions/business/live-lesson/backend/src/classroom/personal-touch/personalization.service.ts` — dispatches through registry
- `solutions/business/live-lesson/frontend/src/components/student/exercise/PracticePhase.tsx` — single `<PluginComp/>` call drives render/submit/check
- `solutions/business/live-lesson/frontend/src/components/student/exercise/enrich-exercise.ts` — dispatches through registry
- `solutions/business/live-lesson/frontend/src/components/student/StudentShell.tsx` — unchanged
- `solutions/business/live-lesson/frontend/src/components/teacher/teacher-helpers.ts` — `getObserveType` reads `plugin.observeType` from the registry

If you find yourself editing any of these to wire a new type in, that file likely missed a registry migration — please file an issue.

---

## Common pitfalls

- **Forgetting `@ExerciseType('...')`** — the class compiles but never gets registered. `ExerciseTypeRegistry.getRegisteredTypes()` won't list your type at startup.
- **Mismatched `type` strings** — the backend plugin's `type` field, the `@ExerciseType()` argument, the frontend plugin's `type`, and the answerKey `type` literal must all match exactly. The Zod schema uses `z.literal('your-type')` so any drift gets caught at parse time.
- **Using `ans` for UI state** — every other plugin numerically keys into the same `ans` bag (`ans[0]`, `ans[1]`, ...). Stashing UI state like `{ matrixOpen: true }` there will collide. Use `pluginState`.
- **Async `grade` that touches state** — `grade(ctx)` must be pure (or only do LLM/network calls). Don't mutate `ctx.key` or `ctx.data` in place; the inspector replay path passes them around.
- **Forgetting `reviewData`** — review-mode UI silently breaks for your type until you forward it to the underlying exercise component.

---

## References

- Architecture: `solutions/business/live-lesson/docs/exercise-plugin-architecture.md`
- Preview platform design: `solutions/business/live-lesson/docs/exercise-plugin-preview-design.md`
- Existing plugins to crib from: `solutions/business/live-lesson/backend/src/classroom/exercise/plugins/*.plugin.ts`
- Example bundle: `packages/exercise-preview/bundles/quiz-demo/`
- §14 L3 (Inspector debugging contract): `exercise-plugin-preview-design.md §14`
