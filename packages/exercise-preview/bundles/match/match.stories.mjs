/**
 * Demo bundle — `match` exercise type.
 *
 * AnswerKey shape (MatchAnswerKeySchema):
 *   { type:'match', answers:[{ pairIdx, left, correct, options?, ... }], options? }
 *
 * Each answer needs options either at answer-level or top-level. We use the
 * top-level form so all left-items pick from one shared pool.
 *
 * The match plugin renders `pairs[]` with `{ left, opts, correct }` — see
 * matchPlugin.enrichFromManifest in built-in.tsx.
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/match
 */
import { defineStories } from '../../dist/index.js'

const matchPlugin = {
  type: 'match',
  displayName: 'Match',
  grade(ctx) {
    const submitted = ctx.data.pairs ?? []
    const expected = (ctx.key.answers ?? []).map((a) => a.correct)
    const correctness = expected.map((c, i) => {
      const opts = ctx.key.options ?? []
      const expectedIdx = opts.indexOf(c)
      return submitted[i] === expectedIdx
    })
    const allCorrect = correctness.every(Boolean)
    return {
      total: allCorrect ? 100 : Math.round((correctness.filter(Boolean).length / expected.length) * 100),
      byDimension: Object.fromEntries(correctness.map((c, i) => [`p${i}`, c])),
    }
  },
}

const idealBeautyMatch = {
  type: 'match',
  options: [
    'Bodily enlargement (fattening room)',
    'Skin-lightening cosmetics',
    'Foot binding',
    'Cosmetic eyelid surgery',
  ],
  answers: [
    {
      pairIdx: 0,
      left: 'Nigeria (Efik people)',
      correct: 'Bodily enlargement (fattening room)',
      hint: 'See ¶1 — what did Happiness Edem do?',
      hintZh: '见 ¶1，Happiness Edem 做了什么？',
    },
    {
      pairIdx: 1,
      left: 'India / parts of Africa',
      correct: 'Skin-lightening cosmetics',
      hintZh: '见 ¶3，市场上常见什么产品？',
    },
    {
      pairIdx: 2,
      left: 'Imperial China (历史)',
      correct: 'Foot binding',
      hintZh: '见 ¶4，三寸金莲。',
    },
    {
      pairIdx: 3,
      left: 'South Korea (modern)',
      correct: 'Cosmetic eyelid surgery',
      hintZh: '见 ¶5，最常见的整形手术。',
    },
  ],
}

export default defineStories({
  plugin: matchPlugin,
  meta: {
    title: 'Match — Beauty practices across cultures',
    description: '匹配 4 种文化与对应的"美"实践,练习跨文化阅读理解。',
    tags: ['demo', 'match', 'reading'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyMatch,
}

export const AllCorrect = {
  name: 'All correct (pre-filled)',
  locale: 'zh',
  answerKey: idealBeautyMatch,
  initialAns: { 0: 0, 1: 1, 2: 2, 3: 3 },
}
