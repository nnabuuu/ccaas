/**
 * `emit_todo_card` re-expressed as an ontology ActionDef.
 *
 * Same wire shape as the legacy stdio MCP tool
 * (`creator-mcp-server/src/tools/todo.ts`): handler returns
 * `{ kind: 'todo', title, summary, items }`, which the platform's
 * `EventMapperService` wraps into an `output_update(card)` SSE event
 * (the trigger config in solution.json matches by local name
 * `emit_todo_card`, and EventMapperService's suffix-match
 * — `<ns>.emit_todo_card` or `<ns>_emit_todo_card` — fires regardless
 * of which namespace registers it).
 *
 * The ActionDef path is registered alongside (NOT replacing) the stdio
 * path, under namespace `creator-actions` so both tools coexist on
 * `live-lesson` while the migration plays out. See
 * docs/ontology/PROGRESS.md for the rollout shape.
 */

import { z } from 'zod';
import { defineAction, type ActionDef } from '@kedge-agentic/ontology';
import type {
  ToolInvocation,
  ToolResult,
} from '@kedge-agentic/backend/tool-caller/types';

const TodoItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean().optional(),
});

const TodoCardArgsSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  items: z.array(TodoItemSchema),
});

export const EmitTodoCardAction: ActionDef = defineAction({
  apiName: 'emit_todo_card',
  displayName: '弹出待办卡 / Emit Todo Card',
  semantic: '在学生界面弹出 todo card（清单卡片）。供 agent 引导学生执行多步任务时使用。',
  params: TodoCardArgsSchema,
  sideEffects: ['emits:TodoCard'],
  allowedRoles: ['agent'],
  auditLevel: 'log',
});

/**
 * Handler — accepts the validated args and returns a content block
 * whose JSON encodes the same `{kind:'todo',...}` shape the stdio
 * handler emits, so `EventMapperService` routing works identically.
 */
export const emitTodoCardHandler = async (
  invocation: ToolInvocation,
): Promise<ToolResult> => {
  const args = invocation.args as z.infer<typeof TodoCardArgsSchema>;
  const card = {
    kind: 'todo' as const,
    title: args.title,
    summary: args.summary,
    items: args.items,
  };
  return {
    ok: true,
    content: [{ type: 'text', text: JSON.stringify(card) }],
  };
};
