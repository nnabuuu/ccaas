/**
 * Demo bundle — `map` exercise type.
 *
 * AnswerKey shape (MapAnswerKeySchema):
 *   { type:'map', prompt, axes:{x:{neg,pos,label}, y:{neg,pos,label}},
 *     items:[{id,label,hint?,refs?}], expected?:{[id]:[x,y]},
 *     minReasonLength?, practiceCount?, randomPractice? }
 *
 * The map plugin uses `items` → `ex.mapItems` (or already-named `mapItems`).
 * Student ans shape: { placements: {[id]: [x,y]}, reasons: {[id]: string} }.
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/map
 */
import { defineStories } from '../../dist/index.js'

const mapPlugin = {
  type: 'map',
  displayName: 'Map',
  grade(ctx) {
    const placements = ctx.data.placements ?? {}
    const expected = ctx.key.expected ?? {}
    const ids = Object.keys(expected)
    if (!ids.length) return { total: 100, byDimension: {} }
    const byDim = {}
    let sum = 0
    ids.forEach((id) => {
      const [ex, ey] = expected[id]
      const got = placements[id]
      const dist = got ? Math.hypot(got[0] - ex, got[1] - ey) : 2
      const sc = Math.max(0, 1 - dist / 2)
      byDim[id] = sc
      sum += sc
    })
    return { total: Math.round((sum / ids.length) * 100), byDimension: byDim }
  },
}

// 2-axis map: "Body modification severity" × "Social mobility signal" —
// 6 beauty practices from the article placed on a 2D plane.
const idealBeautyMap = {
  type: 'map',
  prompt: '把下列"美"实践放到二维坐标:横轴=身体改造程度,纵轴=阶级信号强度。',
  axes: {
    x: { neg: '低改造', pos: '高改造', label: '身体改造程度' },
    y: { neg: '弱阶级信号', pos: '强阶级信号', label: '社会阶级信号' },
  },
  minReasonLength: 8,
  items: [
    { id: 'fattening', label: 'Fattening room', refs: [1, 2], hint: '极高改造 + 家庭地位象征' },
    { id: 'lightening', label: 'Skin lightening', refs: [3], hint: '低-中改造 + 历史种姓暗示' },
    { id: 'binding', label: 'Foot binding', refs: [4], hint: '极高改造 + 婚姻市场信号' },
    { id: 'eyelid', label: 'Eyelid surgery', refs: [5], hint: '中改造 + 弱阶级信号' },
    { id: 'makeup', label: 'Daily makeup', hint: '低改造 + 弱阶级信号' },
    { id: 'tattoo', label: 'Tribal tattoo', hint: '中改造 + 强归属信号' },
  ],
  expected: {
    fattening: [0.8, 0.8],
    lightening: [-0.3, 0.6],
    binding: [0.9, 0.7],
    eyelid: [0.4, -0.2],
    makeup: [-0.7, -0.7],
    tattoo: [0.2, 0.5],
  },
}

export default defineStories({
  plugin: mapPlugin,
  meta: {
    title: 'Map — Beauty practices on 2 axes',
    description: '把 6 种"美"实践放在"改造程度 × 阶级信号"二维平面上,练习多维归纳。',
    tags: ['demo', 'map', 'reading'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyMap,
}

/* ── Teacher classObserveData mock — matches MapData shape ────────── */
const classObserveDataMap = {
  stats: { totalStudents: 22, submitted: 19, allPlacedCount: 14, avgAccuracy: 64, misconceptionCount: 2 },
  axes: { x: { neg: '低改造', pos: '高改造' }, y: { neg: '弱阶级信号', pos: '强阶级信号' } },
  items: [
    {
      id: 'fattening', label: 'Fattening room', expected: [0.8, 0.8],
      avgDeviation: 0.3, accuracyRate: 78,
      studentPlacements: [
        { studentId: 's01', studentName: '王梓萱', x: 0.85, y: 0.75, deviation: 0.07 },
        { studentId: 's03', studentName: '王思源', x: 0.6, y: 0.3, deviation: 0.54 },
        { studentId: 's07', studentName: '陈昊宇', x: 0.4, y: 0.9, deviation: 0.42 },
      ],
    },
    {
      id: 'eyelid', label: 'Eyelid surgery', expected: [0.4, -0.2],
      avgDeviation: 0.5, accuracyRate: 52,
      studentPlacements: [
        { studentId: 's01', studentName: '王梓萱', x: 0.35, y: -0.1, deviation: 0.11 },
        { studentId: 's03', studentName: '王思源', x: 0.8, y: 0.5, deviation: 0.81 },
      ],
    },
  ],
  misconceptions: [
    { id: 'm1', label: '把"整形"误判为"高阶级信号"——忽略文中"普及化"线索', count: 5, severity: 'medium' },
  ],
  students: [
    { id: 's01', name: '王梓萱', placed: 6, totalItems: 6, reasoned: 6, totalReasons: 6, avgDeviation: 0.15, accuracy: 88, time: 320, keyInsights: ['全部放置,理由扎实'] },
    { id: 's03', name: '王思源', placed: 5, totalItems: 6, reasoned: 4, totalReasons: 5, avgDeviation: 0.65, accuracy: 35, time: 198, keyInsights: ['多项偏离 expected'] },
    { id: 's07', name: '陈昊宇', placed: 4, totalItems: 6, reasoned: 3, totalReasons: 4, avgDeviation: 0.42, accuracy: 58, time: 245, keyInsights: ['部分项未放置'] },
  ],
}

Default.classObserveData = classObserveDataMap
