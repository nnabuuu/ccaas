/**
 * Cross-subject evaluation: does batchSearch + leafOnly work across all 21 subjects?
 *
 * For each subject we run 3 realistic quiz keyword queries and report:
 *  - top-3 results (name, isLeaf, score, matchedKeywords)
 *  - whether leafOnly actually filtered parents
 *  - red flags (empty results, all-parent results, score ties)
 */

import { jsonDataLoader } from './dist/json-data-loader.js';

jsonDataLoader.load();

// ── SUBJECT IDs (from data/subjects/ filenames) ─────────────────────────
const SUBJECTS = {
  '小学-数学':     '1155be3f-391a-4b0d-9f0c-a78d7d36800e',
  '小学-语文':     'b0e09778-0968-4313-a335-f61d541cc838',
  '小学-英语':     '4fa62c23-a13a-4b6a-9781-33f492dd041f',
  '初中-数学':     '3601171b-5ac9-46ba-8dec-2022b42b0fa5',
  '初中-语文':     '013a2410-f817-487b-af58-9447a08311ac',
  '初中-英语':     '0acaab37-fe7e-4054-a7a4-8443115d8ed5',
  '初中-物理':     'b7a84c9e-36e2-45ed-8a70-669bf044b861',
  '初中-化学':     'b9bbfd17-9d61-4b6a-81e2-8fa3033d3ad4',
  '初中-生物学':   'ef4ccf49-e3fe-4eed-8f68-b355b76e937f',
  '初中-历史':     '44a5a5fc-8614-40e7-a58c-9250266985ab',
  '初中-地理':     '8b5c5962-0b09-4b96-857d-10f00fdac665',
  '初中-道德与法治': '8927adef-f214-46f0-a2d6-45cf9f6cf357',
  '高中-数学':     'de8cb5ee-1f32-4c26-bbb9-8aba82f38880',
  '高中-语文':     '7f7cd3ff-c1af-4239-a6a5-056b9546132a',
  '高中-英语':     'c76f8bbb-6329-439d-ba9b-3e90841974c0',
  '高中-物理':     'dde96d5f-cc45-40f4-9d15-7324a75a10c5',
  '高中-化学':     '40ea8701-e720-4215-bbf7-38fb7018eaee',
  '高中-生物学':   '74e5f7c3-13a2-4e95-9597-11dbc439f864',
  '高中-历史':     '6b1127fe-54aa-4794-b51a-f15523caf7c5',
  '高中-地理':     '107aeda0-45bd-4675-9239-2e1512b56d7a',
  '高中-思想政治': 'e1b45e68-6764-4f9c-977d-a86b36685d71',
};

