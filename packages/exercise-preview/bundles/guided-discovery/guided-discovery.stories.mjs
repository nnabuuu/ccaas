/**
 * Demo bundle — `guided-discovery` exercise type.
 *
 * AnswerKey shape (GuidedDiscoveryAnswerKeySchema):
 *   { type:'guided-discovery', title, steps:[GdStep,...], summary? }
 *
 * Steps are a discriminated union by `type`:
 *   - observation_choice : table + binary choices
 *   - formula_blanks     : labeled blanks that combine into a formula
 *   - derivation_blank   : multi-line derivation with at most one blank/line
 *   - text_blanks        : prose template with {{n}} placeholders
 *
 * The plugin reads `ak.steps` → `ex.gdSteps`. Student ans:
 *   { steps: { [stepId]: { answers: { [blankId]: any } } } }
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/guided-discovery
 */
import { defineStories } from '../../dist/index.js'

const gdPlugin = {
  type: 'guided-discovery',
  displayName: 'Guided Discovery',
  grade(ctx) {
    const steps = ctx.data.steps ?? {}
    const total = Object.keys(steps).length
    return { total: total > 0 ? 80 : 0, byDimension: { stepsAttempted: total } }
  },
}

// Math: deriving the perfect-square formula (a + b)² = a² + 2ab + b² via
// guided observation → formula → derivation → summary.
const perfectSquareDiscovery = {
  type: 'guided-discovery',
  title: '推导完全平方公式 (a + b)²',
  steps: [
    {
      type: 'observation_choice',
      id: 'obs-1',
      title: '步骤 1:观察规律',
      table: [
        { expression: '(1 + 2)²', result: '9 = 1 + 4 + 4' },
        { expression: '(2 + 3)²', result: '25 = 4 + 12 + 9' },
        { expression: '(3 + 4)²', result: '49 = 9 + 24 + 16' },
      ],
      choices: [
        {
          id: 'c1',
          prompt: '展开后的第一项与什么有关?',
          options: ['第一个数的平方', '两数之和'],
          correct: 0,
        },
        {
          id: 'c2',
          prompt: '展开后的最后一项是什么?',
          options: ['两数乘积', '第二个数的平方'],
          correct: 1,
        },
        {
          id: 'c3',
          prompt: '中间项与两数关系如何?',
          options: ['等于两数之和', '等于两数乘积的 2 倍'],
          correct: 1,
        },
      ],
    },
    {
      type: 'formula_blanks',
      id: 'fb-1',
      title: '步骤 2:填入公式',
      prompt: '根据上面规律,填出 (a + b)² 展开式:',
      layout: 'inline',
      separator: '+',
      blanks: [
        { id: 'b1', label: '第一项', placeholder: 'a²', accepts: ['a^2', 'a²', 'a*a'] },
        { id: 'b2', label: '中间项', placeholder: '2ab', accepts: ['2ab', '2*a*b', '2ba'] },
        { id: 'b3', label: '最后项', placeholder: 'b²', accepts: ['b^2', 'b²', 'b*b'] },
      ],
    },
    {
      type: 'derivation_blank',
      id: 'dv-1',
      title: '步骤 3:代数推导',
      lines: [
        { text: '(a + b)² = (a + b)(a + b)' },
        { text: '         = a(a + b) + b(a + b)' },
        {
          text: '         = a² + ab + ___ + b²',
          blank: { id: 'd1', placeholder: 'ab', accepts: ['ab', 'a*b', 'ba'] },
        },
        {
          text: '         = a² + ___ + b²',
          blank: { id: 'd2', placeholder: '2ab', accepts: ['2ab', '2*a*b'] },
        },
      ],
    },
    {
      type: 'text_blanks',
      id: 'tb-1',
      title: '步骤 4:用语言总结',
      template: '完全平方公式:两数之和的平方,等于这两数的{{1}}加上它们乘积的{{2}}倍。',
      blanks: [
        { id: 't1', accepts: ['平方和', '各自平方之和'] },
        { id: 't2', accepts: ['2', '两', 'two'] },
      ],
    },
  ],
  summary: {
    formula: '(a + b)² = a² + 2ab + b²',
    name: '完全平方公式',
    description: '两数之和的平方等于两数平方之和加上它们乘积的 2 倍。',
  },
}

export default defineStories({
  plugin: gdPlugin,
  meta: {
    title: 'Guided Discovery — Perfect-square formula',
    description: '四步骤引导式推导 (a+b)² = a² + 2ab + b²:观察 → 填公式 → 推导 → 总结。',
    tags: ['demo', 'guided-discovery', 'math'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: perfectSquareDiscovery,
}

/* ── Teacher classObserveData mock — matches GdData shape ────────────── */
const classObserveDataGd = {
  stats: { totalStudents: 22, submitted: 19, avgScore: 76, perfectCount: 7, avgTime: 285 },
  stepDefs: [
    {
      id: 'obs-1', title: '观察规律', type: 'observation_choice',
      spec: {
        type: 'observation_choice', id: 'obs-1', title: '观察规律',
        choices: [
          { id: 'c1', prompt: '第一项', options: ['第一个数的平方', '两数之和'], correct: 0 },
          { id: 'c2', prompt: '最后项', options: ['两数乘积', '第二个数的平方'], correct: 1 },
          { id: 'c3', prompt: '中间项', options: ['两数之和', '两数乘积的2倍'], correct: 1 },
        ],
      },
    },
    {
      id: 'fb-1', title: '填入公式', type: 'formula_blanks',
      spec: {
        type: 'formula_blanks', id: 'fb-1', title: '填入公式',
        blanks: [
          { id: 'b1', label: '第一项', accepts: ['a^2'] },
          { id: 'b2', label: '中间项', accepts: ['2ab'] },
          { id: 'b3', label: '最后项', accepts: ['b^2'] },
        ],
      },
    },
  ],
  stepStats: [
    {
      id: 'obs-1', title: '观察规律',
      passedCount: 18, passedRate: 95,
      errors: [
        {
          description: 'c3 选成"两数之和"——忽略表中"24 = 2·3·4"提示', count: 4,
          students: [{ id: 's03', name: '王思源' }, { id: 's11', name: '林佳颖' }],
        },
      ],
    },
    {
      id: 'fb-1', title: '填入公式',
      passedCount: 15, passedRate: 79,
      errors: [
        {
          description: '中间项填成 ab——漏写系数 2', count: 4,
          students: [{ id: 's07', name: '陈昊宇' }, { id: 's14', name: '黄子凯' }],
        },
      ],
    },
  ],
  students: [
    {
      id: 's01', name: '王梓萱', submitted: true, score: 100, time: 240,
      stepResults: { 'obs-1': true, 'fb-1': true, 'dv-1': true, 'tb-1': true },
      stepAnswers: {},
      keyInsights: ['全对,可作为讲解范例'],
    },
    {
      id: 's03', name: '王思源', submitted: true, score: 60, time: 312,
      stepResults: { 'obs-1': false, 'fb-1': true, 'dv-1': true, 'tb-1': false },
      stepAnswers: {},
      keyInsights: ['观察阶段卡顿,总结表述不准'],
    },
  ],
}

Default.classObserveData = classObserveDataGd
