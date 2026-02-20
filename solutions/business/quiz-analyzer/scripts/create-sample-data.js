import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../data/quiz-analyzer.db');

console.log('Creating sample data for testing...\n');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// 1. 创建科目
console.log('Creating subjects...');
const mathId = uuidv4();
const physicsId = uuidv4();

db.prepare(`
  INSERT INTO subjects (id, name, code, grade_levels)
  VALUES (?, ?, ?, ?)
`).run(mathId, '数学', 'MATH', JSON.stringify(['7', '8', '9']));

db.prepare(`
  INSERT INTO subjects (id, name, code, grade_levels)
  VALUES (?, ?, ?, ?)
`).run(physicsId, '物理', 'PHYS', JSON.stringify(['8', '9']));

console.log(`✓ Created 2 subjects (Math: ${mathId}, Physics: ${physicsId})`);

// 2. 创建分层知识点
console.log('\nCreating hierarchical knowledge points...');

// 数学知识点树
const algebraId = uuidv4();
const equationId = uuidv4();
const quadraticEqId = uuidv4();
const linearEqId = uuidv4();
const geometryId = uuidv4();
const triangleId = uuidv4();

const mathKnowledgePoints = [
  { id: algebraId, parent: null, name: '代数', level: 0, grade: '7' },
  { id: equationId, parent: algebraId, name: '方程', level: 1, grade: '8' },
  { id: quadraticEqId, parent: equationId, name: '一元二次方程', level: 2, grade: '9' },
  { id: linearEqId, parent: equationId, name: '一元一次方程', level: 2, grade: '7' },
  { id: geometryId, parent: null, name: '几何', level: 0, grade: '7' },
  { id: triangleId, parent: geometryId, name: '三角形', level: 1, grade: '8' },
];

