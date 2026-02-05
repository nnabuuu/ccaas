import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { SYNC_FIELDS } from './types.js';
import { validateAndFixField } from './schemas.js';
import { loadKnowledgePointsTree } from './data-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../data/quiz-analyzer.db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.MCP_PORT || 3006;

// Load knowledge points on startup
let knowledgePointsTree: ReturnType<typeof loadKnowledgePointsTree> = {};
try {
  knowledgePointsTree = loadKnowledgePointsTree();
  console.log('✓ Knowledge points tree loaded');
} catch (error) {
  console.error('✗ Failed to load knowledge points:', error);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'quiz-analyzer-mcp',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    knowledgePoints: Object.keys(knowledgePointsTree).length,
  });
});

// Tool: write_output
app.post('/tools/write_output', (req, res) => {
  const { field, value, preview } = req.body;

  if (!field || !SYNC_FIELDS.includes(field as any)) {
    return res.status(400).json({
      status: 'error',
      error: `Invalid field: ${field}. Must be one of: ${SYNC_FIELDS.join(', ')}`,
    });
  }

  const validation = validateAndFixField(field, value);

  if (!validation.success) {
    return res.status(400).json({
      status: 'error',
      error: `Validation failed: ${validation.errors.join('; ')}`,
      field,
    });
  }

  res.json({
    status: 'success',
    data: {
      field,
      value: validation.data,
      preview: preview || `Updated ${field}`,
    },
  });
});

// Tool: get_knowledge_points_tree
app.post('/tools/get_knowledge_points_tree', (req, res) => {
  const { subjectId, gradeLevel } = req.body;

  let tree = knowledgePointsTree[subjectId] || [];

  // Filter by grade level if specified
  if (gradeLevel) {
    tree = filterTreeByGrade(tree, gradeLevel);
  }

  res.json({
    status: 'success',
    data: {
      tree,
      totalNodes: countNodes(tree),
    },
  });
});

// Tool: verify_knowledge_point_tags
app.post('/tools/verify_knowledge_point_tags', (req, res) => {
  const { quizContent, proposedTags } = req.body;

  // AI should analyze quiz content and verify each tag
  // Returns verified tags with confidence scores

  res.json({
    status: 'success',
    data: {
      instructions: 'Analyze the quiz content and verify each proposed knowledge point tag. ' +
        'For each tag, determine if it\'s relevant (confidence 0.0-1.0) and mark as verified.',
      availableKnowledgePoints: knowledgePointsTree,
    },
  });
});

// Tool: calculate_difficulty
app.post('/tools/calculate_difficulty', (req, res) => {
  const { knowledgePointCount, stepCount, quizType } = req.body;

  const typeWeights: Record<string, number> = {
    '选择题': 0.8,
    '填空题': 1.0,
    '解答题': 1.2,
    '证明题': 1.5,
  };

  const weight = typeWeights[quizType] || 1.0;
  const difficulty = Math.min(5, Math.ceil(
    (knowledgePointCount * 0.5 + stepCount * 0.3) * weight
  ));

  const labels = ['', '简单', '较易', '中等', '较难', '困难'];
  const timeEstimates = ['', '3-5分钟', '5-8分钟', '8-12分钟', '12-18分钟', '18分钟以上'];

  res.json({
    status: 'success',
    data: {
      difficulty,
      label: labels[difficulty],
      timeEstimate: timeEstimates[difficulty],
      formula: `min(5, ceil((${knowledgePointCount} × 0.5 + ${stepCount} × 0.3) × ${weight}))`,
    },
  });
});

// Tool: generate_thinking_process_template
app.post('/tools/generate_thinking_process_template', (req, res) => {
  const { quizContent, quizType, knowledgePoints } = req.body;

  const templates: Record<string, string> = {
    '选择题': `# 解题思路

## 1. 理解题意
- 仔细阅读题目，找出关键信息
- 明确问题要求

## 2. 分析选项
- 逐一分析每个选项
- 使用排除法

## 3. 知识点应用
相关知识点：${knowledgePoints?.join(', ') || '待确定'}

## 4. 验证答案
- 检查推理过程
- 确认答案合理性`,

    '解答题': `# 解题思路

## 1. 审题
- 理解题目条件
- 明确求解目标
- 识别隐含条件

## 2. 制定策略
相关知识点：${knowledgePoints?.join(', ') || '待确定'}
- 选择合适方法
- 规划解题步骤

## 3. 详细求解
[AI将在这里生成具体步骤]

## 4. 检验
- 验证结果合理性
- 检查计算过程`,
  };

  const template = templates[quizType] || templates['解答题'];

  res.json({
    status: 'success',
    data: {
      template,
      instructions: 'Use this template as a starting point. Fill in specific details based on the quiz content.',
    },
  });
});

