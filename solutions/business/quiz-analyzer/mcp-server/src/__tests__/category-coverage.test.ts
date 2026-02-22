/**
 * Category Coverage Tests — Level 3 and Level 4 Nodes
 *
 * Verifies that batchSearchKnowledgePoints (with leafOnly: false) correctly
 * finds L3 and L4 category nodes across 10+ subjects, and that each result
 * carries a correct fullName and pathNames array.
 *
 * Subjects covered:
 *   初中数学, 高中数学, 初中物理, 高中物理, 初中化学, 高中化学,
 *   初中语文, 初中历史, 初中生物, 初中地理, 小学数学
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { jsonDataLoader } from '../json-data-loader.js'

// ─── KP ID Registry (verified from live data) ─────────────────────────────────

// === 初中数学 ===
const KP_JZ_MATH = {
  // L3
  nuAndShi:          '1998702114322399413', // 数与式
  graphProperty:     '1998702114322399999', // 图形的性质
  graphChange:       '1998702114322400388', // 图形的变化
  // L4 children of 数与式
  rationalNum:       '1998702114322399414', // 有理数
  realNum:           '1998702114322399472', // 实数
  algebraExpr:       '1998702114322399589', // 代数式
  // L4 children of 图形的性质
  parallelLines:     '1998702114322400080', // 相交线与平行线
  triangle:          '1998702114322400119', // 三角形
  circle:            '1998702114322400302', // 圆
  // L4 children of 图形的变化
  axiSymmetry:       '1998702114322400389', // 图形的轴对称
  rotation:          '1998702114322400407', // 图形的旋转
  similarity:        '1998702114322400424', // 图形的相似
} as const

// === 高中数学 ===
const KP_GZ_MATH = {
  // L3
  set:               '1998702114322402418', // 集合
  proposition:       '1998702114322402435', // 命题与逻辑
  // L4 children of 集合
  setOperation:      '1998702114322402432', // 集合的基本运算
  // L4 children of 命题与逻辑
  sufficientCond:    '1998702114322402444', // 充分条件、必要条件与充要条件
  propFourForms:     '1998702114322402443', // 若则命题的四种形式
} as const

// === 初中物理 ===
const KP_JZ_PHY = {
  // L3
  motionDesc:        '1998702114322400602', // 运动的描述
  soundProp:         '1998702114322400619', // 声音的产生和传播
  // L4 children of 运动的描述
  referenceFrame:    '1998702114322400605', // 参照物
  // L4 children of 声音的产生和传播
  soundSpeed:        '1998702114322400624', // 声速
  soundWave:         '1998702114322400621', // 声波
  echo:              '1998702114322400625', // 回声
} as const

// === 高中物理 ===
const KP_GZ_PHY = {
  // L3
  uniformAccel:      '1998702114322403047', // 匀变速直线运动
  newtonLaws:        '1998702114322403091', // 牛顿运动定律
  // L4 children of 匀变速直线运动
  freeFall:          '1998702114322403061', // 自由落体
  uniformAccelLaw:   '1998702114322403049', // 匀变速直线运动规律
  // L4 children of 牛顿运动定律
  newton2nd:         '1998702114322403100', // 牛顿第二定律
  overweight:        '1998702114322403111', // 超重与失重
} as const

// === 高中化学 ===
const KP_GZ_CHEM = {
  // L3
  matterClassify:    '1998702114322403590', // 物质的分类与化学用语
  chemCalc:          '1998702114322403608', // 化学计量
  // L4 children of 物质的分类与化学用语
  matterClass:       '1998702114322403594', // 物质的分类
  chemLang:          '1998702114322403607', // 化学用语
  // L4 children of 化学计量
  molarMass:         '1998702114322403613', // 摩尔质量
  moleUnit:          '1998702114322403609', // 物质的量及单位
  gasMolarVol:       '1998702114322403616', // 气体摩尔体积
} as const

// === 初中化学 ===
const KP_JZ_CHEM = {
  // L3 (no L4 children)
  chemChange:        '1998702114322401153', // 化学变化
} as const

// === 初中语文 ===
const KP_JZ_CHINESE = {
  // L3 (no L4 children)
  pronunciation:     '1998702114322394009', // 字音辨析
} as const

// === 初中历史 ===
const KP_JZ_HIST = {
  // L3
  prehistory:        '1998702114322387920', // 史前时期
  xiaShang:          '1998702114322387933', // 夏商西周时期
  // L4 children of 史前时期
  earlyHuman:        '1998702114322387921', // 中国早期人类的代表
  farmingLife:       '1998702114322387925', // 原始农耕生活
  // L4 children of 夏商西周时期
  bronzeOracle:      '1998702114322387947', // 青铜器与甲骨文
} as const

// === 初中生物 ===
const KP_JZ_BIO = {
  // L3
  cellUnit:          '1998702114322401727', // 细胞是生命活动的基本单位
  // L4 children of 细胞
  plantCell:         '1998702114322401733', // 植物细胞
  animalCell:        '1998702114322401735', // 动物细胞
  cellDiff:          '1998702114322401737', // 动植物细胞结构的异同点
} as const

// === 初中地理 ===
const KP_JZ_GEO = {
  // L3
  weatherClimate:    '1998702114322391767', // 天气与气候
  // L4 children of 天气与气候
  worldClimate:      '1998702114322391805', // 世界的气候
} as const

// === 小学数学 ===
const KP_XS_MATH = {
  // L3
  numOps:            '1998702114322386313', // 数的运算
  // L4 children of 数的运算
  decimalAddSub:     '1998702114322386891', // 小数加减法
  fractionAddSub:    '1998702114322386982', // 分数加减法
  mixedOps:          '1998702114322387038', // 混合运算
  multiDiv:          '1998702114322386466', // 表内乘除法
} as const

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => { jsonDataLoader.load() })

// ─── Helper ───────────────────────────────────────────────────────────────────

function search(keywords: string[], gradeLevel: string) {
  return jsonDataLoader.batchSearchKnowledgePoints(keywords, { gradeLevel, leafOnly: false })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — L3 Category Nodes (18 subjects)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 初中数学 ─────────────────────────────────────────────────────────────────

describe('Quiz 1: 数与式 — 初中数学 L3', () => {
  // Teacher tags quiz as belonging to chapter "数与式"; student answer uses rational numbers
  it('quiz keywords find the 数与式 L3 category node', () => {
    const results = search(['数与式', '有理数'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_MATH.nuAndShi)
  })
  it('数与式 node carries correct fullName', () => {
    const results = search(['数与式', '有理数'], '初中')
    const node = results.find(r => r.id === KP_JZ_MATH.nuAndShi)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('数与式')
    expect(node.pathNames.at(-1)!.trim()).toBe('数与式')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Quiz 2: 图形的性质 — 初中数学 L3', () => {
  // Teacher tags quiz under chapter "图形的性质"; quiz involves parallel lines
  it('quiz keywords find the 图形的性质 L3 category node', () => {
    const results = search(['图形的性质', '平行线'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_MATH.graphProperty)
  })
  it('图形的性质 node carries correct fullName', () => {
    const results = search(['图形的性质', '平行线'], '初中')
    const node = results.find(r => r.id === KP_JZ_MATH.graphProperty)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('图形的性质')
    expect(node.pathNames.at(-1)!.trim()).toBe('图形的性质')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Quiz 3: 图形的变化 — 初中数学 L3', () => {
  // Teacher tags quiz under chapter "图形的变化"; quiz involves rotation transformations
  it('quiz keywords find the 图形的变化 L3 category node', () => {
    const results = search(['图形的变化', '旋转'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_MATH.graphChange)
  })
  it('图形的变化 node carries correct fullName', () => {
    const results = search(['图形的变化', '旋转'], '初中')
    const node = results.find(r => r.id === KP_JZ_MATH.graphChange)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('图形的变化')
    expect(node.pathNames.at(-1)!.trim()).toBe('图形的变化')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 高中数学 ─────────────────────────────────────────────────────────────────

describe('Quiz 4: 集合 — 高中数学 L3', () => {
  // Student answer involves set operations and intersection
  it('quiz keywords find the 集合 L3 category node', () => {
    const results = search(['集合', '交集'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_MATH.set)
  })
  it('集合 node carries correct fullName', () => {
    const results = search(['集合', '交集'], '高中')
    const node = results.find(r => r.id === KP_GZ_MATH.set)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('集合')
    expect(node.pathNames.at(-1)!.trim()).toBe('集合')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Quiz 5: 命题与逻辑 — 高中数学 L3', () => {
  // Student answer involves propositions and sufficient conditions
  it('quiz keywords find the 命题与逻辑 L3 category node', () => {
    const results = search(['命题', '充分条件'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_MATH.proposition)
  })
  it('命题与逻辑 node carries correct fullName', () => {
    const results = search(['命题', '充分条件'], '高中')
    const node = results.find(r => r.id === KP_GZ_MATH.proposition)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('命题与逻辑')
    expect(node.pathNames.at(-1)!.trim()).toBe('命题与逻辑')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 初中物理 ─────────────────────────────────────────────────────────────────

describe('Quiz 6: 运动的描述 — 初中物理 L3', () => {
  // Student answer describes motion using reference frames
  it('quiz keywords find the 运动的描述 L3 category node', () => {
    const results = search(['参考系', '运动'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_PHY.motionDesc)
  })
  it('运动的描述 node carries correct fullName', () => {
    const results = search(['参考系', '运动'], '初中')
    const node = results.find(r => r.id === KP_JZ_PHY.motionDesc)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('运动的描述')
    expect(node.pathNames.at(-1)!.trim()).toBe('运动的描述')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Quiz 7: 声音的产生和传播 — 初中物理 L3', () => {
  // Student answer discusses sound traveling through different media
  it('quiz keywords find the 声音的产生和传播 L3 category node', () => {
    const results = search(['声音', '传播', '介质'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_PHY.soundProp)
  })
  it('声音的产生和传播 node carries correct fullName', () => {
    const results = search(['声音', '传播', '介质'], '初中')
    const node = results.find(r => r.id === KP_JZ_PHY.soundProp)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('声音的产生和传播')
    expect(node.pathNames.at(-1)!.trim()).toBe('声音的产生和传播')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 高中物理 ─────────────────────────────────────────────────────────────────

describe('Quiz 8: 匀变速直线运动 — 高中物理 L3', () => {
  // Student answer applies kinematic equations with constant acceleration
  it('quiz keywords find the 匀变速直线运动 L3 category node', () => {
    const results = search(['加速度', '匀变速'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_PHY.uniformAccel)
  })
  it('匀变速直线运动 node carries correct fullName', () => {
    const results = search(['加速度', '匀变速'], '高中')
    const node = results.find(r => r.id === KP_GZ_PHY.uniformAccel)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('匀变速直线运动')
    expect(node.pathNames.at(-1)!.trim()).toBe('匀变速直线运动')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Quiz 9: 牛顿运动定律 — 高中物理 L3', () => {
  // Student answer applies Newton's laws with net force
  it('quiz keywords find the 牛顿运动定律 L3 category node', () => {
    const results = search(['牛顿', '合外力'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_PHY.newtonLaws)
  })
  it('牛顿运动定律 node carries correct fullName', () => {
    const results = search(['牛顿', '合外力'], '高中')
    const node = results.find(r => r.id === KP_GZ_PHY.newtonLaws)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('牛顿运动定律')
    expect(node.pathNames.at(-1)!.trim()).toBe('牛顿运动定律')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 初中化学 ─────────────────────────────────────────────────────────────────

describe('Quiz 10: 化学变化 — 初中化学 L3', () => {
  // Student answer discusses chemical vs physical changes with oxidation
  it('quiz keywords find the 化学变化 L3 category node', () => {
    const results = search(['化学变化', '氧化'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_CHEM.chemChange)
  })
  it('化学变化 node carries correct fullName', () => {
    const results = search(['化学变化', '氧化'], '初中')
    const node = results.find(r => r.id === KP_JZ_CHEM.chemChange)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('化学变化')
    expect(node.pathNames.at(-1)!.trim()).toBe('化学变化')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 高中化学 ─────────────────────────────────────────────────────────────────

describe('Quiz 11: 物质的分类与化学用语 — 高中化学 L3', () => {
  // Student answer classifies pure substances and uses chemical formulas
  it('quiz keywords find the 物质的分类与化学用语 L3 category node', () => {
    const results = search(['物质', '分类', '纯净物'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_CHEM.matterClassify)
  })
  it('物质的分类与化学用语 node carries correct fullName', () => {
    const results = search(['物质', '分类', '纯净物'], '高中')
    const node = results.find(r => r.id === KP_GZ_CHEM.matterClassify)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('物质的分类与化学用语')
    expect(node.pathNames.at(-1)!.trim()).toBe('物质的分类与化学用语')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Quiz 12: 化学计量 — 高中化学 L3', () => {
  // Teacher tags quiz under chapter "化学计量"; quiz involves molar mass calculations
  it('quiz keywords find the 化学计量 L3 category node', () => {
    const results = search(['化学计量', '摩尔'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_CHEM.chemCalc)
  })
  it('化学计量 node carries correct fullName', () => {
    const results = search(['化学计量', '摩尔'], '高中')
    const node = results.find(r => r.id === KP_GZ_CHEM.chemCalc)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('化学计量')
    expect(node.pathNames.at(-1)!.trim()).toBe('化学计量')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 初中语文 ─────────────────────────────────────────────────────────────────

describe('Quiz 13: 字音辨析 — 初中语文 L3', () => {
  // Student answer distinguishes polyphonic characters
  it('quiz keywords find the 字音辨析 L3 category node', () => {
    const results = search(['字音', '多音字'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_CHINESE.pronunciation)
  })
  it('字音辨析 node carries correct fullName', () => {
    const results = search(['字音', '多音字'], '初中')
    const node = results.find(r => r.id === KP_JZ_CHINESE.pronunciation)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('字音辨析')
    expect(node.pathNames.at(-1)!.trim()).toBe('字音辨析')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 初中历史 ─────────────────────────────────────────────────────────────────

describe('Quiz 14: 史前时期 — 初中历史 L3', () => {
  // Teacher tags quiz under chapter "史前时期"; quiz discusses prehistoric humans
  it('quiz keywords find the 史前时期 L3 category node', () => {
    const results = search(['史前时期', '原始人'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_HIST.prehistory)
  })
  it('史前时期 node carries correct fullName', () => {
    const results = search(['史前时期', '原始人'], '初中')
    const node = results.find(r => r.id === KP_JZ_HIST.prehistory)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('史前时期')
    expect(node.pathNames.at(-1)!.trim()).toBe('史前时期')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Quiz 15: 夏商西周时期 — 初中历史 L3', () => {
  // Teacher tags quiz under chapter "夏商西周时期"; quiz discusses enfeoffment
  it('quiz keywords find the 夏商西周时期 L3 category node', () => {
    const results = search(['夏商西周时期', '分封'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_HIST.xiaShang)
  })
  it('夏商西周时期 node carries correct fullName', () => {
    const results = search(['夏商西周时期', '分封'], '初中')
    const node = results.find(r => r.id === KP_JZ_HIST.xiaShang)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('夏商西周时期')
    expect(node.pathNames.at(-1)!.trim()).toBe('夏商西周时期')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 初中生物 ─────────────────────────────────────────────────────────────────

describe('Quiz 16: 细胞是生命活动的基本单位 — 初中生物 L3', () => {
  // Student answer describes cell membrane structure
  it('quiz keywords find the 细胞是生命活动的基本单位 L3 category node', () => {
    const results = search(['细胞', '细胞膜'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_BIO.cellUnit)
  })
  it('细胞是生命活动的基本单位 node carries correct fullName', () => {
    const results = search(['细胞', '细胞膜'], '初中')
    const node = results.find(r => r.id === KP_JZ_BIO.cellUnit)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('细胞是生命活动的基本单位')
    expect(node.pathNames.at(-1)!.trim()).toBe('细胞是生命活动的基本单位')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 初中地理 ─────────────────────────────────────────────────────────────────

describe('Quiz 17: 天气与气候 — 初中地理 L3', () => {
  // Student answer discusses seasonal monsoon patterns
  it('quiz keywords find the 天气与气候 L3 category node', () => {
    const results = search(['气候', '季风'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_GEO.weatherClimate)
  })
  it('天气与气候 node carries correct fullName', () => {
    const results = search(['气候', '季风'], '初中')
    const node = results.find(r => r.id === KP_JZ_GEO.weatherClimate)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('天气与气候')
    expect(node.pathNames.at(-1)!.trim()).toBe('天气与气候')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 小学数学 ─────────────────────────────────────────────────────────────────

describe('Quiz 18: 数的运算 — 小学数学 L3', () => {
  // Teacher tags quiz under chapter "数的运算"; quiz involves decimal addition
  it('quiz keywords find the 数的运算 L3 category node', () => {
    const results = search(['数的运算', '小数'], '小学')
    expect(results.map(r => r.id)).toContain(KP_XS_MATH.numOps)
  })
  it('数的运算 node carries correct fullName', () => {
    const results = search(['数的运算', '小数'], '小学')
    const node = results.find(r => r.id === KP_XS_MATH.numOps)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('数的运算')
    expect(node.pathNames.at(-1)!.trim()).toBe('数的运算')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — L4 Category Nodes (rich L3 expansions)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 初中数学 > 图形的性质 (8 L4 children) ────────────────────────────────────

describe('Quiz 19: 相交线与平行线 — 初中数学 L4', () => {
  // Transversal cut parallel lines — identify alternate interior angles
  it('quiz keywords find the 相交线与平行线 L4 category node', () => {
    const results = search(['平行线', '截线', '同位角'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_MATH.parallelLines)
  })
  it('相交线与平行线 node carries correct fullName', () => {
    const results = search(['平行线', '截线', '同位角'], '初中')
    const node = results.find(r => r.id === KP_JZ_MATH.parallelLines)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('相交线与平行线')
    expect(node.pathNames.at(-1)!.trim()).toBe('相交线与平行线')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 20: 三角形 — 初中数学 L4', () => {
  // Prove triangle angle sum theorem
  it('quiz keywords find the 三角形 L4 category node', () => {
    const results = search(['三角形', '内角和'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_MATH.triangle)
  })
  it('三角形 node carries correct fullName', () => {
    const results = search(['三角形', '内角和'], '初中')
    const node = results.find(r => r.id === KP_JZ_MATH.triangle)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('三角形')
    expect(node.pathNames.at(-1)!.trim()).toBe('三角形')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 21: 圆 — 初中数学 L4', () => {
  // Properties of circles: center, radius, chord
  it('quiz keywords find the 圆 L4 category node', () => {
    const results = search(['圆', '圆心', '半径'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_MATH.circle)
  })
  it('圆 node carries correct fullName', () => {
    const results = search(['圆', '圆心', '半径'], '初中')
    const node = results.find(r => r.id === KP_JZ_MATH.circle)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('圆')
    expect(node.pathNames.at(-1)!.trim()).toBe('圆')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 初中数学 > 图形的变化 (6 L4 children) ────────────────────────────────────

describe('Quiz 22: 图形的轴对称 — 初中数学 L4', () => {
  // Determine if a shape is axially symmetric
  it('quiz keywords find the 图形的轴对称 L4 category node', () => {
    const results = search(['轴对称', '对称轴'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_MATH.axiSymmetry)
  })
  it('图形的轴对称 node carries correct fullName', () => {
    const results = search(['轴对称', '对称轴'], '初中')
    const node = results.find(r => r.id === KP_JZ_MATH.axiSymmetry)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('图形的轴对称')
    expect(node.pathNames.at(-1)!.trim()).toBe('图形的轴对称')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 23: 图形的旋转 — 初中数学 L4', () => {
  // Rotate a figure around a given center point
  it('quiz keywords find the 图形的旋转 L4 category node', () => {
    const results = search(['旋转', '旋转中心'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_MATH.rotation)
  })
  it('图形的旋转 node carries correct fullName', () => {
    const results = search(['旋转', '旋转中心'], '初中')
    const node = results.find(r => r.id === KP_JZ_MATH.rotation)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('图形的旋转')
    expect(node.pathNames.at(-1)!.trim()).toBe('图形的旋转')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 高中数学 > 命题与逻辑 (7 L4 children) ────────────────────────────────────

describe('Quiz 24: 充分条件与必要条件 — 高中数学 L4', () => {
  // Identify necessary and sufficient conditions in a mathematical statement
  it('quiz keywords find the 充分条件与必要条件 L4 category node', () => {
    const results = search(['充分条件', '必要条件'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_MATH.sufficientCond)
  })
  it('充分条件与必要条件 node carries correct fullName', () => {
    const results = search(['充分条件', '必要条件'], '高中')
    const node = results.find(r => r.id === KP_GZ_MATH.sufficientCond)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('充分条件')
    expect(node.pathNames.at(-1)!.trim()).toMatch(/充分条件/)
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 初中物理 > 声音的产生和传播 (7 L4 children) ─────────────────────────────

describe('Quiz 25: 声速 — 初中物理 L4', () => {
  // Variation of sound speed with temperature
  it('quiz keywords find the 声速 L4 category node', () => {
    const results = search(['声速', '温度'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_PHY.soundSpeed)
  })
  it('声速 node carries correct fullName', () => {
    const results = search(['声速', '温度'], '初中')
    const node = results.find(r => r.id === KP_JZ_PHY.soundSpeed)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('声速')
    expect(node.pathNames.at(-1)!.trim()).toBe('声速')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 26: 回声 — 初中物理 L4', () => {
  // Echo ranging principle using sound reflection
  it('quiz keywords find the 回声 L4 category node', () => {
    const results = search(['回声', '反射'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_PHY.echo)
  })
  it('回声 node carries correct fullName', () => {
    const results = search(['回声', '反射'], '初中')
    const node = results.find(r => r.id === KP_JZ_PHY.echo)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('回声')
    expect(node.pathNames.at(-1)!.trim()).toBe('回声')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 高中物理 > 匀变速直线运动 (4 L4 children) ───────────────────────────────

describe('Quiz 27: 自由落体 — 高中物理 L4', () => {
  // Free fall motion with gravitational acceleration
  it('quiz keywords find the 自由落体 L4 category node', () => {
    const results = search(['自由落体', '重力加速度'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_PHY.freeFall)
  })
  it('自由落体 node carries correct fullName', () => {
    const results = search(['自由落体', '重力加速度'], '高中')
    const node = results.find(r => r.id === KP_GZ_PHY.freeFall)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('自由落体')
    expect(node.pathNames.at(-1)!.trim()).toBe('自由落体')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 高中物理 > 牛顿运动定律 (9 L4 children) ─────────────────────────────────

describe('Quiz 28: 牛顿第二定律 — 高中物理 L4', () => {
  // F=ma applied to a block on a surface
  it('quiz keywords find the 牛顿第二定律 L4 category node', () => {
    const results = search(['牛顿第二', '加速度', '质量'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_PHY.newton2nd)
  })
  it('牛顿第二定律 node carries correct fullName', () => {
    const results = search(['牛顿第二', '加速度', '质量'], '高中')
    const node = results.find(r => r.id === KP_GZ_PHY.newton2nd)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('牛顿第二定律')
    expect(node.pathNames.at(-1)!.trim()).toBe('牛顿第二定律')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 29: 超重与失重 — 高中物理 L4', () => {
  // Apparent weight in an accelerating elevator
  it('quiz keywords find the 超重与失重 L4 category node', () => {
    const results = search(['超重', '失重', '电梯'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_PHY.overweight)
  })
  it('超重与失重 node carries correct fullName', () => {
    const results = search(['超重', '失重', '电梯'], '高中')
    const node = results.find(r => r.id === KP_GZ_PHY.overweight)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('超重与失重')
    expect(node.pathNames.at(-1)!.trim()).toBe('超重与失重')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 高中化学 > 化学计量 (8 L4 children) ─────────────────────────────────────

describe('Quiz 30: 摩尔质量 — 高中化学 L4', () => {
  // Calculate molar mass from relative molecular mass
  it('quiz keywords find the 摩尔质量 L4 category node', () => {
    const results = search(['摩尔质量', '相对分子质量'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_CHEM.molarMass)
  })
  it('摩尔质量 node carries correct fullName', () => {
    const results = search(['摩尔质量', '相对分子质量'], '高中')
    const node = results.find(r => r.id === KP_GZ_CHEM.molarMass)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('摩尔质量')
    expect(node.pathNames.at(-1)!.trim()).toBe('摩尔质量')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 31: 气体摩尔体积 — 高中化学 L4', () => {
  // Volume of gas at standard temperature and pressure
  it('quiz keywords find the 气体摩尔体积 L4 category node', () => {
    const results = search(['摩尔体积', '标准状况'], '高中')
    expect(results.map(r => r.id)).toContain(KP_GZ_CHEM.gasMolarVol)
  })
  it('气体摩尔体积 node carries correct fullName', () => {
    const results = search(['摩尔体积', '标准状况'], '高中')
    const node = results.find(r => r.id === KP_GZ_CHEM.gasMolarVol)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('气体摩尔体积')
    expect(node.pathNames.at(-1)!.trim()).toBe('气体摩尔体积')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 初中生物 > 细胞 (6 L4 children) ─────────────────────────────────────────

describe('Quiz 32: 植物细胞 — 初中生物 L4', () => {
  // Unique structures of plant cells (cell wall)
  it('quiz keywords find the 植物细胞 L4 category node', () => {
    const results = search(['植物细胞', '细胞壁'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_BIO.plantCell)
  })
  it('植物细胞 node carries correct fullName', () => {
    const results = search(['植物细胞', '细胞壁'], '初中')
    const node = results.find(r => r.id === KP_JZ_BIO.plantCell)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('植物细胞')
    expect(node.pathNames.at(-1)!.trim()).toBe('植物细胞')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 33: 动物细胞 — 初中生物 L4', () => {
  // Animal cell structure with mitochondria
  it('quiz keywords find the 动物细胞 L4 category node', () => {
    const results = search(['动物细胞', '线粒体'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_BIO.animalCell)
  })
  it('动物细胞 node carries correct fullName', () => {
    const results = search(['动物细胞', '线粒体'], '初中')
    const node = results.find(r => r.id === KP_JZ_BIO.animalCell)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('动物细胞')
    expect(node.pathNames.at(-1)!.trim()).toBe('动物细胞')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 初中历史 > 史前时期 (3 L4 children) ─────────────────────────────────────

describe('Quiz 34: 中国早期人类的代表 — 初中历史 L4', () => {
  // Peking Man as representative of early Chinese humans
  it('quiz keywords find the 中国早期人类的代表 L4 category node', () => {
    const results = search(['早期人类', '北京人'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_HIST.earlyHuman)
  })
  it('中国早期人类的代表 node carries correct fullName', () => {
    const results = search(['早期人类', '北京人'], '初中')
    const node = results.find(r => r.id === KP_JZ_HIST.earlyHuman)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('中国早期人类的代表')
    expect(node.pathNames.at(-1)!.trim()).toBe('中国早期人类的代表')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 初中历史 > 夏商西周时期 (2 L4 children) ─────────────────────────────────

describe('Quiz 35: 青铜器与甲骨文 — 初中历史 L4', () => {
  // Shang-Zhou bronze civilization and oracle bones
  it('quiz keywords find the 青铜器与甲骨文 L4 category node', () => {
    const results = search(['青铜器', '甲骨文'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_HIST.bronzeOracle)
  })
  it('青铜器与甲骨文 node carries correct fullName', () => {
    const results = search(['青铜器', '甲骨文'], '初中')
    const node = results.find(r => r.id === KP_JZ_HIST.bronzeOracle)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('青铜器与甲骨文')
    expect(node.pathNames.at(-1)!.trim()).toBe('青铜器与甲骨文')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 初中地理 > 天气与气候 (4 L4 children) ────────────────────────────────────

describe('Quiz 36: 世界的气候 — 初中地理 L4', () => {
  // Tropical rainforest climate characteristics
  it('quiz keywords find the 世界的气候 L4 category node', () => {
    const results = search(['世界的气候', '热带雨林'], '初中')
    expect(results.map(r => r.id)).toContain(KP_JZ_GEO.worldClimate)
  })
  it('世界的气候 node carries correct fullName', () => {
    const results = search(['世界的气候', '热带雨林'], '初中')
    const node = results.find(r => r.id === KP_JZ_GEO.worldClimate)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('世界的气候')
    expect(node.pathNames.at(-1)!.trim()).toBe('世界的气候')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 小学数学 > 数的运算 (14 L4 children) ─────────────────────────────────────

describe('Quiz 37: 小数加减法 — 小学数学 L4', () => {
  // Decimal addition using column method
  it('quiz keywords find the 小数加减法 L4 category node', () => {
    const results = search(['小数', '加减'], '小学')
    expect(results.map(r => r.id)).toContain(KP_XS_MATH.decimalAddSub)
  })
  it('小数加减法 node carries correct fullName', () => {
    const results = search(['小数', '加减'], '小学')
    const node = results.find(r => r.id === KP_XS_MATH.decimalAddSub)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('小数加减法')
    expect(node.pathNames.at(-1)!.trim()).toBe('小数加减法')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 38: 分数加减法 — 小学数学 L4', () => {
  // Adding fractions with different denominators (通分)
  it('quiz keywords find the 分数加减法 L4 category node', () => {
    const results = search(['分数', '通分'], '小学')
    expect(results.map(r => r.id)).toContain(KP_XS_MATH.fractionAddSub)
  })
  it('分数加减法 node carries correct fullName', () => {
    const results = search(['分数', '通分'], '小学')
    const node = results.find(r => r.id === KP_XS_MATH.fractionAddSub)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('分数加减法')
    expect(node.pathNames.at(-1)!.trim()).toBe('分数加减法')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 39: 混合运算 — 小学数学 L4', () => {
  // Order of operations in mixed arithmetic
  it('quiz keywords find the 混合运算 L4 category node', () => {
    const results = search(['混合运算', '运算顺序'], '小学')
    expect(results.map(r => r.id)).toContain(KP_XS_MATH.mixedOps)
  })
  it('混合运算 node carries correct fullName', () => {
    const results = search(['混合运算', '运算顺序'], '小学')
    const node = results.find(r => r.id === KP_XS_MATH.mixedOps)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('混合运算')
    expect(node.pathNames.at(-1)!.trim()).toBe('混合运算')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Quiz 40: 表内乘除法 — 小学数学 L4', () => {
  // Times table and basic division
  it('quiz keywords find the 表内乘除法 L4 category node', () => {
    const results = search(['乘除法', '口诀'], '小学')
    expect(results.map(r => r.id)).toContain(KP_XS_MATH.multiDiv)
  })
  it('表内乘除法 node carries correct fullName', () => {
    const results = search(['乘除法', '口诀'], '小学')
    const node = results.find(r => r.id === KP_XS_MATH.multiDiv)!
    expect(node).toBeDefined()
    expect(node.fullName).toContain('表内乘除法')
    expect(node.pathNames.at(-1)!.trim()).toBe('表内乘除法')
    expect(node.pathNames).toBeInstanceOf(Array)
    expect(node.pathNames.length).toBeGreaterThanOrEqual(4)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C — Cross-subject fullName validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('fullName field — cross-subject validation', () => {
  const multiSubjectSearch = () =>
    jsonDataLoader.batchSearchKnowledgePoints(
      ['数学', '物理', '化学', '生物', '历史', '地理'],
      { gradeLevel: '初中', leafOnly: false },
    )

  it('every result has non-empty fullName and non-empty pathNames', () => {
    const results = multiSubjectSearch()
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.fullName).toBeDefined()
      expect(typeof r.fullName).toBe('string')
      expect(r.fullName.trim().length).toBeGreaterThan(0)
      expect(r.pathNames).toBeInstanceOf(Array)
      expect(r.pathNames.length).toBeGreaterThan(0)
    }
  })

  it('fullName equals pathNames joined with " > "', () => {
    const results = multiSubjectSearch()
    for (const r of results) {
      const reconstructed = r.pathNames.join(' > ')
      expect(r.fullName).toBe(reconstructed)
    }
  })

  it('pathNames.at(-1) matches the trimmed node name', () => {
    const results = multiSubjectSearch()
    for (const r of results) {
      const lastName = r.pathNames.at(-1)!
      expect(lastName.trim()).toBe(r.name.trim())
    }
  })
})