mathKnowledgePoints.forEach(kp => {
  db.prepare(`
    INSERT INTO knowledge_points
    (id, subject_id, parent_id, name, level, grade_level, difficulty_contribution)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(kp.id, mathId, kp.parent, kp.name, kp.level, kp.grade, 0.5);
});

console.log(`✓ Created ${mathKnowledgePoints.length} math knowledge points`);

// 物理知识点
const mechanicsId = uuidv4();
const forceId = uuidv4();

db.prepare(`
  INSERT INTO knowledge_points
  (id, subject_id, parent_id, name, level, grade_level, difficulty_contribution)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(mechanicsId, physicsId, null, '力学', 0, '8', 0.5);

db.prepare(`
  INSERT INTO knowledge_points
  (id, subject_id, parent_id, name, level, grade_level, difficulty_contribution)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(forceId, physicsId, mechanicsId, '力的合成与分解', 1, '8', 0.6);

console.log('✓ Created 2 physics knowledge points');

// 3. 创建题目
console.log('\nCreating sample quizzes...');

const quizzes = [
  {
    id: uuidv4(),
    subjectId: mathId,
    content: '求解方程 x² - 5x + 6 = 0',
    type: '解答题',
    gradeLevel: '9',
    difficulty: 3,
    answer: 'x₁ = 2, x₂ = 3',
    knowledgePoints: [quadraticEqId]
  },
  {
    id: uuidv4(),
    subjectId: mathId,
    content: '若方程 x² + px + q = 0 的两根为 2 和 3，求 p 和 q 的值',
    type: '解答题',
    gradeLevel: '9',
    difficulty: 4,
    answer: 'p = -5, q = 6',
    knowledgePoints: [quadraticEqId]
  },
  {
    id: uuidv4(),
    subjectId: mathId,
    content: '解方程：2x + 5 = 11',
    type: '解答题',
    gradeLevel: '7',
    difficulty: 1,
    answer: 'x = 3',
    knowledgePoints: [linearEqId]
  },
  {
    id: uuidv4(),
    subjectId: mathId,
    content: '在直角三角形ABC中，∠C=90°，a=3，b=4，求c的长度',
    type: '解答题',
    gradeLevel: '8',
    difficulty: 2,
    answer: 'c = 5',
    knowledgePoints: [triangleId]
  },
  {
    id: uuidv4(),
    subjectId: mathId,
    content: '判断方程 x² - 4x + 4 = 0 的根的情况\nA. 两个不相等的实数根\nB. 两个相等的实数根\nC. 没有实数根\nD. 无法判断',
    type: '选择题',
    gradeLevel: '9',
    difficulty: 2,
    answer: 'B',
    options: JSON.stringify(['两个不相等的实数根', '两个相等的实数根', '没有实数根', '无法判断']),
    knowledgePoints: [quadraticEqId]
  },
  {
    id: uuidv4(),
    subjectId: physicsId,
    content: '两个力F₁=3N和F₂=4N互相垂直，求合力的大小',
    type: '解答题',
    gradeLevel: '8',
    difficulty: 3,
    answer: 'F = 5N',
    knowledgePoints: [forceId]
  },
];

quizzes.forEach(quiz => {
  // Insert quiz
  db.prepare(`
    INSERT INTO quizzes
    (id, tenant_id, content, subject_id, grade_level, quiz_type, difficulty, correct_answer, answer_options)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    quiz.id,
    'default',
    quiz.content,
    quiz.subjectId,
    quiz.gradeLevel,
    quiz.type,
    quiz.difficulty,
    quiz.answer,
    quiz.options || null
  );

  // Link knowledge points
  quiz.knowledgePoints.forEach(kpId => {
    db.prepare(`
      INSERT INTO quiz_knowledge_links
      (id, quiz_id, knowledge_point_id, confidence_score, link_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), quiz.id, kpId, 1.0, 'manual', 'system');
  });
});

console.log(`✓ Created ${quizzes.length} sample quizzes with knowledge point links`);

// 4. 创建一些分析数据
console.log('\nCreating sample analysis data...');

const analysisQuiz = quizzes[0]; // 第一道题
db.prepare(`
  INSERT INTO quiz_analyses
  (id, quiz_id, thinking_process, solution_steps, common_mistakes,
   knowledge_gap_analysis, difficulty_rationale, time_estimate, analyzer_version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  uuidv4(),
  analysisQuiz.id,
  `# 解题思路

## 1. 审题
方程 x² - 5x + 6 = 0 是标准的一元二次方程形式

## 2. 选择方法
可以使用因式分解法，因为常数项6可以分解为2×3，且2+3=5

## 3. 求解
将方程因式分解为 (x-2)(x-3) = 0
因此 x₁ = 2, x₂ = 3

## 4. 检验
代入原方程验证，确认答案正确`,
  JSON.stringify([
    {
      stepNumber: 1,
      title: '识别方程类型',
      description: '这是一元二次方程，形式为 ax² + bx + c = 0，其中 a=1, b=-5, c=6',
      reasoning: '标准形式便于选择合适的解法',
      commonErrors: []
    },
    {
      stepNumber: 2,
      title: '因式分解',
      description: '将 x² - 5x + 6 分解为 (x-2)(x-3)',
      formula: '(x-2)(x-3) = 0',
      reasoning: '6 = 2×3，且 2+3 = 5，满足因式分解条件',
      commonErrors: ['符号错误：写成 (x+2)(x+3)', '分解错误：写成 (x-1)(x-6)']
    },
    {
      stepNumber: 3,
      title: '求解',
      description: '令每个因式等于0，得到 x-2=0 或 x-3=0',
      reasoning: '零因子性质：ab=0 则 a=0 或 b=0',
      commonErrors: ['只求出一个根']
    },
    {
      stepNumber: 4,
      title: '得出答案',
      description: 'x₁ = 2, x₂ = 3',
      reasoning: '方程有两个不同的实数根',
      commonErrors: []
    }
  ]),
  JSON.stringify([
    {
      description: '因式分解时符号错误',
      frequency: 'high',
      knowledgeGaps: [quadraticEqId],
      remediation: '复习因式分解的十字相乘法，注意符号规律'
    },
    {
      description: '只写出一个根',
      frequency: 'medium',
      knowledgeGaps: [quadraticEqId],
      remediation: '理解一元二次方程有两个根（可能相等）'
    }
  ]),
  '学生需要掌握：1) 一元二次方程的标准形式；2) 因式分解法；3) 十字相乘法的符号规律',
  '该题涉及一元二次方程的基本解法，属于中等难度，因式分解较为直接',
  '5-8分钟',
  '1.0'
);

console.log('✓ Created 1 sample analysis');

// 5. 统计信息
console.log('\n' + '='.repeat(60));
console.log('Database Statistics:');
console.log('='.repeat(60));

const stats = {
  subjects: db.prepare('SELECT COUNT(*) as count FROM subjects').get().count,
  knowledgePoints: db.prepare('SELECT COUNT(*) as count FROM knowledge_points').get().count,
  rootKPs: db.prepare('SELECT COUNT(*) as count FROM knowledge_points WHERE parent_id IS NULL').get().count,
  quizzes: db.prepare('SELECT COUNT(*) as count FROM quizzes').get().count,
  links: db.prepare('SELECT COUNT(*) as count FROM quiz_knowledge_links').get().count,
  analyses: db.prepare('SELECT COUNT(*) as count FROM quiz_analyses').get().count,
};

console.log(`Subjects:          ${stats.subjects}`);
console.log(`Knowledge Points:  ${stats.knowledgePoints} (${stats.rootKPs} root nodes)`);
console.log(`Quizzes:           ${stats.quizzes}`);
console.log(`KP Links:          ${stats.links}`);
console.log(`Analyses:          ${stats.analyses}`);

// 6. 显示知识点树
console.log('\n' + '='.repeat(60));
console.log('Knowledge Points Tree Structure:');
console.log('='.repeat(60));

const printTree = (parentId, indent = '') => {
  const children = db.prepare(
    'SELECT id, name, level FROM knowledge_points WHERE parent_id IS ? ORDER BY name'
  ).all(parentId);

  children.forEach(node => {
    console.log(`${indent}├─ ${node.name} (level ${node.level})`);
    printTree(node.id, indent + '│  ');
  });
};

const roots = db.prepare(
  'SELECT id, name, level FROM knowledge_points WHERE parent_id IS NULL ORDER BY name'
).all();

roots.forEach(root => {
  console.log(`\n${root.name} (level ${root.level})`);
  printTree(root.id, '');
});

// 7. 显示题目示例
console.log('\n' + '='.repeat(60));
console.log('Sample Quizzes:');
console.log('='.repeat(60));

const sampleQuizzes = db.prepare(`
  SELECT
    q.id,
    q.content,
    q.quiz_type,
    q.difficulty,
    q.grade_level,
    GROUP_CONCAT(kp.name) as knowledge_points
  FROM quizzes q
  LEFT JOIN quiz_knowledge_links qkl ON q.id = qkl.quiz_id
  LEFT JOIN knowledge_points kp ON qkl.knowledge_point_id = kp.id
  GROUP BY q.id
  LIMIT 3
`).all();

sampleQuizzes.forEach((quiz, idx) => {
  console.log(`\n${idx + 1}. [${quiz.quiz_type}] [难度${quiz.difficulty}] [${quiz.grade_level}年级]`);
  console.log(`   内容: ${quiz.content.substring(0, 50)}${quiz.content.length > 50 ? '...' : ''}`);
  console.log(`   知识点: ${quiz.knowledge_points}`);
});

console.log('\n' + '='.repeat(60));
console.log('✓ Sample data created successfully!');
console.log('='.repeat(60));
console.log('\nYou can now test the MCP server with:');
console.log('  npm run quiz:mcp:start');
console.log('\nAnd query the knowledge points tree:');
console.log(`  curl -X POST http://localhost:3006/tools/get_knowledge_points_tree \\`);
console.log(`    -H "Content-Type: application/json" \\`);
console.log(`    -d '{"subjectId":"${mathId}"}'`);

db.close();
