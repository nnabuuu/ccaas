# 6.3 MCP Server

## What You Will Build

In this section, you will build the MCP Server for the Task Manager Solution. The MCP Server provides tools that the AI Agent can invoke during conversation -- most importantly, the `write_output` tool that syncs AI-generated data to the frontend form.

By the end of this section, you will have:

- A working MCP Server using the `@modelcontextprotocol/sdk`
- A `write_output` tool with field validation
- Input validation using Zod schemas
- The MCP Server registered in `solution.json`

## Understanding the MCP Server's Role

Recall from the architecture chapter:

```
User → Frontend → CCAAS → AI Agent → MCP Server → (response) → CCAAS → Frontend
```

The MCP Server sits at the end of this chain. When the AI Agent decides to update a form field, it calls `write_output` on the MCP Server. The MCP Server validates the input and returns a structured response. CCAAS then wraps that response into an `output_update` SSE event and pushes it to the frontend.

The MCP Server does **not** directly communicate with the frontend -- CCAAS handles that relay.

## Project Setup

### Directory Structure

```
solutions/task-manager-tutorial/
└── mcp-server/              # ← We are building this
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts          # Server entry point
        └── schemas.ts        # Zod validation schemas
```

### Initialize the Package

```bash
cd solutions/task-manager-tutorial
mkdir -p mcp-server/src
cd mcp-server
```

Create `package.json`:

```json
{
  "name": "task-manager-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
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

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

Install dependencies:

```bash
npm install
```

## Step 1: Define Sync Fields and Types

Create `src/types.ts` with the sync field definitions from Chapter 2:

```typescript
// src/types.ts

export const SYNC_FIELDS = [
  'taskTitle',
  'taskDescription',
  'priority',
  'status',
  'projectId',
  'dueDate',
  'tags',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

export interface WriteOutputInput {
  field: SyncField;
  value: unknown;
  preview?: string;
}

export interface WriteOutputResult {
  data: {
    field?: SyncField;
    value?: unknown;
    preview?: string;
    error?: string;
  };
  status: 'success' | 'error';
}
```

{% hint style="info" %}
The `SYNC_FIELDS` array is the single source of truth for which fields the AI Agent can update. This same list must match the Skill instructions and the frontend handler.
{% endhint %}

## Step 2: Add Zod Validation Schemas

Create `src/schemas.ts` to validate the data the AI Agent sends:

```typescript
// src/schemas.ts

import { z } from 'zod';
import { SYNC_FIELDS, type SyncField } from './types.js';

// Individual field schemas
const fieldSchemas: Record<SyncField, z.ZodType> = {
  taskTitle: z.string().min(1, 'Title cannot be empty').max(200),
  taskDescription: z.string().max(5000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
  projectId: z.string().uuid('Project ID must be a valid UUID'),
  dueDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Due date must be in YYYY-MM-DD format'
  ),
  tags: z.array(z.string().min(1).max(50)).max(20),
};

export interface ValidationResult {
  success: boolean;
  data?: unknown;
  errors: string[];
}

/**
 * Validate a write_output field value against its schema.
 */
export function validateField(
  field: SyncField,
  value: unknown
): ValidationResult {
  const schema = fieldSchemas[field];
  if (!schema) {
    return {
      success: false,
      errors: [`Unknown field: ${field}`],
    };
  }

  const result = schema.safeParse(value);
  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ),
  };
}
```

### Why Validate in the MCP Server?

The AI Agent does not always produce perfectly formatted data. Common issues include:

- Sending a number when a string is expected
- Using an invalid enum value (e.g., `"completed"` instead of `"done"`)
- Missing required fields

By validating in the MCP Server, you catch these issues early. The AI Agent receives a clear error message and can self-correct.

## Step 3: Build the MCP Server

Create `src/index.ts` -- the main server file:

```typescript
#!/usr/bin/env node
// src/index.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  SYNC_FIELDS,
  type SyncField,
  type WriteOutputInput,
  type WriteOutputResult,
} from './types.js';
import { validateField } from './schemas.js';

