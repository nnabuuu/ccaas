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
 * 12. save_complete_analysis - Save complete quiz analysis to database
 * 13. parse_quiz_content - Parse raw quiz text into structured fields
 * 14. batch_search_knowledge_points - Search multiple keywords at once (Mode A)
 * 15. search_knowledge_points_by_priority - Search KPs by keywords in priority order (Mode C)
 * 16. list_subjects - List all subjects or filter by keyword
 * 17. get_knowledge_point_subtree - Get all descendant nodes of one or more parent nodes
 * 18. list_knowledge_points_at_level - Get all nodes at a specific tree depth for a grade level
 * 19. get_leaf_nodes - Get only leaf nodes under one or more parent nodes
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
- quizAnalysis: string (Overall analysis summary in Markdown)
- knowledgePointTags: KnowledgePointTag[] (Array of knowledge points with confidence scores)
- thinkingProcess: string (解题思路 in Markdown)
- solutionSteps: SolutionStep[] (Array of solution steps)
- correctAnswer: string (The correct answer)
- commonMistakes: Mistake[] (Array of common mistakes with frequency and remediation)
- knowledgeGapAnalysis: string (Analysis of knowledge gaps in Markdown)
- difficulty: number (Difficulty level 1-5)
- difficultyAssessment: { score: number (1-5), pitfalls: string[], reasoning: string } (Rich difficulty with pitfalls)
- relatedQuizzes: RelatedQuiz[] (Array of related quizzes with similarity scores)
- timeEstimate: string (Estimated solving time)
- timeAssessment: { estimate: string, reasoning: string } (Rich time estimate with reasoning)
- kpRefinementResult: { tags: [{id,name,confidence,role}], traversalType, tagCount, trace } (Complete KP refinement result)
- parsedContent: { stem: string, options: string[], correctAnswer?: string, quizType: 'choice'|'fill'|'subjective' } (Parsed quiz structure)

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
          { type: 'object', description: 'For structured fields (kp_refinement_result)' },
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
  description: `Get hierarchical knowledge points structure for a specific subject or grade level.

IMPORTANT: You must provide at least one of subjectId or gradeLevel. Without a filter this would return 31,000+ nodes and is rejected.

NOTE: subjectId here is the KP tree subject ID (visible in any search result's subjectId field), NOT a list_subjects catalog ID. The simplest filter is gradeLevel: "小学", "初中", or "高中".

Example usage:
{ "subjectId": "3601171b-5ac9-46ba-8dec-2022b42b0fa5" }

Example response:
{
  "subject": "3601171b-...",
  "gradeLevel": "all",
  "tree": [
    {
      "id": "...",
      "name": "初中知识点",
      "level": 0,
      "children": [
        { "id": "...", "name": "数与代数", "level": 1, "children": [...] }
      ]
    }
  ]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      subjectId: {
        type: 'string',
        description: 'KP tree subject UUID (from a KP search result\'s subjectId field). Required unless gradeLevel is provided.',
      },
      gradeLevel: {
        type: 'string',
        description: 'Grade level: 小学/初中/高中. Required unless subjectId is provided.',
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
  "valid": [{ "id": "123", "name": "二次函数", "exists": true, "fullName": "初中知识点 > 数与代数 > 函数 > 二次函数", "pathNames": ["初中知识点", "数与代数", "函数", "二次函数"] }],
  "invalid": [{ "id": "bad-id", "name": "unknown", "exists": false }],
  "suggestions": [{ "id": "456", "name": "二次函数的图象与性质", "fullName": "...", "pathNames": [...] }]
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
            id: { type: 'string' },
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
  description: `Search knowledge points by keyword (single keyword, last-resort backup). For multiple keywords use search_knowledge_points_by_priority (Mode C — primary) or batch_search_knowledge_points (Mode A — secondary).

Each result includes: id, name, fullName (root→node path), pathNames (array), level, subjectId, gradeLevel, parentId, isLeaf.

Example usage:
{
  "keyword": "函数",
  "gradeLevel": "初中",
  "limit": 10
}`,
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Search keyword' },
      subjectId: { type: 'string', description: 'Filter by subject ID (optional)' },
      gradeLevel: { type: 'string', description: 'Filter by grade level: 小学/初中/高中 (optional)' },
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
  description: `Get root-level knowledge point categories. Optionally filter by subject or grade level.

