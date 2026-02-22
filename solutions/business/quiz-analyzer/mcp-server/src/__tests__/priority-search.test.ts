/**
 * Mode C: search_knowledge_points_by_priority Tests
 *
 * Verifies jsonDataLoader.searchKnowledgePointsByPriority() — the extracted
 * core logic for the search_knowledge_points_by_priority MCP tool.
 *
 * Key behaviors under test:
 * 1. Basic round structure: multi-concept quiz, cumulativeCount monotonically increases
 * 2. Cross-round dedup: synonym keywords trigger empty newKPs (the real "early stop" signal)
 * 3. Zero-match → uncoveredKeywords
 * 4. Mixed coverage → coverageScore calculation
 * 5. leafOnly parameter filters non-leaf nodes
 * 6. limitPerKeyword caps results per round
 *
 * Confirmed leaf nodes used in tests (from leaf-priority-search.test.ts):
 *   pythagoreanProof:       '1998702114322400157' - 勾股定理及其证明
 *   pythagoreanApplication: '1998702114322400159' - 勾股定理的实际应用
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { jsonDataLoader } from '../json-data-loader.js'

beforeAll(() => { jsonDataLoader.load() })

// ─── Test 1: Basic round structure ────────────────────────────────────────────

describe('Test 1: 基本轮次结构（多概念题）', () => {
  // 因式分解、一元二次方程、韦达定理 — three distinct concept branches
  // Verified from actual run (leafOnly=true, limitPerKeyword=5):
  //   round[0] 因式分解:     found=5, newKPs=5, cumulativeCount=5
  //   round[1] 一元二次方程:  found=5, newKPs=5, cumulativeCount=10
  //   round[2] 韦达定理:     found=1, newKPs=1, cumulativeCount=11
  const KEYWORDS = ['因式分解', '一元二次方程', '韦达定理']

  it('返回正确的 rounds 数量（每个 keyword 一轮）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.rounds).toHaveLength(3)
  })

  it('rounds[0].keyword === "因式分解"，rounds[2].keyword === "韦达定理"', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.rounds[0].keyword).toBe('因式分解')
    expect(result.rounds[1].keyword).toBe('一元二次方程')
    expect(result.rounds[2].keyword).toBe('韦达定理')
  })

  it('cumulativeCount 单调递增', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    for (let i = 1; i < result.rounds.length; i++) {
      expect(result.rounds[i].cumulativeCount).toBeGreaterThanOrEqual(result.rounds[i - 1].cumulativeCount)
    }
  })

  it('最终 cumulativeCount === allResults.length', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    const lastRound = result.rounds[result.rounds.length - 1]
    expect(lastRound.cumulativeCount).toBe(result.allResults.length)
  })

  it('所有3个关键词均有命中 → coverageScore === 1.0', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.coverageScore).toBe(1.0)
    expect(result.coveredKeywords).toEqual(KEYWORDS)
    expect(result.uncoveredKeywords).toHaveLength(0)
  })

  it('allResults 中的每个 KP 都是叶节点（leafOnly=true）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.allResults.length).toBeGreaterThan(0)
    result.allResults.forEach(kp => expect(kp.isLeaf).toBe(true))
  })

  it('rounds[2] (韦达定理) 命中了韦达定理相关叶节点（found >= 1, newKPs >= 1）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    const lastRound = result.rounds[2]
    expect(lastRound.found).toBeGreaterThanOrEqual(1)
    expect(lastRound.newKPs.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Test 2: Cross-round dedup — empty newKPs for synonym keyword ─────────────

describe('Test 2: 跨轮去重 — 同义词关键词触发 newKPs 为空（真正的早停信号）', () => {
  // "勾股定理" 命中 "勾股定理及其证明" 和 "勾股定理的实际应用" 两个叶节点
  // "勾股定理的实际应用" 在 round[1] 中找到了，但全部已在 seenIds 中
  // → rounds[1].newKPs === [] 但 rounds[1].found >= 1（关键！区别于零命中）
  const KEYWORDS = ['勾股定理', '勾股定理的实际应用']

  it('round[0] 命中了勾股定理相关叶节点（found >= 1, newKPs >= 1）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.rounds[0].found).toBeGreaterThanOrEqual(1)
    expect(result.rounds[0].newKPs.length).toBeGreaterThanOrEqual(1)
  })

  it('round[1] 找到了结果（found >= 1），但 newKPs 为空（全部被 dedup 过滤）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    // "勾股定理的实际应用" exists in the data and IS found in round[1]
    expect(result.rounds[1].found).toBeGreaterThanOrEqual(1)
    // But all found KPs were already seen in round[0] — dedup in action
    expect(result.rounds[1].newKPs).toHaveLength(0)
  })

  it('round[1].cumulativeCount 与 round[0].cumulativeCount 相同（无新增）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.rounds[1].cumulativeCount).toBe(result.rounds[0].cumulativeCount)
  })

  it('allResults 中每个 KP id 唯一（seenIds 去重有效）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    const ids = result.allResults.map(kp => kp.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('round[0] 的 newKPs 中包含 "勾股定理的实际应用"（id: 1998702114322400159）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    const pythagoreanApplicationId = '1998702114322400159'
    const ids = result.rounds[0].newKPs.map(kp => kp.id)
    expect(ids).toContain(pythagoreanApplicationId)
  })
})

// ─── Test 3: Zero match → uncoveredKeywords ────────────────────────────────────

describe('Test 3: 零命中关键词 → uncoveredKeywords', () => {
  const IMPOSSIBLE_KEYWORD = 'zzznomatch_xyz_term'

  it('found === 0, newKPs === [] 当关键词无匹配', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority([IMPOSSIBLE_KEYWORD], { leafOnly: true })
    expect(result.rounds[0].found).toBe(0)
    expect(result.rounds[0].newKPs).toHaveLength(0)
  })

  it('无匹配关键词进入 uncoveredKeywords', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority([IMPOSSIBLE_KEYWORD], { leafOnly: true })
    expect(result.uncoveredKeywords).toContain(IMPOSSIBLE_KEYWORD)
    expect(result.coveredKeywords).toHaveLength(0)
  })

  it('coverageScore === 0 当所有关键词都无匹配', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority([IMPOSSIBLE_KEYWORD], { leafOnly: true })
    expect(result.coverageScore).toBe(0)
  })

  it('allResults === [] 当所有关键词都无匹配', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority([IMPOSSIBLE_KEYWORD], { leafOnly: true })
    expect(result.allResults).toHaveLength(0)
  })
})

// ─── Test 4: Mixed coverage → coverageScore ────────────────────────────────────

describe('Test 4: 混合覆盖率 — 部分命中', () => {
  const KEYWORDS = ['勾股定理', 'zzznomatch_xyz_term']

  it('coverageScore === 0.5（1 命中 / 2 关键词）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.coverageScore).toBe(0.5)
  })

  it('coveredKeywords === ["勾股定理"]', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.coveredKeywords).toEqual(['勾股定理'])
  })

  it('uncoveredKeywords === ["zzznomatch_xyz_term"]', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(KEYWORDS, { leafOnly: true })
    expect(result.uncoveredKeywords).toEqual(['zzznomatch_xyz_term'])
  })
})

// ─── Test 5: leafOnly parameter validity ───────────────────────────────────────

describe('Test 5: leafOnly 有效性', () => {
  // "对称轴" matches "二次函数的对称轴" (confirmed leaf from leaf-priority-search.test.ts)
  // A specific enough keyword to reliably hit leaf nodes in the first search window

  it('leafOnly: true → allResults 中所有节点 isLeaf === true', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(['对称轴'], { leafOnly: true })
    expect(result.allResults.length).toBeGreaterThan(0)
    result.allResults.forEach(kp => expect(kp.isLeaf).toBe(true))
  })

  it('leafOnly: false → allResults 中可能含 isLeaf === false 的节点（"二次函数" 本身是父节点）', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(['二次函数'], { leafOnly: false })
    expect(result.allResults.length).toBeGreaterThan(0)
    // With leafOnly=false, parent nodes like "二次函数" can appear
    const hasNonLeaf = result.allResults.some(kp => !kp.isLeaf)
    expect(hasNonLeaf).toBe(true)
  })

  it('leafOnly: true 结果数量 <= leafOnly: false 结果数量（叶节点是子集）', () => {
    const withLeaf = jsonDataLoader.searchKnowledgePointsByPriority(['二次函数'], { leafOnly: true, limitPerKeyword: 20 })
    const withoutLeaf = jsonDataLoader.searchKnowledgePointsByPriority(['二次函数'], { leafOnly: false, limitPerKeyword: 20 })
    expect(withLeaf.allResults.length).toBeLessThanOrEqual(withoutLeaf.allResults.length)
  })
})

// ─── Test 6: limitPerKeyword boundary ─────────────────────────────────────────

describe('Test 6: limitPerKeyword 边界', () => {
  it('limitPerKeyword: 2 → rounds[0].found <= 2', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(['函数'], { limitPerKeyword: 2 })
    expect(result.rounds[0].found).toBeLessThanOrEqual(2)
  })

  it('limitPerKeyword: 2 → rounds[0].newKPs.length <= 2', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(['函数'], { limitPerKeyword: 2 })
    expect(result.rounds[0].newKPs.length).toBeLessThanOrEqual(2)
  })

  it('limitPerKeyword: 1 → 每轮最多1个 newKP', () => {
    const result = jsonDataLoader.searchKnowledgePointsByPriority(
      ['因式分解', '一元二次方程'],
      { leafOnly: true, limitPerKeyword: 1 },
    )
    result.rounds.forEach(round => {
      expect(round.newKPs.length).toBeLessThanOrEqual(1)
    })
  })
})
