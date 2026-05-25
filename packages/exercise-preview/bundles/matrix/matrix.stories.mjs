/**
 * Demo bundle — `matrix` exercise type.
 *
 * AnswerKey shape (MatrixAnswerKeySchema):
 *   { type:'matrix', answers:[{ rowIdx, place, isDemo?, practice?, reason?, ... }],
 *     practiceCount? }
 * Non-demo rows MUST have both `practice` and `reason`.
 *
 * matrixPlugin.enrichFromManifest maps answers[] → ex.rows[] with
 * `{ place, demo, practice, reason, whatPrompt?, whyPrompt? }`.
 * Student fills two text fields per row (what/why) → ans.matrixAns shape:
 *   { [rowIdx]: { what: string, why: string } }
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/matrix
 */
import { defineStories } from '../../dist/index.js'

const matrixPlugin = {
  type: 'matrix',
  displayName: 'Matrix',
  grade(ctx) {
    const rows = ctx.data.rows ?? {}
    const filled = Object.values(rows).filter((r) => (r?.what?.trim().length ?? 0) > 0 && (r?.why?.trim().length ?? 0) > 0).length
    const total = (ctx.key.answers ?? []).filter((a) => !a.isDemo).length || 1
    return { total: Math.round((filled / total) * 100), byDimension: { filled } }
  },
}

// 4 cultures × (what beauty practice + why) — first row is a worked demo.
const idealBeautyMatrix = {
  type: 'matrix',
  practiceCount: 3,
  answers: [
    {
      rowIdx: 0,
      place: 'Nigeria (Efik)',
      isDemo: true,
      practice: 'Fattening rooms for brides',
      reason: 'Weight signals wealth, fertility, and family prosperity.',
      whatPrompt: 'What practice?',
      whyPrompt: 'Why is it valued?',
    },
    {
      rowIdx: 1,
      place: 'India / parts of Africa',
      practice: 'Skin-lightening cosmetics',
      reason: 'Lighter skin historically associated with higher caste/class.',
    },
    {
      rowIdx: 2,
      place: 'Imperial China',
      practice: 'Foot binding (三寸金莲)',
      reason: 'Small feet signaled refinement and marriageability.',
    },
    {
      rowIdx: 3,
      place: 'Modern South Korea',
      practice: 'Cosmetic eyelid surgery',
      reason: 'Larger eyes seen as youthful and aesthetically pleasing.',
    },
  ],
}

export default defineStories({
  plugin: matrixPlugin,
  meta: {
    title: 'Matrix — Beauty practices across 4 cultures',
    description: '为每种文化填写"是什么 / 为什么",练习跨文化对比阅读。',
    tags: ['demo', 'matrix', 'reading'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyMatrix,
}

/* ── Teacher classObserveData mock — matches MatrixData shape ────────── */
const classObserveDataMatrix = {
  stats: {
    totalStudents: 22, submitted: 20, avgCompletion: 88,
    avgQuality: 2.1, whatAvg: 2.3, whyAvg: 1.9, needAttention: 3,
  },
  rows: [
    {
      id: 'r1', concept: '印度·美白', paraRef: '¶3',
      whatAvg: 2.5, whyAvg: 2.1,
      whatDist: [0, 2, 6, 12], whyDist: [1, 3, 8, 8],
    },
    {
      id: 'r2', concept: '中国·缠足', paraRef: '¶4',
      whatAvg: 2.4, whyAvg: 1.8,
      whatDist: [0, 3, 5, 12], whyDist: [2, 5, 7, 6],
    },
    {
      id: 'r3', concept: '韩国·整形', paraRef: '¶5',
      whatAvg: 2.2, whyAvg: 1.8,
      whatDist: [0, 4, 6, 10], whyDist: [3, 4, 7, 6],
    },
  ],
  patterns: [
    {
      id: 'why-shallow',
      label: '"Why" 普遍流于表面 — 只复述事实,缺少社会/历史原因',
      count: 7, severity: 'medium',
      students: [{ id: 's03', name: '王思源' }, { id: 's11', name: '林佳颖' }, { id: 's18', name: '周雨桐' }],
    },
  ],
  students: [
    {
      id: 's01', name: '王梓萱', time: 215, submitted: true,
      completion: { filled: 3, total: 3, pct: 100 }, avgQuality: 2.7,
      responses: {
        r1: { what: 'Skin-lightening creams', why: 'Caste/class associations', whatQ: 3, whyQ: 3 },
        r2: { what: 'Foot binding', why: 'Marriage market signaling', whatQ: 3, whyQ: 3 },
        r3: { what: 'Eyelid surgery', why: 'Youthful look', whatQ: 3, whyQ: 2 },
      },
      keyInsights: ['深度对比到位'],
    },
    {
      id: 's03', name: '王思源', time: 142, submitted: true,
      completion: { filled: 3, total: 3, pct: 100 }, avgQuality: 1.5,
      responses: {
        r1: { what: 'Whitening cream', why: 'People like white skin', whatQ: 2, whyQ: 1 },
        r2: { what: 'Foot binding', why: 'Tradition', whatQ: 2, whyQ: 1 },
        r3: { what: 'Surgery', why: 'Want to look better', whatQ: 2, whyQ: 1 },
      },
      keyInsights: ['Why 维度笼统'],
    },
    {
      id: 's07', name: '陈昊宇', time: 0, submitted: false,
      completion: { filled: 1, total: 3, pct: 33 }, avgQuality: 1.0,
      responses: {
        r1: { what: 'Skin cream', why: '', whatQ: 1, whyQ: 0 },
      },
      keyInsights: ['未交,需提醒'],
    },
  ],
}

Default.classObserveData = classObserveDataMatrix
