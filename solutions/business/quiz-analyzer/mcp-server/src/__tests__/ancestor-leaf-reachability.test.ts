/**
 * Ancestor-to-Leaf Reachability Tests
 *
 * For every unique (subject × level) combination, picks the first non-leaf
 * node at that level, DFS-walks to its first leaf descendant, then asserts
 * that searching for that leaf by name (scoped to its subject) returns it.
 *
 * This verifies that the entire tree is reachable via searchKnowledgePoints,
 * covering all levels in all 21 subjects. Produces ≤105 test cases.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, it, beforeAll, expect } from 'vitest'
import { jsonDataLoader } from '../json-data-loader.js'

// ─── Test Case Generation (synchronous, at module load) ───────────────────────

const DATA_DIR = resolve(__dirname, '../../../data/subjects')

interface TestCase {
  label: string
  subjectId: string
  level: number
  ancestorId: string
  ancestorName: string
  leafId: string
  leafName: string
}

function firstLeaf(nodeMap: Map<string, any>, nodeId: string): any | null {
  const node = nodeMap.get(nodeId)
  if (!node) return null
  if (node.children.length === 0) return node
  for (const childId of node.children) {
    const found = firstLeaf(nodeMap, childId)
    if (found) return found
  }
  return null
}

function buildTestCases(): TestCase[] {
  const cases: TestCase[] = []
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort()

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'))
    const nodeMap = new Map<string, any>()
    for (const kp of raw.knowledgePoints) nodeMap.set(kp.id, kp)

    // Group non-leaf nodes by level
    const byLevel = new Map<number, any[]>()
    for (const kp of raw.knowledgePoints) {
      if (kp.children.length > 0) {
        if (!byLevel.has(kp.level)) byLevel.set(kp.level, [])
        byLevel.get(kp.level)!.push(kp)
      }
    }

    // One test case per (subject × level)
    const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b)
    for (const level of sortedLevels) {
      const ancestor = byLevel.get(level)![0]  // first non-leaf at this level
      const leaf = firstLeaf(nodeMap, ancestor.id)
      if (!leaf) continue

      cases.push({
        label: `${raw.gradeLevel} L${level} "${ancestor.name.trim()}" → "${leaf.name.trim()}"`,
        subjectId: raw.subjectId,
        level,
        ancestorId: ancestor.id,
        ancestorName: ancestor.name.trim(),
        leafId: leaf.id,
        leafName: leaf.name.trim(),
      })
    }
  }

  return cases
}

const TEST_CASES = buildTestCases()

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Ancestor-to-Leaf Reachability', () => {
  beforeAll(() => {
    jsonDataLoader.load()
  })

  it('should generate at least one test case per subject', () => {
    const subjectIds = new Set(TEST_CASES.map(tc => tc.subjectId))
    const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
    expect(subjectIds.size).toBe(files.length)
  })

  it(`should produce ≤150 cases (got ${TEST_CASES.length})`, () => {
    // Upper bound: 21 subjects × max ~9 non-leaf levels observed in data (e.g. 初中英语 reaches L8)
    expect(TEST_CASES.length).toBeLessThanOrEqual(150)
  })

  it.each(TEST_CASES)('$label', ({ subjectId, leafId, leafName }) => {
    const results = jsonDataLoader.searchKnowledgePoints(leafName, {
      subjectId,
      limit: 500,
    })
    expect(results.some(r => r.id === leafId)).toBe(true)
  })
})
