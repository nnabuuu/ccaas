/**
 * Example bundle — `quiz` exercise type.
 *
 * Run this against the preview server from the repo root:
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/quiz-demo
 *
 * The CLI auto-discovers *.stories.ts / *.stories.mjs files, loads the
 * default export (plugin + meta) and every named export that matches the
 * Story shape. We ship .mjs (not .ts) so Node can import natively without
 * a TypeScript loader hook — the dev server runs the compiled CLI from
 * dist/, which doesn't have tsx wired up.
 *
 * A production plugin would also implement sanitize / buildCheckItems /
 * enrichFromApi / enrichFromManifest — see
 * docs/exercise-plugin-extension-guide.md (and its Chinese counterpart).
 */
import { defineStories } from '../../dist/index.js'

/** Tiny quiz plugin — picks the index that matches `key.correct`. */
const quizPlugin = {
  type: 'quiz',
  displayName: 'Quiz',
  // exercise-preview only routes by .type — schema is ignored at runtime.
  answerKeySchema: undefined,
  grade(ctx) {
    const selected = (ctx.data.answers ?? [])[0]
    const isCorrect = selected === ctx.key.correct
    return {
      total: isCorrect ? 100 : 0,
      byDimension: { q0: isCorrect },
    }
  },
}

export default defineStories({
  plugin: quizPlugin,
  meta: {
    title: 'Quiz Demo Bundle',
    description:
      'Sanity-check bundle: a single multiple-choice question with three stories (correct / wrong / empty).',
    tags: ['demo', 'quiz'],
  },
})

export const Default = {
  name: 'Default — correct selection',
  locale: 'en',
  answerKey: { type: 'quiz', correct: 1 },
  initialAns: { answers: [1] },
}

export const WrongAnswer = {
  name: 'Wrong answer',
  locale: 'en',
  answerKey: { type: 'quiz', correct: 1 },
  initialAns: { answers: [0] },
}

export const Unanswered = {
  name: 'Unanswered',
  locale: 'en',
  answerKey: { type: 'quiz', correct: 1 },
  initialAns: {},
}
