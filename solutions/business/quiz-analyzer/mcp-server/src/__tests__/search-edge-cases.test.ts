/**
 * Edge Case Tests — Core Search Functions
 *
 * Covers missing scenarios identified in coverage analysis:
 * - Empty keyword inputs
 * - gradeLevel mismatch filtering
 * - leafOnly fallback behaviour (no leaf nodes → return all matching)
 * - Limit parameter
 * - Exact vs partial name matching in searchKnowledgePoints
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { jsonDataLoader } from '../json-data-loader.js'

beforeAll(() => { jsonDataLoader.load() })

// ─── batchSearchKnowledgePoints ────────────────────────────────────────────────

describe('batchSearchKnowledgePoints — empty input', () => {
  it('empty keyword array returns empty results', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints([])
    expect(results).toHaveLength(0)
  })

  it('array of empty strings returns empty results', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(['', ''])
    expect(results).toHaveLength(0)
  })
})

describe('batchSearchKnowledgePoints — gradeLevel filtering', () => {
  it('gradeLevel 高中 excludes 初中-only nodes', () => {
    // "勾股定理" is only in 初中 math
    const results = jsonDataLoader.batchSearchKnowledgePoints(['勾股定理'], { gradeLevel: '高中' })
    // Should either be empty or contain only 高中-graded nodes
    for (const r of results) {
      expect(r.gradeLevel).toBe('高中')
    }
  })

  it('gradeLevel 初中 excludes 小学-only nodes', () => {
    // "表内乘除法" is 小学 only
    const results = jsonDataLoader.batchSearchKnowledgePoints(['表内乘除法'], { gradeLevel: '初中' })
    for (const r of results) {
      expect(r.gradeLevel).toBe('初中')
    }
  })

  it('same keyword with different gradeLevel returns different result sets', () => {
    const junior = jsonDataLoader.batchSearchKnowledgePoints(['函数'], { gradeLevel: '初中' })
    const senior = jsonDataLoader.batchSearchKnowledgePoints(['函数'], { gradeLevel: '高中' })
    // At least one set should be non-empty (函数 appears in both grades)
    expect(junior.length + senior.length).toBeGreaterThan(0)
    // Every junior result has correct grade
    for (const r of junior) expect(r.gradeLevel).toBe('初中')
    for (const r of senior) expect(r.gradeLevel).toBe('高中')
  })

  it('no results when gradeLevel does not match any node for keyword', () => {
    // "北京人" is a history node tagged 初中; querying with 小学 should return nothing
    const results = jsonDataLoader.batchSearchKnowledgePoints(['中国早期人类的代表'], { gradeLevel: '小学' })
    expect(results).toHaveLength(0)
  })
})

describe('batchSearchKnowledgePoints — leafOnly fallback', () => {
  it('leafOnly:true with keyword that only matches branch nodes falls back to those branch nodes', () => {
    // "数与式" is a branch (L3) node with children; with leafOnly it should fall back to branch nodes
    const results = jsonDataLoader.batchSearchKnowledgePoints(['数与式'], { gradeLevel: '初中', leafOnly: true })
    // Per implementation: if no leaf matched, returns all matched nodes (including branches)
    expect(results.length).toBeGreaterThan(0)
    // "数与式" itself is NOT a leaf (it has children), but since no leaf matched, it should be included
    const branchNode = results.find(r => r.name.trim() === '数与式')
    expect(branchNode).toBeDefined()
  })

  it('leafOnly:true returns only leaf nodes when leaves exist for keyword', () => {
    // "有理数" is a leaf node (or matches leaves)
    const results = jsonDataLoader.batchSearchKnowledgePoints(['有理数'], { gradeLevel: '初中', leafOnly: true })
    if (results.length > 0) {
      for (const r of results) {
        expect(r.children).toHaveLength(0)
      }
    }
  })

  it('leafOnly:false includes non-leaf nodes in results', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(['数与式'], { gradeLevel: '初中', leafOnly: false })
    const branchNodes = results.filter(r => r.children.length > 0)
    expect(branchNodes.length).toBeGreaterThan(0)
  })
})

describe('batchSearchKnowledgePoints — limit parameter', () => {
  it('limit:1 returns at most 1 result', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(['函数'], { gradeLevel: '初中', limit: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('limit:5 returns at most 5 results', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(['函数'], { limit: 5 })
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it('results are ordered by matchScore descending even when limited', () => {
    const limited = jsonDataLoader.batchSearchKnowledgePoints(['函数'], { limit: 10 })
    const unlimited = jsonDataLoader.batchSearchKnowledgePoints(['函数'])
    // First 10 of unlimited should match limited
    if (limited.length > 1) {
      for (let i = 0; i < limited.length - 1; i++) {
        expect(limited[i].matchScore).toBeGreaterThanOrEqual(limited[i + 1].matchScore)
      }
    }
    // Each limited result should appear in unlimited (same order)
    const unlimitedIds = unlimited.map(r => r.id)
    limited.forEach((r, idx) => {
      expect(unlimitedIds[idx]).toBe(r.id)
    })
  })
})

describe('batchSearchKnowledgePoints — result shape', () => {
  it('every result has required fields including fullName and pathNames', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(['数学'], { limit: 20 })
    for (const r of results) {
      expect(typeof r.id).toBe('string')
      expect(r.id.length).toBeGreaterThan(0)
      expect(typeof r.name).toBe('string')
      expect(typeof r.fullName).toBe('string')
      expect(r.fullName.length).toBeGreaterThan(0)
      expect(Array.isArray(r.pathNames)).toBe(true)
      expect(r.pathNames.length).toBeGreaterThan(0)
      expect(Array.isArray(r.matchedKeywords)).toBe(true)
      expect(r.matchedKeywords.length).toBeGreaterThan(0)
      expect(typeof r.matchScore).toBe('number')
    }
  })

  it('fullName is consistent: equals pathNames.join(" > ")', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(['数学', '物理', '化学'], { limit: 50 })
    for (const r of results) {
      expect(r.fullName).toBe(r.pathNames.join(' > '))
    }
  })

  it('no duplicate IDs in results', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(['函数', '方程', '方程与函数'])
    const ids = results.map(r => r.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ─── searchKnowledgePoints (single-keyword) ────────────────────────────────────

describe('searchKnowledgePoints — empty input', () => {
  it('empty string keyword returns empty results', () => {
    const results = jsonDataLoader.searchKnowledgePoints('')
    expect(results).toHaveLength(0)
  })
})

describe('searchKnowledgePoints — match types', () => {
  it('exact match scores higher than prefix match', () => {
    // "函数" should score higher than "反比例函数"
    const results = jsonDataLoader.searchKnowledgePoints('函数', { gradeLevel: '初中' })
    const exactMatch = results.find(r => r.name.trim() === '函数')
    const prefixMatch = results.find(r => r.name.trim().startsWith('函数') && r.name.trim() !== '函数')
    if (exactMatch && prefixMatch) {
      const exactIdx = results.indexOf(exactMatch)
      const prefixIdx = results.indexOf(prefixMatch)
      expect(exactIdx).toBeLessThan(prefixIdx)
    }
  })

  it('gradeLevel filter excludes wrong grade nodes', () => {
    const results = jsonDataLoader.searchKnowledgePoints('函数', { gradeLevel: '初中' })
    for (const r of results) {
      expect(r.gradeLevel).toBe('初中')
    }
  })

  it('limit parameter caps results', () => {
    const limited = jsonDataLoader.searchKnowledgePoints('数', { limit: 3 })
    expect(limited.length).toBeLessThanOrEqual(3)
  })
})

// ─── getKnowledgePointById ─────────────────────────────────────────────────────

describe('getKnowledgePointById — edge cases', () => {
  it('returns undefined for unknown ID', () => {
    const result = jsonDataLoader.getKnowledgePointById('nonexistent-id-99999')
    expect(result).toBeUndefined()
  })

  it('returns undefined for empty string ID', () => {
    const result = jsonDataLoader.getKnowledgePointById('')
    expect(result).toBeUndefined()
  })

  it('returns the correct node for a known ID', () => {
    const kp = jsonDataLoader.getKnowledgePointById('1998702114322399413') // 数与式
    expect(kp).toBeDefined()
    expect(kp!.name.trim()).toBe('数与式')
  })
})
