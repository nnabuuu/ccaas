/**
 * Leaf-Priority Knowledge Point Matching Tests
 *
 * Verifies that batchSearchKnowledgePoints with leafOnly: true
 * returns ONLY leaf nodes (children === []) — the most specific
 * knowledge points — rather than intermediate parent nodes.
 *
 * The actual data has much deeper hierarchies than typically assumed.
 * Nodes like "勾股定理", "一元二次方程", "二次函数的图象与性质" are
 * all intermediate parents with leaf children beneath them.
 *
 * Three test categories:
 * A: Single leaf concept  — one specific subtopic
 * B: Multiple sibling leaves — same parent, different aspects
 * C: Multiple cross-branch leaves — different domain branches
 *
 * Confirmed hierarchy (from data inspection):
 *   一次函数 (parent)
 *   ├── 一次函数的解析式 (LEAF) ← key
 *   ├── 一次函数的图象与性质 (parent)
 *   │   ├── 一次函数的图象的特点 (LEAF) ← key
 *   │   └── k,b对一次函数图象及性质的影响 (LEAF)
 *   └── 一次函数图像的交点问题 (LEAF) ← key
 *
 *   二次函数 (parent)
 *   ├── 二次函数的概念 (LEAF) ← key
 *   ├── 二次函数的图象与性质 (parent)
 *   │   ├── 描点法画二次函数图象 (LEAF) ← key
 *   │   └── 二次函数的性质 (parent)
 *   │       └── 二次函数的对称轴 (LEAF) ← key
 *   └── 二次函数的图象变换 (LEAF)
 *
 *   反比例函数 (parent)
 *   ├── 反比例函数的图象与性质 (parent)
 *   │   └── 反比例函数的图象变换 [sibling] (LEAF) ← key
 *   └── 反比例函数的图象变换 (LEAF) ← key
 *
 *   勾股定理 (parent)
 *   ├── 勾股定理及其证明 (LEAF) ← key
 *   └── 勾股定理的实际应用 (LEAF)
 *
 *   一元二次方程 (parent)
 *   ├── 一元二次方程的概念 (LEAF) ← key
 *   └── 一元二次方程根的判别式 (LEAF)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { jsonDataLoader } from '../json-data-loader.js'

// ─── Parent nodes (confirmed: have children, should NOT appear with leafOnly) ─
const PARENTS = {
  linearFunction:           '1998702114322399906', // 一次函数
  linearFnGraph:            '1998702114322399909', // 一次函数的图象与性质
  quadraticFunction:        '1998702114322399941', // 二次函数
  quadraticFnGraph:         '1998702114322399943', // 二次函数的图象与性质
  inverseProportionFn:      '1998702114322399976', // 反比例函数
  inverseProportionFnGraph: '1998702114322399980', // 反比例函数的图象与性质
  quadraticEquation:        '1998702114322399803', // 一元二次方程
  rightTriangle:            '1998702114322400153', // 直角三角形
  pythagoreanTheorem:       '1998702114322400154', // 勾股定理
} as const

// ─── Actual leaf nodes (confirmed: children === []) ──────────────────────────
const LEAVES = {
  // 一次函数 branch leaves
  linearFnExpression:       '1998702114322399908', // 一次函数的解析式
  linearFnIntersection:     '1998702114322399922', // 一次函数图像的交点问题
  linearFnGraphFeature:     '1998702114322399910', // 一次函数的图象的特点

  // 二次函数 branch leaves
  quadraticFnConcept:       '1998702114322399942', // 二次函数的概念
  quadraticFnSymmetryAxis:  '1998702114322399955', // 二次函数的对称轴
  quadraticFnDrawing:       '1998702114322399944', // 描点法画二次函数图象

  // 反比例函数 branch leaves
  inverseFnGraphTransform:  '1998702114322399990', // 反比例函数的图象变换

  // 勾股定理 branch leaves
  pythagoreanProof:         '1998702114322400157', // 勾股定理及其证明

  // 一元二次方程 branch leaves
  quadEqConcept:            '1998702114322399804', // 一元二次方程的概念
} as const

beforeAll(() => { jsonDataLoader.load() })

// ─── Invariant: All leafOnly results must be leaf nodes ──────────────────────

describe('leafOnly invariant', () => {
  it('所有 leafOnly 结果的 children 数组均为空', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数', '图象'],
      { gradeLevel: '初中', leafOnly: true },
    )
    expect(results.length).toBeGreaterThan(0)
    results.forEach(r => expect(r.children).toHaveLength(0))
  })

  it('不加 leafOnly 时，中间父节点可能出现在结果中', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数'],
      { gradeLevel: '初中' },
    )
    // 二次函数 (parent) matches keyword and appears without leafOnly
    const hasParent = results.some(r => r.id === PARENTS.quadraticFunction)
    expect(hasParent).toBe(true)
  })
})

// ─── Category A: 单一叶节点 ──────────────────────────────────────────────────

describe('Category A: 单一叶节点', () => {
  it('A1: 二次函数对称轴题 → 叶节点 二次函数的对称轴，不含父节点 二次函数', () => {
    // f(x) = x² - 4x + 3，求顶点坐标和对称轴
    // 注：数据中 "二次函数的图象与性质" 是父节点，其叶后代包含 "二次函数的对称轴"
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数', '图象', '对称轴'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.quadraticFnSymmetryAxis) // 二次函数的对称轴 (leaf) ✅
    expect(ids).not.toContain(PARENTS.quadraticFunction)  // 二次函数 (parent) ❌
    expect(ids).not.toContain(PARENTS.quadraticFnGraph)   // 二次函数的图象与性质 (parent) ❌
  })

  it('A2: 一次函数解析式题 → 叶节点 一次函数的解析式，不含父节点 一次函数', () => {
    // 直线 y = kx + b 经过点(1, 3)和(-1, -1)，用待定系数法求解析式
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '解析式'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.linearFnExpression)    // 一次函数的解析式 (leaf) ✅
    expect(ids).not.toContain(PARENTS.linearFunction)   // 一次函数 (parent) ❌
  })

  it('A3: 勾股定理题 → 叶节点 勾股定理及其证明，不含父节点 勾股定理 和 直角三角形', () => {
    // 直角三角形中两直角边为 3 和 4，用勾股定理求斜边
    // 注：数据中 "勾股定理" 是父节点，叶后代包含 "勾股定理及其证明" 等
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['勾股定理', '直角三角形'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.pythagoreanProof)        // 勾股定理及其证明 (leaf) ✅
    expect(ids).not.toContain(PARENTS.pythagoreanTheorem) // 勾股定理 (parent) ❌
    expect(ids).not.toContain(PARENTS.rightTriangle)      // 直角三角形 (parent) ❌
  })
})

// ─── Category B: 多叶节点·同一父节点（sibling leaves）──────────────────────

describe('Category B: 多叶节点·同一父节点', () => {
  it('B1: 一次函数解析式+图象题 → 两个兄弟叶节点均出现，父节点 一次函数 不出现', () => {
    // y = kx + b 过(1,3)(2,5)，求解析式，分析单调性，判断是否过原点
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '解析式', '图象', '单调性'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.linearFnExpression)   // 一次函数的解析式 (leaf) ✅
    expect(ids).toContain(LEAVES.linearFnGraphFeature) // 一次函数的图象的特点 (leaf) ✅
    expect(ids).not.toContain(PARENTS.linearFunction)  // 一次函数 (parent) ❌
    expect(ids).not.toContain(PARENTS.linearFnGraph)   // 一次函数的图象与性质 (parent) ❌
  })

  it('B2: 二次函数概念+对称轴题 → 两个兄弟叶节点均出现，父节点 二次函数 不出现', () => {
    // 抛物线过(-1,0)(1,-4)(3,0)，写解析式、画图象、求顶点和对称轴
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数', '解析式', '图象', '顶点', '对称轴'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.quadraticFnConcept)      // 二次函数的概念 (leaf) ✅
    expect(ids).toContain(LEAVES.quadraticFnSymmetryAxis) // 二次函数的对称轴 (leaf) ✅
    expect(ids).not.toContain(PARENTS.quadraticFunction)  // 二次函数 (parent) ❌
    expect(ids).not.toContain(PARENTS.quadraticFnGraph)   // 二次函数的图象与性质 (parent) ❌
  })

  it('B3: 一次函数交点+图象题 → 两个兄弟叶节点均出现，父节点 一次函数 不出现', () => {
    // 两直线 y₁=2x+1 和 y₂=x+3，求交点，分析交点两侧大小关系
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '交点', '图象'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.linearFnIntersection)  // 一次函数图像的交点问题 (leaf) ✅
    expect(ids).toContain(LEAVES.linearFnGraphFeature)  // 一次函数的图象的特点 (leaf) ✅
    expect(ids).not.toContain(PARENTS.linearFunction)   // 一次函数 (parent) ❌
    expect(ids).not.toContain(PARENTS.linearFnGraph)    // 一次函数的图象与性质 (parent) ❌
  })
})

// ─── Category C: 多叶节点·不同父节点分支（cross-branch leaves）─────────────

describe('Category C: 多叶节点·不同父节点分支', () => {
  it('C1: 一次函数+勾股定理综合题 → 函数分支叶 和 几何分支叶同时命中', () => {
    // 直线 y=x+1 与直角三角形某边共线，已知直角三角形相关条件，求斜边
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '勾股定理'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.linearFnExpression)      // 函数分支叶（一次函数匹配）✅
    expect(ids).toContain(LEAVES.pythagoreanProof)        // 几何分支叶（勾股定理匹配）✅
    expect(ids).not.toContain(PARENTS.linearFunction)     // 函数父节点 ❌
    expect(ids).not.toContain(PARENTS.pythagoreanTheorem) // 几何父节点 ❌
    expect(ids).not.toContain(PARENTS.rightTriangle)      // 几何父节点 ❌
  })

  it('C2: 二次函数+一元二次方程综合题 → 函数分支叶 和 方程分支叶同时命中', () => {
    // f(x)=x²-5x+6，求 f(x)=0 实数根，分析抛物线与 x 轴交点
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['二次函数', '一元二次方程', '图象', '交点'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.quadraticFnDrawing)      // 函数→二次函数叶（图象匹配）✅
    expect(ids).toContain(LEAVES.quadEqConcept)           // 方程叶（一元二次方程匹配）✅
    expect(ids).not.toContain(PARENTS.quadraticFunction)  // 函数父节点 ❌
    expect(ids).not.toContain(PARENTS.quadraticEquation)  // 方程父节点 ❌
  })

  it('C3: 反比例函数+一次函数交点综合题 → 同父函数分支下不同 level-4 叶节点', () => {
    // y=6/x 与 y=x+1 在第一象限的交点，分析两图象位置关系
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['反比例函数', '一次函数', '图象', '交点'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const ids = results.map(r => r.id)
    expect(ids).toContain(LEAVES.inverseFnGraphTransform) // 反比例函数分支叶（图象匹配）✅
    expect(ids).toContain(LEAVES.linearFnIntersection)    // 一次函数分支叶（交点匹配）✅
    expect(ids).not.toContain(PARENTS.inverseProportionFn)      // 父节点 ❌
    expect(ids).not.toContain(PARENTS.inverseProportionFnGraph) // 父节点 ❌
    expect(ids).not.toContain(PARENTS.linearFunction)           // 父节点 ❌
  })
})

// ─── Fallback & Score preservation ───────────────────────────────────────────

describe('Fallback: leafOnly 回退与评分', () => {
  it('完全无匹配时返回空数组（leafOnly 不影响空结果）', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['这个知识点绝对不存在xyz123'],
      { gradeLevel: '初中', leafOnly: true },
    )
    expect(results).toHaveLength(0)
  })

  it('leafOnly 不改变匹配节点的 matchScore 和 matchedKeywords', () => {
    // 一次函数的解析式 是一个确认的叶节点，在两种模式下分数应相同
    const withLeaf = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '解析式'],
      { gradeLevel: '初中', leafOnly: true },
    )
    const withoutLeaf = jsonDataLoader.batchSearchKnowledgePoints(
      ['一次函数', '解析式'],
      { gradeLevel: '初中' },
    )
    const leafEntry    = withLeaf.find(r => r.id === LEAVES.linearFnExpression)
    const nonLeafEntry = withoutLeaf.find(r => r.id === LEAVES.linearFnExpression)
    expect(leafEntry).toBeDefined()
    expect(nonLeafEntry).toBeDefined()
    expect(leafEntry!.matchScore).toBe(nonLeafEntry!.matchScore)
    expect(leafEntry!.matchedKeywords.sort()).toEqual(nonLeafEntry!.matchedKeywords.sort())
  })
})