Use this as the starting point for hierarchical traversal (Mode B): get root nodes, then call get_knowledge_point_children to drill down.

Each result includes: id, name, fullName, pathNames, level, subjectId, gradeLevel, isLeaf, childCount.

Example usage:
{ "gradeLevel": "初中" }`,
  inputSchema: {
    type: 'object',
    properties: {
      subjectId: { type: 'string', description: 'Filter by subject ID (optional)' },
      gradeLevel: { type: 'string', description: 'Filter by grade level: 小学/初中/高中 (optional)' },
    },
  },
};

const getChildrenNodesTool: Tool = {
  name: 'get_knowledge_point_children',
  description: `Get child knowledge points of a parent knowledge point node.

Returns all direct children. Each child includes: id, name, fullName, pathNames, level, subjectId, gradeLevel, isLeaf (children.length === 0), childCount. Use this for hierarchical traversal (Mode B): if isLeaf is true, the node is suitable for tagging.

Example usage:
{ "parentId": "1998702114322399941" }`,
  inputSchema: {
    type: 'object',
    properties: {
      parentId: { type: 'string', description: 'Parent knowledge point ID' },
    },
    required: ['parentId'],
  },
};

const getNodePathTool: Tool = {
  name: 'get_knowledge_point_path',
  description: `Get the path from root to a specific knowledge point node.

Returns the full hierarchy path as an array (e.g., ["初中知识点", "数与代数", "函数", "二次函数"]). Note: all search tools (batch_search_knowledge_points, search_knowledge_points_by_priority, verify_knowledge_point_tags) already return fullName/pathNames inline — only call this when you have a bare ID with no path context and need to resolve its position.

Example usage:
{ "nodeId": "1998702114322399941" }`,
  inputSchema: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'Knowledge point ID' },
    },
    required: ['nodeId'],
  },
};

const searchInScopeTool: Tool = {
  name: 'search_knowledge_points_under',
  description: `Search knowledge points within a specific knowledge point subtree.

Searches only within the descendants of a specific parent node. Use this when a branch has many children (>10) and you want to narrow down by keyword instead of traversing all children manually.

Each result includes: id, name, fullName (root→node path), pathNames (array), level, subjectId, gradeLevel, parentId, isLeaf.

Example usage:
{
  "scopeId": "1998702114322399941",
  "keyword": "对称轴"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      scopeId: { type: 'string', description: 'Scope (parent) knowledge point ID' },
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
      "fullName": "初中知识点 > 数与代数 > 函数 > 一次函数图像的交点问题",
      "pathNames": ["初中知识点", "数与代数", "函数", "一次函数图像的交点问题"],
      "isLeaf": true,
      "subjectId": "...",
      "gradeLevel": "初中",
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
      "newKPs": [{"id": "...", "name": "勾股定理的实际应用", "fullName": "初中知识点 > 图形与几何 > 图形的性质 > 三角形 > 勾股定理 > 勾股定理的实际应用", "isLeaf": true, "subjectId": "uuid...", "gradeLevel": "初中"}],
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

Each KP in newKPs and allResults includes: fullName (full path from root), pathNames (array), subjectId, gradeLevel, isLeaf. Use fullName to disambiguate nodes with identical short names. Use subjectId/gradeLevel to identify the subject without a separate list_subjects call.

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

const getKnowledgePointSubtreeTool: Tool = {
  name: 'get_knowledge_point_subtree',
  description: `Get all descendant nodes of one or more parent knowledge point nodes (full depth).

Use this for top-down beam search: after selecting the 2 most relevant root/branch nodes, call this once to get their entire subtrees, then filter by level to traverse layer by layer without additional API calls.

Each result node includes: id, name, fullName, pathNames, level, subjectId, gradeLevel, isLeaf, childCount.

Example usage:
{ "nodeIds": ["1998702114322399941", "1998702114322399942"] }

Returns all descendants (including the input nodes themselves), deduplicated.`,
  inputSchema: {
    type: 'object',
    properties: {
      nodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'One or more parent node IDs whose entire subtrees to return',
        minItems: 1,
      },
    },
    required: ['nodeIds'],
  },
};

