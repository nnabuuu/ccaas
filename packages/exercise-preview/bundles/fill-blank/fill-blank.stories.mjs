/**
 * Demo bundle — `fill-blank` exercise type.
 *
 * AnswerKey shape (FillBlankAnswerKeySchema):
 *   { type:'fill-blank',
 *     sentences:[{ id, template:'... {{1}} ... {{2}} ...',
 *                  blanks:{ '1':{accepts:[...]}, '2':{accepts:[...]} } }] }
 *
 * Template uses `{{n}}` placeholders; per-blank `accepts` is a list of strings
 * (case-insensitive match handled by the FillBlankExercise component).
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/fill-blank
 */
import { defineStories } from '../../dist/index.js'

const fillBlankPlugin = {
  type: 'fill-blank',
  displayName: 'Fill Blank',
  grade(ctx) {
    const blanks = ctx.data.blanks ?? {}
    const sentences = ctx.key.sentences ?? []
    let total = 0
    let correct = 0
    const byDim = {}
    sentences.forEach((s) => {
      Object.entries(s.blanks).forEach(([bid, spec]) => {
        total += 1
        const got = (blanks[`${s.id}_${bid}`] ?? '').trim().toLowerCase()
        const ok = spec.accepts.some((a) => a.toLowerCase() === got)
        if (ok) correct += 1
        byDim[`${s.id}_${bid}`] = ok
      })
    })
    return { total: total > 0 ? Math.round((correct / total) * 100) : 0, byDimension: byDim }
  },
}

const idealBeautyFillBlank = {
  type: 'fill-blank',
  sentences: [
    {
      id: 's1',
      template: 'Happiness Edem spent {{1}} months in a {{2}} room to gain weight.',
      blanks: {
        '1': { accepts: ['six', '6'] },
        '2': { accepts: ['fattening'], hint: 'A room designed to add weight.' },
      },
    },
    {
      id: 's2',
      template: 'In some parts of {{1}} and Africa, skin-{{2}} cosmetics are popular.',
      blanks: {
        '1': { accepts: ['India', 'india'] },
        '2': { accepts: ['lightening', 'whitening'] },
      },
    },
    {
      id: 's3',
      template: 'Modern South Korea is famous for {{1}} surgery, especially {{2}} surgery.',
      blanks: {
        '1': { accepts: ['cosmetic', 'plastic'] },
        '2': { accepts: ['eyelid', 'double eyelid'] },
      },
    },
  ],
}

export default defineStories({
  plugin: fillBlankPlugin,
  meta: {
    title: 'Fill Blank — Ideal Beauty key facts',
    description: '从课文中提取 6 个关键事实并填空,练习细节定位与拼写。',
    tags: ['demo', 'fill-blank', 'reading'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyFillBlank,
}

export const AllCorrect = {
  name: 'All correct (pre-filled)',
  locale: 'zh',
  answerKey: idealBeautyFillBlank,
  initialAns: {
    s1_1: 'six',
    s1_2: 'fattening',
    s2_1: 'India',
    s2_2: 'lightening',
    s3_1: 'cosmetic',
    s3_2: 'eyelid',
  },
}
