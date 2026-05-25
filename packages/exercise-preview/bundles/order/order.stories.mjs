/**
 * Demo bundle — `order` exercise type.
 *
 * AnswerKey shape (OrderAnswerKeySchema):
 *   { type:'order', items:[string,...], correctOrder:[number,...] }
 *
 * correctOrder must be a permutation of [0..items.length-1].
 * The order plugin reads `exercise.items` and grades against `correctOrder`.
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/order
 */
import { defineStories } from '../../dist/index.js'

const orderPlugin = {
  type: 'order',
  displayName: 'Order',
  grade(ctx) {
    const submitted = ctx.data.order ?? []
    const expected = ctx.key.correctOrder ?? []
    const ok = submitted.length === expected.length && submitted.every((v, i) => v === expected[i])
    return { total: ok ? 100 : 0, byDimension: { order: ok } }
  },
}

// "Ideal Beauty" ¶1-2 narrative order — Happiness Edem's fattening-room journey.
const idealBeautyOrder = {
  type: 'order',
  items: [
    'Happiness Edem was sent to a fattening room.',
    'She ate large amounts of fatty food every day.',
    'She gained significant weight over six months.',
    'She emerged as a "beautiful" bride by Efik standards.',
    'She married into her husband\'s family.',
  ],
  correctOrder: [0, 1, 2, 3, 4],
}

export default defineStories({
  plugin: orderPlugin,
  meta: {
    title: 'Order — Happiness Edem\'s story timeline',
    description: '把 ¶1-2 中 Happiness Edem 的经历按时间顺序排列。',
    tags: ['demo', 'order', 'reading'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyOrder,
}

export const Correct = {
  name: 'Correct order (pre-filled)',
  locale: 'zh',
  answerKey: idealBeautyOrder,
  initialAns: { order: [0, 1, 2, 3, 4] },
}

export const Scrambled = {
  name: 'Scrambled (wrong)',
  locale: 'zh',
  answerKey: idealBeautyOrder,
  initialAns: { order: [2, 0, 4, 1, 3] },
}
