#!/usr/bin/env node
/**
 * Live Lesson MCP Server
 *
 * Tools:
 * 1. load_lesson - Load lesson manifest and initialize board state
 * 2. reveal_nodes - Make board skeleton nodes visible
 * 3. highlight_nodes - Flash/highlight specific nodes
 * 4. show_confusion_probes - Show diagnostic probe buttons for a confusion point
 * 5. dismiss_probes - Clear all probes and highlights
 * 6. write_output - Sync data to frontend (platform mechanism)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SYNC_FIELDS, type SyncField, type WriteOutputInput, type WriteOutputResult } from './types.js';
import { validateField } from './schemas.js';
import { stateManager } from './state-manager.js';

// Create the MCP server
const server = new Server(
  {
    name: 'live-lesson-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

/**
 * Internal: Sync current board state to frontend via write_output format
 * Returns the MCP content response for board state
 */
function syncBoardState(): { content: Array<{ type: string; text: string }> } {
  const state = stateManager.getBoardState();
  if (!state) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            error: 'No board state to sync. Call load_lesson first.',
          } satisfies WriteOutputResult),
        },
      ],
    };
  }

  const result: WriteOutputResult = {
    data: {
      field: 'boardState',
      value: state,
      preview: `板书状态已更新 (${state.visibleNodeIds.length} 个节点可见)`,
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

// Tool definitions

const loadLessonTool: Tool = {
  name: 'load_lesson',
  description: `加载课程清单并初始化板书状态机。

每次教学会话开始时必须首先调用此工具。

Example:
{ "lessonId": "math-linear-eq-intro" }

Returns: Initial board state with visible nodes`,
  inputSchema: {
    type: 'object',
    properties: {
      lessonId: {
        type: 'string',
        description: 'Lesson ID (must match a directory in data/lessons/)',
      },
    },
    required: ['lessonId'],
  },
};

const revealNodesTool: Tool = {
  name: 'reveal_nodes',
  description: `点亮指定板书骨架节点，使其在黑板上显示。

调用此工具后会自动同步板书状态到前端。

Example:
{ "nodeIds": ["arithmetic-xiaoming-dist", "arithmetic-xiaohong-dist"] }

Use this to progressively reveal the lesson content as the student advances through the material.`,
  inputSchema: {
    type: 'object',
    properties: {
      nodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of node IDs to make visible',
      },
    },
    required: ['nodeIds'],
  },
};

const highlightNodesTool: Tool = {
  name: 'highlight_nodes',
  description: `高亮闪烁指定板书节点，用于强调关键概念。

- color: "yellow" 用于强调焦点概念, "red" 用于标记困惑点, "blue" 用于其他
- durationMs: 高亮持续毫秒数，0 表示清除所有高亮
- 自动同步板书状态到前端

Example (highlight equation equals sign in yellow for 4 seconds):
{ "nodeIds": ["equation-equals"], "color": "yellow", "durationMs": 4000 }

Example (clear all highlights):
{ "nodeIds": [], "color": "yellow", "durationMs": 0 }`,
  inputSchema: {
    type: 'object',
    properties: {
      nodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of node IDs to highlight',
      },
      color: {
        type: 'string',
        enum: ['yellow', 'red', 'blue'],
        description: 'Highlight color (default: yellow)',
      },
      durationMs: {
        type: 'number',
        description: 'Duration in milliseconds (0 = clear all highlights, default: 3000)',
      },
    },
    required: ['nodeIds'],
  },
};

const showConfusionProbesTool: Tool = {
  name: 'show_confusion_probes',
  description: `展示二级诊断探针按钮，精准定位学生困惑来源。

当学生表现出困惑时（说"不明白"、发送 [CONFUSED] 信号等），调用此工具：
1. 从课程清单查找对应困惑点
2. 写入 activeProbes（前端显示诊断按钮）
3. 高亮对应板书节点（红色）
4. 自动同步板书状态到前端

Available confusion point IDs:
- "cp-speed-ratio" - 关于1.2倍速度的困惑
- "cp-variable-setup" - 关于设未知数x的困惑
- "cp-equation-balance" - 关于等号含义的困惑

After probes are shown, wait for [PROBE_SELECTED] {probeId} message from frontend,
then call dismiss_probes() and provide Socratic remediation.`,
  inputSchema: {
    type: 'object',
    properties: {
      confusionPointId: {
        type: 'string',
        description: 'Confusion point ID from the lesson manifest',
      },
    },
    required: ['confusionPointId'],
  },
};

