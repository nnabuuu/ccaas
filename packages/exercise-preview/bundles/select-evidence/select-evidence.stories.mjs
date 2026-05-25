/**
 * Demo bundle — `select-evidence` exercise type.
 *
 * AnswerKey shape (SelectEvidenceAnswerKeySchema):
 *   { type:'select-evidence',
 *     functionOptions:[string,...],
 *     sections:[{ id, label, range:[para,...], correctFunction, minHits?, ... }],
 *     paragraphTokens?:{ [paraNum]: [{t,kind?,why?}, ...] } }
 *
 * If `paragraphTokens` is supplied, every `section.range` paragraph number
 * MUST appear as a key. We include a minimal tokens stub for ¶1 and ¶3 only —
 * the student UI uses these tokens to render clickable evidence pieces.
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/select-evidence
 */
import { defineStories } from '../../dist/index.js'

const sePlugin = {
  type: 'select-evidence',
  displayName: 'Select Evidence',
  grade(ctx) {
    const sections = ctx.data.sections ?? {}
    const fn = ctx.key.functionOptions ?? []
    const expected = ctx.key.sections ?? []
    let correct = 0
    expected.forEach((s) => {
      const got = sections[s.id]?.func
      if (got === s.correctFunction) correct += 1
    })
    return {
      total: expected.length ? Math.round((correct / expected.length) * 100) : 0,
      byDimension: Object.fromEntries(expected.map((s) => [s.id, sections[s.id]?.func === s.correctFunction])),
    }
  },
}

// Two sections from Ideal Beauty — ¶1 (concrete example) and ¶3 (broader claim).
const idealBeautyEvidence = {
  type: 'select-evidence',
  functionOptions: [
    'Concrete example',
    'Counter-example',
    'General claim',
    'Author opinion',
    'Cause / effect',
  ],
  sections: [
    {
      id: 'sec-edem',
      label: 'Section A — ¶1',
      range: [1],
      correctFunction: 'Concrete example',
      minHits: 2,
      hint: '问自己:作者在用 Happiness Edem 的故事做什么?',
      hintZh: '作者用具体人物来支撑哪类论点?',
    },
    {
      id: 'sec-claim',
      label: 'Section B — ¶3',
      range: [3],
      correctFunction: 'General claim',
      minHits: 1,
      hintZh: '¶3 是单一例子,还是更宽泛的概括?',
    },
  ],
  paragraphTokens: {
    1: [
      { t: 'Happiness Edem', kind: 'name', why: '具体人物 → 例子标志' },
      { t: 'spent six months', kind: 'time' },
      { t: 'fattening room', kind: 'practice', why: '具体实践 → 例子标志' },
      { t: 'in Nigeria', kind: 'place' },
    ],
    3: [
      { t: 'across many cultures', kind: 'generalizer', why: '范围词 → 概括标志' },
      { t: 'beauty standards vary', kind: 'claim', why: '主张核心' },
      { t: 'in surprising ways', kind: 'qualifier' },
    ],
  },
}

export default defineStories({
  plugin: sePlugin,
  meta: {
    title: 'Select Evidence — Function of ¶1 and ¶3',
    description: '判断两个段落在论证中的功能,并圈选相应证据词。仅含 ¶1/¶3 token 以保持 demo 体积。',
    tags: ['demo', 'select-evidence', 'reading'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyEvidence,
}

/* ── Teacher classObserveData mock — matches EvidenceData shape ────────── */
const classObserveDataEvidence = {
  stats: { totalStudents: 22, allDone: 18, perfectAll: 9, evidenceHitRate: 71, funcWrongCount: 4 },
  sections: [
    {
      id: 'sec-edem', label: 'Section A — ¶1', func: 'Concrete example', funcZh: '具体例子',
      funcCorrectRate: 86, funcCorrectCount: 19, funcTotalCount: 22,
      evidenceBar: { hit: 38, total: 44, pct: 86 },
    },
    {
      id: 'sec-claim', label: 'Section B — ¶3', func: 'General claim', funcZh: '总体主张',
      funcCorrectRate: 64, funcCorrectCount: 14, funcTotalCount: 22,
      evidenceBar: { hit: 18, total: 22, pct: 82 },
    },
  ],
  misconceptions: [
    {
      id: 'mc-claim-as-example', label: '把 ¶3 的概括判为"具体例子"——混淆"范围词"和"人名"', count: 5, severity: 'medium',
      students: [
        { id: 's03', name: '王思源' }, { id: 's07', name: '陈昊宇' }, { id: 's11', name: '林佳颖' },
      ],
    },
  ],
  students: [
    {
      id: 's01', name: '王梓萱', completed: true, time: 132,
      sectionResults: {
        'sec-edem': { perfect: true, funcCorrect: true, evidenceHit: 2, evidenceTotal: 2, wrongCount: 0 },
        'sec-claim': { perfect: true, funcCorrect: true, evidenceHit: 1, evidenceTotal: 1, wrongCount: 0 },
      },
      keyInsights: ['两 section 都 perfect'],
    },
    {
      id: 's03', name: '王思源', completed: true, time: 186,
      sectionResults: {
        'sec-edem': { perfect: true, funcCorrect: true, evidenceHit: 2, evidenceTotal: 2, wrongCount: 0 },
        'sec-claim': { perfect: false, funcCorrect: false, evidenceHit: 1, evidenceTotal: 1, wrongCount: 0 },
      },
      keyInsights: ['¶3 功能判断错误'],
    },
  ],
}

Default.classObserveData = classObserveDataEvidence
