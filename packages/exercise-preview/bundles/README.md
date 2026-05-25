# Example bundles

This directory ships canonical `*.stories.{ts,mjs}` files so newcomers can
run `exercise-preview` immediately without writing a bundle of their own
first.

## Quickstart

### Standalone — single bundle, vanilla chrome

```sh
# From the repo root
npx exercise-preview packages/exercise-preview/bundles/quiz-real
# → preview server on http://localhost:4321
```

Open the URL in a browser. The chrome will iframe in
`http://localhost:5283/exercise-demo` (the live-lesson frontend) for the
student/teacher views — start that separately:

```sh
cd solutions/business/live-lesson/frontend && npm run dev
```

### Full demo set — all 11 bundles

```sh
npx exercise-preview packages/exercise-preview/bundles/
```

The chrome's left pane lists every loaded bundle; click any story to
render it in the iframe.

## What's here

| Bundle               | Plugin type         | Stories | classObserveData | Notes                                          |
| -------------------- | ------------------- | ------- | ---------------- | ---------------------------------------------- |
| `quiz-real/`         | `quiz`              | 3       | ✓                | Ideal Beauty ¶1-2 reading-comp questions       |
| `quiz-demo/`         | `quiz`              | 3       | —                | Older minimal schema — kept for e2e parity     |
| `match/`             | `match`             | 2       | —                | Culture × beauty-practice matching             |
| `matrix/`            | `matrix`            | 1       | ✓                | What/Why grid across cultures                  |
| `order/`             | `order`             | 3       | —                | Sequence assembly                              |
| `stance/`            | `stance`            | 2       | —                | Position-taking with evidence                  |
| `fill-blank/`        | `fill-blank`        | 2       | —                | Vocabulary infill                              |
| `select-evidence/`   | `select-evidence`   | 1       | ✓                | Function tagging on paragraph spans            |
| `map/`               | `map`               | 1       | ✓                | 2-axis positioning (drag onto coord plane)     |
| `image-upload/`      | `image-upload`      | 1       | ✓                | Photo of handwritten work + rubric grading     |
| `rich-content-quiz/` | `rich-content-quiz` | 1       | —                | Multi-part calculation with scaffolds          |
| `guided-discovery/`  | `guided-discovery`  | 1       | ✓                | Perfect-square formula — 4 step subtypes       |

Note: `quiz-real` and `quiz-demo` both register as `type: 'quiz'`. When
the chrome loads both, the alphabetically-later one (quiz-real) wins the
`quiz` bundleId. To preview the older one specifically, scope the
preview-server to that bundle alone (`npx exercise-preview .../quiz-demo`).

## Writing your own

Pattern (mirrors `quiz-real/quiz-real.stories.mjs`):

```js
import { defineStories } from '../../dist/index.js'

const plugin = {
  type: 'match',
  displayName: 'Match',
  grade(ctx) { /* minimal grader is fine — preview-server uses the
                  real production grader if available via NestJS DI */ },
}

const answerKey = {
  type: 'match',
  // ...follow the production zod schema for your type
  // (backend/src/schemas/answer-key.schema.ts is the source of truth)
}

export default defineStories({
  plugin,
  meta: { title: 'Match — your title', description: '...', tags: ['demo'] },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey,
  // initialAns: { ... },        // optional, pre-fills the student state
  // classObserveData: { ... },  // optional, drives ?role=teacher
}
```

For types with an `ObserveClassView` (matrix / map / select-evidence /
image-upload / guided-discovery / quiz via `McClassView`), supply a
`classObserveData` whose shape matches what that ClassView destructures
at the top — e.g. `{ stats, questions, misconceptions, students }` for
`McClassView`. See `quiz-real/quiz-real.stories.mjs` for a worked example.

For the full end-to-end walkthrough on adding a new exercise type, see
[`exercise-plugin-extension-guide.md`](../../../solutions/business/live-lesson/docs/exercise-plugin-extension-guide.md).
