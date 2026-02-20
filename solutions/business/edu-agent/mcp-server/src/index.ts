#!/usr/bin/env node
/**
 * EduAgent Unified MCP Server
 *
 * Merged tools from lesson-plan-designer and problem-explainer plus navigate_to.
 *
 * Tools:
 * 1.  write_output          - Write structured data to frontend form
 * 2.  navigate_to           - Navigate frontend to a specific route
 * 3.  get_textbook_subjects - Get available subjects
 * 4.  get_textbook_grades   - Get grades for a subject
 * 5.  get_textbook_volumes  - Get volumes
 * 6.  get_textbook_chapters - Get chapter tree
 * 7.  get_curriculum_standards - Get curriculum standards
 * 8.  get_subjects          - Get problem-explainer subjects
 * 9.  get_knowledge_points  - Get knowledge points
 * 10. calculate_difficulty  - Calculate problem difficulty
 * 11. generate_script_template - Generate explanation script template
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ALL_SYNC_FIELDS, validateAndFixField } from './schemas.js';
import {
  getTextbookSubjects,
  getTextbookGrades,
  getTextbookVolumes,
  getTextbookChapters,
  getCurriculumStandards,
  getSubjects,
  getKnowledgePoints,
  calculateDifficulty,
} from './data-loader.js';

const server = new Server(
  { name: 'edu-agent-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const navigateToTool: Tool = {
  name: 'navigate_to',
  description: `导航用户浏览器到指定页面。

可用路由:
- "/" : 主页 (Hub)
- "/lesson-plan" : 备课设计页面
- "/problem-explain" : 讲题解析页面

当用户表达备课需求时，导航到 /lesson-plan。
当用户表达讲题/解题需求时，导航到 /problem-explain。

示例:
{ "route": "/lesson-plan", "reason": "用户需要设计教案" }`,
  inputSchema: {
    type: 'object',
    properties: {
      route: {
        type: 'string',
        enum: ['/', '/lesson-plan', '/problem-explain'],
        description: '目标路由',
      },
      reason: {
        type: 'string',
        description: '导航原因（展示给用户）',
      },
    },
    required: ['route'],
  },
};

const writeOutputTool: Tool = {
  name: 'write_output',
  description: `将结构化内容写入前端界面的指定字段。

备课字段: title, subject, gradeLevel, duration, objectives, standards, materials, activities, assessment, differentiation
讲题字段: problemAnalysis, keyKnowledge, solutionSteps, answer, commonMistakes, relatedProblems, hints, difficulty

使用方式: 分析完一个部分后立即调用，前端会显示同步按钮让用户确认。`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...ALL_SYNC_FIELDS],
        description: '要更新的字段名',
      },
      value: {
        description: '字段值（类型取决于字段）',
      },
      preview: {
        type: 'string',
        description: '简短预览描述，显示在同步按钮上',
      },
    },
    required: ['field', 'value', 'preview'],
  },
};

const getTextbookSubjectsTool: Tool = {
  name: 'get_textbook_subjects',
  description: '获取所有可用教材学科列表。返回: ["数学", "物理", "化学"]',
  inputSchema: { type: 'object', properties: {} },
};

const getTextbookGradesTool: Tool = {
  name: 'get_textbook_grades',
  description: '获取指定学科的年级列表。示例: { "subject": "数学" } → [1,2,...,9]',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '学科名称' },
    },
    required: ['subject'],
  },
};

const getTextbookVolumesTool: Tool = {
  name: 'get_textbook_volumes',
  description: '获取指定学科和年级的册别。示例: { "subject": "数学", "grade": 3 } → ["上册", "下册"]',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      grade: { type: 'number' },
    },
    required: ['subject', 'grade'],
  },
};

const getTextbookChaptersTool: Tool = {
  name: 'get_textbook_chapters',
  description: '获取指定教材版本的章节树。示例: { "subject": "数学", "grade": 3, "volume": "上册" }',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      grade: { type: 'number' },
      volume: { type: 'string' },
    },
    required: ['subject', 'grade', 'volume'],
  },
};

const getCurriculumStandardsTool: Tool = {
  name: 'get_curriculum_standards',
  description: `获取课程标准数据，支持按学段、类型、领域、关键词过滤。
示例: { "subject": "数学", "stage": "义务教育阶段第二学段", "keyword": "分数" }`,
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '学科 (数学/物理/化学)' },
      stage: { type: 'string', description: '学段' },
      standardType: { type: 'string', description: '标准类型: 内容要求/学业要求' },
      contentDomain: { type: 'string', description: '内容领域' },
      keyword: { type: 'string', description: '关键词搜索' },
    },
    required: ['subject'],
  },
};

const getSubjectsTool: Tool = {
  name: 'get_subjects',
  description: '获取讲题支持的学科列表',
  inputSchema: { type: 'object', properties: {} },
};

const getKnowledgePointsTool: Tool = {
  name: 'get_knowledge_points',
  description: '获取指定学科的知识点列表。示例: { "subject": "math" }',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '学科ID (math, physics, chemistry等)' },
      grade: { type: 'string', description: '年级（可选）' },
    },
    required: ['subject'],
  },
};

const calculateDifficultyTool: Tool = {
  name: 'calculate_difficulty',
  description: '根据知识点数量和步骤数计算难度(1-5)。示例: { "knowledgePointCount": 3, "stepCount": 5 }',
  inputSchema: {
    type: 'object',
    properties: {
      knowledgePointCount: { type: 'number' },
      stepCount: { type: 'number' },
    },
    required: ['knowledgePointCount', 'stepCount'],
  },
};

const generateScriptTemplateTool: Tool = {
  name: 'generate_script_template',
  description: '生成讲稿模板结构',
  inputSchema: {
    type: 'object',
    properties: {
      problemContent: { type: 'string' },
      subject: { type: 'string' },
      knowledgePoints: { type: 'array', items: { type: 'string' } },
      solutionSteps: { type: 'array' },
      answer: { type: 'string' },
      difficulty: { type: 'number' },
      commonMistakes: { type: 'array', items: { type: 'string' } },
    },
    required: ['problemContent', 'subject', 'knowledgePoints', 'solutionSteps', 'answer', 'difficulty'],
  },
};

// ============================================================================
// HANDLERS
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    navigateToTool,
    writeOutputTool,
    getTextbookSubjectsTool,
    getTextbookGradesTool,
    getTextbookVolumesTool,
    getTextbookChaptersTool,
    getCurriculumStandardsTool,
    getSubjectsTool,
    getKnowledgePointsTool,
    calculateDifficultyTool,
    generateScriptTemplateTool,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // === navigate_to ===
      case 'navigate_to': {
        const { route, reason } = args as { route: string; reason?: string };
        // Return output_update format with __navigation__ field
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              data: { field: '__navigation__', value: route, preview: reason || `导航到 ${route}` },
              status: 'success',
            }),
          }],
        };
      }

      // === write_output ===
      case 'write_output': {
        const { field, value, preview } = args as { field: string; value: unknown; preview: string };
        if (!ALL_SYNC_FIELDS.includes(field as any)) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ data: { error: `Invalid field: ${field}` }, status: 'error' }) }],
            isError: true,
          };
        }
        const validation = validateAndFixField(field, value);
        if (!validation.success) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ data: { error: validation.errors.join('; '), field }, status: 'error' }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ data: { field, value: validation.data, preview }, status: 'success' }) }],
        };
      }

      // === Textbook tools ===
      case 'get_textbook_subjects':
        return json(getTextbookSubjects());

      case 'get_textbook_grades': {
        const { subject } = args as { subject: string };
        return json(getTextbookGrades(subject));
      }

      case 'get_textbook_volumes': {
        const { subject, grade } = args as { subject: string; grade: number };
        return json(getTextbookVolumes(subject, grade));
      }

      case 'get_textbook_chapters': {
        const { subject, grade, volume } = args as { subject: string; grade: number; volume: string };
        return json(getTextbookChapters(subject, grade, volume));
      }

      case 'get_curriculum_standards': {
        const { subject, stage, standardType, contentDomain, keyword } = args as {
          subject: string; stage?: string; standardType?: string; contentDomain?: string; keyword?: string;
        };
        return json(getCurriculumStandards(subject, stage, standardType, contentDomain, keyword));
      }

      // === Problem tools ===
      case 'get_subjects':
        return json(getSubjects());

      case 'get_knowledge_points': {
        const { subject, grade } = args as { subject: string; grade?: string };
        return json(getKnowledgePoints(subject, grade));
      }

      case 'calculate_difficulty': {
        const { knowledgePointCount, stepCount } = args as { knowledgePointCount: number; stepCount: number };
        return json(calculateDifficulty(knowledgePointCount, stepCount));
      }

      case 'generate_script_template': {
        const input = args as {
          problemContent: string; subject: string; knowledgePoints: string[];
          solutionSteps: unknown[]; answer: string; difficulty: number; commonMistakes?: string[];
        };
        const template = {
          title: `${input.subject}题目讲解`,
          sections: [
            { name: '题目呈现', content: input.problemContent },
            { name: '知识点回顾', content: input.knowledgePoints.join('、') },
            { name: '解题过程', steps: input.solutionSteps },
            { name: '答案', content: input.answer },
            ...(input.commonMistakes?.length ? [{ name: '易错点提醒', content: input.commonMistakes.join('；') }] : []),
            { name: '总结', content: `本题难度${input.difficulty}/5，涉及${input.knowledgePoints.length}个知识点` },
          ],
        };
        return json(template);
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error}` }], isError: true };
  }
});

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('EduAgent MCP Server started (11 tools)');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
