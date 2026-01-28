#!/usr/bin/env node
/**
 * Problem Explainer MCP Server (stdio transport)
 *
 * This is a stdio wrapper that Claude Code CLI can spawn.
 * It defines the same tools as the REST API and forwards calls to the REST server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SYNC_FIELDS, type SyncField, type WriteOutputInput, type WriteOutputResult } from './types.js';

// REST API base URL (the Express server running on port 3004)
const REST_API_URL = process.env.MCP_REST_URL || 'http://localhost:3004';

// Create the MCP server
const server = new Server(
  {
    name: 'problem-explainer-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const writeOutputTool: Tool = {
  name: 'write_output',
  description: `将讲解内容同步到前端界面的指定字段。

用于实时更新讲解进度，让学生看到分析结果。

可用字段 (field):
- problemAnalysis: 题目分析 (string)
- keyKnowledge: 核心知识点 (string[])
- solutionSteps: 解题步骤 (SolutionStep[])
- answer: 最终答案 (string)
- commonMistakes: 易错点 (string[])
- relatedProblems: 变式练习 (string[])
- hints: 提示 (string)
- difficulty: 难度 1-5 (number)

使用方式:
1. 分析完一个部分后立即调用
2. 每个字段可以多次更新（会覆盖之前的值）
3. preview 参数用于在同步按钮上显示简短描述`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      field: {
        type: 'string',
        description: '要更新的字段名',
        enum: [...SYNC_FIELDS],
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

const getSubjectsTool: Tool = {
  name: 'get_subjects',
  description: '获取所有支持的学科列表',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

const getKnowledgePointsTool: Tool = {
  name: 'get_knowledge_points',
  description: '获取指定学科的知识点列表',
  inputSchema: {
    type: 'object' as const,
    properties: {
      subject: {
        type: 'string',
        description: '学科ID，如 math, physics, chemistry 等',
      },
      grade: {
        type: 'string',
        description: '年级（可选）',
      },
    },
    required: ['subject'],
  },
};

const calculateDifficultyTool: Tool = {
  name: 'calculate_difficulty',
  description: `根据知识点数量和解题步骤数计算题目难度。

公式: min(5, ceil((知识点数 × 0.5) + (步骤数 × 0.3)))

返回: 难度等级 (1-5), 难度标签, 预计讲解时间`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      knowledgePointCount: {
        type: 'number',
        description: '知识点数量',
      },
      stepCount: {
        type: 'number',
        description: '解题步骤数',
      },
    },
    required: ['knowledgePointCount', 'stepCount'],
  },
};

const generateScriptTemplateTool: Tool = {
  name: 'generate_script_template',
  description: '生成讲稿模板，包含完整的讲解结构',
  inputSchema: {
    type: 'object' as const,
    properties: {
      problemContent: {
        type: 'string',
        description: '题目内容',
      },
      subject: {
        type: 'string',
        description: '学科',
      },
      knowledgePoints: {
        type: 'array',
        items: { type: 'string' },
        description: '知识点列表',
      },
      solutionSteps: {
        type: 'array',
        description: '解题步骤',
      },
      answer: {
        type: 'string',
        description: '答案',
      },
      difficulty: {
        type: 'number',
        description: '难度 1-5',
      },
      commonMistakes: {
        type: 'array',
        items: { type: 'string' },
        description: '易错点（可选）',
      },
    },
    required: ['problemContent', 'subject', 'knowledgePoints', 'solutionSteps', 'answer', 'difficulty'],
  },
};

const tools: Tool[] = [
  writeOutputTool,
  getSubjectsTool,
  getKnowledgePointsTool,
  calculateDifficultyTool,
  generateScriptTemplateTool,
];

// ============================================================================
// HELPER: Call REST API
// ============================================================================

async function callRestApi(endpoint: string, method: string, body?: unknown): Promise<unknown> {
  const url = `${REST_API_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      status: 'error',
      error: `Failed to call REST API: ${error}`,
    };
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'write_output': {
        const result = await callRestApi('/tools/write_output', 'POST', args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      }

      case 'get_subjects': {
        const result = await callRestApi('/tools/get_subjects', 'GET');
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      }

      case 'get_knowledge_points': {
        const result = await callRestApi('/tools/get_knowledge_points', 'POST', args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      }

      case 'calculate_difficulty': {
        const result = await callRestApi('/tools/calculate_difficulty', 'POST', args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      }

      case 'generate_script_template': {
        const result = await callRestApi('/tools/generate_script_template', 'POST', args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      }

      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${error}` }],
      isError: true,
    };
  }
});

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is used for MCP protocol)
  console.error('Problem Explainer MCP Server (stdio) started');
  console.error(`REST API URL: ${REST_API_URL}`);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
