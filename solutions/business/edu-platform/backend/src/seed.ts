/**
 * Seed script for edu-platform curriculum database.
 * Populates ~150 curriculum nodes for junior high math (初中数学)
 * and a default teacher user account.
 *
 * Usage: npm run seed
 */
import Database from 'better-sqlite3';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { encrypt } from './auth/crypto.util';

const DB_PATH = path.resolve(__dirname, '../data/edu.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Drop and recreate
db.exec('DROP TABLE IF EXISTS curriculum_nodes');
db.exec(`
  CREATE TABLE curriculum_nodes (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    subject TEXT NOT NULL,
    grade_range TEXT,
    sort_order INTEGER DEFAULT 0,
    cognitive TEXT,
    difficulty_min REAL,
    difficulty_max REAL,
    question_types TEXT,
    exam_weight REAL,
    prerequisites TEXT,
    common_mistakes TEXT,
    exam_patterns TEXT
  );
  CREATE INDEX idx_curriculum_subject ON curriculum_nodes(subject);
  CREATE INDEX idx_curriculum_parent ON curriculum_nodes(parent_id);
  CREATE INDEX idx_curriculum_level ON curriculum_nodes(level);
`);

const insert = db.prepare(`
  INSERT INTO curriculum_nodes (id, parent_id, name, level, subject, grade_range, sort_order, cognitive, difficulty_min, difficulty_max, question_types, exam_weight, prerequisites, common_mistakes, exam_patterns)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

interface NodeData {
  id: string;
  parent_id: string | null;
  name: string;
  level: number;
  grade_range: string | null;
  sort_order: number;
  cognitive?: string;
  difficulty_min?: number;
  difficulty_max?: number;
  question_types?: string[];
  exam_weight?: number;
  prerequisites?: string;
  common_mistakes?: string;
  exam_patterns?: string;
}

function addNode(n: NodeData) {
  insert.run(
    n.id, n.parent_id, n.name, n.level, 'math', n.grade_range, n.sort_order,
    n.cognitive || null, n.difficulty_min || null, n.difficulty_max || null,
    n.question_types ? JSON.stringify(n.question_types) : null,
    n.exam_weight || null, n.prerequisites || null, n.common_mistakes || null,
    n.exam_patterns || null
  );
}

// ─── Level 1: 领域 (Domains) ─────────────────────────────

const domains: NodeData[] = [
  { id: 'kp:math.number_algebra', parent_id: null, name: '数与代数', level: 1, grade_range: null, sort_order: 1 },
  { id: 'kp:math.geometry', parent_id: null, name: '图形与几何', level: 1, grade_range: null, sort_order: 2 },
  { id: 'kp:math.statistics', parent_id: null, name: '统计与概率', level: 1, grade_range: null, sort_order: 3 },
];

// ─── Level 2: 主题 (Topics) ──────────────────────────────

const topics: NodeData[] = [
  // 数与代数
  { id: 'kp:math.number_algebra.rational', parent_id: 'kp:math.number_algebra', name: '有理数', level: 2, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.number_algebra.expression', parent_id: 'kp:math.number_algebra', name: '整式', level: 2, grade_range: '7', sort_order: 2 },
  { id: 'kp:math.number_algebra.equation', parent_id: 'kp:math.number_algebra', name: '方程与不等式', level: 2, grade_range: '7,8', sort_order: 3 },
  { id: 'kp:math.number_algebra.function', parent_id: 'kp:math.number_algebra', name: '函数', level: 2, grade_range: '8,9', sort_order: 4 },
  { id: 'kp:math.number_algebra.real_number', parent_id: 'kp:math.number_algebra', name: '实数', level: 2, grade_range: '7,8', sort_order: 5 },
  { id: 'kp:math.number_algebra.factoring', parent_id: 'kp:math.number_algebra', name: '因式分解', level: 2, grade_range: '8', sort_order: 6 },
  { id: 'kp:math.number_algebra.fraction', parent_id: 'kp:math.number_algebra', name: '分式', level: 2, grade_range: '8', sort_order: 7 },
  { id: 'kp:math.number_algebra.quadratic_root', parent_id: 'kp:math.number_algebra', name: '二次根式', level: 2, grade_range: '8', sort_order: 8 },
  // 图形与几何
  { id: 'kp:math.geometry.line_angle', parent_id: 'kp:math.geometry', name: '相交线与平行线', level: 2, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.geometry.triangle', parent_id: 'kp:math.geometry', name: '三角形', level: 2, grade_range: '7,8', sort_order: 2 },
  { id: 'kp:math.geometry.quadrilateral', parent_id: 'kp:math.geometry', name: '四边形', level: 2, grade_range: '8', sort_order: 3 },
  { id: 'kp:math.geometry.circle', parent_id: 'kp:math.geometry', name: '圆', level: 2, grade_range: '9', sort_order: 4 },
  { id: 'kp:math.geometry.similarity', parent_id: 'kp:math.geometry', name: '图形的相似', level: 2, grade_range: '9', sort_order: 5 },
  { id: 'kp:math.geometry.transformation', parent_id: 'kp:math.geometry', name: '图形的变换', level: 2, grade_range: '7,8', sort_order: 6 },
  { id: 'kp:math.geometry.coordinate', parent_id: 'kp:math.geometry', name: '平面直角坐标系', level: 2, grade_range: '7,8', sort_order: 7 },
  // 统计与概率
  { id: 'kp:math.statistics.data_collection', parent_id: 'kp:math.statistics', name: '数据的收集与整理', level: 2, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.statistics.data_analysis', parent_id: 'kp:math.statistics', name: '数据的分析', level: 2, grade_range: '8', sort_order: 2 },
  { id: 'kp:math.statistics.probability', parent_id: 'kp:math.statistics', name: '概率', level: 2, grade_range: '9', sort_order: 3 },
];

// ─── Level 3: 单元 (Units) ───────────────────────────────

const units: NodeData[] = [
  // 有理数
  { id: 'kp:math.rational.concept', parent_id: 'kp:math.number_algebra.rational', name: '有理数的概念', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.rational.operation', parent_id: 'kp:math.number_algebra.rational', name: '有理数的运算', level: 3, grade_range: '7', sort_order: 2 },
  // 整式
  { id: 'kp:math.expression.monomial', parent_id: 'kp:math.number_algebra.expression', name: '单项式与多项式', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.expression.operation', parent_id: 'kp:math.number_algebra.expression', name: '整式的运算', level: 3, grade_range: '7', sort_order: 2 },
  // 方程与不等式
  { id: 'kp:math.equation.linear_one', parent_id: 'kp:math.number_algebra.equation', name: '一元一次方程', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.equation.system_linear', parent_id: 'kp:math.number_algebra.equation', name: '二元一次方程组', level: 3, grade_range: '7', sort_order: 2 },
  { id: 'kp:math.equation.inequality', parent_id: 'kp:math.number_algebra.equation', name: '一元一次不等式', level: 3, grade_range: '7', sort_order: 3 },
  { id: 'kp:math.equation.quadratic', parent_id: 'kp:math.number_algebra.equation', name: '一元二次方程', level: 3, grade_range: '9', sort_order: 4 },
  { id: 'kp:math.equation.fractional', parent_id: 'kp:math.number_algebra.equation', name: '分式方程', level: 3, grade_range: '8', sort_order: 5 },
  // 函数
  { id: 'kp:math.function.concept', parent_id: 'kp:math.number_algebra.function', name: '函数的概念', level: 3, grade_range: '8', sort_order: 1 },
  { id: 'kp:math.function.linear', parent_id: 'kp:math.number_algebra.function', name: '一次函数', level: 3, grade_range: '8', sort_order: 2 },
  { id: 'kp:math.function.inverse', parent_id: 'kp:math.number_algebra.function', name: '反比例函数', level: 3, grade_range: '9', sort_order: 3 },
  { id: 'kp:math.function.quadratic', parent_id: 'kp:math.number_algebra.function', name: '二次函数', level: 3, grade_range: '9', sort_order: 4 },
  // 实数
  { id: 'kp:math.real.square_root', parent_id: 'kp:math.number_algebra.real_number', name: '平方根与立方根', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.real.concept', parent_id: 'kp:math.number_algebra.real_number', name: '实数的概念', level: 3, grade_range: '8', sort_order: 2 },
  // 因式分解
  { id: 'kp:math.factoring.methods', parent_id: 'kp:math.number_algebra.factoring', name: '因式分解方法', level: 3, grade_range: '8', sort_order: 1 },
  // 分式
  { id: 'kp:math.fraction.concept', parent_id: 'kp:math.number_algebra.fraction', name: '分式的概念', level: 3, grade_range: '8', sort_order: 1 },
  { id: 'kp:math.fraction.operation', parent_id: 'kp:math.number_algebra.fraction', name: '分式的运算', level: 3, grade_range: '8', sort_order: 2 },
  // 二次根式
  { id: 'kp:math.qroot.concept', parent_id: 'kp:math.number_algebra.quadratic_root', name: '二次根式的概念', level: 3, grade_range: '8', sort_order: 1 },
  { id: 'kp:math.qroot.operation', parent_id: 'kp:math.number_algebra.quadratic_root', name: '二次根式的运算', level: 3, grade_range: '8', sort_order: 2 },
  // 相交线与平行线
  { id: 'kp:math.line.intersecting', parent_id: 'kp:math.geometry.line_angle', name: '相交线', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.line.parallel', parent_id: 'kp:math.geometry.line_angle', name: '平行线', level: 3, grade_range: '7', sort_order: 2 },
  // 三角形
  { id: 'kp:math.triangle.properties', parent_id: 'kp:math.geometry.triangle', name: '三角形的基本性质', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.triangle.congruent', parent_id: 'kp:math.geometry.triangle', name: '全等三角形', level: 3, grade_range: '8', sort_order: 2 },
  { id: 'kp:math.triangle.right', parent_id: 'kp:math.geometry.triangle', name: '直角三角形与勾股定理', level: 3, grade_range: '8', sort_order: 3 },
  { id: 'kp:math.triangle.isosceles', parent_id: 'kp:math.geometry.triangle', name: '等腰三角形', level: 3, grade_range: '8', sort_order: 4 },
  // 四边形
  { id: 'kp:math.quad.parallelogram', parent_id: 'kp:math.geometry.quadrilateral', name: '平行四边形', level: 3, grade_range: '8', sort_order: 1 },
  { id: 'kp:math.quad.special', parent_id: 'kp:math.geometry.quadrilateral', name: '特殊四边形', level: 3, grade_range: '8', sort_order: 2 },
  // 圆
  { id: 'kp:math.circle.properties', parent_id: 'kp:math.geometry.circle', name: '圆的基本性质', level: 3, grade_range: '9', sort_order: 1 },
  { id: 'kp:math.circle.relation', parent_id: 'kp:math.geometry.circle', name: '与圆有关的位置关系', level: 3, grade_range: '9', sort_order: 2 },
  { id: 'kp:math.circle.calculation', parent_id: 'kp:math.geometry.circle', name: '弧长与扇形面积', level: 3, grade_range: '9', sort_order: 3 },
  // 相似
  { id: 'kp:math.similarity.concept', parent_id: 'kp:math.geometry.similarity', name: '相似三角形', level: 3, grade_range: '9', sort_order: 1 },
  { id: 'kp:math.similarity.application', parent_id: 'kp:math.geometry.similarity', name: '相似的应用', level: 3, grade_range: '9', sort_order: 2 },
  // 变换
  { id: 'kp:math.transform.translation', parent_id: 'kp:math.geometry.transformation', name: '平移', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.transform.rotation', parent_id: 'kp:math.geometry.transformation', name: '旋转', level: 3, grade_range: '8', sort_order: 2 },
  { id: 'kp:math.transform.symmetry', parent_id: 'kp:math.geometry.transformation', name: '轴对称', level: 3, grade_range: '7', sort_order: 3 },
  // 坐标系
  { id: 'kp:math.coordinate.basic', parent_id: 'kp:math.geometry.coordinate', name: '坐标系基础', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.coordinate.graph', parent_id: 'kp:math.geometry.coordinate', name: '函数图像与坐标', level: 3, grade_range: '8', sort_order: 2 },
  // 统计
  { id: 'kp:math.data_col.survey', parent_id: 'kp:math.statistics.data_collection', name: '调查与数据收集', level: 3, grade_range: '7', sort_order: 1 },
  { id: 'kp:math.data_col.chart', parent_id: 'kp:math.statistics.data_collection', name: '统计图表', level: 3, grade_range: '7', sort_order: 2 },
  { id: 'kp:math.data_ana.central', parent_id: 'kp:math.statistics.data_analysis', name: '集中趋势', level: 3, grade_range: '8', sort_order: 1 },
  { id: 'kp:math.data_ana.dispersion', parent_id: 'kp:math.statistics.data_analysis', name: '离散程度', level: 3, grade_range: '8', sort_order: 2 },
  // 概率
  { id: 'kp:math.prob.random', parent_id: 'kp:math.statistics.probability', name: '随机事件与概率', level: 3, grade_range: '9', sort_order: 1 },
  { id: 'kp:math.prob.methods', parent_id: 'kp:math.statistics.probability', name: '概率的计算方法', level: 3, grade_range: '9', sort_order: 2 },
];

// ─── Level 4: 知识点 (Knowledge Points) ──────────────────

const knowledgePoints: NodeData[] = [
  // 有理数概念
  { id: 'kp:math.rational.concept.positive_negative', parent_id: 'kp:math.rational.concept', name: '正数与负数', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '填空题'], exam_weight: 0.02, common_mistakes: '负数前面漏写负号', exam_patterns: '数轴上的点表示' },
  { id: 'kp:math.rational.concept.number_line', parent_id: 'kp:math.rational.concept', name: '数轴', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.5, question_types: ['选择题', '填空题', '作图题'], exam_weight: 0.02, common_mistakes: '正方向标记错误', exam_patterns: '数轴上的距离问题' },
  { id: 'kp:math.rational.concept.absolute_value', parent_id: 'kp:math.rational.concept', name: '绝对值', level: 4, grade_range: '7', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['选择题', '填空题', '计算题'], exam_weight: 0.03, common_mistakes: '绝对值为负', prerequisites: '正数与负数,数轴', exam_patterns: '含绝对值的化简' },
  { id: 'kp:math.rational.concept.opposite', parent_id: 'kp:math.rational.concept', name: '相反数', level: 4, grade_range: '7', sort_order: 4,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.3, question_types: ['选择题', '填空题'], exam_weight: 0.01, common_mistakes: '相反数与倒数混淆' },

  // 有理数运算
  { id: 'kp:math.rational.op.addition', parent_id: 'kp:math.rational.operation', name: '有理数加法', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.2, difficulty_max: 0.5, question_types: ['计算题'], exam_weight: 0.03, prerequisites: '绝对值', common_mistakes: '异号相加符号判断错误' },
  { id: 'kp:math.rational.op.subtraction', parent_id: 'kp:math.rational.operation', name: '有理数减法', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.2, difficulty_max: 0.5, question_types: ['计算题'], exam_weight: 0.02, prerequisites: '有理数加法', common_mistakes: '减法转加法时忘记变号' },
  { id: 'kp:math.rational.op.multiplication', parent_id: 'kp:math.rational.operation', name: '有理数乘法', level: 4, grade_range: '7', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['计算题'], exam_weight: 0.02, common_mistakes: '多个负数相乘符号判断错误' },
  { id: 'kp:math.rational.op.division', parent_id: 'kp:math.rational.operation', name: '有理数除法', level: 4, grade_range: '7', sort_order: 4,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['计算题'], exam_weight: 0.02, prerequisites: '有理数乘法', common_mistakes: '除以0的判断' },
  { id: 'kp:math.rational.op.power', parent_id: 'kp:math.rational.operation', name: '有理数的乘方', level: 4, grade_range: '7', sort_order: 5,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题', '选择题'], exam_weight: 0.02, common_mistakes: '负数的偶次幂与奇次幂混淆' },
  { id: 'kp:math.rational.op.mixed', parent_id: 'kp:math.rational.operation', name: '有理数混合运算', level: 4, grade_range: '7', sort_order: 6,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题'], exam_weight: 0.04, prerequisites: '有理数加法,有理数减法,有理数乘法,有理数除法,有理数的乘方', common_mistakes: '运算顺序错误', exam_patterns: '运算律的灵活应用' },

  // 整式-单项式与多项式
  { id: 'kp:math.expression.mono.concept', parent_id: 'kp:math.expression.monomial', name: '单项式的概念', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '填空题'], exam_weight: 0.01 },
  { id: 'kp:math.expression.poly.concept', parent_id: 'kp:math.expression.monomial', name: '多项式的概念', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '填空题'], exam_weight: 0.01 },
  { id: 'kp:math.expression.like_terms', parent_id: 'kp:math.expression.monomial', name: '合并同类项', level: 4, grade_range: '7', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.03, common_mistakes: '同类项判断错误' },

  // 整式运算
  { id: 'kp:math.expression.op.add_sub', parent_id: 'kp:math.expression.operation', name: '整式的加减', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['计算题'], exam_weight: 0.02, prerequisites: '合并同类项' },
  { id: 'kp:math.expression.op.multiply', parent_id: 'kp:math.expression.operation', name: '整式的乘法', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题'], exam_weight: 0.03 },
  { id: 'kp:math.expression.op.formula', parent_id: 'kp:math.expression.operation', name: '乘法公式', level: 4, grade_range: '7', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题', '选择题'], exam_weight: 0.04, common_mistakes: '平方差公式与完全平方公式混淆', exam_patterns: '逆用乘法公式' },

  // 一元一次方程
  { id: 'kp:math.equation.linear_one.concept', parent_id: 'kp:math.equation.linear_one', name: '一元一次方程的概念', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.equation.linear_one.solve', parent_id: 'kp:math.equation.linear_one', name: '解一元一次方程', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.05, common_mistakes: '移项变号忘记', exam_patterns: '去括号、去分母步骤' },
  { id: 'kp:math.equation.linear_one.application', parent_id: 'kp:math.equation.linear_one', name: '一元一次方程应用题', level: 4, grade_range: '7', sort_order: 3,
    cognitive: '分析', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['解答题'], exam_weight: 0.06, prerequisites: '解一元一次方程', common_mistakes: '等量关系找不准', exam_patterns: '行程问题、工程问题、利润问题' },

  // 二元一次方程组
  { id: 'kp:math.equation.system.concept', parent_id: 'kp:math.equation.system_linear', name: '二元一次方程组的概念', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.equation.system.substitution', parent_id: 'kp:math.equation.system_linear', name: '代入消元法', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.03 },
  { id: 'kp:math.equation.system.elimination', parent_id: 'kp:math.equation.system_linear', name: '加减消元法', level: 4, grade_range: '7', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.03, common_mistakes: '消元时系数配平错误' },
  { id: 'kp:math.equation.system.application', parent_id: 'kp:math.equation.system_linear', name: '方程组应用题', level: 4, grade_range: '7', sort_order: 4,
    cognitive: '分析', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['解答题'], exam_weight: 0.05 },

  // 不等式
  { id: 'kp:math.equation.ineq.concept', parent_id: 'kp:math.equation.inequality', name: '不等式的性质', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.equation.ineq.solve', parent_id: 'kp:math.equation.inequality', name: '解一元一次不等式', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.04, common_mistakes: '不等号方向变化（两边乘负数）' },
  { id: 'kp:math.equation.ineq.group', parent_id: 'kp:math.equation.inequality', name: '不等式组', level: 4, grade_range: '7', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题', '选择题'], exam_weight: 0.03, common_mistakes: '取交集方法错误', exam_patterns: '数轴表示解集' },

  // 一元二次方程
  { id: 'kp:math.equation.quad.concept', parent_id: 'kp:math.equation.quadratic', name: '一元二次方程的概念', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.equation.quad.formula', parent_id: 'kp:math.equation.quadratic', name: '求根公式', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题'], exam_weight: 0.05, common_mistakes: '判别式计算错误', exam_patterns: '配方法、公式法、因式分解法' },
  { id: 'kp:math.equation.quad.discriminant', parent_id: 'kp:math.equation.quadratic', name: '判别式与根的关系', level: 4, grade_range: '9', sort_order: 3,
    cognitive: '分析', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['选择题', '解答题'], exam_weight: 0.04, prerequisites: '求根公式', exam_patterns: '韦达定理应用' },
  { id: 'kp:math.equation.quad.application', parent_id: 'kp:math.equation.quadratic', name: '一元二次方程应用题', level: 4, grade_range: '9', sort_order: 4,
    cognitive: '分析', difficulty_min: 0.6, difficulty_max: 0.9, question_types: ['解答题'], exam_weight: 0.06, prerequisites: '求根公式,判别式与根的关系' },

  // 函数概念
  { id: 'kp:math.function.concept.variable', parent_id: 'kp:math.function.concept', name: '变量与函数', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.function.concept.domain', parent_id: 'kp:math.function.concept', name: '函数的定义域与值域', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.function.concept.graph', parent_id: 'kp:math.function.concept', name: '函数图像', level: 4, grade_range: '8', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['作图题', '选择题'], exam_weight: 0.03 },

  // 一次函数
  { id: 'kp:math.function.linear.concept', parent_id: 'kp:math.function.linear', name: '一次函数的概念', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.function.linear.graph', parent_id: 'kp:math.function.linear', name: '一次函数的图像与性质', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['选择题', '作图题', '解答题'], exam_weight: 0.05, common_mistakes: 'k的正负与图像走向', exam_patterns: '两条直线交点问题' },
  { id: 'kp:math.function.linear.application', parent_id: 'kp:math.function.linear', name: '一次函数应用题', level: 4, grade_range: '8', sort_order: 3,
    cognitive: '分析', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['解答题'], exam_weight: 0.05, prerequisites: '一次函数的图像与性质' },

  // 反比例函数
  { id: 'kp:math.function.inverse.concept', parent_id: 'kp:math.function.inverse', name: '反比例函数的概念', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.function.inverse.graph', parent_id: 'kp:math.function.inverse', name: '反比例函数的图像与性质', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['选择题', '解答题'], exam_weight: 0.04, common_mistakes: '象限判断错误' },

  // 二次函数
  { id: 'kp:math.function.quad.concept', parent_id: 'kp:math.function.quadratic', name: '二次函数的概念', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.4, difficulty_max: 0.6, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.function.quad.graph', parent_id: 'kp:math.function.quadratic', name: '二次函数的图像与性质', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['选择题', '作图题', '解答题'], exam_weight: 0.06, common_mistakes: '顶点坐标计算错误', exam_patterns: '开口方向、对称轴、顶点' },
  { id: 'kp:math.function.quad.application', parent_id: 'kp:math.function.quadratic', name: '二次函数应用题', level: 4, grade_range: '9', sort_order: 3,
    cognitive: '分析', difficulty_min: 0.6, difficulty_max: 0.9, question_types: ['解答题'], exam_weight: 0.07, prerequisites: '二次函数的图像与性质,一元二次方程', exam_patterns: '最值问题、面积问题' },

  // 三角形基本性质
  { id: 'kp:math.triangle.prop.interior_angle', parent_id: 'kp:math.triangle.properties', name: '三角形内角和', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.triangle.prop.exterior_angle', parent_id: 'kp:math.triangle.properties', name: '三角形的外角', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '计算题'], exam_weight: 0.02, common_mistakes: '外角与内角关系混淆' },
  { id: 'kp:math.triangle.prop.side_relation', parent_id: 'kp:math.triangle.properties', name: '三角形三边关系', level: 4, grade_range: '7', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02, common_mistakes: '两边之差与两边之和忘记' },

  // 全等三角形
  { id: 'kp:math.triangle.cong.concept', parent_id: 'kp:math.triangle.congruent', name: '全等三角形的概念', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题'], exam_weight: 0.02 },
  { id: 'kp:math.triangle.cong.conditions', parent_id: 'kp:math.triangle.congruent', name: '全等三角形的判定', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['选择题', '证明题'], exam_weight: 0.06, common_mistakes: 'SSA不能判定全等', exam_patterns: 'SSS、SAS、ASA、AAS、HL' },
  { id: 'kp:math.triangle.cong.proof', parent_id: 'kp:math.triangle.congruent', name: '全等三角形的证明', level: 4, grade_range: '8', sort_order: 3,
    cognitive: '分析', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['证明题'], exam_weight: 0.06, prerequisites: '全等三角形的判定', exam_patterns: '辅助线添加' },

  // 勾股定理
  { id: 'kp:math.triangle.right.pythagorean', parent_id: 'kp:math.triangle.right', name: '勾股定理', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题', '选择题'], exam_weight: 0.05, exam_patterns: '直角三角形边长计算' },
  { id: 'kp:math.triangle.right.converse', parent_id: 'kp:math.triangle.right', name: '勾股定理的逆定理', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.6, question_types: ['选择题', '证明题'], exam_weight: 0.03, prerequisites: '勾股定理', common_mistakes: '判定直角三角形时数据验证错误' },

  // 平行四边形
  { id: 'kp:math.quad.para.properties', parent_id: 'kp:math.quad.parallelogram', name: '平行四边形的性质', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.03 },
  { id: 'kp:math.quad.para.judgment', parent_id: 'kp:math.quad.parallelogram', name: '平行四边形的判定', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['选择题', '证明题'], exam_weight: 0.04 },

  // 特殊四边形
  { id: 'kp:math.quad.special.rectangle', parent_id: 'kp:math.quad.special', name: '矩形', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['选择题', '证明题'], exam_weight: 0.03 },
  { id: 'kp:math.quad.special.rhombus', parent_id: 'kp:math.quad.special', name: '菱形', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['选择题', '证明题'], exam_weight: 0.03 },
  { id: 'kp:math.quad.special.square', parent_id: 'kp:math.quad.special', name: '正方形', level: 4, grade_range: '8', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['选择题', '证明题'], exam_weight: 0.02 },

  // 圆的基本性质
  { id: 'kp:math.circle.prop.concept', parent_id: 'kp:math.circle.properties', name: '圆的基本概念', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.circle.prop.central_angle', parent_id: 'kp:math.circle.properties', name: '圆心角与弧', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['选择题', '计算题'], exam_weight: 0.03 },
  { id: 'kp:math.circle.prop.inscribed_angle', parent_id: 'kp:math.circle.properties', name: '圆周角', level: 4, grade_range: '9', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['选择题', '证明题'], exam_weight: 0.04, common_mistakes: '圆周角与圆心角关系', exam_patterns: '同弧上的圆周角相等' },

  // 圆的位置关系
  { id: 'kp:math.circle.rel.line', parent_id: 'kp:math.circle.relation', name: '直线与圆的位置关系', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['选择题', '计算题'], exam_weight: 0.04, exam_patterns: '切线的判定与性质' },
  { id: 'kp:math.circle.rel.tangent', parent_id: 'kp:math.circle.relation', name: '切线', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '分析', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['证明题', '计算题'], exam_weight: 0.05, prerequisites: '直线与圆的位置关系', exam_patterns: '切线长定理' },

  // 弧长与扇形
  { id: 'kp:math.circle.calc.arc_length', parent_id: 'kp:math.circle.calculation', name: '弧长公式', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.02 },
  { id: 'kp:math.circle.calc.sector_area', parent_id: 'kp:math.circle.calculation', name: '扇形面积', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.02 },

  // 相似
  { id: 'kp:math.similarity.concept.ratio', parent_id: 'kp:math.similarity.concept', name: '比例与比例线段', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.similarity.concept.conditions', parent_id: 'kp:math.similarity.concept', name: '相似三角形的判定', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['证明题', '计算题'], exam_weight: 0.05, exam_patterns: 'AA、SAS、SSS相似' },
  { id: 'kp:math.similarity.concept.properties', parent_id: 'kp:math.similarity.concept', name: '相似三角形的性质', level: 4, grade_range: '9', sort_order: 3,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['选择题', '计算题'], exam_weight: 0.03 },

  // 平行线
  { id: 'kp:math.line.intersecting.vertical', parent_id: 'kp:math.line.intersecting', name: '对顶角与邻补角', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.line.intersecting.perpendicular', parent_id: 'kp:math.line.intersecting', name: '垂线', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.2, difficulty_max: 0.5, question_types: ['作图题', '选择题'], exam_weight: 0.02 },
  { id: 'kp:math.line.parallel.conditions', parent_id: 'kp:math.line.parallel', name: '平行线的判定', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['选择题', '证明题'], exam_weight: 0.03, exam_patterns: '同位角、内错角、同旁内角' },
  { id: 'kp:math.line.parallel.properties', parent_id: 'kp:math.line.parallel', name: '平行线的性质', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['选择题', '计算题'], exam_weight: 0.03 },

  // 统计
  { id: 'kp:math.data_col.survey.sampling', parent_id: 'kp:math.data_col.survey', name: '全面调查与抽样调查', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题'], exam_weight: 0.02 },
  { id: 'kp:math.data_col.chart.histogram', parent_id: 'kp:math.data_col.chart', name: '频率分布直方图', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['作图题', '解答题'], exam_weight: 0.03 },
  { id: 'kp:math.data_ana.central.mean', parent_id: 'kp:math.data_ana.central', name: '平均数', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.2, difficulty_max: 0.5, question_types: ['计算题'], exam_weight: 0.02, common_mistakes: '加权平均数权重错误' },
  { id: 'kp:math.data_ana.central.median_mode', parent_id: 'kp:math.data_ana.central', name: '中位数与众数', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.data_ana.dispersion.variance', parent_id: 'kp:math.data_ana.dispersion', name: '方差与标准差', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.03, common_mistakes: '方差公式中忘记求平均数' },

  // 概率
  { id: 'kp:math.prob.random.concept', parent_id: 'kp:math.prob.random', name: '必然事件、不可能事件、随机事件', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题'], exam_weight: 0.02 },
  { id: 'kp:math.prob.random.frequency', parent_id: 'kp:math.prob.random', name: '用频率估计概率', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '解答题'], exam_weight: 0.02 },
  { id: 'kp:math.prob.methods.tree', parent_id: 'kp:math.prob.methods', name: '树状图法', level: 4, grade_range: '9', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.6, question_types: ['解答题'], exam_weight: 0.03, exam_patterns: '两步实验的概率' },
  { id: 'kp:math.prob.methods.list', parent_id: 'kp:math.prob.methods', name: '列表法', level: 4, grade_range: '9', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['解答题'], exam_weight: 0.03 },

  // 实数
  { id: 'kp:math.real.sqrt.square', parent_id: 'kp:math.real.square_root', name: '平方根', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '计算题'], exam_weight: 0.02, common_mistakes: '正数有两个平方根' },
  { id: 'kp:math.real.sqrt.cube', parent_id: 'kp:math.real.square_root', name: '立方根', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '计算题'], exam_weight: 0.02 },
  { id: 'kp:math.real.concept.irrational', parent_id: 'kp:math.real.concept', name: '无理数与实数', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02 },

  // 因式分解
  { id: 'kp:math.factoring.methods.common', parent_id: 'kp:math.factoring.methods', name: '提公因式法', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['计算题'], exam_weight: 0.03 },
  { id: 'kp:math.factoring.methods.formula', parent_id: 'kp:math.factoring.methods', name: '公式法', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题'], exam_weight: 0.04, prerequisites: '乘法公式', common_mistakes: '平方差与完全平方分解混淆' },
  { id: 'kp:math.factoring.methods.group', parent_id: 'kp:math.factoring.methods', name: '分组分解法', level: 4, grade_range: '8', sort_order: 3,
    cognitive: '分析', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['计算题'], exam_weight: 0.02, prerequisites: '提公因式法,公式法' },

  // 分式
  { id: 'kp:math.fraction.concept.meaning', parent_id: 'kp:math.fraction.concept', name: '分式的概念与意义', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02, common_mistakes: '分式有意义的条件判断' },
  { id: 'kp:math.fraction.op.multiply_divide', parent_id: 'kp:math.fraction.operation', name: '分式的乘除', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['计算题'], exam_weight: 0.03 },
  { id: 'kp:math.fraction.op.add_subtract', parent_id: 'kp:math.fraction.operation', name: '分式的加减', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题'], exam_weight: 0.03, common_mistakes: '通分时最简公分母找错' },

  // 二次根式
  { id: 'kp:math.qroot.concept.meaning', parent_id: 'kp:math.qroot.concept', name: '二次根式的概念', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '填空题'], exam_weight: 0.02, common_mistakes: '被开方数非负条件忘记' },
  { id: 'kp:math.qroot.op.simplify', parent_id: 'kp:math.qroot.operation', name: '二次根式的化简', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题'], exam_weight: 0.03 },
  { id: 'kp:math.qroot.op.mixed', parent_id: 'kp:math.qroot.operation', name: '二次根式的混合运算', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['计算题'], exam_weight: 0.03, prerequisites: '二次根式的化简' },

  // 分式方程
  { id: 'kp:math.equation.frac.solve', parent_id: 'kp:math.equation.fractional', name: '解分式方程', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.4, difficulty_max: 0.7, question_types: ['计算题'], exam_weight: 0.04, common_mistakes: '忘记检验增根', exam_patterns: '去分母→整式方程→检验' },
  { id: 'kp:math.equation.frac.application', parent_id: 'kp:math.equation.fractional', name: '分式方程应用题', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '分析', difficulty_min: 0.5, difficulty_max: 0.8, question_types: ['解答题'], exam_weight: 0.04, prerequisites: '解分式方程' },

  // 变换
  { id: 'kp:math.transform.translation.concept', parent_id: 'kp:math.transform.translation', name: '平移的概念与性质', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '作图题'], exam_weight: 0.02 },
  { id: 'kp:math.transform.symmetry.axial', parent_id: 'kp:math.transform.symmetry', name: '轴对称的概念与性质', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.5, question_types: ['选择题', '作图题'], exam_weight: 0.02 },
  { id: 'kp:math.transform.rotation.concept', parent_id: 'kp:math.transform.rotation', name: '旋转的概念与性质', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.3, difficulty_max: 0.5, question_types: ['选择题', '作图题'], exam_weight: 0.02 },
  { id: 'kp:math.transform.rotation.center_sym', parent_id: 'kp:math.transform.rotation', name: '中心对称', level: 4, grade_range: '8', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['选择题', '作图题'], exam_weight: 0.02 },

  // 坐标系
  { id: 'kp:math.coordinate.basic.concept', parent_id: 'kp:math.coordinate.basic', name: '平面直角坐标系的概念', level: 4, grade_range: '7', sort_order: 1,
    cognitive: '理解', difficulty_min: 0.2, difficulty_max: 0.4, question_types: ['选择题', '填空题'], exam_weight: 0.02 },
  { id: 'kp:math.coordinate.basic.point', parent_id: 'kp:math.coordinate.basic', name: '点的坐标', level: 4, grade_range: '7', sort_order: 2,
    cognitive: '应用', difficulty_min: 0.2, difficulty_max: 0.5, question_types: ['选择题', '填空题', '作图题'], exam_weight: 0.02, common_mistakes: '象限判断错误' },
  { id: 'kp:math.coordinate.graph.linear', parent_id: 'kp:math.coordinate.graph', name: '用坐标表示函数图像', level: 4, grade_range: '8', sort_order: 1,
    cognitive: '应用', difficulty_min: 0.3, difficulty_max: 0.6, question_types: ['作图题', '解答题'], exam_weight: 0.03 },
];

// ─── Insert all nodes ────────────────────────────────────

const insertAll = db.transaction(() => {
  for (const node of domains) addNode(node);
  for (const node of topics) addNode(node);
  for (const node of units) addNode(node);
  for (const node of knowledgePoints) addNode(node);
});

insertAll();

// Summary
const total = (db.prepare('SELECT COUNT(*) as count FROM curriculum_nodes').get() as { count: number }).count;
const byLevel = db.prepare('SELECT level, COUNT(*) as count FROM curriculum_nodes GROUP BY level ORDER BY level').all() as { level: number; count: number }[];

const labels = ['', '领域', '主题', '单元', '知识点'];
const breakdown = byLevel.map(row => `Level ${row.level} (${labels[row.level]}): ${row.count}`).join(', ');
console.log(`✅ Curriculum seeded: ${total} nodes — ${breakdown}`);

// ─── Seed default users ─────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    school TEXT DEFAULT '树人中学',
    ccaas_user_id TEXT,
    ccaas_api_key TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Clear existing seed users and re-insert
db.exec("DELETE FROM users WHERE username = 'teacher'");

const seedPassword = bcrypt.hashSync('teacher123', 10);
const jwtSecret = process.env.JWT_SECRET || 'edu-platform-dev-secret';
const rawApiKey = process.env.CCAAS_API_KEY || null;
const encryptedApiKey = rawApiKey ? encrypt(rawApiKey, jwtSecret) : null;
db.prepare(
  'INSERT INTO users (id, username, password_hash, name, school, ccaas_api_key) VALUES (?, ?, ?, ?, ?, ?)',
).run(randomUUID(), 'teacher', seedPassword, '张老师', '树人中学', encryptedApiKey);

console.log('✅ Default user seeded: teacher / teacher123 (张老师, 树人中学)');

db.close();
