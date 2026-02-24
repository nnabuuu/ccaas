# MCP Server Development

## What is an MCP Server

An MCP (Model Context Protocol) Server provides external tools to the AI Agent. During task execution, the AI Agent can invoke tools exposed by the MCP Server to perform specific operations such as searching data, calling external APIs, or generating files.

## When to Use This

The core question: **does your agent need data access or operational capabilities it doesn't have on its own?**

**You need an MCP Server when:**
- The agent needs to query your private data (textbook content, student records, product catalog)
- Your solution uses `write_output` — this tool must be exposed through an MCP Server
- The agent needs to call external APIs (search services, databases, third-party platforms)
- You need business-layer validation of agent outputs (Zod schema enforcement)

**You don't need an MCP Server when:**
- The agent only does reasoning and generation — no external data access required
- You're using only Claude's built-in tools (file system, web search, etc.)
- It's a fully conversational solution with no structured output

If you're building a lesson plan designer that searches curriculum standards and populates a form, you need an MCP Server. If you're building a Q&A bot that answers questions from its training knowledge, you don't.

## Two Implementation Approaches

| Approach | Description | Use Case |
|----------|-------------|----------|
| **stdio (MCP SDK)** | Communication via standard input/output using `@modelcontextprotocol/sdk` | Recommended -- native MCP protocol, managed by CCAAS |
| **REST API** | HTTP endpoints called via the CCAAS REST adapter | Alternative -- for wrapping existing external HTTP services |

{% hint style="info" %}
The CCAAS platform recommends the **stdio approach** using `@modelcontextprotocol/sdk`. CCAAS manages the MCP Server process lifecycle directly -- no separate deployment or health checks needed.
{% endhint %}

## stdio Approach with MCP SDK (Recommended)

### Project Structure

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts       # Server entry point and tool definitions
│   ├── types.ts       # Sync field types
│   └── schemas.ts     # Zod validation schemas
└── dist/              # Compiled output
```

### Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

### Basic Template

```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// Create the MCP server
const server = new Server(
  {
    name: 'my-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Define the write_output tool
const writeOutputTool: Tool = {
  name: 'write_output',
  description: 'Output structured data to the frontend form',
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        description: 'Name of the field to update',
      },
      value: {
        description: 'Field value',
      },
      preview: {
        type: 'string',
        description: 'Human-readable summary shown on the sync button',
      },
    },
    required: ['field', 'value'],
  },
}

// Define a custom domain tool
const searchDataTool: Tool = {
  name: 'search_data',
  description: 'Search domain data by keyword',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search keyword',
      },
    },
    required: ['query'],
  },
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [writeOutputTool, searchDataTool] }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'write_output') {
    const { field, value, preview } = args as {
      field: string
      value: unknown
      preview?: string
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { field, value, preview },
          status: 'success',
        }),
      }],
    }
  }

  if (name === 'search_data') {
    const { query } = args as { query: string }
    const results = performSearch(query) // Your business logic

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: results,
          status: 'success',
        }),
      }],
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        data: { error: `Unknown tool: ${name}` },
        status: 'error',
      }),
    }],
    isError: true,
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Use stderr for logging -- stdout is reserved for MCP protocol
  console.error('MCP Server started')
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})
```

### Real Example: Lesson Plan Designer MCP Server

The lesson-plan-designer solution provides a production MCP Server with multiple tools. Here is a simplified view of its structure:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'lesson-plan-designer', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// Domain tools for searching textbooks and curriculum standards
const searchTextbookTool: Tool = {
  name: 'search_textbook',
  description: 'Search textbook chapters and content by subject, grade, or keyword',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Subject to filter by' },
      gradeLevel: { type: 'string', description: 'Grade level to filter by' },
      keyword: { type: 'string', description: 'Keyword to search' },
    },
  },
}

const getTextbookChaptersTool: Tool = {
  name: 'get_textbook_chapters',
  description: 'Get the chapter tree for a specific textbook edition from real data',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Subject name' },
      grade: { type: 'number', description: 'Grade number (1-9)' },
      volume: { type: 'string', description: 'Volume name' },
    },
    required: ['subject', 'grade', 'volume'],
  },
}

// Register all tools including write_output and domain tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      writeOutputTool,
      searchTextbookTool,
      getTextbookChaptersTool,
      // ... more domain tools
    ],
  }
})
```

Key patterns from this real implementation:

- **write_output** for syncing AI-generated data to the frontend form
- **Domain-specific tools** (search_textbook, get_textbook_chapters) for data retrieval
- **Zod validation** on write_output fields to catch AI formatting errors early
- **stderr for logging** since stdout is reserved for MCP protocol

### Registering in solution.json

Register the stdio MCP Server in `solution.json` so CCAAS launches and manages it:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "MCP tools including write_output",
      "type": "stdio",
      "env": {}
    }
  }
}
```

Key fields:

| Field | Description |
|-------|-------------|
| `command` | The command to run (`node`) |
| `args` | Arguments to the command (path to compiled JS) |
| `type` | Communication protocol (`stdio` for standard I/O) |
| `env` | Environment variables passed to the process |

{% hint style="warning" %}
The `args` path points to `dist/index.js`, not `src/index.ts`. You must build the MCP Server before running it: `npm run build`.
{% endhint %}

## REST API Approach (Alternative for External Services)

Use the REST API approach when you need to wrap an existing external HTTP service as an MCP tool. This is useful for integrating third-party APIs that are already deployed as HTTP endpoints.

### Project Structure

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts       # Tool definitions and Express server
└── dist/              # Compiled output
```

