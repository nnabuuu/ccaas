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

/* ── Teacher-view mock data ─────────────────────────────────────────────
 * Shape matches McClassView's expected `data` (frontend/components/teacher/observe/mc).
 * Real backend produces this via QuizObserveHandler; for the standalone demo we
 * pre-bake a representative class snapshot so the teacher panel shows realistic
 * class-wide stats, per-question distribution, and a misconception cluster.
 */
const classObserveDataIdealBeauty = {
  stats: {
    totalStudents: 24,
    submitted: 22,
    avgScore: 76,
    perfectCount: 11,
    zeroCount: 1,
    avgTime: 138,
    fastestTime: 52,
    slowestTime: 312,
  },
  questions: [
    {
      idx: 0,
      stem: 'What did Happiness Edem do to become "beautiful"?',
      tag: 'Detail · ¶1',
      options: [
        'Went on a diet to become slim',
        'Gained weight in a fattening room',
        'Got cosmetic surgery',
        'Started a fashion brand',
      ],
      correctIdx: 1,
      distribution: [
        { count: 6, pct: 27 },
        { count: 14, pct: 64 },
        { count: 1, pct: 5 },
        { count: 1, pct: 5 },
      ],
      correctRate: 64,
    },
    {
      idx: 1,
      stem: 'Where did this practice take place?',
      tag: 'Detail · ¶1',
      options: ['Egypt', 'Brazil', 'Nigeria', 'India'],
      correctIdx: 2,
      distribution: [
        { count: 1, pct: 5 },
        { count: 0, pct: 0 },
        { count: 20, pct: 91 },
        { count: 1, pct: 5 },
      ],
      correctRate: 91,
    },
    {
      idx: 2,
      stem: 'How long did the process last?',
      tag: 'Detail · ¶2',
      options: ['Six weeks', 'Six months', 'One year', 'Two years'],
      correctIdx: 1,
      distribution: [
        { count: 3, pct: 14 },
        { count: 16, pct: 73 },
        { count: 2, pct: 9 },
        { count: 1, pct: 5 },
      ],
      correctRate: 73,
    },
  ],
  misconceptions: [
    {
      id: 'q1-slim',
      label: '把"变美"等同于"变瘦"——忽略 ¶1 明示的 fattening 主题',
      count: 6,
      severity: 'high',
      students: [
        { id: 's03', name: '王思源' },
        { id: 's07', name: '陈昊宇' },
        { id: 's11', name: '林佳颖' },
        { id: 's14', name: '黄子凯' },
        { id: 's18', name: '周雨桐' },
        { id: 's21', name: '徐俊豪' },
      ],
    },
    {
      id: 'q3-weeks',
      label: '时间量级估算偏短——把 months 读成 weeks',
      count: 3,
      severity: 'medium',
      students: [
        { id: 's05', name: '李欣然' },
        { id: 's13', name: '赵明轩' },
        { id: 's20', name: '马诗涵' },
      ],
    },
  ],
  students: [
    { id: 's01', name: '王梓萱', score: 100, time: 78,
      answers: { 0: { selected: 1, correct: true, changed: false, timeSpent: 24 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 18 },
                 2: { selected: 1, correct: true, changed: false, timeSpent: 36 } },
      keyInsights: ['快速、稳定'] },
    { id: 's03', name: '王思源', score: 67, time: 165,
      answers: { 0: { selected: 0, correct: false, changed: false, timeSpent: 62 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 28 },
                 2: { selected: 1, correct: true, changed: true, timeSpent: 75 } },
      keyInsights: ['Q1 误解：variation 主题'] },
    { id: 's05', name: '李欣然', score: 67, time: 142,
      answers: { 0: { selected: 1, correct: true, changed: false, timeSpent: 35 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 22 },
                 2: { selected: 0, correct: false, changed: false, timeSpent: 85 } },
      keyInsights: ['Q3 时间词混淆'] },
    { id: 's07', name: '陈昊宇', score: 33, time: 268,
      answers: { 0: { selected: 0, correct: false, changed: true, timeSpent: 132 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 41 },
                 2: { selected: 0, correct: false, changed: false, timeSpent: 95 } },
      keyInsights: ['多处犹豫、最终错答'] },
    { id: 's11', name: '林佳颖', score: 67, time: 112,
      answers: { 0: { selected: 0, correct: false, changed: false, timeSpent: 48 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 25 },
                 2: { selected: 1, correct: true, changed: false, timeSpent: 39 } },
      keyInsights: ['Q1 直觉式误读'] },
    { id: 's14', name: '黄子凯', score: 67, time: 198,
      answers: { 0: { selected: 0, correct: false, changed: false, timeSpent: 88 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 35 },
                 2: { selected: 1, correct: true, changed: false, timeSpent: 75 } },
      keyInsights: ['Q1 跳过细节'] },
    { id: 's16', name: '吴梓铭', score: 100, time: 95,
      answers: { 0: { selected: 1, correct: true, changed: false, timeSpent: 32 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 21 },
                 2: { selected: 1, correct: true, changed: false, timeSpent: 42 } },
      keyInsights: [] },
    { id: 's18', name: '周雨桐', score: 67, time: 156,
      answers: { 0: { selected: 0, correct: false, changed: false, timeSpent: 71 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 30 },
                 2: { selected: 1, correct: true, changed: false, timeSpent: 55 } },
      keyInsights: ['Q1 误解：slim 暗示'] },
    { id: 's21', name: '徐俊豪', score: 33, time: 312,
      answers: { 0: { selected: 0, correct: false, changed: true, timeSpent: 158 },
                 1: { selected: 3, correct: false, changed: false, timeSpent: 62 },
                 2: { selected: 1, correct: true, changed: false, timeSpent: 92 } },
      keyInsights: ['整体偏弱、需个别指导'] },
    { id: 's23', name: '何欣怡', score: 100, time: 88,
      answers: { 0: { selected: 1, correct: true, changed: false, timeSpent: 28 },
                 1: { selected: 2, correct: true, changed: false, timeSpent: 19 },
                 2: { selected: 1, correct: true, changed: false, timeSpent: 41 } },
      keyInsights: [] },
  ],
}

Default.classObserveData = classObserveDataIdealBeauty
AllCorrect.classObserveData = classObserveDataIdealBeauty
PartiallyWrong.classObserveData = classObserveDataIdealBeauty
