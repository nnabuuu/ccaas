#!/usr/bin/env node

/**
 * Live-Lesson Creator MCP Server.
 *
 * Exposes 3 stdio tools (`emit_todo_card`, `emit_questions_card`,
 * `emit_verify_card`) that the ccaas agent invokes when it wants to
 * render a structured progress / clarification / verification card
 * in the creator app's chat panel — rather than emitting more text.
 *
 * Data flow:
 *   1. LLM calls tool with card-shaped input
 *   2. Tool validates with Zod + wraps result as
 *      `{ kind: '...', ...validatedInput }` and JSON-stringifies it
 *      into the MCP `text` content
 *   3. ccaas-core's EventMapperService sees the tool name matches a
 *      registered `toolEventTriggers` entry (declared in
 *      `solution.json`), parses the text as JSON, wraps it as
 *      `{ field: 'card', value: <parsed> }` (the `field` config name
 *      becomes the `field` key, NOT a top-level key — confirmed
 *      against `event-mapper.service.ts:1376-1377`), and emits SSE
 *      `{ type: 'output_update', payload: { data: { field, value }, status, ...} }`
 *   4. Frontend `useAgentChat` reads `payload.data.value` when
 *      `payload.data.field === 'card'`, then routes on
 *      `value.kind` to the right React component
 *
 * Conventions mirrored from sibling `mcp-server/` (classroom):
 *  - ES modules + Node16 module resolution
 *  - All logging via `console.error('[creator-mcp-server] ...')` so
 *    the MCP stdio protocol on stdout stays clean
 *  - Handler dispatch via name switch inside `CallToolRequestSchema`
 *    request handler; tools as static `Tool` objects (not decorators)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { emitTodoCardTool, handleEmitTodoCard } from './tools/todo.js'
import {
  emitQuestionsCardTool,
  handleEmitQuestionsCard,
} from './tools/questions.js'
import { emitVerifyCardTool, handleEmitVerifyCard } from './tools/verify.js'

const server = new Server(
  {
    name: 'live-lesson-creator-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [emitTodoCardTool, emitQuestionsCardTool, emitVerifyCardTool],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  try {
    switch (name) {
      case 'emit_todo_card':
        return handleEmitTodoCard(args)
      case 'emit_questions_card':
        return handleEmitQuestionsCard(args)
      case 'emit_verify_card':
        return handleEmitVerifyCard(args)
      default:
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                status: 'error',
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        }
    }
  } catch (err) {
    // Zod parse failures + any other handler throw end up here. Echo
    // the error message back so the LLM can read it + retry with
    // corrected input on its next turn.
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        : err instanceof Error
          ? err.message
          : String(err)
    console.error(`[creator-mcp-server] tool ${name} failed: ${message}`)
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ status: 'error', error: message }),
        },
      ],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[creator-mcp-server] started')

  // Graceful shutdown — ccaas-core SIGTERMs the stdio child on
  // session end. Without explicit handlers the in-flight handler is
  // killed mid-`parse()` with no log line, which makes mystery
  // disconnects look like crashes. The classroom sibling has the
  // same gap; doing it right here as the convention.
  const shutdown = (signal: string) => {
    console.error(`[creator-mcp-server] received ${signal}, closing transport`)
    server
      .close()
      .catch((err) => console.error('[creator-mcp-server] close error:', err))
      .finally(() => process.exit(0))
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[creator-mcp-server] fatal:', err)
  process.exit(1)
})
