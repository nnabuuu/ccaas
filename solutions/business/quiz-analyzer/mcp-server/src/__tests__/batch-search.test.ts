/**
 * Multi-Knowledge-Point Matching Tests
 *
 * Verifies that batch_search_knowledge_points correctly finds multiple
 * knowledge points in a single call for complex quiz questions.
 *
 * Quiz scenarios:
 * 1. 一次函数 + 二次函数 + 交点问题（综合题）
 * 2. 勾股定理 + 面积（几何综合）
 * 3. 二次函数 + 一元二次方程（方程与函数结合）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { jsonDataLoader } from '../json-data-loader.js'

const KP = {
  // 函数 branch
  linearFunction:        '1998702114322399906', // 一次函数
  linearFnGraph:         '1998702114322399909', // 一次函数的图象与性质
  linearFnIntersection:  '1998702114322399922', // 一次函数图像的交点问题
  quadraticFunction:     '1998702114322399941', // 二次函数
  quadraticFnGraph:      '1998702114322399943', // 二次函数的图象与性质
  // 方程 branch
  quadraticEquation:     '1998702114322399803', // 一元二次方程
  // 几何 branch
  pythagoreanTheorem:    '1998702114322400154', // 勾股定理
  rightTriangle:         '1998702114322400153', // 直角三角形
} as const

beforeAll(() => { jsonDataLoader.load() })

// ─── Core: batch_search vs. repeated single-search ────────────────────────────

describe('batchSearchKnowledgePoints vs. single-keyword search', () => {
  it('两次单独搜索需要合并去重，batch 一次返回已去重结果', () => {
    const single1 = jsonDataLoader.searchKnowledgePoints('一次函数', { gradeLevel: '初中' })
    const single2 = jsonDataLoader.searchKnowledgePoints('二次函数', { gradeLevel: '初中' })
    const mergedIds = new Set([...single1.map(k => k.id), ...single2.map(k => k.id)])

    const batch = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '二次函数'],
      { gradeLevel: '初中' },
    )

    // batch 结果数量 == 去重后的 union
    expect(batch.length).toBe(mergedIds.size)
    // batch 每个结果都在 union 中
    batch.forEach(r => expect(mergedIds.has(r.id)).toBe(true))
  })

  it('batch 结果按 matchScore 降序排列', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '二次函数'],
      { gradeLevel: '初中', limit: 30 },
    )
    for (let i = 1; i < results.length; i++) {
      expect(results[i].matchScore).toBeLessThanOrEqual(results[i - 1].matchScore)
    }
  })

  it('匹配两个关键词的 KP matchScore 高于只匹配一个的', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '交点'],
      { gradeLevel: '初中', limit: 30 },
    )
    // "一次函数图像的交点问题" 包含两个关键词
    const doubleMatch = results.find(r => r.id === KP.linearFnIntersection)
    expect(doubleMatch).toBeDefined()
    expect(doubleMatch!.matchedKeywords).toContain('一次函数')
    expect(doubleMatch!.matchedKeywords).toContain('交点')
    expect(doubleMatch!.matchScore).toBeGreaterThanOrEqual(20) // 2 keywords × 10

    // 纯 "一次函数" 节点只匹配一个关键词
    const singleMatch = results.find(r => r.id === KP.linearFunction)
    expect(singleMatch).toBeDefined()
    expect(singleMatch!.matchedKeywords).toHaveLength(1)

    expect(doubleMatch!.matchScore).toBeGreaterThan(singleMatch!.matchScore)
  })
})

// ─── Quiz 4: 一次函数 + 二次函数综合题 ────────────────────────────────────────

describe('Quiz 4: 一次函数与二次函数综合题', () => {
  // 直线 y = kx + b 与抛物线 y = x² - 4x + 3 的交点问题
  // 知识点: 一次函数 + 二次函数 + 交点

  it('batch 搜索三个关键词，应同时覆盖 一次函数 和 二次函数 节点（不限 limit）', () => {
    // 不加 limit：父节点（level 4）matchScore 低于子节点，需要查全量才能保证覆盖
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '二次函数', '交点'],
      { gradeLevel: '初中' },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(KP.linearFunction)
    expect(ids).toContain(KP.quadraticFunction)
  })

  it('一次函数图像的交点问题 应出现在前5名（匹配最多关键词）', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '交点'],
      { gradeLevel: '初中', limit: 10 },
    )
    const top5 = results.slice(0, 5).map(r => r.id)
    expect(top5).toContain(KP.linearFnIntersection)
  })

  it('每个 batch 结果都包含 matchedKeywords 字段', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '二次函数'],
      { gradeLevel: '初中', limit: 10 },
    )
    results.forEach(r => {
      expect(Array.isArray(r.matchedKeywords)).toBe(true)
      expect(r.matchedKeywords.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('limit 参数有效限制返回数量', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '二次函数'],
      { gradeLevel: '初中', limit: 5 },
    )
    expect(results.length).toBeLessThanOrEqual(5)
  })
})

// ─── Quiz 5: 勾股定理 + 直角三角形面积 ───────────────────────────────────────

describe('Quiz 5: 勾股定理与三角形面积综合题', () => {
  // 已知直角三角形两直角边为 3 和 4，求斜边和面积
  // 知识点: 勾股定理 + 直角三角形 + 三角形面积

  it('batch 搜索应同时找到 勾股定理 和 直角三角形（不限 limit）', () => {
    // 不加 limit 保证覆盖父节点（直角三角形 level=5，matchScore=15 可能被更多结果挤出 top 20）
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['勾股定理', '直角三角形'],
      { gradeLevel: '初中' },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(KP.pythagoreanTheorem)
    expect(ids).toContain(KP.rightTriangle)
  })

  it('勾股定理 matchScore 应 ≥ 16（level=6，1个关键词）', () => {
    // 不限 limit，只验证分数计算正确
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['勾股定理', '直角三角形'],
      { gradeLevel: '初中' },
    )
    const pythagorean = results.find(r => r.id === KP.pythagoreanTheorem)
    expect(pythagorean).toBeDefined()
    // 勾股定理 level=6，matchScore 至少 = 1×10 + 6 = 16
    expect(pythagorean!.matchScore).toBeGreaterThanOrEqual(16)
  })

  it('三角形面积 关键词应能找到相关知识点', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['三角形', '面积'],
      { gradeLevel: '初中', limit: 20 },
    )
    // 至少有一个结果包含"面积"
    const hasArea = results.some(r => r.name.includes('面积'))
    expect(hasArea).toBe(true)
    // 同时包含两个关键词的 KP matchScore 更高
    const doubleMatches = results.filter(r => r.matchedKeywords.length === 2)
    const singleMatches = results.filter(r => r.matchedKeywords.length === 1)
    if (doubleMatches.length > 0 && singleMatches.length > 0) {
      expect(doubleMatches[0].matchScore).toBeGreaterThan(singleMatches[0].matchScore)
    }
  })
})

// ─── Quiz 6: 二次函数 + 一元二次方程（方程与函数结合）────────────────────────

describe('Quiz 6: 二次函数与一元二次方程结合', () => {
  // f(x) = x² - 5x + 6，求 f(x) = 0 的解，并分析图象与 x 轴交点
  // 知识点: 二次函数 + 一元二次方程 + 图象

  it('batch 搜索 [二次函数, 一元二次方程] 应同时覆盖两个核心知识点（不限 limit）', () => {
    // 不加 limit：两组 KP 来自不同分支，父节点 level 4/5 均可能被子节点挤出 top 20
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数', '一元二次方程'],
      { gradeLevel: '初中' },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(KP.quadraticFunction)
    expect(ids).toContain(KP.quadraticEquation)
  })

  it('加入"图象"关键词后，图象相关 KP 的 matchScore 提升', () => {
    const without = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数'],
      { gradeLevel: '初中', limit: 30 },
    )
    const with3 = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数', '一元二次方程', '图象'],
      { gradeLevel: '初中', limit: 30 },
    )

    const graphKpWithout = without.find(r => r.id === KP.quadraticFnGraph)
    const graphKpWith = with3.find(r => r.id === KP.quadraticFnGraph)

    expect(graphKpWithout).toBeDefined()
    expect(graphKpWith).toBeDefined()
    // 多一个关键词 matchScore 增加
    expect(graphKpWith!.matchScore).toBeGreaterThan(graphKpWithout!.matchScore)
  })
})

// ─── Edge Cases ────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('单关键词 batch 与 single search 结果一致（matchScore 可能不同但 ids 相同）', () => {
    const batch = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数'],
      { gradeLevel: '初中' },
    )
    const single = jsonDataLoader.searchKnowledgePoints('二次函数', { gradeLevel: '初中' })

    const batchIds = new Set(batch.map(r => r.id))
    const singleIds = new Set(single.map(r => r.id))
    expect(batchIds).toEqual(singleIds)
  })

  it('空结果：不存在的关键词返回空数组', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['这个知识点绝对不存在xyz123'],
      { gradeLevel: '初中' },
    )
    expect(results).toHaveLength(0)
  })

  it('gradeLevel 过滤有效：所有结果都属于指定年级', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['函数', '方程'],
      { gradeLevel: '初中', limit: 50 },
    )
    results.forEach(r => expect(r.gradeLevel).toBe('初中'))
  })
})