// ── TEST CASES per subject ───────────────────────────────────────────────
// Each case: { label, keywords, gradeLevel }
const CASES = {
  '小学-数学': [
    { label: '分数加减',   keywords: ['分数', '加减法'] },
    { label: '长方形面积', keywords: ['面积', '长方形'] },
    { label: '乘法口诀',   keywords: ['乘法', '口诀'] },
  ],
  '小学-语文': [
    { label: '古诗默写',   keywords: ['古诗', '默写'] },
    { label: '段落主旨',   keywords: ['段落', '主旨'] },
    { label: '修辞比喻',   keywords: ['修辞', '比喻'] },
  ],
  '小学-英语': [
    { label: '字母音标',   keywords: ['字母', '音标'] },
    { label: '句型语法',   keywords: ['句型', '语法'] },
    { label: '单词拼写',   keywords: ['单词', '拼写'] },
  ],
  '初中-数学': [
    { label: '一次方程',   keywords: ['方程', '一次'] },
    { label: '因式分解',   keywords: ['因式分解', '十字相乘'] },
    { label: '概率随机',   keywords: ['概率', '随机事件'] },
  ],
  '初中-语文': [
    { label: '文言虚词',   keywords: ['文言文', '虚词'] },
    { label: '议论论点',   keywords: ['议论文', '论点'] },
    { label: '修辞排比',   keywords: ['修辞', '排比'] },
  ],
  '初中-英语': [
    { label: '一般现在时', keywords: ['时态', '一般现在时'] },
    { label: '被动语态',   keywords: ['被动语态', '动词'] },
    { label: '阅读推断',   keywords: ['阅读', '推断'] },
  ],
  '初中-物理': [
    { label: '摩擦力',     keywords: ['摩擦力', '接触面'] },
    { label: '欧姆定律',   keywords: ['欧姆定律', '电流', '电阻'] },
    { label: '浮力密度',   keywords: ['浮力', '密度'] },
  ],
  '初中-化学': [
    { label: '氧化物',     keywords: ['氧化', '化合物'] },
    { label: '酸碱中和',   keywords: ['酸', '碱', '中和'] },
    { label: '原子分子',   keywords: ['原子', '分子'] },
  ],
  '初中-生物学': [
    { label: '光合作用',   keywords: ['光合作用', '叶绿体'] },
    { label: '细胞分裂',   keywords: ['细胞', '分裂'] },
    { label: '遗传染色体', keywords: ['遗传', '染色体'] },
  ],
  '初中-历史': [
    { label: '秦朝统一',   keywords: ['秦朝', '统一'] },
    { label: '唐朝盛世',   keywords: ['唐朝', '经济'] },
    { label: '近代列强',   keywords: ['鸦片战争', '列强'] },
  ],
  '初中-地理': [
    { label: '气候类型',   keywords: ['气候', '温带'] },
    { label: '地形地貌',   keywords: ['地形', '山脉'] },
    { label: '中国河流',   keywords: ['河流', '流域'] },
  ],
  '初中-道德与法治': [
    { label: '法律权利',   keywords: ['法律', '权利'] },
    { label: '公民责任',   keywords: ['公民', '责任'] },
    { label: '青春心理',   keywords: ['青春', '心理'] },
  ],
  '高中-数学': [
    { label: '导数极值',   keywords: ['导数', '极值'] },
    { label: '排列组合',   keywords: ['排列', '组合'] },
    { label: '向量数量积', keywords: ['向量', '数量积'] },
  ],
  '高中-语文': [
    { label: '文言虚词',   keywords: ['文言文', '虚词'] },
    { label: '现代诗意象', keywords: ['现代诗', '意象'] },
    { label: '议论文立意', keywords: ['议论文', '立意'] },
  ],
  '高中-英语': [
    { label: '虚拟语气',   keywords: ['虚拟语气', '条件句'] },
    { label: '长难句分析', keywords: ['从句', '定语从句'] },
    { label: '写作议论',   keywords: ['写作', '论点'] },
  ],
  '高中-物理': [
    { label: '动量冲量',   keywords: ['动量', '冲量'] },
    { label: '电磁感应',   keywords: ['电磁感应', '楞次定律'] },
    { label: '光电效应',   keywords: ['光电效应', '光子'] },
  ],
  '高中-化学': [
    { label: '原电池',     keywords: ['原电池', '电极'] },
    { label: '有机酯化',   keywords: ['酯化', '有机物'] },
    { label: '氧化还原',   keywords: ['氧化还原', '电子转移'] },
  ],
  '高中-生物学': [
    { label: 'DNA基因',    keywords: ['DNA', '基因'] },
    { label: '光合卡尔文', keywords: ['光合作用', '暗反应'] },
    { label: '免疫抗体',   keywords: ['免疫', '抗体'] },
  ],
  '高中-历史': [
    { label: '工业革命',   keywords: ['工业革命', '蒸汽机'] },
    { label: '二战法西斯', keywords: ['第二次世界大战', '法西斯'] },
    { label: '新中国成立', keywords: ['新民主主义', '解放战争'] },
  ],
  '高中-地理': [
    { label: '气候因素',   keywords: ['气候类型', '影响因素'] },
    { label: '板块运动',   keywords: ['板块', '地壳运动'] },
    { label: '工业区位',   keywords: ['工业', '区位'] },
  ],
  '高中-思想政治': [
    { label: '市场经济',   keywords: ['市场经济', '价值规律'] },
    { label: '文化传承',   keywords: ['文化', '传承'] },
    { label: '民主法治',   keywords: ['民主', '法治'] },
  ],
};

// ── RUNNER ───────────────────────────────────────────────────────────────
const DIVIDER = '─'.repeat(72);
let totalCases = 0;
let emptyResults = [];
let allParents = [];

for (const [subjectName, subjectId] of Object.entries(SUBJECTS)) {
  const gradeLevel = subjectName.startsWith('小学') ? '小学'
                   : subjectName.startsWith('初中') ? '初中' : '高中';
  const cases = CASES[subjectName] || [];

  console.log(`\n${DIVIDER}`);
  console.log(`【${subjectName}】 (${gradeLevel})`);

  for (const { label, keywords } of cases) {
    totalCases++;
    // Run without leafOnly first to see raw results
    const raw  = jsonDataLoader.batchSearchKnowledgePoints(keywords, { subjectId });
    const leaf = jsonDataLoader.batchSearchKnowledgePoints(keywords, { subjectId, leafOnly: true });

    const top3 = leaf.slice(0, 3);
    const leafCount  = leaf.filter(r => r.children.length === 0).length;
    const parentCount = leaf.filter(r => r.children.length > 0).length;
    const fallback = raw.length > 0 && leaf.length === raw.length
      && leaf.every(r => r.children.length > 0); // leafOnly fell back to parents

    console.log(`\n  ▸ [${label}] keywords: ${JSON.stringify(keywords)}`);
    console.log(`    raw=${raw.length} | leafOnly results=${leaf.length} (leaves=${leafCount}, parents=${parentCount}${fallback ? ', ⚠️ FALLBACK' : ''})`);

    if (leaf.length === 0) {
      emptyResults.push(`${subjectName} / ${label}`);
      console.log(`    ❌ 0 results`);
      continue;
    }

    if (parentCount > 0 && leafCount === 0) {
      allParents.push(`${subjectName} / ${label}`);
    }

    for (const r of top3) {
      const leaf_icon = r.children.length === 0 ? '✅叶' : '📁父';
      const keywords_hit = r.matchedKeywords?.join('+') ?? '-';
      console.log(`    ${leaf_icon} [score=${r.matchScore}] ${r.name}  (命中:${keywords_hit})`);
    }
  }
}

console.log(`\n${'═'.repeat(72)}`);
console.log(`SUMMARY  total cases=${totalCases}`);
console.log(`  ❌ 0 results (${emptyResults.length}): ${emptyResults.join(' | ') || 'none'}`);
console.log(`  ⚠️  all-parent fallback (${allParents.length}): ${allParents.join(' | ') || 'none'}`);
console.log(`${'═'.repeat(72)}`);
