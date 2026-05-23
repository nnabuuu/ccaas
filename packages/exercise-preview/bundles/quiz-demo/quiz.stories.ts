/**
 * Example bundle — `quiz` exercise type.
 *
 * Run this against the preview server from the repo root:
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/quiz-demo
 *
 * The CLI auto-discovers `*.stories.ts` files, loads the default export
 * (plugin + meta) and every named export that matches the Story shape.
 *
 * The plugin here is a deliberately minimal stub. A production plugin would
 * also implement sanitize / buildCheckItems / enrichFromApi /
 * enrichFromManifest — see docs/exercise-plugin-extension-guide.md.
 */
import { defineStories } from '../../src/core/define-stories'
import type { Story } from '../../src/core/types'

/** Tiny quiz plugin — picks the index that matches `key.correct`. */
const quizPlugin = {
  type: 'quiz' as const,
  displayName: 'Quiz',
  /** Mirrors a fragment of the production QuizAnswerKey shape. */
  answerKeySchema: {} as never, // exercise-preview only uses .type for routing
  grade(ctx: { key: { correct: number }; data: { answers?: number[] } }) {
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

// ─────────────────────────────────────────────────────────────────────────
// Stories
// ─────────────────────────────────────────────────────────────────────────

/**
 * Default happy-path story: the right answer is selected, so grade() returns
 * total = 100. Used to smoke-check the dev server end-to-end.
 */
export const Default: Story = {
  name: 'Default — correct selection',
  locale: 'en',
  answerKey: { type: 'quiz', correct: 1 },
  initialAns: { answers: [1] },
}

/**
 * Wrong-answer story: useful for verifying the Inspector's grade history +
 * L1 prompt traces (the deterministic quiz plugin's `buildGradePrompt`
 * returns [] so the L1 panel says "no LLM calls", confirming wiring).
 */
export const WrongAnswer: Story = {
  name: 'Wrong answer',
  locale: 'en',
  answerKey: { type: 'quiz', correct: 1 },
  initialAns: { answers: [0] },
}

/**
 * Empty-input story: nothing selected. Lets authors check that the UI
 * disables submit until an answer is picked (canSubmit contract).
 */
export const Unanswered: Story = {
  name: 'Unanswered',
  locale: 'en',
  answerKey: { type: 'quiz', correct: 1 },
  initialAns: {},
}
