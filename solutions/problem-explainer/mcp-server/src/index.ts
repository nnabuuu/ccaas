#!/usr/bin/env node

/**
 * Problem Explainer MCP REST Server
 *
 * This is an HTTP REST API that exposes MCP tools for CCAAS.
 * The CCAAS backend's rest-adapter will call these endpoints.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
  SYNC_FIELDS,
  Subject,
  KnowledgePoint,
  WriteOutputInput,
  GetKnowledgePointsInput,
} from './types.js';
import { validateAndFixField } from './schemas.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.MCP_PORT || 3004;

// Default subjects
const SUBJECTS: Subject[] = [
  { id: 'math', name: '数学', hasFormula: true },
  { id: 'physics', name: '物理', hasFormula: true },
  { id: 'chemistry', name: '化学', hasFormula: true },
  { id: 'biology', name: '生物', hasFormula: false },
  { id: 'chinese', name: '语文', hasFormula: false },
  { id: 'english', name: '英语', hasFormula: false },
  { id: 'history', name: '历史', hasFormula: false },
  { id: 'geography', name: '地理', hasFormula: false },
  { id: 'politics', name: '政治', hasFormula: false },
];

// Knowledge points cache
const knowledgePointsCache = new Map<string, KnowledgePoint[]>();

// Load knowledge points from data directory
function loadKnowledgePoints(): void {
  // Try multiple possible paths
  const possiblePaths = [
    path.resolve(process.cwd(), 'data/knowledge-points'),
    path.resolve(process.cwd(), '../data/knowledge-points'),
    path.resolve(__dirname, '../../data/knowledge-points'),
  ];

  let dataDir: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      dataDir = p;
      break;
    }
  }

  if (!dataDir) {
    console.warn('Knowledge points directory not found, using empty cache');
    return;
  }

  console.log(`Loading knowledge points from: ${dataDir}`);

  for (const subject of SUBJECTS) {
    const filePath = path.join(dataDir, `${subject.id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        knowledgePointsCache.set(subject.id, data.knowledgePoints || []);
        console.log(`  Loaded ${subject.id}: ${data.knowledgePoints?.length || 0} points`);
      } catch (error) {
        console.error(`Failed to load knowledge points for ${subject.id}:`, error);
      }
    }
  }
}

// Get subject by ID or name
function getSubjectById(idOrName: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === idOrName || s.name === idOrName);
}

// Find knowledge point by ID recursively
function findKnowledgePointById(
  points: KnowledgePoint[],
  id: string
): KnowledgePoint | undefined {
  for (const point of points) {
    if (point.id === id) {
      return point;
    }
    if (point.children) {
      const found = findKnowledgePointById(point.children, id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}


// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'problem-explainer-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// TOOL: write_output
// ============================================================================

app.post('/tools/write_output', (req: Request, res: Response) => {
  const input = req.body as WriteOutputInput;

  // 1. Validate field name
  if (!input.field || !SYNC_FIELDS.includes(input.field)) {
    res.status(400).json({
      status: 'error',
      error: `Invalid field: ${input.field}. Valid fields: ${SYNC_FIELDS.join(', ')}`,
    });
    return;
  }

  // 2. Use Zod Schema to validate and auto-fix
  const validation = validateAndFixField(input.field, input.value);

  if (!validation.success) {
    console.error(`[write_output] Validation failed for ${input.field}:`, validation.errors);
    res.status(400).json({
      status: 'error',
      error: `Data validation failed: ${validation.errors.join('; ')}`,
      field: input.field,
      originalValue: input.value,
    });
    return;
  }

  // 3. Return validated/fixed data
  if (validation.fixed) {
    console.log(`[write_output] Data for ${input.field} was auto-fixed`);
  }

  res.json({
    status: 'success',
    data: {
      field: input.field,
      value: validation.data, // Use validated/fixed data
      preview: input.preview,
    },
  });
});

// ============================================================================
// TOOL: get_subjects
// ============================================================================

app.get('/tools/get_subjects', (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: SUBJECTS,
  });
});

app.post('/tools/get_subjects', (_req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: SUBJECTS,
  });
});

// ============================================================================
// TOOL: get_knowledge_points
// ============================================================================

app.post('/tools/get_knowledge_points', (req: Request, res: Response) => {
  const input = req.body as GetKnowledgePointsInput;

  if (!input.subject) {
    res.status(400).json({
      status: 'error',
      error: 'subject is required',
      availableSubjects: SUBJECTS.map((s) => ({ id: s.id, name: s.name })),
    });
    return;
  }

  const subject = getSubjectById(input.subject);
  if (!subject) {
    res.status(404).json({
      status: 'error',
      error: `Unknown subject: ${input.subject}`,
      availableSubjects: SUBJECTS.map((s) => ({ id: s.id, name: s.name })),
    });
    return;
  }

  let points = knowledgePointsCache.get(subject.id) || [];

  // Filter by parentId
  if (input.parentId) {
    const parent = findKnowledgePointById(points, input.parentId);
    points = parent?.children || [];
  }

  // Filter by grade
  if (input.grade) {
    points = points.filter((p) => !p.grade || p.grade === input.grade);
  }

  res.json({
    status: 'success',
    data: points,
  });
});

// ============================================================================
// TOOL: calculate_difficulty
// ============================================================================

app.post('/tools/calculate_difficulty', (req: Request, res: Response) => {
  const input = req.body as { knowledgePointCount: number; stepCount: number };

  const knowledgePointCount = input.knowledgePointCount || 0;
  const stepCount = input.stepCount || 0;

  // Formula: min(5, ceil((知识点数 × 0.5) + (步骤数 × 0.3)))
  const rawScore = knowledgePointCount * 0.5 + stepCount * 0.3;
  const difficulty = Math.min(5, Math.ceil(rawScore));

  const difficultyLabels: Record<number, string> = {
    1: '基础',
    2: '简单',
    3: '中等',
    4: '较难',
    5: '困难',
  };

  res.json({
    status: 'success',
    data: {
      difficulty,
      label: difficultyLabels[difficulty] || '未知',
      formula: `min(5, ceil((${knowledgePointCount} × 0.5) + (${stepCount} × 0.3))) = ${difficulty}`,
      estimatedTime: `${Math.max(3, difficulty * 2)}-${difficulty * 3}分钟`,
    },
  });
});

// ============================================================================
// TOOL: generate_script_template
// ============================================================================

app.post('/tools/generate_script_template', (req: Request, res: Response) => {
  const input = req.body as {
    problemContent: string;
    subject: string;
    knowledgePoints: string[];
    solutionSteps: Array<{
      stepNumber: number;
      description: string;
      explanation: string;
      formula?: string;
    }>;
    answer: string;
    difficulty: number;
    commonMistakes?: string[];
  };

  // Validate required fields
  if (!input.problemContent || !input.subject || !input.knowledgePoints || !input.solutionSteps || !input.answer || !input.difficulty) {
    res.status(400).json({
      status: 'error',
      error: 'Missing required fields: problemContent, subject, knowledgePoints, solutionSteps, answer, difficulty',
    });
    return;
  }

  const difficultyStars = '⭐'.repeat(input.difficulty);
  const estimatedTime = `${Math.max(3, input.difficulty * 2)}-${input.difficulty * 3}分钟`;

  // Generate step content
  const stepsContent = input.solutionSteps
    .map((step) => {
      let stepText = `#### 第${step.stepNumber}步：${step.description}\n\n${step.explanation}`;
      if (step.formula) {
        stepText += `\n\n**公式**: $${step.formula}$`;
      }
      return stepText;
    })
    .join('\n\n');

  // Generate knowledge points content
  const knowledgeContent = input.knowledgePoints
    .map((kp, i) => `${i + 1}. **${kp}**`)
    .join('\n');

  // Generate mistakes content
  const mistakesContent = input.commonMistakes
    ? input.commonMistakes.map((m) => `- ${m}`).join('\n')
    : '- 注意审题，不要遗漏条件';

  const script = `# 讲题讲稿

## 题目

${input.problemContent}

## 考查知识点

${knowledgeContent}

## 难度评估

- 难度：${difficultyStars} (${input.difficulty}/5)
- 预计讲解时长：${estimatedTime}

---

## 讲解正文

### 开场 (30秒)

同学们好，今天我们来看一道关于${input.subject}的题目。这道题主要考查${input.knowledgePoints.slice(0, 2).join('和')}的知识。

### 题目分析 (1分钟)

首先，让我们来读懂这道题。

**已知条件**：
（从题目中提取）

**求解目标**：
（明确要求什么）

### 解题过程 (${Math.max(3, input.difficulty * 2)}分钟)

${stepsContent}

### 答案与总结 (1分钟)

**最终答案**：${input.answer}

**解题关键**：
这道题的关键在于掌握${input.knowledgePoints[0]}的应用方法。

### 易错提醒 (30秒)

做这类题时要特别注意：

${mistakesContent}

---

## 练习题

请尝试用同样的方法解决以下题目：

1. （相似题目 - 换个数字）
2. （变式题目 - 稍微增加难度）

---

*讲稿生成时间：${new Date().toISOString()}*
`;

  res.json({
    status: 'success',
    data: {
      script,
      metadata: {
        subject: input.subject,
        difficulty: input.difficulty,
        knowledgePointCount: input.knowledgePoints.length,
        stepCount: input.solutionSteps.length,
        estimatedTime,
      },
      instructions:
        '请使用 Write 工具将讲稿保存到 .agent-workspace/sessions/{sessionId}/outputs/讲稿.md',
    },
  });
});

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    error: err.message || 'Internal server error',
  });
});

// ============================================================================
// START SERVER
// ============================================================================

// Load knowledge points data
loadKnowledgePoints();

app.listen(PORT, () => {
  console.log(`Problem Explainer MCP REST Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  /health`);
  console.log(`  POST /tools/write_output`);
  console.log(`  GET  /tools/get_subjects`);
  console.log(`  POST /tools/get_subjects`);
  console.log(`  POST /tools/get_knowledge_points`);
  console.log(`  POST /tools/calculate_difficulty`);
  console.log(`  POST /tools/generate_script_template`);
});