### Basic Template

```typescript
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// write_output tool
app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body

  res.json({
    data: { field, value, operation },
    status: 'success'
  })
})

// Custom tool example
app.post('/tools/search_data', (req, res) => {
  const { query } = req.body

  // Business logic
  const results = performSearch(query)

  res.json({
    data: results,
    status: 'success'
  })
})

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
})
```

### REST Adapter Endpoint Definition

When registering a REST-based MCP Server with CCAAS, you need to define the endpoint format:

```typescript
interface McpEndpoint {
  name: string          // Tool name
  description: string   // Tool description (read by the AI)
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string          // Endpoint path
  parameters: {
    name: string
    type: string
    description: string
    required: boolean
    in: 'body' | 'query' | 'path'
  }[]
}
```

### REST Adapter Configuration in solution.json

```json
{
  "mcpServers": {
    "my-tools": {
      "type": "rest-adapter",
      "url": "http://localhost:3004",
      "endpoints": [
        {
          "name": "write_output",
          "description": "Output structured data to the frontend",
          "method": "POST",
          "path": "/tools/write_output",
          "parameters": [
            {
              "name": "field",
              "type": "string",
              "description": "Name of the field to update",
              "required": true,
              "in": "body"
            },
            {
              "name": "value",
              "type": "string",
              "description": "Field value",
              "required": true,
              "in": "body"
            }
          ]
        }
      ]
    }
  }
}
```

## Tool Event Triggers (toolEventTriggers)

By default, the frontend only receives an `output_update` event when the AI calls `write_output`. If your tool performs an action that should also notify the frontend, you can declare `toolEventTriggers` in `solution.json` — no changes to MCP Server code required.

### Configuration

Add `toolEventTriggers` under the relevant MCP Server in `solution.json`:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "toolEventTriggers": [
        { "toolName": "advance_beat", "eventType": "output_update" },
        { "toolName": "execute_dynamic_board", "eventType": "output_update" }
      ]
    }
  }
}
```

Whenever the AI Agent calls `advance_beat` or `execute_dynamic_board` and receives a result, the platform automatically emits an `output_update` event to the frontend.

### ToolEventTrigger Fields

| Field | Type | Description |
|-------|------|-------------|
| `toolName` | string | Name of the MCP tool to watch |
| `eventType` | `"output_update"` | Frontend event to emit (currently only `output_update` is supported) |

### vs. write\_output

| | `write_output` | `toolEventTriggers` |
|---|---|---|
| **How triggered** | MCP Server calls explicitly | Platform watches tool results automatically |
| **Data payload** | Carries field/value to update | Signals frontend to re-fetch data |
| **Best for** | AI-generated content into forms | State changes, action completion notifications |
| **Where configured** | MCP Server code | `solution.json` (no restart needed) |

{% hint style="info" %}
Triggers are registered automatically at startup from `solution.json`. Admins can also update triggers at runtime via `PUT /api/v1/admin/mcp-servers/:id` — changes take effect immediately without restarting the backend.
{% endhint %}

---

## write\_output Tool

`write_output` is the most important MCP tool, used to synchronize AI-generated structured data to frontend forms.

### Basic Usage

When the AI Agent calls write\_output, it passes a field name and value:

```json
{
  "field": "title",
  "value": "Calculating Triangle Area",
  "operation": "set"
}
```

### Operation Types

| Operation | Description |
|-----------|-------------|
| `set` | Overwrite the field value (default) |
| `append` | Append to the existing value |
| `merge` | Merge objects |

For detailed usage, see [write\_output Best Practices](write-output.md).

## Authentication Configuration

The REST adapter supports multiple authentication methods:

```json
{
  "auth": {
    "type": "api-key",
    "header": "X-API-Key",
    "value": "${MY_API_KEY}"
  }
}
```

Supported authentication types:
- **api-key** -- Pass an API key via a custom header
- **bearer** -- Bearer token authentication
- **basic** -- HTTP Basic Auth
- **oauth2** -- OAuth2 authentication flow

## Debugging Tips

1. **stderr logging** -- Use `console.error()` for logging in stdio servers since stdout is reserved for MCP protocol
2. **MCP Inspector** -- Use `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js` to test tool listing
3. **Check logs** -- MCP Server logs are your primary resource for troubleshooting
4. **Verify registration** -- Confirm that the MCP Server is correctly registered in `solution.json`
5. **Build first** -- Always run `npm run build` after code changes since `solution.json` points to `dist/`

### Testing stdio Servers

```bash
# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# Call write_output
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_output","arguments":{"field":"title","value":"Test Title","preview":"Set title"}}}' | node dist/index.js
```

### Testing REST Servers

```bash
# Health check
curl http://localhost:3004/health

# Test tool invocation
curl -X POST http://localhost:3004/tools/write_output \
  -H "Content-Type: application/json" \
  -d '{"field": "title", "value": "Test Title"}'

# Verify registration
curl http://localhost:3001/api/v1/mcp-servers
```