const dismissProbesTool: Tool = {
  name: 'dismiss_probes',
  description: `清除所有诊断探针按钮和高亮状态。

在学生选择了探针（收到 [PROBE_SELECTED] 消息）后调用此工具，
然后用苏格拉底方式讲解 remediation 内容。

自动同步板书状态到前端。`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const writeOutputTool: Tool = {
  name: 'write_output',
  description: `Write data to the frontend (platform sync mechanism).

Valid fields: ${SYNC_FIELDS.join(', ')}

- boardState: Current board state object
- teacherMessage: Teacher message string

The platform detects this tool call and broadcasts an output_update event to the frontend.

Example:
{
  "field": "teacherMessage",
  "value": "很好！你注意到了速度的比值关系。",
  "preview": "教师反馈消息"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...SYNC_FIELDS],
        description: 'The field to update',
      },
      value: {
        description: 'The value for the field',
      },
      preview: {
        type: 'string',
        description: 'Human-readable summary',
      },
    },
    required: ['field', 'value', 'preview'],
  },
};

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      loadLessonTool,
      revealNodesTool,
      highlightNodesTool,
      showConfusionProbesTool,
      dismissProbesTool,
      writeOutputTool,
    ],
  };
});

// Handle call_tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ── load_lesson ──────────────────────────────────────────────────────
  if (name === 'load_lesson') {
    const { lessonId } = args as { lessonId: string };

    try {
      const state = stateManager.loadLesson(lessonId);
      const manifest = stateManager.getManifest()!;

      // Sync to frontend
      const syncResponse = syncBoardState();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: `课程 "${manifest.title}" 加载成功`,
              lessonId,
              phases: manifest.teachingPhases.map(p => p.id),
              totalNodes: manifest.boardNodes.length,
              initiallyVisibleNodes: state.visibleNodeIds,
              confusionPoints: manifest.confusionPoints.map(cp => cp.id),
              boardStateSync: JSON.parse(syncResponse.content[0].text),
            }),
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: msg }) }],
        isError: true,
      };
    }
  }

  // ── reveal_nodes ─────────────────────────────────────────────────────
  if (name === 'reveal_nodes') {
    const { nodeIds } = args as { nodeIds: string[] };

    try {
      stateManager.revealNodes(nodeIds);
      return syncBoardState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: msg }) }],
        isError: true,
      };
    }
  }

  // ── highlight_nodes ───────────────────────────────────────────────────
  if (name === 'highlight_nodes') {
    const { nodeIds, color = 'yellow', durationMs = 3000 } = args as {
      nodeIds: string[];
      color?: 'yellow' | 'red' | 'blue';
      durationMs?: number;
    };

    try {
      stateManager.highlightNodes(nodeIds, color, durationMs);
      return syncBoardState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: msg }) }],
        isError: true,
      };
    }
  }

  // ── show_confusion_probes ─────────────────────────────────────────────
  if (name === 'show_confusion_probes') {
    const { confusionPointId } = args as { confusionPointId: string };

    try {
      stateManager.showConfusionProbes(confusionPointId);
      return syncBoardState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: msg }) }],
        isError: true,
      };
    }
  }

  // ── dismiss_probes ─────────────────────────────────────────────────────
  if (name === 'dismiss_probes') {
    try {
      stateManager.dismissProbes();
      return syncBoardState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: msg }) }],
        isError: true,
      };
    }
  }

  // ── write_output ───────────────────────────────────────────────────────
  if (name === 'write_output') {
    const input = args as unknown as WriteOutputInput;

    if (!SYNC_FIELDS.includes(input.field as SyncField)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              error: `Invalid field: ${input.field}. Valid fields: ${SYNC_FIELDS.join(', ')}`,
            } satisfies WriteOutputResult),
          },
        ],
        isError: true,
      };
    }

    const validation = validateField(input.field as SyncField, input.value);

    if (!validation.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              error: `Validation failed for "${input.field}": ${validation.errors.join('; ')}`,
            } satisfies WriteOutputResult),
          },
        ],
        isError: true,
      };
    }

    const result: WriteOutputResult = {
      data: {
        field: input.field as SyncField,
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

  // Unknown tool
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          status: 'error',
          error: `Unknown tool: ${name}`,
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
  console.error('Live Lesson MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
