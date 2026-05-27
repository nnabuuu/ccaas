import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { TodoDataSchema } from '../schemas.js'

export const emitTodoCardTool: Tool = {
  name: 'emit_todo_card',
  description: `在 chat 面板插入结构化任务进度卡, 展示 AI 正在执行的多步骤工作的里程碑。

适用场景: AI 接到多阶段产出请求时, 用这个工具让教师看到分阶段进度而非长段文字。 典型例子: "生成 5 个 Step → 配 Rubric → 校验 Schema"。

数据形状: title (卡片标题) + items 数组 (每项含 label + status: done/active/pending/error + 可选 detail)。 调用后教师会看到一个可折叠的任务列表卡片, 头部根据完成度切换颜色 (purple → blue → green)。

注意: 这个工具*不会*真的执行那些 step —— 它只是渲染进度。 你应该在真正完成每一步后再次调用本工具 (或一次性把所有 step 标好 status)。`,
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '卡片标题, 简明描述这组任务做什么。 例: "执行设计生成"',
      },
      summary: {
        type: 'string',
        description: '可选副标题, 1 句话概括。 例: "根据教案自动生成 5 个 Step、13 个模块"',
      },
      items: {
        type: 'array',
        minItems: 1,
        description: '任务列表, 每项一个独立的子步骤',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '任务唯一 id, 如 "t1"' },
            label: { type: 'string', description: '任务名称, 教师可读' },
            status: {
              type: 'string',
              enum: ['done', 'active', 'pending', 'error'],
              description: 'done=已完成 / active=进行中 (会有呼吸动画) / pending=待处理 / error=出错',
            },
            detail: { type: 'string', description: '可选补充说明, 1 行' },
          },
          required: ['id', 'label', 'status'],
        },
      },
    },
    required: ['title', 'items'],
  },
}

/**
 * Validate input + wrap with discriminator. Throws ZodError on invalid
 * input (handler catches + returns isError). Result is JSON-stringified
 * into the MCP `text` content; ccaas-core re-parses it as the
 * structured payload and wraps it as `{ field: 'card', value: <parsed> }`
 * per the `toolEventTriggers[].field: 'card'` config in solution.json.
 * The frontend's `useAgentChat` reads `payload.data.value` when
 * `payload.data.field === 'card'` and routes on `value.kind` to the
 * right card component (see `event-mapper.service.ts:1376-1377`).
 */
export function handleEmitTodoCard(args: unknown): { content: { type: 'text'; text: string }[] } {
  const parsed = TodoDataSchema.parse(args)
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ kind: 'todo' as const, ...parsed }),
      },
    ],
  }
}
