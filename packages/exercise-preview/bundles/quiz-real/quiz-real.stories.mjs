/**
 * Demo bundle — `quiz` exercise type with **production schema**.
 *
 * Mirrors the real live-lesson QuizAnswerKey shape used by Ideal Beauty:
 *
 *   answerKey: {
 *     type: 'quiz',
 *     answers: [{ questionIdx, correct, options, questionText, hint, walkthrough }]
 *   }
 *
 * The frontend's enrichFromManifest reads from `answers[]` — using the minimal
 * `{type:'quiz', correct: 1}` shape from the older quiz-demo bundle would crash
 * QuizExercise.tsx.
 *
 * Run:
 *   $ npx exercise-preview packages/exercise-preview/bundles/quiz-real
 */
import { defineStories } from '../../dist/index.js'

const quizPlugin = {
  type: 'quiz',
  displayName: 'Quiz',
  answerKeySchema: undefined,
  grade(ctx) {
    const submitted = ctx.data.answers ?? []
    const expected = (ctx.key.answers ?? []).map((a) => a.correct)
    const correctness = expected.map((c, i) => submitted[i] === c)
    const allCorrect = correctness.every(Boolean)
    return {
      total: allCorrect ? 100 : Math.round((correctness.filter(Boolean).length / expected.length) * 100),
      byDimension: Object.fromEntries(correctness.map((c, i) => [`q${i}`, c])),
    }
  },
}

const idealBeautyP1Quiz = {
  type: 'quiz',
  answers: [
    {
      questionIdx: 0,
      correct: 1,
      questionText: 'What did Happiness Edem do to become "beautiful"?',
      questionTranslate: 'Happiness Edem 为了变"美"做了什么？',
      options: [
        'Went on a diet to become slim',
        'Gained weight in a fattening room',
        'Got cosmetic surgery',
        'Started a fashion brand',
      ],
      hint: 'Look at ¶1: what happened to her **weight**? Did it go up or down?',
      hintZh: '看 ¶1，她的**体重**发生了什么变化？增加还是减少？',
    },
    {
      questionIdx: 1,
      correct: 2,
      questionText: 'Where did this practice take place?',
      questionTranslate: '这种习俗发生在哪里？',
      options: ['Egypt', 'Brazil', 'Nigeria', 'India'],
      hint: 'The first sentence mentions the country.',
    },
    {
      questionIdx: 2,
      correct: 1,
      questionText: 'How long did the process last?',
      questionTranslate: '过程持续了多久？',
      options: ['Six weeks', 'Six months', 'One year', 'Two years'],
      hint: '"She spent ___ in a fattening room"',
    },
  ],
}

export default defineStories({
  plugin: quizPlugin,
  meta: {
    title: 'Quiz — Ideal Beauty ¶1-2',
    description: 'Real production-schema quiz: 3 reading-comprehension questions on the opening of "Ideal Beauty".',
    tags: ['demo', 'quiz', 'reading'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyP1Quiz,
}

export const AllCorrect = {
  name: 'All correct (pre-filled)',
  locale: 'zh',
  answerKey: idealBeautyP1Quiz,
  initialAns: { 0: 1, 1: 2, 2: 1 },
}

export const PartiallyWrong = {
  name: 'Partially wrong',
  locale: 'zh',
  answerKey: idealBeautyP1Quiz,
  initialAns: { 0: 0, 1: 2, 2: 1 },
}
