/**
 * Quiz → Catalog & Knowledge Point Matching Tests
 *
 * Given a real quiz question, verify that:
 * 1. search_catalog returns the correct subject (e.g. 初中-数学)
 * 2. search_knowledge_points returns the correct knowledge points
 * 3. getKnowledgePointPath returns the correct hierarchy
 *
 * Knowledge point hierarchy verified from data:
 *   初中知识点 > 数与代数 > 函数 > 二次函数 > 二次函数的图象与性质
 *   初中知识点 > 数与代数 > 方程与不等式 > 方程与方程组 > 一元二次方程
 *   初中知识点 > 图形与几何 > 图形的性质 > 三角形 > 直角三角形 > 勾股定理
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { jsonDataLoader } from '../json-data-loader.js'

// ─── Known IDs (verified from data/knowledge-points.json) ─────────────────────

const KP = {
  juniorRoot:            '1998702114322399411', // 初中知识点
  numberAlgebra:         '1998702114322399412', // 数与代数
  function:              '1998702114322399881', // 函数
  quadraticFunction:     '1998702114322399941', // 二次函数
  quadraticFnConcept:    '1998702114322399942', // 二次函数的概念
  quadraticFnGraph:      '1998702114322399943', // 二次函数的图象与性质
  equationIneq:          '1998702114322399709', // 方程与不等式
  equationGroup:         '1998702114322399710', // 方程与方程组
  quadraticEquation:     '1998702114322399803', // 一元二次方程
  shapeGeometry:         '1998702114322399998', // 图形与几何
  shapeProperties:       '1998702114322399999', // 图形的性质
  triangle:              '1998702114322400119', // 三角形
  rightTriangle:         '1998702114322400153', // 直角三角形
  pythagoreanTheorem:    '1998702114322400154', // 勾股定理
} as const

const SUBJECT = {
  juniorMath: '3601171b-5ac9-46ba-8dec-2022b42b0fa5', // 初中-数学
}

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(() => {
  jsonDataLoader.load()
})

// ─── Catalog (Subject) Search ──────────────────────────────────────────────────

describe('Catalog (Subject) Search', () => {
  it('should find 初中-数学 by exact name', () => {
    const results = jsonDataLoader.searchSubjects('初中-数学')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(s => s.id === SUBJECT.juniorMath)).toBe(true)
  })

  it('should find 初中-数学 by keyword 初中', () => {
    const results = jsonDataLoader.searchSubjects('初中')
    const math = results.find(s => s.id === SUBJECT.juniorMath)
    expect(math).toBeDefined()
    expect(math!.name).toBe('初中-数学')
  })

  it('should return subject id and name in result', () => {
    const results = jsonDataLoader.searchSubjects('初中-数学', { limit: 1 })
    expect(results[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) })
  })
})

// ─── Quiz 1: 二次函数 ─────────────────────────────────────────────────────────

describe('Quiz 1: 二次函数题', () => {
  // 已知二次函数 f(x) = x² - 4x + 3，求该函数的最小值和对称轴方程。

  it('搜索"二次函数"应匹配到 id=quadraticFunction 的知识点', () => {
    const results = jsonDataLoader.searchKnowledgePoints('二次函数')
    expect(results.some(k => k.id === KP.quadraticFunction)).toBe(true)
  })

  it('限定初中年级搜索"二次函数"，所有结果均属于初中', () => {
    const results = jsonDataLoader.searchKnowledgePoints('二次函数', { gradeLevel: '初中', limit: 20 })
    expect(results.length).toBeGreaterThan(0)
    results.forEach(k => expect(k.gradeLevel).toBe('初中'))
  })

  it('通过 id 查询 二次函数 的层级路径应为: 初中知识点 > 数与代数 > 函数 > 二次函数', () => {
    const path = jsonDataLoader.getKnowledgePointPath(KP.quadraticFunction)
    expect(path.map(k => k.name.trim())).toEqual([
      '初中知识点', '数与代数', '函数', '二次函数',
    ])
  })

  it('二次函数 的子节点应包含 二次函数的概念 和 二次函数的图象与性质', () => {
    const children = jsonDataLoader.getChildrenKnowledgePoints(KP.quadraticFunction)
    const childIds = children.map(k => k.id)
    expect(childIds).toContain(KP.quadraticFnConcept)
    expect(childIds).toContain(KP.quadraticFnGraph)
  })

  it('搜索"对称轴"应返回包含该词的知识点', () => {
    const results = jsonDataLoader.searchKnowledgePoints('对称轴', { gradeLevel: '初中' })
    expect(results.length).toBeGreaterThan(0)
    results.forEach(k => expect(k.name + k.description).toMatch(/对称轴/))
  })
})

// ─── Quiz 2: 一元二次方程 ─────────────────────────────────────────────────────

describe('Quiz 2: 一元二次方程题', () => {
  // 解方程：x² + 5x + 6 = 0

  it('搜索"一元二次方程"应匹配到 id=quadraticEquation 的知识点', () => {
    const results = jsonDataLoader.searchKnowledgePoints('一元二次方程', { gradeLevel: '初中', limit: 20 })
    expect(results.some(k => k.id === KP.quadraticEquation)).toBe(true)
  })

  it('一元二次方程 的层级路径应为: 初中知识点 > 数与代数 > 方程与不等式 > 方程与方程组 > 一元二次方程', () => {
    const path = jsonDataLoader.getKnowledgePointPath(KP.quadraticEquation)
    expect(path.map(k => k.name.trim())).toEqual([
      '初中知识点', '数与代数', '方程与不等式', '方程与方程组', '一元二次方程',
    ])
  })

  it('方程与方程组 的子节点应包含 一元二次方程', () => {
    const children = jsonDataLoader.getChildrenKnowledgePoints(KP.equationGroup)
    expect(children.some(k => k.id === KP.quadraticEquation)).toBe(true)
  })

  it('通过 id 直接查询 一元二次方程 节点应存在', () => {
    const kp = jsonDataLoader.getKnowledgePointById(KP.quadraticEquation)
    expect(kp).toBeDefined()
    expect(kp!.name.trim()).toBe('一元二次方程')
    expect(kp!.gradeLevel).toBe('初中')
  })
})

// ─── Quiz 3: 勾股定理 ─────────────────────────────────────────────────────────

describe('Quiz 3: 勾股定理题', () => {
  // 在直角三角形中，已知两直角边分别为 3 和 4，求斜边长度。

  it('搜索"勾股定理"应匹配到 id=pythagoreanTheorem 的知识点', () => {
    const results = jsonDataLoader.searchKnowledgePoints('勾股定理', { gradeLevel: '初中', limit: 10 })
    expect(results.some(k => k.id === KP.pythagoreanTheorem)).toBe(true)
  })

  it('勾股定理 的层级路径应为: 初中知识点 > 图形与几何 > 图形的性质 > 三角形 > 直角三角形 > 勾股定理', () => {
    const path = jsonDataLoader.getKnowledgePointPath(KP.pythagoreanTheorem)
    expect(path.map(k => k.name.trim())).toEqual([
      '初中知识点', '图形与几何', '图形的性质', '三角形', '直角三角形', '勾股定理',
    ])
  })

  it('直角三角形 的子节点应包含 勾股定理', () => {
    const children = jsonDataLoader.getChildrenKnowledgePoints(KP.rightTriangle)
    expect(children.some(k => k.id === KP.pythagoreanTheorem)).toBe(true)
  })

  it('搜索"直角三角形"应返回包含该词的知识点，并包含 rightTriangle 节点', () => {
    const results = jsonDataLoader.searchKnowledgePoints('直角三角形', { gradeLevel: '初中', limit: 20 })
    expect(results.some(k => k.id === KP.rightTriangle)).toBe(true)
  })
})

// ─── Cross-quiz: Root Node & Statistics ───────────────────────────────────────

describe('Data Integrity', () => {
  it('初中知识点 是所有初中数学知识点的根节点（parentId = null）', () => {
    const root = jsonDataLoader.getKnowledgePointById(KP.juniorRoot)
    expect(root).toBeDefined()
    expect(root!.parentId).toBeNull()
  })

  it('根节点的路径长度为 1（只含自身）', () => {
    const path = jsonDataLoader.getKnowledgePointPath(KP.juniorRoot)
    expect(path.length).toBe(1)
    expect(path[0].id).toBe(KP.juniorRoot)
  })

  it('数据库共加载 > 10000 个知识点', () => {
    const all = jsonDataLoader.getAllKnowledgePoints()
    expect(all.length).toBeGreaterThan(10_000)
  })
})
