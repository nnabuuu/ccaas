/**
 * Path-Dependent Leaf Node Tests
 *
 * 测试"名称本身无法单独表达语义"的叶节点。
 * 这类节点的 name 字段是模糊甚至完全无意义的，只有结合完整路径才能理解。
 *
 * 典型例子：
 *   "b"   单独来看 → 无意义
 *   "b"   + 路径   → 识字与写字 > 拼音 > 声母 > b（汉语拼音声母）
 *
 *   "日本" 单独来看 → 地理？历史？
 *   "日本" 在高中-地理 → 世界地理 > 东半球的地区和国家 > 日本（区域地理概念）
 *   "日本" 在高中-历史 → 世界古代文明 > 中古时期的亚洲 > 日本（历史事件背景）
 *
 * 测试验证两件事：
 *   1. batchSearchKnowledgePoints 能找到这些路径依赖节点
 *   2. getKnowledgePointPath 能重建完整上下文路径（Agent 依赖路径来理解节点含义）
 *
 * 四个类别：
 *   A: 拼音声母韵母  — 用户举的具体例子（b/p/a/o）
 *   B: 标点符号       — 同一名称在不同学段代表相同概念，路径确认学段
 *   C: 地名跨科消歧   — "日本"在地理和历史中的不同语境
 *   D: 物理/历史短词  — 熵、功、北京人（专有概念缩写）
 *
 * IDs 经数据验证（data/subjects/ 文件 + getKnowledgePointPath 实跑）
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { jsonDataLoader } from '../json-data-loader.js'

// ─── Subject IDs ──────────────────────────────────────────────────────────────
const SUBJECTS = {
  xiaoxue_yuwen:  'b0e09778-0968-4313-a335-f61d541cc838',  // 小学-语文
  zhongxue_yuwen: '013a2410-f817-487b-af58-9447a08311ac',  // 初中-语文
  zhongxue_lishi: '44a5a5fc-8614-40e7-a58c-9250266985ab',  // 初中-历史
  gaozhong_dili:  '107aeda0-45bd-4675-9239-2e1512b56d7a',  // 高中-地理
  gaozhong_lishi: '6b1127fe-54aa-4794-b51a-f15523caf7c5',  // 高中-历史
  gaozhong_wuli:  'dde96d5f-cc45-40f4-9d15-7324a75a10c5',  // 高中-物理
} as const

// ─── Leaf IDs (confirmed via data inspection) ─────────────────────────────────
const LEAVES = {
  // 小学-语文 / 识字与写字 / 拼音 / 声母
  shengmu_b: '1998702114322374663',  // b
  shengmu_p: '1998702114322374664',  // p
  shengmu_m: '1998702114322374665',  // m
  shengmu_f: '1998702114322374666',  // f

  // 小学-语文 / 识字与写字 / 拼音 / 韵母
  yunmu_a: '1998702114322374687',    // a
  yunmu_o: '1998702114322374688',    // o
  yunmu_i: '1998702114322374690',    // i

  // 初中-语文 / 梳理与探究 / 标点符号
  biaodian_juehao_zhongxue:  '1998702114322394738',  // 句号
  biaodian_wenhao_zhongxue:  '1998702114322394739',  // 问号
  biaodian_yinhao_zhongxue:  '1998702114322394745',  // 引号

  // 小学-语文 / 梳理与探究 / 标点符号
  biaodian_juehao_xiaoxue: '1998702114322375377',    // 句号
  biaodian_yinhao_xiaoxue: '1998702114322375370',    // 引号

  // 高中-地理 / 世界地理 / 东半球的地区和国家
  dili_yaxiou:   '1998702114322393929',  // 亚洲
  dili_riben:    '1998702114322393932',  // 日本

  // 高中-历史 / 古代史 / 世界古代文明 / 中古时期的亚洲
  lishi_riben:   '1998702114322388973',  // 日本（历史语境）

  // 初中-历史 / 中国古代史 / 史前时期 / 中国早期人类的代表
  beijing_ren:   '1998702114322387923',  // 北京人
  shandingdong_ren: '1998702114322387924', // 山顶洞人

  // 高中-物理 / 热学 / 热力学定律
  shang:    '1998702114322403453',    // 熵

  // 高中-物理 / 能量与动量 / 机械能 / 功和能
  gong:     '1998702114322403179',    // 功
} as const

beforeAll(() => { jsonDataLoader.load() })

// ─── 通用工具：将 path 名称列表转为 trim 后的字符串数组 ──────────────────────
function pathNames(id: string): string[] {
  return jsonDataLoader.getKnowledgePointPath(id).map(kp => kp.name.trim())
}

// ─── Category A: 拼音声母韵母 ─────────────────────────────────────────────────

describe('Category A: 拼音声母韵母（小学-语文）', () => {
  it('A1: 搜索 ["声母","b"] 找到叶节点 b，路径完整包含 声母 > b', () => {
    // 题目示例："下列哪个字母是声母？ b / o / e"
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['声母', 'b'],
      { subjectId: SUBJECTS.xiaoxue_yuwen, leafOnly: true },
    )
    const b_node = results.find(r => r.id === LEAVES.shengmu_b)
    expect(b_node).toBeDefined()
    expect(b_node!.children).toHaveLength(0)              // 确认是叶节点

    // 路径重建：Agent 须通过路径才能知道 "b" 指的是拼音声母
    const path = pathNames(LEAVES.shengmu_b)
    expect(path).toHaveLength(5)
    expect(path[2]).toBe('拼音')      // 明确是拼音域
    expect(path[3]).toBe('声母')      // 明确是声母（而非韵母）
    expect(path[4]).toBe('b')         // 叶节点名称
  })

  it('A2: 搜索 ["声母","p"] 找到叶节点 p，路径与 b 同属声母，不混入韵母', () => {
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['声母', 'p'],
      { subjectId: SUBJECTS.xiaoxue_yuwen, leafOnly: true },
    )
    const p_node = results.find(r => r.id === LEAVES.shengmu_p)
    expect(p_node).toBeDefined()
    expect(p_node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.shengmu_p)
    expect(path[3]).toBe('声母')      // 声母，非韵母
    expect(path[4]).toBe('p')
  })

  it('A3: 搜索 ["韵母","a"] 找到叶节点 a（韵母），路径与声母中的 a 字母无关', () => {
    // a 既可能是声母（无），也可能是韵母。路径区分两者。
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['韵母', 'a'],
      { subjectId: SUBJECTS.xiaoxue_yuwen, leafOnly: true },
    )
    const a_node = results.find(r => r.id === LEAVES.yunmu_a)
    expect(a_node).toBeDefined()
    expect(a_node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.yunmu_a)
    expect(path[3]).toBe('韵母')      // 路径明确标注"韵母"，消除歧义
    expect(path[4]).toBe('a')
  })

  it('A4: 声母/韵母 路径深度为 5，父节点 声母 本身也在路径中', () => {
    // 验证路径层级结构完整，Agent 可以向上追溯
    const bPath  = pathNames(LEAVES.shengmu_b)
    const oPath  = pathNames(LEAVES.yunmu_o)

    expect(bPath).toEqual(['2022版知识图谱', '识字与写字', '拼音', '声母', 'b'])
    expect(oPath).toEqual(['2022版知识图谱', '识字与写字', '拼音', '韵母', 'o'])

    // 根节点相同（同属小学-语文知识体系）
    expect(bPath[0]).toBe(oPath[0])
    // 领域节点相同（同属拼音）
    expect(bPath[2]).toBe('拼音')
    expect(oPath[2]).toBe('拼音')
    // 类型节点不同（声母 vs 韵母）
    expect(bPath[3]).not.toBe(oPath[3])
  })
})

// ─── Category B: 标点符号（同名，不同学段）───────────────────────────────────

describe('Category B: 标点符号（同一名称，路径区分学段）', () => {
  it('B1: 小学-语文 中搜索 ["标点","句号"] 找到叶节点 句号，路径含 小学 知识体系', () => {
    // "句号用在句子末尾，表示陈述语气" — 小学题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['标点', '句号'],
      { subjectId: SUBJECTS.xiaoxue_yuwen, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.biaodian_juehao_xiaoxue)
    expect(node).toBeDefined()
    expect(node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.biaodian_juehao_xiaoxue)
    expect(path[2]).toBe('标点符号')
    expect(path[3]).toBe('句号')
    expect(path[0]).toMatch(/2022版/)  // 小学-语文 特有根节点
  })

  it('B2: 初中-语文 中搜索 ["标点","句号"] 找到不同叶节点，路径含 初中 知识体系', () => {
    // "下列句子标点符号使用正确的是？" — 初中题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['标点', '句号'],
      { subjectId: SUBJECTS.zhongxue_yuwen, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.biaodian_juehao_zhongxue)
    expect(node).toBeDefined()
    expect(node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.biaodian_juehao_zhongxue)
    expect(path[2]).toBe('标点符号')
    expect(path[3]).toBe('句号')
    expect(path[0]).toMatch(/初中知识点/)  // 初中-语文 特有根节点
  })

  it('B3: 两个"句号"叶节点的 ID 不同，但路径结构相似（仅根节点不同）', () => {
    // 验证：同一概念在两个学段各有独立节点，不共享
    expect(LEAVES.biaodian_juehao_xiaoxue).not.toBe(LEAVES.biaodian_juehao_zhongxue)

    const xiaoxue_path = pathNames(LEAVES.biaodian_juehao_xiaoxue)
    const zhongxue_path = pathNames(LEAVES.biaodian_juehao_zhongxue)

    // 叶节点名称相同
    expect(xiaoxue_path.at(-1)).toBe('句号')
    expect(zhongxue_path.at(-1)).toBe('句号')

    // 父节点名称相同
    expect(xiaoxue_path.at(-2)).toBe('标点符号')
    expect(zhongxue_path.at(-2)).toBe('标点符号')

    // 根节点不同（区分学段）
    expect(xiaoxue_path[0]).not.toBe(zhongxue_path[0])
  })

  it('B4: 引号在初中-语文中的路径可消歧（是"引号用法"而非其他）', () => {
    // "下面句子中引号的用法是表示强调还是引用？" — 初中题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['引号', '标点'],
      { subjectId: SUBJECTS.zhongxue_yuwen, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.biaodian_yinhao_zhongxue)
    expect(node).toBeDefined()

    const path = pathNames(LEAVES.biaodian_yinhao_zhongxue)
    // 完整路径：初中知识点 > 梳理与探究 > 标点符号 > 引号
    expect(path).toEqual(['初中知识点', '梳理与探究', '标点符号', '引号'])
  })
})

// ─── Category C: 地名跨学科消歧 ─────────────────────────────────────────────

describe('Category C: 地名跨学科消歧（高中-地理 vs 高中-历史）', () => {
  it('C1: "日本" 在高中-地理 中路径指向区域地理概念', () => {
    // "日本的工业主要分布在哪些地区？" — 地理题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['日本', '地理'],
      { subjectId: SUBJECTS.gaozhong_dili, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.dili_riben)
    expect(node).toBeDefined()
    expect(node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.dili_riben)
    // 路径：高地知识点 > 世界地理 > 东半球的地区和国家 > 日本
    expect(path[1]).toBe('世界地理')
    expect(path[2]).toBe('东半球的地区和国家')  // 上下文：区域地理
    expect(path[3]).toBe('日本')
  })

  it('C2: "日本" 在高中-历史 中路径指向历史事件背景（中古时期）', () => {
    // "中古时期日本效仿唐朝进行了哪些改革？" — 历史题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['日本', '历史'],
      { subjectId: SUBJECTS.gaozhong_lishi, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.lishi_riben)
    expect(node).toBeDefined()
    expect(node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.lishi_riben)
    // 路径：高中历史知识点 > 古代史 > 世界古代文明 > 中古时期的亚洲 > 日本
    expect(path[2]).toBe('世界古代文明')   // 上下文：历史文明
    expect(path[3]).toBe('中古时期的亚洲') // 历史时期明确
    expect(path[4]).toBe('日本')
  })

  it('C3: 两个"日本"叶节点的 ID 不同，子学科过滤正确区分', () => {
    // 同一地名在不同学科中是完全不同的知识点
    expect(LEAVES.dili_riben).not.toBe(LEAVES.lishi_riben)

    const dili_path  = pathNames(LEAVES.dili_riben)
    const lishi_path = pathNames(LEAVES.lishi_riben)

    // 叶节点名称相同
    expect(dili_path.at(-1)).toBe('日本')
    expect(lishi_path.at(-1)).toBe('日本')

    // 父节点不同（核心消歧点）
    expect(dili_path.at(-2)).toBe('东半球的地区和国家') // 地理父节点
    expect(lishi_path.at(-2)).toBe('中古时期的亚洲')    // 历史父节点

    // 根节点不同（学科标识）
    expect(dili_path[0]).toBe('高地知识点')
    expect(lishi_path[0]).toBe('高中历史知识点')
  })

  it('C4: "亚洲"在高中-地理 中路径提供区域地理背景', () => {
    // "亚洲地形的主要特征是什么？" — 地理题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['亚洲'],
      { subjectId: SUBJECTS.gaozhong_dili, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.dili_yaxiou)
    expect(node).toBeDefined()
    expect(node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.dili_yaxiou)
    expect(path).toEqual(['高地知识点', '世界地理', '东半球的地区和国家', '亚洲'])
  })
})

// ─── Category D: 物理/历史短词 ────────────────────────────────────────────────

describe('Category D: 物理/历史单词/短词路径依赖', () => {
  it('D1: "熵" 在高中-物理 中路径指向热力学定律下的具体概念', () => {
    // "根据热力学第二定律，熵变的方向是？" — 高中物理题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['熵', '热力学'],
      { subjectId: SUBJECTS.gaozhong_wuli, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.shang)
    expect(node).toBeDefined()
    expect(node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.shang)
    // 路径：知识点(高中) > 热学 > 热力学定律 > 熵
    expect(path[1]).toBe('热学')
    expect(path[2]).toBe('热力学定律')  // 上下文：热力学，而非化学或其他
    expect(path[3]).toBe('熵')
  })

  it('D2: "功" 在高中-物理 中路径指向机械能领域（而非初中-物理的功）', () => {
    // "用力F推一个物体移动距离s，功是多少？" — 物理题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['功', '机械能'],
      { subjectId: SUBJECTS.gaozhong_wuli, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.gong)
    expect(node).toBeDefined()
    expect(node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.gong)
    // 路径：知识点(高中) > 能量与动量 > 机械能 > 功和能 > 功
    expect(path[1]).toBe('能量与动量')
    expect(path[2]).toBe('机械能')
    expect(path[3]).toBe('功和能')   // "功和能" 这个父节点消除了"功"的歧义
    expect(path[4]).toBe('功')
  })

  it('D3: "北京人" 在初中-历史 中路径指向史前人类而非现代北京', () => {
    // "北京人是中国何时的古人类？使用什么工具？" — 初中历史题
    const results = jsonDataLoader.batchSearchKnowledgePoints(
      ['北京人', '史前'],
      { subjectId: SUBJECTS.zhongxue_lishi, leafOnly: true },
    )
    const node = results.find(r => r.id === LEAVES.beijing_ren)
    expect(node).toBeDefined()
    expect(node!.children).toHaveLength(0)

    const path = pathNames(LEAVES.beijing_ren)
    // 路径：初中历史知识点 > 中国古代史 > 史前时期 > 中国早期人类的代表 > 北京人
    expect(path[2]).toBe('史前时期')
    expect(path[3]).toBe('中国早期人类的代表')  // 消歧：是"早期人类"而非地名
    expect(path[4]).toBe('北京人')
  })

  it('D4: "山顶洞人" 与 "北京人" 同属一个父节点，路径证明是同类概念', () => {
    // 验证两个节点有相同的父节点（说明是同类知识点，可以在同一道题中一起考）
    const beijing_path  = pathNames(LEAVES.beijing_ren)
    const shandingdong_path = pathNames(LEAVES.shandingdong_ren)

    // 同级：父节点名称相同
    expect(beijing_path.at(-2)).toBe('中国早期人类的代表')
    expect(shandingdong_path.at(-2)).toBe('中国早期人类的代表')

    // 叶节点名称不同
    expect(beijing_path.at(-1)).toBe('北京人')
    expect(shandingdong_path.at(-1)).toBe('山顶洞人')
  })
})

// ─── 路径重建功能验证 ─────────────────────────────────────────────────────────

describe('getKnowledgePointPath 功能验证', () => {
  it('路径首节点是根节点（parentId = null）', () => {
    const cases = [
      LEAVES.shengmu_b,
      LEAVES.dili_riben,
      LEAVES.lishi_riben,
      LEAVES.shang,
    ]
    for (const id of cases) {
      const path = jsonDataLoader.getKnowledgePointPath(id)
      expect(path[0].parentId).toBeNull()  // 根节点无父节点
    }
  })

  it('路径末节点是目标叶节点', () => {
    const cases = [
      LEAVES.shengmu_b,
      LEAVES.yunmu_a,
      LEAVES.biaodian_juehao_zhongxue,
      LEAVES.dili_riben,
      LEAVES.lishi_riben,
    ]
    for (const id of cases) {
      const path = jsonDataLoader.getKnowledgePointPath(id)
      expect(path.at(-1)!.id).toBe(id)
      expect(path.at(-1)!.children).toHaveLength(0)  // 末节点是叶节点
    }
  })

  it('路径长度等于节点 level + 1（level 从 1 起，根节点 level 通常为 1）', () => {
    // 注：小学-语文声母路径深度为 5（level=5 对应 path.length=5）
    const b_path = jsonDataLoader.getKnowledgePointPath(LEAVES.shengmu_b)
    const b_node = jsonDataLoader.getKnowledgePointById(LEAVES.shengmu_b)!
    expect(b_path.length).toBe(b_node.level)  // level=5 → 路径有 5 个节点
  })

  it('路径中父节点的 children 列表包含其子节点 ID', () => {
    // 声母父节点应包含 b, p, m, f 等声母的 ID
    const b_path = jsonDataLoader.getKnowledgePointPath(LEAVES.shengmu_b)
    const shengmu_node = b_path[3]  // 声母节点（path 的第 4 个节点）

    expect(shengmu_node.name.trim()).toBe('声母')
    expect(shengmu_node.children).toContain(LEAVES.shengmu_b)
    expect(shengmu_node.children).toContain(LEAVES.shengmu_p)
    expect(shengmu_node.children).toContain(LEAVES.shengmu_m)
  })
})