const listKnowledgePointsAtLevelTool: Tool = {
  name: 'list_knowledge_points_at_level',
  description: `Get all knowledge point nodes at a specific tree depth for a grade level.

Use this as Phase 1 of a two-phase search: retrieve all nodes at level 3 (the "topic" tier), scan their fullName paths to identify the relevant subject branch, pick ≤3 matching nodes, then call get_leaf_nodes to get all leaves under them.

Level numbering (root = level 1):
- level 1: root nodes (e.g., "初中知识点", "2021版")  — 1 per subject
- level 2: major domains (e.g., "数与代数", "图形与几何")
- level 3: topics (e.g., "函数", "方程与不等式", "数的认识")  ← DEFAULT, recommended
- level 4: sub-topics (e.g., "二次函数", "多位数除法")

For math subjects: level 3 typically returns 8–28 nodes per grade, making selection easy.
For broader grade queries: level 3 may return 400+ nodes — use fullName paths to filter by subject
(e.g., math nodes contain "数与代数" or "函数" in their path).

Each result includes: id, name, fullName, pathNames, level, subjectId, gradeLevel, isLeaf, childCount.

Example usage:
{ "gradeLevel": "初中", "level": 3 }
{ "subjectId": "3601171b-5ac9-46ba-8dec-2022b42b0fa5", "level": 3 }`,
  inputSchema: {
    type: 'object',
    properties: {
      gradeLevel: {
        type: 'string',
        description: 'Grade level: 小学/初中/高中. Required unless subjectId is provided.',
      },
      subjectId: {
        type: 'string',
        description: 'Filter to a specific subject UUID (from list_root_knowledge_points). Optional but narrows results significantly.',
      },
      level: {
        type: 'number',
        description: 'Tree depth to retrieve (default: 3). Level 1 = root, level 2 = major domains, level 3 = topics, level 4 = sub-topics.',
      },
    },
  },
};

const getLeafNodesTool: Tool = {
  name: 'get_leaf_nodes',
  description: `Get all leaf knowledge point nodes (isLeaf: true) under one or more parent nodes.

Use this as Phase 2 of a two-phase search: after selecting ≤3 topic-level nodes from list_knowledge_points_at_level, retrieve all their leaf descendants and pick the single best match for the quiz.

Leaf nodes are the most specific knowledge points (no children) and are suitable for tagging.

Each result includes: id, name, fullName, pathNames, level, subjectId, gradeLevel.

Returns up to 200 leaves by default. If truncated, the response includes "truncated: true" — in that case, refine your parent node selection to a more specific topic.

Example usage:
{ "nodeIds": ["id_of_函数", "id_of_方程"] }`,
  inputSchema: {
    type: 'object',
    properties: {
      nodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'One or more parent node IDs whose leaf descendants to return',
        minItems: 1,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of leaves to return (default: 200)',
      },
    },
    required: ['nodeIds'],
  },
};

const searchCatalogTool: Tool = {
  name: 'list_subjects',
  description: `Search and list subjects (学科) from the knowledge base.

Returns matching catalog subjects/chapters from textbook catalog data. Use this in Step 3 to identify which textbook catalog section a quiz belongs to (e.g., "九年级上册 > 第二章 函数").

NOTE: The IDs returned here are catalog entry IDs, NOT the KP tree subjectIds used by list_root_knowledge_points or get_knowledge_points_tree. For Mode B KP traversal, call list_root_knowledge_points with gradeLevel directly.

Omit keyword to list all available subjects. Provide keyword to filter by name.

Each result includes: id, name, code, gradeLevels (array), hasFormula (bool).

Example usage:
{}                         — list all subjects
{ "keyword": "初中" }      — filter by grade level
{ "keyword": "数学" }      — filter by subject name`,
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: 'Optional filter keyword (omit to list all)' },
      limit: { type: 'number', description: 'Maximum results (default: 20)' },
    },
  },
};

