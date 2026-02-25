#!/usr/bin/env node
/**
 * Live Lesson MCP Server
 *
 * Tools:
 * 1. load_lesson            - Load lesson manifest and initialize board state; returns full manifest to AI
 * 2. reveal_nodes           - Make board skeleton nodes visible
 * 3. highlight_nodes        - Flash/highlight specific nodes
 * 4. set_phase              - Update the current teaching phase label
 * 5. write_output           - Sync data to frontend (platform mechanism)
 * 6. advance_beat           - Advance to a specific beat in the lesson
 * 7. execute_dynamic_board  - Execute custom chalkboard drawing actions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SYNC_FIELDS, type SyncField, type WriteOutputInput, type WriteOutputResult, type ChalkboardAction } from './types.js';
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
 * Internal: Sync current board state to frontend via write_output format.
 * Always returns the boardState field for backward compatibility.
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
返回完整的 manifest（所有节点内容、教学阶段、teachingNotes），供 AI 掌握全局教学蓝图。

Example:
{ "lessonId": "math-linear-eq-intro" }

Returns: Full manifest + initial board state`,
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

const setPhaseTool: Tool = {
  name: 'set_phase',
  description: `更新当前教学阶段标签，反映教学进度。

调用此工具后会自动同步板书状态到前端。

Example:
{ "phaseId": "equation" }`,
  inputSchema: {
    type: 'object',
    properties: {
      phaseId: {
        type: 'string',
        description: 'Phase ID from the lesson manifest teachingPhases',
      },
    },
    required: ['phaseId'],
  },
};

const writeOutputTool: Tool = {
  name: 'write_output',
  description: `Write data to the frontend (platform sync mechanism).

Valid fields: ${SYNC_FIELDS.join(', ')}

- boardState: Current board state object
- teacherMessage: Teacher message string
- beatState: Beat progress state
- dynamicBoardActions: Array of chalkboard drawing actions
- globalBoardOps: Array of global board operations

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

const advanceBeatTool: Tool = {
  name: 'advance_beat',
  description: `推进到指定 beat，更新课程进度。

调用此工具后，前端会：
1. 更新左侧 GlobalBoard（点亮对应节点）
2. 在 InteractionPanel 显示 narratorText（叙述文本）
3. 显示 expectedQuestions 作为 quick-reply 按钮

标准教学流程：
- 课程开始: advance_beat({ beatId: "beat-1" })
- 学生准备好后: advance_beat({ beatId: "beat-2" })

返回: { beatState, narratorText, expectedQuestions }`,
  inputSchema: {
    type: 'object',
    properties: {
      beatId: { type: 'string', description: 'Beat ID from lesson manifest' },
    },
    required: ['beatId'],
  },
};

const executeDynamicBoardTool: Tool = {
  name: 'execute_dynamic_board',
  description: `在动态黑板上执行自定义绘图动作（AI偏轨时使用）。

当学生提问超出标准 beat 范围时，用此工具在黑板上画出自定义解释。

Example:
{
  "beatId": "beat-2",
  "actions": [
    { "type": "write", "text": "速度比 = 1.2", "x": 100, "y": 200, "fontSize": 24 },
    { "type": "draw_line", "x1": 80, "y1": 220, "x2": 350, "y2": 220 }
  ]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      beatId: { type: 'string', description: 'Current beat ID' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
          },
          required: ['type'],
        },
        description: 'Array of ChalkboardAction objects',
      },
    },
    required: ['beatId', 'actions'],
  },
};

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      loadLessonTool,
      revealNodesTool,
      highlightNodesTool,
      setPhaseTool,
      writeOutputTool,
      advanceBeatTool,
      executeDynamicBoardTool,
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

      // Sync board state to frontend
      const syncResponse = syncBoardState();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: `课程 "${manifest.title}" 加载成功`,
              lessonId,
              manifest,
              initiallyVisibleNodes: state.visibleNodeIds,
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

  // ── set_phase ─────────────────────────────────────────────────────────
  if (name === 'set_phase') {
    const { phaseId } = args as { phaseId: string };

    try {
      stateManager.setPhase(phaseId);
      return syncBoardState();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: msg }) }],
        isError: true,
      };
    }
  }

  // ── advance_beat ──────────────────────────────────────────────────────
  if (name === 'advance_beat') {
    const { beatId } = args as { beatId: string };
    try {
      const { beatState, beat } = stateManager.advanceBeat(beatId);
      // Apply global board op for this section
      if (beat?.sectionId) {
        stateManager.applyGlobalOp({ nodeId: beat.sectionId, op: 'reveal' });
      }

      const result = {
        status: 'success',
        data: {
          field: 'beatState' as SyncField,
          value: {
            ...beatState,
            // Include extra info for AI
            narratorText: beat?.narratorText ?? '',
            expectedQuestions: beat?.expectedQuestions ?? [],
            dynamicBoardActions: beat?.dynamicBoardActions ?? [],
          },
          preview: `Beat ${beatState.currentBeatIndex + 1}/${beatState.totalBeats}: ${beat?.narratorText?.slice(0, 40) ?? beatId}...`,
        },
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: msg }) }],
        isError: true,
      };
    }
  }

  // ── execute_dynamic_board ─────────────────────────────────────────────
  if (name === 'execute_dynamic_board') {
    const { beatId, actions } = args as { beatId: string; actions: ChalkboardAction[] };
    try {
      const newActions = stateManager.appendDynamicBoardActions(beatId, actions);
      const result = {
        status: 'success',
        data: {
          field: 'dynamicBoardActions' as SyncField,
          value: newActions,
          preview: `动态黑板：${actions.length} 个动作`,
        },
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
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