// Tool: search_quizzes
app.post('/tools/search_quizzes', (req, res) => {
  const {
    query,          // 搜索关键词
    subjectId,      // 科目ID
    gradeLevel,     // 年级
    quizType,       // 题型
    difficulty,     // 难度
    knowledgePointId, // 知识点ID
    limit = 10,
    offset = 0
  } = req.body;

  try {
    const db = new Database(DB_PATH, { readonly: true });

    let sql = `
      SELECT DISTINCT
        q.id,
        q.content,
        q.quiz_type,
        q.difficulty,
        q.grade_level,
        q.correct_answer,
        s.name as subject_name,
        GROUP_CONCAT(DISTINCT kp.name) as knowledge_points
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN quiz_knowledge_links qkl ON q.id = qkl.quiz_id
      LEFT JOIN knowledge_points kp ON qkl.knowledge_point_id = kp.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (query) {
      sql += ` AND q.content LIKE ?`;
      params.push(`%${query}%`);
    }

    if (subjectId) {
      sql += ` AND q.subject_id = ?`;
      params.push(subjectId);
    }

    if (gradeLevel) {
      sql += ` AND q.grade_level = ?`;
      params.push(gradeLevel);
    }

    if (quizType) {
      sql += ` AND q.quiz_type = ?`;
      params.push(quizType);
    }

    if (difficulty) {
      sql += ` AND q.difficulty = ?`;
      params.push(difficulty);
    }

    if (knowledgePointId) {
      sql += ` AND qkl.knowledge_point_id = ?`;
      params.push(knowledgePointId);
    }

    sql += ` GROUP BY q.id ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const quizzes = db.prepare(sql).all(...params);

    // Get total count
    let countSql = `
      SELECT COUNT(DISTINCT q.id) as total
      FROM quizzes q
      LEFT JOIN quiz_knowledge_links qkl ON q.id = qkl.quiz_id
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (query) {
      countSql += ` AND q.content LIKE ?`;
      countParams.push(`%${query}%`);
    }
    if (subjectId) {
      countSql += ` AND q.subject_id = ?`;
      countParams.push(subjectId);
    }
    if (gradeLevel) {
      countSql += ` AND q.grade_level = ?`;
      countParams.push(gradeLevel);
    }
    if (quizType) {
      countSql += ` AND q.quiz_type = ?`;
      countParams.push(quizType);
    }
    if (difficulty) {
      countSql += ` AND q.difficulty = ?`;
      countParams.push(difficulty);
    }
    if (knowledgePointId) {
      countSql += ` AND qkl.knowledge_point_id = ?`;
      countParams.push(knowledgePointId);
    }

    const { total } = db.prepare(countSql).get(...countParams) as any;

    db.close();

    res.json({
      status: 'success',
      data: {
        quizzes,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Tool: search_knowledge_points
app.post('/tools/search_knowledge_points', (req, res) => {
  const {
    query,       // 搜索关键词
    subjectId,   // 科目ID
    gradeLevel,  // 年级
    parentId,    // 父知识点ID (null 表示只搜索根节点)
    limit = 20
  } = req.body;

  try {
    const db = new Database(DB_PATH, { readonly: true });

    let sql = `
      SELECT
        kp.id,
        kp.name,
        kp.code,
        kp.level,
        kp.grade_level,
        kp.parent_id,
        s.name as subject_name,
        parent_kp.name as parent_name,
        (SELECT COUNT(*) FROM knowledge_points WHERE parent_id = kp.id) as children_count
      FROM knowledge_points kp
      LEFT JOIN subjects s ON kp.subject_id = s.id
      LEFT JOIN knowledge_points parent_kp ON kp.parent_id = parent_kp.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (query) {
      sql += ` AND kp.name LIKE ?`;
      params.push(`%${query}%`);
    }

    if (subjectId) {
      sql += ` AND kp.subject_id = ?`;
      params.push(subjectId);
    }

    if (gradeLevel) {
      sql += ` AND kp.grade_level = ?`;
      params.push(gradeLevel);
    }

    if (parentId !== undefined) {
      if (parentId === null) {
        sql += ` AND kp.parent_id IS NULL`;
      } else {
        sql += ` AND kp.parent_id = ?`;
        params.push(parentId);
      }
    }

    sql += ` ORDER BY kp.level ASC, kp.name ASC LIMIT ?`;
    params.push(limit);

    const knowledgePoints = db.prepare(sql).all(...params);

    db.close();

    res.json({
      status: 'success',
      data: {
        knowledgePoints,
        count: knowledgePoints.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Tool: get_quiz_details
app.post('/tools/get_quiz_details', (req, res) => {
  const { quizId } = req.body;

  if (!quizId) {
    return res.status(400).json({
      status: 'error',
      error: 'quizId is required'
    });
  }

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Get quiz basic info
    const quiz = db.prepare(`
      SELECT
        q.*,
        s.name as subject_name,
        s.code as subject_code
      FROM quizzes q
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE q.id = ?
    `).get(quizId);

    if (!quiz) {
      db.close();
      return res.status(404).json({
        status: 'error',
        error: 'Quiz not found'
      });
    }

    // Get knowledge points
    const knowledgePoints = db.prepare(`
      SELECT
        kp.id,
        kp.name,
        kp.code,
        kp.level,
        qkl.confidence_score,
        qkl.link_type
      FROM quiz_knowledge_links qkl
      JOIN knowledge_points kp ON qkl.knowledge_point_id = kp.id
      WHERE qkl.quiz_id = ?
      ORDER BY kp.level ASC
    `).all(quizId);

    // Get analysis if exists
    const analysis = db.prepare(`
      SELECT * FROM quiz_analyses WHERE quiz_id = ?
    `).get(quizId);

    db.close();

    res.json({
      status: 'success',
      data: {
        quiz,
        knowledgePoints,
        analysis: analysis || null
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Helper functions
function filterTreeByGrade(tree: any[], gradeLevel: string): any[] {
  return tree.map(node => ({
    ...node,
    children: node.children ? filterTreeByGrade(node.children, gradeLevel) : [],
  })).filter(node =>
    !node.gradeLevel || node.gradeLevel === gradeLevel || node.children.length > 0
  );
}

function countNodes(tree: any[]): number {
  return tree.reduce((sum, node) =>
    sum + 1 + (node.children ? countNodes(node.children) : 0), 0
  );
}

app.listen(PORT, () => {
  console.log(`Quiz Analyzer MCP Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