const fuzzySearchKnowledgePointsTool: Tool = {
  name: 'fuzzy_search_knowledge_points',
  description: `Fuzzy search knowledge points using bigram/token/substring scoring.

Unlike search_knowledge_points (exact substring match only), this tool finds candidates even when the query and node name differ slightly — e.g. "一元一次方程" will match "一元一次方程的解法".

Scoring formula:
  score = 0.5×bigramOverlap + 0.3×tokenOverlap + 0.15×substringBonus + 0.05×leafBonus

Use this as Phase A (Locate) of the unified KP search: extract 2-4 keywords from the quiz, call this tool for each keyword, then use get_knowledge_point_children to refine.

Each result includes: id, name, fullName, pathNames, score, isLeaf, level, subjectId, gradeLevel.

Example usage:
{ "query": "一元一次方程" }
{ "query": "二次函数", "subject_id": "3601171b-...", "top_k": 5 }`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g. keyword extracted from quiz)',
      },
      subject_id: {
        type: 'string',
        description: 'Optional subject ID to narrow search scope (~31k → ~2k candidates)',
      },
      top_k: {
        type: 'number',
        description: 'Maximum results to return (default: 10)',
      },
    },
    required: ['query'],
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
      // JSON-based tools
      parseQuizContentTool,
      batchSearchKnowledgePointsTool,
      searchKnowledgePointsByPriorityTool,
      searchCatalogTool,
      getKnowledgePointSubtreeTool,
      listKnowledgePointsAtLevelTool,
      getLeafNodesTool,
      fuzzySearchKnowledgePointsTool,
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

    if (!subjectId && !gradeLevel) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          status: 'error',
          error: 'At least one filter (subjectId or gradeLevel) is required to avoid returning the full 31k-node tree. Use gradeLevel ("小学"/"初中"/"高中") as the simplest filter, or pass a subjectId from any KP search result.',
        }) }],
        isError: true,
      };
    }

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
          const cached = jsonDataLoader.getFullName(tagId);
          const { fullName, pathNames } = cached ?? { fullName: node.name, pathNames: [node.name] };
          valid.push({ ...tag, exists: true, fullName, pathNames });
        } else {
          invalid.push({ ...tag, exists: false });

          // Try to find similar nodes by name (fuzzy search)
          const similar = jsonDataLoader.searchKnowledgePoints(tag.name, { limit: 3 });

          if (similar.length > 0) {
            suggestions.push({
              original: tag,
              suggestions: similar.map(kp => {
                const c = jsonDataLoader.getFullName(kp.id);
                const { fullName, pathNames } = c ?? { fullName: kp.name, pathNames: [kp.name] };
                return { id: kp.id, name: kp.name.trim(), fullName, pathNames };
              }),
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
        isLeaf: kp.children.length === 0,
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
        const cached = jsonDataLoader.getFullName(kp.id);
        const { fullName, pathNames } = cached ?? { fullName: kp.name, pathNames: [kp.name] };
        return {
          id: kp.id,
          name: kp.name.trim(),
          fullName,
          pathNames,
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
        const cached = jsonDataLoader.getFullName(kp.id);
        const { fullName, pathNames } = cached ?? { fullName: kp.name, pathNames: [kp.name] };
        return {
          id: kp.id,
          name: kp.name.trim(),
          fullName,
          pathNames,
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

  // Handle search_knowledge_points tool
  if (name === 'search_knowledge_points') {
    const { keyword, subjectId, gradeLevel, limit = 20 } = args as {
      keyword?: string;
      subjectId?: string;
      gradeLevel?: string;
      limit?: number;
    };

    if (!keyword) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ count: 0, keyword: '', results: [] }, null, 2) }],
      };
    }

    try {
      const results = jsonDataLoader.searchKnowledgePoints(keyword, { subjectId, gradeLevel, limit });
      const formattedResults = results.map(kp => {
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
        content: [{ type: 'text', text: JSON.stringify({ count: formattedResults.length, keyword, results: formattedResults }, null, 2) }],
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

      // Search only within the descendant subtree (O(subtree) instead of O(all 31k nodes))
      const scopedResults = jsonDataLoader.searchKnowledgePoints(keyword, { scopeIds: descendantIds });

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
      keyword?: string;
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

  // Handle get_knowledge_point_subtree tool
  if (name === 'get_knowledge_point_subtree') {
    const { nodeIds } = args as { nodeIds: string[] };

    try {
      const MAX_SUBTREE_NODES = 2000;
      const seenIds = new Set<string>();
      const result: any[] = [];

      function collectDescendants(nodeId: string) {
        if (seenIds.has(nodeId) || result.length >= MAX_SUBTREE_NODES) return;
        const node = jsonDataLoader.getKnowledgePointById(nodeId);
        if (!node) return;
        seenIds.add(nodeId);
        const cached = jsonDataLoader.getFullName(node.id);
        const { fullName, pathNames } = cached ?? { fullName: node.name, pathNames: [node.name] };
        result.push({
          id: node.id,
          name: node.name.trim(),
          fullName,
          pathNames,
          level: node.level,
          subjectId: node.subjectId,
          gradeLevel: node.gradeLevel,
          isLeaf: node.children.length === 0,
          childCount: node.children.length,
        });
        for (const childId of node.children) {
          if (result.length >= MAX_SUBTREE_NODES) break;
          collectDescendants(childId);
        }
      }

      for (const nodeId of nodeIds) {
        if (result.length >= MAX_SUBTREE_NODES) break;
        collectDescendants(nodeId);
      }

      const truncated = result.length >= MAX_SUBTREE_NODES;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              nodeIds,
              count: result.length,
              truncated,
              nodes: result,
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

  // Handle list_knowledge_points_at_level tool
  if (name === 'list_knowledge_points_at_level') {
    const { gradeLevel, subjectId, level = 3 } = args as { gradeLevel?: string; subjectId?: string; level?: number };

    if (!gradeLevel && !subjectId) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: 'Provide at least gradeLevel or subjectId to avoid returning all nodes.' }) }],
        isError: true,
      };
    }

    try {
      const allKps = jsonDataLoader.getAllKnowledgePoints();
      const filtered = allKps.filter(kp => {
        if (kp.level !== level) return false;
        if (gradeLevel && kp.gradeLevel !== gradeLevel) return false;
        if (subjectId && kp.subjectId !== subjectId) return false;
        return true;
      });

      // Sort by fullName for readability
      const nodes = filtered.map(kp => {
        const cached = jsonDataLoader.getFullName(kp.id);
        const { fullName, pathNames } = cached ?? { fullName: kp.name, pathNames: [kp.name] };
        return { id: kp.id, name: kp.name.trim(), fullName, pathNames, level: kp.level, subjectId: kp.subjectId, gradeLevel: kp.gradeLevel, isLeaf: kp.children.length === 0, childCount: kp.children.length };
      }).sort((a, b) => a.fullName.localeCompare(b.fullName));

      return {
        content: [{ type: 'text', text: JSON.stringify({ level, gradeLevel: gradeLevel || 'all', subjectId: subjectId || 'all', count: nodes.length, nodes }, null, 2) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // Handle get_leaf_nodes tool
  if (name === 'get_leaf_nodes') {
    const { nodeIds, limit = 200 } = args as { nodeIds: string[]; limit?: number };

    try {
      const collected: any[] = [];
      const seenIds = new Set<string>();

      function collectLeaves(nodeId: string) {
        if (seenIds.has(nodeId) || collected.length >= limit) return;
        seenIds.add(nodeId);
        const node = jsonDataLoader.getKnowledgePointById(nodeId);
        if (!node) return;
        if (node.children.length === 0) {
          // This is a leaf
          const cached = jsonDataLoader.getFullName(node.id);
          const { fullName, pathNames } = cached ?? { fullName: node.name, pathNames: [node.name] };
          collected.push({ id: node.id, name: node.name.trim(), fullName, pathNames, level: node.level, subjectId: node.subjectId, gradeLevel: node.gradeLevel });
        } else {
          for (const childId of node.children) {
            if (collected.length >= limit) break;
            collectLeaves(childId);
          }
        }
      }

      for (const nodeId of nodeIds) {
        collectLeaves(nodeId);
        if (collected.length >= limit) break;
      }

      const truncated = collected.length >= limit;
      const result = collected.slice(0, limit);

      return {
        content: [{ type: 'text', text: JSON.stringify({ nodeIds, count: result.length, truncated, nodes: result }, null, 2) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // Handle fuzzy_search_knowledge_points tool
  if (name === 'fuzzy_search_knowledge_points') {
    const { query, subject_id, top_k = 10 } = args as {
      query: string;
      subject_id?: string;
      top_k?: number;
    };

    if (!query || query.trim().length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ query: '', count: 0, results: [] }, null, 2) }],
      };
    }

    try {
      const results = jsonDataLoader.fuzzySearch(query, {
        subjectId: subject_id,
        topK: top_k,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query,
            subjectId: subject_id || null,
            count: results.length,
            results,
          }, null, 2),
        }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: errorMessage }) }],
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
