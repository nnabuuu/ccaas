#!/usr/bin/env node
/**
 * Quiz Analyzer MCP Server
 *
 * Provides tools for:
 * 1. write_output - Send structured quiz analysis data to the frontend
 * 2. get_knowledge_points_tree - Get hierarchical knowledge points structure
 * 3. verify_knowledge_point_tags - Verify AI-proposed knowledge point tags
 * 4. generate_thinking_process_template - Generate template for solution approach
 * 5. search_quizzes - Search quizzes by various criteria
 * 6. search_knowledge_points - Search knowledge points
 * 7. get_quiz_details - Get detailed quiz information
 * 8. list_root_knowledge_points - Get root-level knowledge point categories
 * 9. get_knowledge_point_children - Get child nodes of a knowledge point
 * 10. get_knowledge_point_path - Get path from root to a node
 * 11. search_knowledge_points_under - Search knowledge points within a scope
 * 12. analyze_student_answer - Analyze student answer and identify errors
 * 13. recommend_by_error_pattern - Recommend resources based on error patterns
 * 14. get_error_statistics - Get error statistics for analysis
 * 15. save_complete_analysis - Save complete quiz analysis to database
 * 16. search_knowledge_points_by_priority - Search KPs by keywords in priority order (Mode C)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SYNC_FIELDS, type SyncField, type WriteOutputInput, type WriteOutputResult } from './common/types.js';
import { validateAndFixField } from './common/schemas.js';
import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { jsonDataLoader } from './json-data-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database (kept for backwards compatibility with some tools)
const dbPath = path.resolve(__dirname, '../../data/quiz-analyzer.db');
const db = new Database(dbPath);

// Load JSON data on startup
jsonDataLoader.load();

// Create the MCP server
const server = new Server(
  {
    name: 'quiz-analyzer-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define the write_output tool
const writeOutputTool: Tool = {
  name: 'write_output',
  description: `Write quiz analysis content to the frontend form. The frontend will display a "Sync to Form" button allowing the user to apply the changes.

Valid fields: ${SYNC_FIELDS.join(', ')}

Field schemas:
- quiz_analysis: string (Overall analysis summary in Markdown)
- knowledge_point_tags: KnowledgePointTag[] (Array of knowledge points with confidence scores)
- thinking_process: string (解题思路 in Markdown)
- solution_steps: SolutionStep[] (Array of solution steps)
- correct_answer: string (The correct answer)
- common_mistakes: Mistake[] (Array of common mistakes with frequency and remediation)
- knowledge_gap_analysis: string (Analysis of knowledge gaps in Markdown)
- difficulty: number (Difficulty level 1-5)
- related_quizzes: RelatedQuiz[] (Array of related quizzes with similarity scores)
- time_estimate: string (Estimated solving time)

Example for quiz_analysis:
{
  "field": "quiz_analysis",
  "value": "这道题主要考察二次函数的图像与性质...",
  "preview": "题目分析已生成"
}

Example for knowledge_point_tags:
{
  "field": "knowledge_point_tags",
  "value": [
    {
      "id": 123,
      "name": "二次函数",
      "confidence": 0.95,
      "source": "题干"
    }
  ],
  "preview": "3个知识点标签"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...SYNC_FIELDS],
        description: 'The quiz analysis field to update',
      },
      value: {
        oneOf: [
          { type: 'string', description: 'For text fields (quiz_analysis, thinking_process, etc.)' },
          { type: 'number', description: 'For numeric fields (difficulty)' },
          { type: 'array', description: 'For array fields (knowledge_point_tags, solution_steps, etc.)' },
        ],
        description: 'The value for the field.',
      },
      preview: {
        type: 'string',
        description: 'Human-readable summary shown on the sync button',
      },
    },
    required: ['field', 'value', 'preview'],
  },
};

// Define other tools
const getKnowledgePointsTreeTool: Tool = {
  name: 'get_knowledge_points_tree',
  description: `Get hierarchical knowledge points structure for a subject and grade level.

Returns a tree structure with parent nodes and child nodes for navigation.

Example usage:
{ "subjectId": "math", "gradeLevel": "9" }

Example response:
{
  "subject": "数学",
  "gradeLevel": "9",
  "tree": [
    {
      "id": 1,
      "name": "代数",
      "level": 0,
      "children": [
        { "id": 2, "name": "二次函数", "level": 1, "children": [] }
      ]
    }
  ]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      subjectId: {
        type: 'string',
        description: 'Subject ID or name',
      },
      gradeLevel: {
        type: 'string',
        description: 'Grade level (e.g., "9")',
      },
    },
  },
};

const verifyKnowledgePointTagsTool: Tool = {
  name: 'verify_knowledge_point_tags',
  description: `Verify AI-proposed knowledge point tags against the database.

Checks if the proposed knowledge points exist and returns validation results.

Example usage:
{
  "proposedTags": [
    { "id": 123, "name": "二次函数", "confidence": 0.95 }
  ]
}

Returns:
{
  "valid": [{ "id": 123, "name": "二次函数", "exists": true }],
  "invalid": [],
  "suggestions": []
}`,
  inputSchema: {
    type: 'object',
    properties: {
      proposedTags: {
        type: 'array',
        description: 'Array of proposed knowledge point tags',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
    },
    required: ['proposedTags'],
  },
};

const generateThinkingProcessTemplateTool: Tool = {
  name: 'generate_thinking_process_template',
  description: `Generate a thinking process template based on quiz type.

Returns a Markdown template with appropriate sections for the quiz type.

Available quiz types: 选择题, 解答题, 填空题, 判断题, 计算题

Example usage:
{
  "quizContent": "求解方程 x^2 + 2x + 1 = 0",
  "quizType": "解答题",
  "knowledgePoints": ["一元二次方程", "因式分解"]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      quizContent: {
        type: 'string',
        description: 'The quiz content',
      },
      quizType: {
        type: 'string',
        description: 'Type of quiz (选择题, 解答题, etc.)',
      },
      knowledgePoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Related knowledge points',
      },
    },
    required: ['quizContent', 'quizType', 'knowledgePoints'],
  },
};

const searchQuizzesTool: Tool = {
  name: 'search_quizzes',
  description: `Search quizzes by various criteria.

Returns matching quizzes with their basic information.

Example usage:
{
  "keyword": "二次函数",
  "subjectId": "math",
  "gradeLevel": "9",
  "quizType": "选择题",
  "limit": 10
}`,
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Search keyword' },
      subjectId: { type: 'string', description: 'Subject ID' },
      gradeLevel: { type: 'string', description: 'Grade level' },
      quizType: { type: 'string', description: 'Quiz type' },
      limit: { type: 'number', description: 'Maximum results (default: 20)' },
    },
  },
};

const searchKnowledgePointsTool: Tool = {
  name: 'search_knowledge_points',
  description: `Search knowledge points by name or ID.

Returns matching knowledge points with their hierarchy information.

Example usage:
{
  "keyword": "函数",
  "subjectId": "math",
  "limit": 10
}`,
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Search keyword' },
      subjectId: { type: 'string', description: 'Subject ID' },
      limit: { type: 'number', description: 'Maximum results (default: 20)' },
    },
  },
};

const getQuizDetailsTool: Tool = {
  name: 'get_quiz_details',
  description: `Get detailed information about a specific quiz.

Returns complete quiz information including content, answer, analysis, etc.

Example usage:
{ "quizId": 123 }`,
  inputSchema: {
    type: 'object',
    properties: {
      quizId: { type: 'number', description: 'Quiz ID' },
    },
    required: ['quizId'],
  },
};

const getRootCategoriesTool: Tool = {
  name: 'list_root_knowledge_points',
  description: `Get root-level knowledge point categories for a subject.

Returns top-level knowledge point categories. Use this as the starting point for hierarchical traversal (Mode B): get the root nodes, then call get_knowledge_point_children to drill down.

Example usage:
{ "subjectId": "math" }`,
  inputSchema: {
    type: 'object',
    properties: {
      subjectId: { type: 'string', description: 'Subject ID or name' },
    },
    required: ['subjectId'],
  },
};

const getChildrenNodesTool: Tool = {
  name: 'get_knowledge_point_children',
  description: `Get child knowledge points of a parent knowledge point node.

Returns all direct children. Each child includes an isLeaf indicator (children.length === 0). Use this for hierarchical traversal (Mode B): if a child has no children, it is a leaf node suitable for tagging.

Example usage:
{ "parentId": "1998702114322399941" }`,
  inputSchema: {
    type: 'object',
    properties: {
      parentId: { type: 'number', description: 'Parent knowledge point ID' },
    },
    required: ['parentId'],
  },
};

const getNodePathTool: Tool = {
  name: 'get_knowledge_point_path',
  description: `Get the path from root to a specific knowledge point node.

Returns the full hierarchy path as an array (e.g., ["初中知识点", "数与代数", "函数", "二次函数"]). Use this to build breadcrumb navigation or verify a node's position in the tree.

Example usage:
{ "nodeId": "1998702114322399941" }`,
  inputSchema: {
    type: 'object',
    properties: {
      nodeId: { type: 'number', description: 'Knowledge point ID' },
    },
    required: ['nodeId'],
  },
};

const searchInScopeTool: Tool = {
  name: 'search_knowledge_points_under',
  description: `Search knowledge points within a specific knowledge point subtree.

Searches only within the descendants of a specific parent node. Use this when a branch has many children (>10) and you want to narrow down by keyword instead of traversing all children manually.

Example usage:
{
  "scopeId": "1998702114322399941",
  "keyword": "对称轴"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      scopeId: { type: 'number', description: 'Scope (parent) knowledge point ID' },
      keyword: { type: 'string', description: 'Search keyword' },
    },
    required: ['scopeId', 'keyword'],
  },
};

const saveCompleteAnalysisTool: Tool = {
  name: 'save_complete_analysis',
  description: `Save complete quiz analysis to the database.

Saves all analysis fields to the quiz_analyses table for persistence.

Example usage:
{
  "quizId": 123,
  "analysis": {
    "quiz_analysis": "...",
    "knowledge_point_tags": [...],
    "thinking_process": "...",
    ...
  }
}`,
  inputSchema: {
    type: 'object',
    properties: {
      quizId: { type: 'number', description: 'Quiz ID' },
      analysis: { type: 'object', description: 'Complete analysis data' },
    },
    required: ['quizId', 'analysis'],
  },
};

// NEW TOOLS for JSON data source

const parseQuizContentTool: Tool = {
  name: 'parse_quiz_content',
  description: `Parse raw quiz content into structured data.

Extracts quiz stem, options, correct answer, and quiz type from raw text.

Example usage:
{
  "content": "已知函数 f(x) = x² - 2x + 1，求 f(x) 的最小值。\\nA. -1\\nB. 0\\nC. 1\\nD. 2"
}

Returns:
{
  "stem": "已知函数 f(x) = x² - 2x + 1，求 f(x) 的最小值。",
  "options": ["A. -1", "B. 0", "C. 1", "D. 2"],
  "quizType": "choice"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Raw quiz content' },
    },
    required: ['content'],
  },
};

const searchKnowledgePointsJSONTool: Tool = {
  name: 'search_knowledge_points_json',
  description: `Search knowledge points from JSON data source (faster than database).

Returns matching knowledge points with hierarchy information.

Example usage:
{
  "keyword": "函数",
  "subjectId": "math-001",
  "gradeLevel": "初中",
  "limit": 10
}`,
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Search keyword' },
      subjectId: { type: 'string', description: 'Subject ID (optional)' },
      gradeLevel: { type: 'string', description: 'Grade level (optional)' },
      limit: { type: 'number', description: 'Maximum results (default: 20)' },
    },
    required: ['keyword'],
  },
};

const batchSearchKnowledgePointsTool: Tool = {
  name: 'batch_search_knowledge_points',
  description: `Search knowledge points by multiple keywords in a single call.

Returns a deduplicated, ranked list. Each result includes:
- fullName: full path from root to this node (e.g. "识字与写字 > 拼音 > 声母 > b") — use this to understand ambiguous short names
- pathNames: same path as an array
- matchedKeywords: which of the input keywords hit this knowledge point
- matchScore: number of matched keywords × 10 + depth level
  (more keyword matches wins; within same count, deeper/more specific nodes rank higher)

Use this when a quiz involves multiple knowledge points and you want to find them all efficiently. The fullName field eliminates the need to call get_knowledge_point_path for disambiguation.

Example usage:
{
  "keywords": ["一次函数", "二次函数", "交点"],
  "gradeLevel": "初中",
  "limit": 15
}

Example response:
{
  "count": 3,
  "results": [
    {
      "id": "...",
      "name": "一次函数图像的交点问题",
      "matchedKeywords": ["一次函数", "交点"],
      "matchScore": 25
    },
    ...
  ]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of keywords to search (e.g. extracted from quiz content)',
        minItems: 1,
      },
      subjectId: { type: 'string', description: 'Subject ID to filter (optional)' },
      gradeLevel: { type: 'string', description: 'Grade level to filter (optional)' },
      limit: { type: 'number', description: 'Maximum results (default: 20)' },
      leafOnly: {
        type: 'boolean',
        description: 'When true, return only leaf nodes (most specific knowledge points with no children). Falls back to all matches if no leaf matches. Recommended for quiz analysis to avoid over-general parent nodes.',
      },
    },
    required: ['keywords'],
  },
};

const searchKnowledgePointsByPriorityTool: Tool = {
  name: 'search_knowledge_points_by_priority',
  description: `Search knowledge points by multiple keywords in priority order (Mode C - primary search path).

Keywords are searched sequentially in importance order. Results are deduplicated across rounds — a KP only appears in the round where it was first found.

Use this as the primary knowledge point search mode. The agent decides how many rounds are sufficient based on semantic coverage of the quiz question.

Example usage:
{
  "keywords": ["勾股定理", "直角三角形", "面积"],
  "leafOnly": true
}

Example response:
{
  "rounds": [
    {
      "keyword": "勾股定理",
      "found": 2,
      "newKPs": [{"id": "...", "name": "勾股定理的实际应用", "fullName": "初中知识点 > 图形与几何 > 图形的性质 > 三角形 > 勾股定理 > 勾股定理的实际应用", "isLeaf": true}],
      "cumulativeCount": 2
    },
    { "keyword": "直角三角形", "found": 1, "newKPs": [{"id": "...", "name": "直角三角形三边关系", "fullName": "...", "isLeaf": true}], "cumulativeCount": 3 },
    { "keyword": "面积", "found": 0, "newKPs": [], "cumulativeCount": 3 }
  ],
  "allResults": [...],
  "coveredKeywords": ["勾股定理", "直角三角形"],
  "uncoveredKeywords": ["面积"],
  "coverageScore": 0.67
}

Each KP in newKPs and allResults includes fullName (full path from root) and pathNames (array). Use fullName to disambiguate nodes with identical short names without calling get_knowledge_point_path.

Agent interpretation:
- rounds[0].newKPs covers core knowledge → likely sufficient for simple questions
- rounds[N].newKPs is empty → that keyword found no new KPs, can be ignored
- coverageScore < 1.0 → some keywords found no matches, may need Mode B for those aspects`,
  inputSchema: {
    type: 'object',
    properties: {
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords sorted by importance (most important/core concept first)',
        minItems: 1,
      },
      leafOnly: {
        type: 'boolean',
        description: 'When true, prefer leaf nodes (most specific KPs with no children). Falls back to all matches if no leaves found. Default: true.',
      },
      gradeLevel: {
        type: 'string',
        description: 'Grade level to filter results (optional)',
      },
      limitPerKeyword: {
        type: 'number',
        description: 'Max KPs to return per keyword round (default: 5)',
      },
    },
    required: ['keywords'],
  },
};

const searchCatalogTool: Tool = {
  name: 'list_subjects',
  description: `Search and list subjects (学科) from the knowledge base.

Returns matching subjects with their IDs and metadata. Use this to get a subjectId before calling list_root_knowledge_points to start hierarchical traversal.

Example usage:
{
  "keyword": "初中",
  "limit": 10
}`,
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Search keyword' },
      limit: { type: 'number', description: 'Maximum results (default: 20)' },
    },
    required: ['keyword'],
  },
};

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      writeOutputTool,
      getKnowledgePointsTreeTool,
      verifyKnowledgePointTagsTool,
      generateThinkingProcessTemplateTool,
      searchQuizzesTool,
      searchKnowledgePointsTool,
      getQuizDetailsTool,
      getRootCategoriesTool,
      getChildrenNodesTool,
      getNodePathTool,
      searchInScopeTool,
      saveCompleteAnalysisTool,
      // New JSON-based tools
      parseQuizContentTool,
      searchKnowledgePointsJSONTool,
      batchSearchKnowledgePointsTool,
      searchKnowledgePointsByPriorityTool,
      searchCatalogTool,
    ],
  };
});

// Handle call_tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Handle write_output tool
  if (name === 'write_output') {
    const input = args as unknown as WriteOutputInput;

    // Validate the field name
    if (!SYNC_FIELDS.includes(input.field as SyncField)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              error: `Invalid field: ${input.field}. Valid fields are: ${SYNC_FIELDS.join(', ')}`,
            } satisfies WriteOutputResult),
          },
        ],
        isError: true,
      };
    }

    // Validate and fix the value using Zod schema
    const validation = validateAndFixField(input.field as SyncField, input.value);

    if (!validation.success) {
      console.error(`[write_output] Validation failed for ${input.field}:`, validation.errors);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              error: `Data validation failed for field "${input.field}": ${validation.errors.join('; ')}`,
            } satisfies WriteOutputResult),
          },
        ],
        isError: true,
      };
    }

    // Log if data was auto-fixed
    if (validation.fixed) {
      console.error(`[write_output] Data for ${input.field} was auto-fixed:`)
    }

    // Return the result with validated/fixed data
    const result: WriteOutputResult = {
      data: {
        field: input.field,
        value: validation.data,
        preview: input.preview,
      },
      status: 'success',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  }

  // Handle get_knowledge_points_tree tool
  if (name === 'get_knowledge_points_tree') {
    const { subjectId, gradeLevel } = args as { subjectId?: string; gradeLevel?: string };

    try {
      // Get root nodes from JSON data
      const rootNodes = jsonDataLoader.getRootKnowledgePoints({
        subjectId,
        gradeLevel,
      });

      // Recursively build tree with children
      const buildTree = (kp: any): any => {
        const children = jsonDataLoader.getChildrenKnowledgePoints(kp.id);
        return {
          id: kp.id,
          name: kp.name,
          level: kp.level,
          subject_id: kp.subjectId,
          grade_level: kp.gradeLevel,
          parent_id: kp.parentId,
          children: children.map(child => buildTree(child)),
        };
      };

      const tree = rootNodes.map(node => buildTree(node));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              subject: subjectId || 'all',
              gradeLevel: gradeLevel || 'all',
              count: tree.length,
              tree,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to get knowledge points tree: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Handle verify_knowledge_point_tags tool
  if (name === 'verify_knowledge_point_tags') {
    const { proposedTags } = args as { proposedTags: Array<{ id: string | number; name: string; confidence: number }> };

    try {
      const valid: any[] = [];
      const invalid: any[] = [];
      const suggestions: any[] = [];

      for (const tag of proposedTags) {
        // Convert ID to string (JSON data uses string IDs)
        const tagId = String(tag.id);
        const node = jsonDataLoader.getKnowledgePointById(tagId);

        if (node) {
          valid.push({ ...tag, exists: true });
        } else {
          invalid.push({ ...tag, exists: false });

          // Try to find similar nodes by name (fuzzy search)
          const similar = jsonDataLoader.searchKnowledgePoints(tag.name, { limit: 3 });

          if (similar.length > 0) {
            suggestions.push({
              original: tag,
              suggestions: similar.map(kp => ({ id: kp.id, name: kp.name })),
            });
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ valid, invalid, suggestions }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to verify tags: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Handle generate_thinking_process_template tool
  if (name === 'generate_thinking_process_template') {
    const { quizType, knowledgePoints } = args as {
      quizContent: string;
      quizType: string;
      knowledgePoints: string[];
    };

    const templates: Record<string, string> = {
      选择题: `# 解题思路

## 1. 理解题意
- 仔细阅读题目，找出关键信息
- 明确问题要求

## 2. 分析选项
- 逐一分析每个选项
- 使用排除法

## 3. 知识点应用
相关知识点：${knowledgePoints.join(', ')}

## 4. 验证答案
- 检查推理过程
- 确认答案合理性`,

      解答题: `# 解题思路

## 1. 审题
- 理解题目条件
- 明确求解目标
- 识别隐含条件

## 2. 制定策略
相关知识点：${knowledgePoints.join(', ')}
- 选择合适方法
- 规划解题步骤

## 3. 详细求解
[AI将在这里生成具体步骤]

## 4. 检验
- 验证答案合理性
- 检查计算过程`,

      填空题: `# 解题思路

## 1. 分析题目
- 找出已知条件
- 确定填空位置的作用

## 2. 应用知识点
相关知识点：${knowledgePoints.join(', ')}

## 3. 推理求解
[AI将在这里生成具体推理]

## 4. 验证答案
- 代入检验
- 确认合理性`,
    };

    const template = templates[quizType] || templates['解答题'];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            template,
            quizType,
            knowledgePoints,
          }, null, 2),
        },
      ],
    };
  }

  // Handle search_quizzes tool
  if (name === 'search_quizzes') {
    const { keyword, subjectId, gradeLevel, quizType, limit = 20 } = args as {
      keyword?: string;
      subjectId?: string;
      gradeLevel?: string;
      quizType?: string;
      limit?: number;
    };

    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (keyword) {
        conditions.push('content LIKE ?');
        params.push(`%${keyword}%`);
      }
      if (subjectId) {
        conditions.push('subject_id = ?');
        params.push(subjectId);
      }
      if (gradeLevel) {
        conditions.push('grade_level = ?');
        params.push(gradeLevel);
      }
      if (quizType) {
        conditions.push('quiz_type = ?');
        params.push(quizType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const quizzes = db.prepare(`
        SELECT id, content, quiz_type, subject_id, grade_level, difficulty
        FROM quizzes
        ${whereClause}
        LIMIT ?
      `).all(...params, limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              count: quizzes.length,
              quizzes,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to search quizzes: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Handle get_quiz_details tool
  if (name === 'get_quiz_details') {
    const { quizId } = args as { quizId: number };

    try {
      const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);

      if (!quiz) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                data: { error: `Quiz not found: ${quizId}` },
                status: 'error',
              }),
            },
          ],
          isError: true,
        };
      }

      // Get linked knowledge points
      const knowledgePoints = db.prepare(`
        SELECT kp.id, kp.name, qkl.confidence_score
        FROM quiz_knowledge_links qkl
        JOIN knowledge_points kp ON kp.id = qkl.knowledge_point_id
        WHERE qkl.quiz_id = ?
      `).all(quizId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              quiz,
              knowledgePoints,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to get quiz details: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Handle save_complete_analysis tool
  if (name === 'save_complete_analysis') {
    const { quizId, analysis } = args as { quizId: number; analysis: any };

    try {
      // Save to quiz_analyses table
      db.prepare(`
        INSERT OR REPLACE INTO quiz_analyses (
          quiz_id, quiz_analysis, knowledge_point_tags, thinking_process,
          solution_steps, correct_answer, common_mistakes, knowledge_gap_analysis,
          difficulty, related_quizzes, time_estimate, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        quizId,
        analysis.quiz_analysis || null,
        JSON.stringify(analysis.knowledge_point_tags || []),
        analysis.thinking_process || null,
        JSON.stringify(analysis.solution_steps || []),
        analysis.correct_answer || null,
        JSON.stringify(analysis.common_mistakes || []),
        analysis.knowledge_gap_analysis || null,
        analysis.difficulty || null,
        JSON.stringify(analysis.related_quizzes || []),
        analysis.time_estimate || null
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Analysis saved successfully',
              quizId,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to save analysis: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Handle parse_quiz_content tool
  if (name === 'parse_quiz_content') {
    const { content } = args as { content: string };

    try {
      // Simple parser for quiz content
      const lines = content.trim().split('\n').filter(line => line.trim());

      // Detect quiz type
      const hasOptions = lines.some(line => /^[A-D][.、:：)]/.test(line.trim()));
      const quizType = hasOptions ? 'choice' : 'fill';

      // Extract stem (all lines before options)
      let stemLines: string[] = [];
      let optionLines: string[] = [];
      let inOptions = false;

      for (const line of lines) {
        if (/^[A-D][.、:：)]/.test(line.trim())) {
          inOptions = true;
          optionLines.push(line.trim());
        } else if (inOptions) {
          optionLines.push(line.trim());
        } else {
          stemLines.push(line.trim());
        }
      }

      const stem = stemLines.join('\n');
      const options = optionLines;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              stem,
              options,
              quizType,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to parse quiz content: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Handle search_knowledge_points_json tool
  if (name === 'search_knowledge_points_json') {
    const { keyword, subjectId, gradeLevel, limit = 20 } = args as {
      keyword: string;
      subjectId?: string;
      gradeLevel?: string;
      limit?: number;
    };

    try {
      const results = jsonDataLoader.searchKnowledgePoints(keyword, {
        subjectId,
        gradeLevel,
        limit,
      });

      // Format results for output
      const formattedResults = results.map(kp => ({
        id: kp.id,
        name: kp.name,
        level: kp.level,
        subjectId: kp.subjectId,
        gradeLevel: kp.gradeLevel,
        parentId: kp.parentId,
        difficultyContribution: kp.difficultyContribution,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              count: formattedResults.length,
              results: formattedResults,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to search knowledge points: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Handle batch_search_knowledge_points tool
  if (name === 'batch_search_knowledge_points') {
    const { keywords, subjectId, gradeLevel, limit = 20, leafOnly } = args as {
      keywords: string[];
      subjectId?: string;
      gradeLevel?: string;
      limit?: number;
      leafOnly?: boolean;
    };

    try {
      const results = jsonDataLoader.batchSearchKnowledgePoints(keywords, {
        subjectId,
        gradeLevel,
        limit,
        leafOnly,
      });

      const formattedResults = results.map(kp => ({
        id: kp.id,
        name: kp.name.trim(),
        fullName: kp.fullName,
        pathNames: kp.pathNames,
        level: kp.level,
        subjectId: kp.subjectId,
        gradeLevel: kp.gradeLevel,
        parentId: kp.parentId,
        matchedKeywords: kp.matchedKeywords,
        matchScore: kp.matchScore,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              count: formattedResults.length,
              keywords,
              results: formattedResults,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to batch search knowledge points: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Handle list_root_knowledge_points tool
  if (name === 'list_root_knowledge_points') {
    const { subjectId, gradeLevel } = args as { subjectId?: string; gradeLevel?: string };

    try {
      const roots = jsonDataLoader.getRootKnowledgePoints({ subjectId, gradeLevel });

      const formattedRoots = roots.map(kp => {
        const { fullName } = jsonDataLoader.getFullName(kp.id) ?? { fullName: kp.name };
        return {
          id: kp.id,
          name: kp.name.trim(),
          fullName,
          level: kp.level,
          subjectId: kp.subjectId,
          gradeLevel: kp.gradeLevel,
          childCount: kp.children.length,
          isLeaf: kp.children.length === 0,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              count: formattedRoots.length,
              subjectId: subjectId || 'all',
              results: formattedRoots,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // Handle get_knowledge_point_children tool
  if (name === 'get_knowledge_point_children') {
    const { parentId } = args as { parentId: string };

    try {
      const children = jsonDataLoader.getChildrenKnowledgePoints(parentId);

      const formattedChildren = children.map(kp => {
        const { fullName } = jsonDataLoader.getFullName(kp.id) ?? { fullName: kp.name };
        return {
          id: kp.id,
          name: kp.name.trim(),
          fullName,
          level: kp.level,
          subjectId: kp.subjectId,
          gradeLevel: kp.gradeLevel,
          childCount: kp.children.length,
          isLeaf: kp.children.length === 0,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              parentId,
              count: formattedChildren.length,
              children: formattedChildren,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // Handle get_knowledge_point_path tool
  if (name === 'get_knowledge_point_path') {
    const { nodeId } = args as { nodeId: string };

    try {
      const pathNodes = jsonDataLoader.getKnowledgePointPath(nodeId);

      if (pathNodes.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: `Node not found: ${nodeId}` }) }],
          isError: true,
        };
      }

      const pathNames = pathNodes.map(kp => kp.name.trim());
      const pathFormatted = pathNodes.map(kp => ({
        id: kp.id,
        name: kp.name.trim(),
        level: kp.level,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              nodeId,
              depth: pathNodes.length,
              path: pathNames,
              nodes: pathFormatted,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // Handle search_knowledge_points_under tool
  if (name === 'search_knowledge_points_under') {
    const { scopeId, keyword } = args as { scopeId: string; keyword: string };

    try {
      // BFS to collect all descendant IDs of the scope node
      const descendantIds = new Set<string>();
      const queue = [scopeId];
      while (queue.length > 0) {
        const id = queue.shift()!;
        const node = jsonDataLoader.getKnowledgePointById(id);
        if (node) {
          node.children.forEach(childId => {
            descendantIds.add(childId);
            queue.push(childId);
          });
        }
      }

      // Search all KPs by keyword, then filter to descendants only
      const allMatches = jsonDataLoader.searchKnowledgePoints(keyword);
      const scopedResults = allMatches.filter(kp => descendantIds.has(kp.id));

      const formattedResults = scopedResults.map(kp => {
        const { pathNames, fullName } = jsonDataLoader.getFullName(kp.id) ?? { pathNames: [], fullName: kp.name };
        return {
          id: kp.id,
          name: kp.name.trim(),
          fullName,
          pathNames,
          level: kp.level,
          subjectId: kp.subjectId,
          gradeLevel: kp.gradeLevel,
          parentId: kp.parentId,
          isLeaf: kp.children.length === 0,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              scopeId,
              keyword,
              count: formattedResults.length,
              results: formattedResults,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // Handle search_knowledge_points_by_priority tool (Mode C)
  if (name === 'search_knowledge_points_by_priority') {
    const { keywords, leafOnly = true, gradeLevel, limitPerKeyword = 5 } = args as {
      keywords: string[];
      leafOnly?: boolean;
      gradeLevel?: string;
      limitPerKeyword?: number;
    };

    try {
      const result = jsonDataLoader.searchKnowledgePointsByPriority(keywords, { leafOnly, gradeLevel, limitPerKeyword });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // Handle list_subjects tool
  if (name === 'list_subjects') {
    const { keyword, limit = 20 } = args as {
      keyword: string;
      limit?: number;
    };

    try {
      const results = jsonDataLoader.searchSubjects(keyword, { limit });

      // Format results for output
      const formattedResults = results.map(subject => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        gradeLevels: subject.gradeLevels,
        hasFormula: subject.hasFormula,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              count: formattedResults.length,
              results: formattedResults,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `Failed to search catalog: ${errorMessage}` },
              status: 'error',
            }),
          },
        ],
        isError: true,
      };
    }
  }

  // Unknown tool
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          data: { error: `Unknown tool: ${name}` },
          status: 'error',
        }),
      },
    ],
    isError: true,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr since stdout is used for MCP communication
  console.error('Quiz Analyzer MCP Server started');
  console.error(`Database: ${dbPath}`);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
