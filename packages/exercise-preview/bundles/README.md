# Example bundles

This directory ships canonical `*.stories.ts` files so newcomers can run
`exercise-preview` immediately without writing a bundle of their own first.

## Quickstart

```sh
# From the repo root
npx exercise-preview packages/exercise-preview/bundles/quiz-demo
# → dev server on http://localhost:4321
```

The preview server scans the given directory recursively for files matching
`*.stories.ts`, loads each module, and registers every named export that
matches the `Story` shape.

Open the URL in a browser, or embed the iframe in the admin playground
(`http://localhost:5175/playground`).

## What's here

| Bundle           | Plugin type | Stories | Notes                                    |
| ---------------- | ----------- | ------- | ---------------------------------------- |
| `quiz-demo/`     | `quiz`      | 3       | Correct / wrong-answer / unanswered      |

## Writing your own

See [`exercise-plugin-extension-guide.md`](../../../solutions/business/live-lesson/docs/exercise-plugin-extension-guide.md)
for the end-to-end walkthrough on adding a new exercise type. The short
version: implement `ExerciseTypePlugin` (backend) + `ExerciseUIPlugin`
(frontend), then drop a `*.stories.ts` next to it.