// Create the MCP server
const server = new Server(
  {
    name: 'task-manager-tools',
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
  description: `Write task data to the frontend form. Updates one field at a time.

Valid fields: ${SYNC_FIELDS.join(', ')}

Field types:
- taskTitle: string (task title, 1-200 characters)
- taskDescription: string (task description, up to 5000 characters)
- priority: "low" | "medium" | "high" | "urgent"
- status: "todo" | "in_progress" | "done" | "cancelled"
- projectId: string (UUID of the project)
- dueDate: string (ISO date format, e.g. "2026-03-15")
- tags: string[] (array of tag strings, e.g. ["frontend", "urgent"])

Example:
{
  "field": "taskTitle",
  "value": "Review API documentation",
  "preview": "Set title"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...SYNC_FIELDS],
        description: 'The task field to update',
      },
      value: {
        description: 'The value for the field',
      },
      preview: {
        type: 'string',
        description: 'Human-readable summary of the change',
      },
    },
    required: ['field', 'value'],
  },
};

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [writeOutputTool] };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'write_output') {
    return handleWriteOutput(args as unknown as WriteOutputInput);
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
  };
});

/**
 * Handle write_output tool calls.
 */
function handleWriteOutput(input: WriteOutputInput) {
  // 1. Check that the field name is valid
  if (!SYNC_FIELDS.includes(input.field)) {
    const result: WriteOutputResult = {
      data: {
        error: `Invalid field: "${input.field}". Valid fields: ${SYNC_FIELDS.join(', ')}`,
      },
      status: 'error',
    };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      isError: true,
    };
  }

  // 2. Validate the value against the field's schema
  const validation = validateField(input.field, input.value);
  if (!validation.success) {
    const result: WriteOutputResult = {
      data: {
        error: `Validation failed for "${input.field}": ${validation.errors.join('; ')}`,
      },
      status: 'error',
    };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      isError: true,
    };
  }

  // 3. Return success with validated data
  const result: WriteOutputResult = {
    data: {
      field: input.field,
      value: validation.data,
      preview: input.preview,
    },
    status: 'success',
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  };
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use stderr for logging since stdout is reserved for MCP protocol
  console.error('Task Manager MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
```

## Step 4: Register in solution.json

The MCP Server must be registered in `solution.json` so CCAAS knows how to launch it:

```json
{
  "mcpServers": {
    "task-manager-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Task Manager MCP tools including write_output",
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

## Step 5: Build and Test

### Build the MCP Server

```bash
cd solutions/task-manager-tutorial/mcp-server
npm run build
```

### Test Manually

You can test the MCP Server locally using the MCP inspector or by piping JSON to stdin:

```bash
# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# Call write_output with a valid field
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_output","arguments":{"field":"taskTitle","value":"Review API docs","preview":"Set title"}}}' | node dist/index.js

# Call write_output with an invalid field
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"write_output","arguments":{"field":"invalid","value":"test"}}}' | node dist/index.js
```

Expected responses:

- **Valid call:** `{ "data": { "field": "taskTitle", "value": "Review API docs" }, "status": "success" }`
- **Invalid field:** `{ "data": { "error": "Invalid field: \"invalid\"..." }, "status": "error" }`

## How write_output Becomes output_update

After your MCP Server returns a successful `write_output` result, here is what happens inside CCAAS:

```
MCP Server returns:
{
  "data": { "field": "taskTitle", "value": "Review API docs" },
  "status": "success"
}
          │
          ▼
CCAAS EventMapper wraps it into an output_update event:
{
  "type": "output_update",
  "sessionId": "abc-123",
  "payload": {
    "data": {
      "field": "taskTitle",
      "value": "Review API docs",
      "operation": "set"
    }
  }
}
          │
          ▼
CCAAS pushes via SSE to the Solution Backend,
which relays to the Frontend.
```

You do not need to implement this relay -- CCAAS handles it automatically. Your MCP Server only needs to return the correct `{ data, status }` response format.

## Adding Custom Tools (Optional)

Beyond `write_output`, you can add domain-specific tools. For the Task Manager, you might add a tool to search existing tasks:

```typescript
const searchTasksTool: Tool = {
  name: 'search_tasks',
  description: 'Search existing tasks by keyword, status, or project',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search keyword',
      },
      status: {
        type: 'string',
        enum: ['todo', 'in_progress', 'done'],
        description: 'Filter by status',
      },
      projectId: {
        type: 'string',
        description: 'Filter by project ID',
      },
    },
  },
};
```

The AI Agent can use this tool to check for duplicate tasks before creating new ones, or to understand the current project context.

## Checkpoint

Before moving to the next section, verify:

- [ ] The MCP Server builds without errors (`npm run build`)
- [ ] `tools/list` returns the `write_output` tool with correct field descriptions
- [ ] Valid `write_output` calls return `{ status: "success" }` with the field and value
- [ ] Invalid field names return `{ status: "error" }` with a clear error message
- [ ] Invalid values (e.g., `priority: "critical"`) return a validation error

## Common Mistakes

### 1. Logging to stdout

```typescript
// Wrong: stdout is reserved for MCP protocol
console.log('Server started');

// Correct: use stderr for logging
console.error('Server started');
```

### 2. Forgetting to build before running

The `solution.json` points to `dist/index.js`. If you modify `src/index.ts` but forget to run `npm run build`, CCAAS will launch the old version.

### 3. Mismatched field names

If your MCP Server validates `taskTitle` but the Skill instructions say `title`, the AI Agent will send `title` and get a validation error. Keep the `SYNC_FIELDS` array as the single source of truth and reference it in both the MCP Server and the Skill.

## Summary

In this section you built:

- An MCP Server using `@modelcontextprotocol/sdk` with stdio transport
- A `write_output` tool that validates field names and values
- Zod schemas for input validation
- Proper error handling that helps the AI Agent self-correct

The MCP Server is the bridge between the AI Agent's intent and the frontend form. In the next section, we will write the **Skills** -- the instructions that tell the AI Agent *how* to use these tools.

---

**Next:** [6.4 Skills](04-skills.md)
**Previous:** [6.2 Backend Implementation](02-backend.md)
