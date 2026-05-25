/**
 * Demo bundle — `rich-content-quiz` exercise type.
 *
 * AnswerKey shape (RichContentQuizAnswerKeySchema):
 *   { type:'rich-content-quiz', subType?:'calculation',
 *     prompt?, promptImages?, rubric?, sampleSolution?, aiSystemPrompt?, maxImages?,
 *     parts?:[{ id, prompt, expression?, rubric, sampleSolution?, maxImages?,
 *                aiSystemPrompt?, scaffold?, inputMethods?, accepts? }],
 *     inputMethods? }
 * MUST have either `parts` or `rubric` at the top level.
 *
 * Math-style multi-part problem: part-(a) computes; part-(b) explains.
 * The plugin (selfManagedSubmit) treats each part as its own grading unit.
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/rich-content-quiz
 */
import { defineStories } from '../../dist/index.js'

const rcqPlugin = {
  type: 'rich-content-quiz',
  displayName: 'Rich Content Quiz',
  grade(ctx) {
    const parts = ctx.data.parts ?? {}
    const total = Object.keys(parts).length
    return { total: total > 0 ? 70 : 0, byDimension: { partsAttempted: total } }
  },
}

// Physics: free-fall problem with scaffolded hints.
const freeFallProblem = {
  type: 'rich-content-quiz',
  subType: 'calculation',
  prompt: '一个物体从高 45 m 的塔顶自由下落 (g = 10 m/s²)。求:(a) 落地用时; (b) 落地速度。',
  inputMethods: ['handwrite', 'photo'],
  parts: [
    {
      id: 'part-a',
      prompt: '(a) 求落地时间 t (秒)。',
      expression: 'h = \\frac{1}{2} g t^2',
      maxImages: 1,
      inputMethods: ['handwrite', 'photo'],
      rubric: [
        { id: 'formula', label: '公式选择', weight: 0.4, criteria: '使用 h = ½gt² 或等价表达' },
        { id: 'compute', label: '计算正确', weight: 0.4, criteria: '代入数值得到 t = 3 s' },
        { id: 'units', label: '单位与符号', weight: 0.2, criteria: '答案带秒(s)单位' },
      ],
      sampleSolution: 'h = ½ g t² → 45 = ½ × 10 × t² → t² = 9 → t = 3 s',
      scaffold: {
        threshold: 1,
        levels: [
          {
            hintZh: '想一想:位移 h 和时间 t 的关系公式是哪一个?',
            steps: [
              { title: '提示1:选公式', hintZh: '匀加速直线运动:h = ½gt²' },
            ],
          },
          {
            hintZh: '把 h=45, g=10 代入,解 t。',
            steps: [
              { title: '提示2:代入', hintZh: '45 = ½ × 10 × t²' },
              { title: '提示3:求解', hintZh: 't² = 9, t = 3 s' },
            ],
          },
        ],
      },
    },
    {
      id: 'part-b',
      prompt: '(b) 求落地速度 v (m/s)。',
      expression: 'v = g t',
      maxImages: 1,
      inputMethods: ['handwrite', 'photo'],
      rubric: [
        { id: 'formula', label: '公式选择', weight: 0.4, criteria: '使用 v = gt 或 v² = 2gh' },
        { id: 'compute', label: '计算正确', weight: 0.4, criteria: '得到 v = 30 m/s' },
        { id: 'units', label: '单位与符号', weight: 0.2, criteria: '答案带 m/s 单位' },
      ],
      sampleSolution: 'v = g t = 10 × 3 = 30 m/s',
    },
  ],
}

export default defineStories({
  plugin: rcqPlugin,
  meta: {
    title: 'Rich Content Quiz — Free fall (physics)',
    description: '两小问的自由落体问题,支持手写/拍照,(a) 配 scaffold 提示链。',
    tags: ['demo', 'rich-content-quiz', 'physics'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: freeFallProblem,
}
